// Edge Function generar-documento: redacta con IA partes de un borrador documental
// (la declaración de la política, del alcance, los objetivos…) a partir de las
// respuestas del cuestionario guiado.
//
// DELGADA y GENÉRICA: no conoce las plantillas (las define la pantalla). Las reglas
// viven en la BD y la lógica de IA en _compartido/ (probada con Vitest).
//   1. Valida el pedido (tamaños acotados: gasta la clave de IA de la consultoría) y cierra
//      los pedidos huérfanos (Pendiente viejos).
//   2. Con el TOKEN DEL USUARIO registra el pedido en generaciones_ia: el RLS exige ser
//      del equipo del proyecto y un trigger aplica el tope diario. Sin ese registro no se
//      llama a la IA.
//   3. Arma el pedido → llama al proveedor (puerto, con timeout) → interpreta.
//   4. Con la clave secreta deja "Completado" o "Error" con un motivo SANEADO.
//
// Una falla de la IA NO es un error HTTP: vuelve como estado "Error" con su motivo, y la
// pantalla genera igual el borrador con las respuestas del usuario (plan B).
//
// Configuración: la misma que analizar-ia (supabase/functions/.env en local):
//   IA_PROVEEDOR, IA_BASE_URL, IA_MODELO, IA_API_KEY, CORS_ORIGEN.

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { crearAnalizadorCompatibleOpenAI, ErrorIA, type AnalizadorIA } from '../_compartido/analisis.ts'
import { armarMensajesGeneracion, interpretarGeneracion, validarPedido } from '../_compartido/generacion.ts'
import { crearCors, esUuid, estadoDe, mensajeDeBD, motivoSaneado, responderCon } from '../_compartido/http.ts'

const CORS = crearCors(Deno.env.get('CORS_ORIGEN'))
const responder = responderCon(CORS)

function crearProveedor(): { analizador: AnalizadorIA; proveedor: string; modelo: string } {
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

  let cuerpo: Record<string, unknown>
  try {
    cuerpo = await req.json()
  } catch {
    return responder(400, { error: 'Cuerpo inválido' })
  }

  // 1. Validar antes de gastar nada (AUD04-B2: 400 claro, sin texto interno de la BD).
  let datos
  try {
    datos = validarPedido(cuerpo)
  } catch (e) {
    return responder(400, { error: e instanceof ErrorIA ? e.message : 'Pedido inválido' })
  }
  if (!esUuid(cuerpo.consultoriaId) || !esUuid(cuerpo.proyectoId)) {
    return responder(400, { error: 'consultoriaId y proyectoId deben ser identificadores válidos.' })
  }
  const plantillaId = typeof cuerpo.plantillaId === 'string' ? cuerpo.plantillaId.trim() : ''

  const url = Deno.env.get('SUPABASE_URL')!
  const comoUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: token } },
    auth: { persistSession: false },
  })
  const conClaveSecreta = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  // Pedidos que se quedaron "Pendiente" pasan a Error. Es limpieza: si falla no frena el
  // pedido (AUD04-B4).
  const { error: errorBarrido } = await conClaveSecreta.rpc('cerrar_pedidos_ia_huerfanos')
  if (errorBarrido) console.error('[generar-documento] no se pudo cerrar pedidos huérfanos:', errorBarrido)

  // 2. El registro del pedido. Si no es del equipo del proyecto, el RLS lo rechaza acá; si
  //    ya pidió demasiado hoy, el trigger del tope lo rechaza (429).
  const { data: generacion, error: errorPedido } = await comoUsuario
    .from('generaciones_ia')
    .insert({ consultoria_id: cuerpo.consultoriaId, proyecto_id: cuerpo.proyectoId, plantilla: plantillaId })
    .select('id')
    .single()
  if (errorPedido) {
    console.error('[generar-documento] no se pudo registrar el pedido:', errorPedido)
    return responder(estadoDe(errorPedido.code), { error: mensajeDeBD(errorPedido), code: errorPedido.code })
  }

  let proveedor = Deno.env.get('IA_PROVEEDOR') ?? 'openai-compatible'
  let modelo = Deno.env.get('IA_MODELO') ?? ''
  const registrar = (estado: 'Completado' | 'Error', error?: string) =>
    conClaveSecreta
      .from('generaciones_ia')
      .update({ estado, error_detalle: error ?? null, proveedor, modelo, completado_en: new Date().toISOString() })
      .eq('id', generacion.id)

  try {
    // 3. Proveedor (puerto) → respuesta → un texto por campo.
    const configurado = crearProveedor()
    proveedor = configurado.proveedor
    modelo = configurado.modelo
    const respuesta = await configurado.analizador.completar(armarMensajesGeneracion(datos))
    const textos = interpretarGeneracion(respuesta, datos.campos)

    // 4. Registrar.
    const { error: errorRegistro } = await registrar('Completado')
    if (errorRegistro) {
      console.error('[generar-documento] no se pudo guardar el resultado:', errorRegistro)
      throw new ErrorIA('No se pudo guardar el resultado.')
    }
    return responder(200, { id: generacion.id, estado: 'Completado', textos, proveedor, modelo })
  } catch (e) {
    // Motivo SANEADO (lo lee quien pidió, AUD04-B3); el detalle técnico va al log.
    console.error('[generar-documento] falló la generación:', e)
    const motivo = motivoSaneado(e)
    await registrar('Error', motivo)
    return responder(200, { id: generacion.id, estado: 'Error', error: motivo, proveedor, modelo })
  }
})
