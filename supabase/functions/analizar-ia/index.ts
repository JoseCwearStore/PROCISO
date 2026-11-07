// Edge Function analizar-ia: preevaluación de un documento o una evidencia
// contra criterios del catálogo, con el proveedor de IA configurado.
//
// DELGADA: las reglas viven en la BD (quién pide, qué se puede analizar) y la
// lógica de IA en _compartido/analisis.ts (probada con Vitest).
//   1. Con el TOKEN DEL USUARIO crea el pedido (el RLS exige ser del equipo).
//   2. Con el mismo token lee criterios y fuente (el RLS decide qué ve).
//   3. Extrae → arma el pedido → llama al proveedor (puerto) → interpreta.
//   4. Con la clave secreta registra "Completado" o "Error" con el motivo.
//
// Configuración (supabase/functions/.env en local; `supabase secrets set` desplegado):
//   IA_PROVEEDOR=openai-compatible   (por ahora el único adaptador)
//   IA_BASE_URL=https://ollama.com/v1
//   IA_MODELO=gpt-oss:120b-cloud
//   IA_API_KEY=…                     (nunca en el repo ni en el navegador)
//   IA_VISION=false                  (true si el modelo acepta imágenes)

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import {
  armarMensajes,
  crearAnalizadorCompatibleOpenAI,
  ErrorIA,
  interpretarRespuesta,
  type AnalizadorIA,
  type CriterioIA,
  type FuenteIA,
} from '../_compartido/analisis.ts'
import { extraerArchivo, extraerDocumento } from './extractores.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const responder = (status: number, cuerpo: Record<string, unknown>) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const estadoDe = (code?: string) =>
  code === '42501' ? 403 : code === '22023' || code === '23503' || code === '23514' ? 400 : 500

interface Pedido {
  consultoriaId: string
  proyectoId: string
  fuenteTipo: 'documento' | 'evidencia'
  documentoId?: string | null
  evidenciaId?: string | null
  criterioIds: string[]
}

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

  let pedido: Pedido
  try {
    pedido = await req.json()
  } catch {
    return responder(400, { error: 'Cuerpo inválido' })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const comoUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: token } },
    auth: { persistSession: false },
  })
  const conClaveSecreta = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  // 1. El pedido. Si no es del equipo del proyecto, el RLS lo rechaza acá.
  const { data: analisis, error: errorPedido } = await comoUsuario
    .from('analisis_ia')
    .insert({
      consultoria_id: pedido.consultoriaId,
      proyecto_id: pedido.proyectoId,
      fuente_tipo: pedido.fuenteTipo,
      documento_id: pedido.fuenteTipo === 'documento' ? pedido.documentoId : null,
      evidencia_id: pedido.fuenteTipo === 'evidencia' ? pedido.evidenciaId : null,
      criterio_ids: pedido.criterioIds,
    })
    .select('id')
    .single()
  if (errorPedido) return responder(estadoDe(errorPedido.code), { error: errorPedido.message, code: errorPedido.code })

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
        .from('evidencias').select('nombre, archivo_ruta, archivo_mime').eq('id', pedido.evidenciaId).single()
      if (error || !ev) throw new ErrorIA('No se pudo leer la evidencia.')
      if (!ev.archivo_ruta) throw new ErrorIA('La evidencia no tiene archivo adjunto.')
      const { data: archivo, error: errorArchivo } = await comoUsuario.storage.from('evidencias').download(ev.archivo_ruta)
      if (errorArchivo || !archivo) throw new ErrorIA('No se pudo descargar el archivo de la evidencia.')
      nombre = ev.nombre
      const mime = ev.archivo_mime || archivo.type || 'application/octet-stream'
      fuente = await extraerArchivo(new Uint8Array(await archivo.arrayBuffer()), mime, Deno.env.get('IA_VISION') === 'true')
    }

    // 3. Proveedor (puerto) → respuesta → resultados por criterio.
    const configurado = crearAnalizador()
    proveedor = configurado.proveedor
    modelo = configurado.modelo
    const respuesta = await configurado.analizador.completar(armarMensajes(criterios as CriterioIA[], fuente, nombre))
    const { resumen, resultados } = interpretarRespuesta(respuesta, criterios as CriterioIA[])

    // 4. Registrar.
    const { error: errorRegistro } = await registrar('Completado', { resumen, resultados })
    if (errorRegistro) throw new ErrorIA(`No se pudo guardar el resultado: ${errorRegistro.message}`)
    return responder(200, { id: analisis.id, estado: 'Completado' })
  } catch (e) {
    // Cualquier falla queda registrada con su motivo: así se puede actuar.
    const motivo = e instanceof ErrorIA ? e.message : `Error inesperado: ${e instanceof Error ? e.message : String(e)}`
    await registrar('Error', { error: motivo })
    return responder(200, { id: analisis.id, estado: 'Error', error: motivo })
  }
})
