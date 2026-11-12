// Edge Function analizar-ia: preevaluación de un documento o una evidencia
// contra criterios del catálogo, con el proveedor de IA configurado.
//
// DELGADA: las reglas viven en la BD (quién pide, qué se puede analizar, topes de uso) y
// la lógica de IA en _compartido/ (probada con Vitest).
//   0. Valida la FORMA del pedido y cierra los pedidos huérfanos (Pendiente viejos).
//   1. Con el TOKEN DEL USUARIO crea el pedido (el RLS exige ser del equipo; un trigger
//      aplica el tope diario de pedidos a la IA).
//   2. Con el mismo token lee criterios y fuente (el RLS decide qué ve).
//   3. Extrae → arma el pedido → llama al proveedor (puerto, con timeout) → interpreta.
//   4. Con la clave secreta registra "Completado" o "Error" con un motivo SANEADO.
//
// Configuración (supabase/functions/.env en local; `supabase secrets set` desplegado):
//   IA_PROVEEDOR=openai-compatible   (por ahora el único adaptador)
//   IA_BASE_URL=https://ollama.com/v1
//   IA_MODELO=gpt-oss:120b-cloud
//   IA_API_KEY=…                     (nunca en el repo ni en el navegador)
//   IA_VISION=false                  (true si el modelo acepta imágenes)
//   IA_MAX_CARACTERES=18000          (opcional: recorta el documento; por defecto 60000. Para un proveedor con tope
//                                     de tokens por pedido, p. ej. plan gratis de Groq (8000 por pedido), 18000 es lo seguro)
//   (La transcripción de audio y video la hace transcribir-evidencia; acá se analiza el texto guardado.)
//   CORS_ORIGEN=https://…            (en producción; sin él queda `*`)

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import {
  armarMensajes,
  crearAnalizadorCompatibleOpenAI,
  ErrorIA,
  interpretarRespuesta,
  limiteDeCaracteres,
  validarPedidoAnalisis,
  verificarTamanoArchivo,
  type AnalizadorIA,
  type CriterioIA,
  type FuenteIA,
} from '../_compartido/analisis.ts'
import { crearCors, estadoDe, mensajeDeBD, motivoSaneado, responderCon } from '../_compartido/http.ts'
import { esMediaTranscribible, fuenteDeTranscripcion } from '../_compartido/transcripcion.ts'
import { extraerArchivo, extraerDocumento } from './extractores.ts'

const CORS = crearCors(Deno.env.get('CORS_ORIGEN'))
const responder = responderCon(CORS)

function crearAnalizador(): { analizador: AnalizadorIA; proveedor: string; modelo: string } {
  const proveedor = Deno.env.get('IA_PROVEEDOR') ?? 'openai-compatible'
  const modelo = Deno.env.get('IA_MODELO') ?? ''
  if (proveedor !== 'openai-compatible') throw new ErrorIA(`Proveedor de IA no soportado todavía: "${proveedor}".`)
  return {
    proveedor,
    modelo,
    analizador: crearAnalizadorCompatibleOpenAI({
      baseUrl: Deno.env.get('IA_BASE_URL') ?? '',
      apiKey: Deno.env.get('IA_API_KEY') ?? '',
      modelo,
    }),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder(405, { error: 'Método no permitido' })
  const token = req.headers.get('Authorization')
  if (!token) return responder(401, { error: 'Sesión requerida' })

  // 0. La forma del pedido, antes de tocar la BD (AUD04-B2: 400 claro, sin texto interno).
  let pedido
  try {
    pedido = validarPedidoAnalisis(await req.json())
  } catch (e) {
    return responder(400, { error: e instanceof ErrorIA ? e.message : 'Cuerpo inválido' })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const comoUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: token } },
    auth: { persistSession: false },
  })
  const conClaveSecreta = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  // Pedidos que se quedaron "Pendiente" (función caída, proveedor colgado) pasan a Error.
  // Es limpieza: si falla no se frena el pedido (AUD04-B4).
  const { error: errorBarrido } = await conClaveSecreta.rpc('cerrar_pedidos_ia_huerfanos')
  if (errorBarrido) console.error('[analizar-ia] no se pudo cerrar pedidos huérfanos:', errorBarrido)

  // 1. El pedido. Si no es del equipo del proyecto, el RLS lo rechaza acá; si ya pidió
  //    demasiado hoy, el trigger del tope lo rechaza (429).
  const { data: analisis, error: errorPedido } = await comoUsuario
    .from('analisis_ia')
    .insert({
      consultoria_id: pedido.consultoriaId,
      proyecto_id: pedido.proyectoId,
      fuente_tipo: pedido.fuenteTipo,
      documento_id: pedido.documentoId,
      evidencia_id: pedido.evidenciaId,
      criterio_ids: pedido.criterioIds,
    })
    .select('id')
    .single()
  if (errorPedido) {
    console.error('[analizar-ia] no se pudo registrar el pedido:', errorPedido)
    return responder(estadoDe(errorPedido.code), { error: mensajeDeBD(errorPedido), code: errorPedido.code })
  }

  let proveedor = Deno.env.get('IA_PROVEEDOR') ?? 'openai-compatible'
  let modelo = Deno.env.get('IA_MODELO') ?? ''
  const registrar = (estado: 'Completado' | 'Error', datos: { resumen?: string | null; error?: string; resultados?: unknown[] }) =>
    conClaveSecreta.rpc('registrar_resultado_analisis', {
      p_analisis_id: analisis.id,
      p_estado: estado,
      p_resumen: datos.resumen ?? null,
      p_error: datos.error ?? null,
      p_proveedor: proveedor,
      p_modelo: modelo,
      p_resultados: datos.resultados ?? [],
    })

  try {
    // 2. Criterios y fuente, con el token del usuario (el RLS decide).
    const { data: criterios, error: errorCriterios } = await comoUsuario
      .from('criterios_evaluacion')
      .select('id, clausula, titulo, intencion, evidencia_esperada, preguntas, senales_de_hueco, orden')
      .in('id', pedido.criterioIds)
      .order('orden')
    if (errorCriterios || !criterios?.length) throw new ErrorIA('No se pudieron leer los criterios pedidos.')

    let fuente: FuenteIA
    let nombre: string
    if (pedido.fuenteTipo === 'documento') {
      const { data: doc, error } = await comoUsuario.from('documentos').select('nombre, secciones').eq('id', pedido.documentoId).single()
      if (error || !doc) throw new ErrorIA('No se pudo leer el documento.')
      nombre = doc.nombre
      fuente = extraerDocumento(doc.secciones)
    } else {
      const { data: ev, error } = await comoUsuario
        .from('evidencias').select('nombre, tipo, archivo_ruta, archivo_mime').eq('id', pedido.evidenciaId).single()
      if (error || !ev) throw new ErrorIA('No se pudo leer la evidencia.')
      nombre = ev.nombre
      const mimeDeclarado = ev.archivo_mime ?? ''
      if (ev.tipo === 'Audio' || ev.tipo === 'Video' || esMediaTranscribible(mimeDeclarado)) {
        // Audio y video: se analiza la transcripción GUARDADA (la que el equipo pudo corregir), no se
        // vuelve a transcribir: lo que se analiza es lo que una persona vio. El RLS decide si la ve.
        const { data: transcripcion, error: errorTranscripcion } = await comoUsuario
          .from('transcripciones').select('texto, corregida_en').eq('evidencia_id', pedido.evidenciaId).maybeSingle()
        if (errorTranscripcion) throw new ErrorIA('No se pudo leer la transcripción.')
        fuente = fuenteDeTranscripcion(transcripcion, ev.tipo === 'Video' || mimeDeclarado.startsWith('video/'))
      } else {
        if (!ev.archivo_ruta) throw new ErrorIA('La evidencia no tiene archivo adjunto.')
        const { data: archivo, error: errorArchivo } = await comoUsuario.storage.from('evidencias').download(ev.archivo_ruta)
        if (errorArchivo || !archivo) throw new ErrorIA('No se pudo descargar el archivo de la evidencia.')
        const mime = mimeDeclarado || archivo.type || 'application/octet-stream'
        // AUD04-B5: se acota el tamaño ANTES de cargarlo en memoria y parsearlo.
        verificarTamanoArchivo({ length: archivo.size }, mime)
        fuente = await extraerArchivo(new Uint8Array(await archivo.arrayBuffer()), mime, Deno.env.get('IA_VISION') === 'true')
      }
    }

    // 3. Proveedor (puerto) → respuesta → resultados por criterio.
    const configurado = crearAnalizador()
    proveedor = configurado.proveedor
    modelo = configurado.modelo
    const respuesta = await configurado.analizador.completar(armarMensajes(criterios as CriterioIA[], fuente, nombre, undefined, limiteDeCaracteres(Deno.env.get('IA_MAX_CARACTERES'))))
    const { resumen, resultados } = interpretarRespuesta(respuesta, criterios as CriterioIA[])

    // 4. Registrar.
    const { error: errorRegistro } = await registrar('Completado', { resumen, resultados })
    if (errorRegistro) {
      console.error('[analizar-ia] no se pudo guardar el resultado:', errorRegistro)
      throw new ErrorIA('No se pudo guardar el resultado.')
    }
    // Se devuelve el análisis completo: la pantalla lo muestra sin otra consulta.
    return responder(200, { id: analisis.id, estado: 'Completado', resumen, proveedor, modelo, resultados })
  } catch (e) {
    // Cualquier falla queda registrada con un motivo SANEADO (lo lee el cliente, AUD04-B3);
    // el detalle técnico real va solo al log del servidor.
    console.error('[analizar-ia] falló el análisis:', e)
    const motivo = motivoSaneado(e)
    await registrar('Error', { error: motivo })
    return responder(200, { id: analisis.id, estado: 'Error', error: motivo, proveedor, modelo, resultados: [] })
  }
})
