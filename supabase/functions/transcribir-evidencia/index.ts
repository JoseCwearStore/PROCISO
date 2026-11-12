// Edge Function transcribir-evidencia: transcribe el audio de una evidencia (audio o video) y GUARDA la
// transcripción para que el consultor la revise y la corrija ANTES de pedir el análisis con IA.
//
// DELGADA: las reglas viven en la BD (quién puede, qué se puede transcribir, tope diario) y la lógica
// en _compartido/ (probada con Vitest).
//   0. Valida la FORMA del pedido: solo el id de la evidencia.
//   1. Con el TOKEN DEL USUARIO le pide permiso a la BD (autorizar_transcripcion): solo el equipo del
//      proyecto, solo audio o video con archivo y con tope diario. La BD decide qué archivo se transcribe.
//   2. Con el mismo token baja el archivo (el RLS de Storage decide).
//   3. Transcribe con el servicio configurado (puerto, con timeout).
//   4. Con la clave secreta registra la transcripción (registrar_transcripcion): conserva lo que escuchó
//      la IA y deja historial.
//
// Configuración (supabase/functions/.env en local; `supabase secrets set` desplegado):
//   IA_STT_BASE_URL=https://api.groq.com/openai/v1
//   IA_STT_MODELO=whisper-large-v3-turbo
//   IA_STT_API_KEY=…                 (nunca en el repo ni en el navegador)
//   CORS_ORIGEN=https://…            (en producción; sin él queda `*`)

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { ErrorIA, verificarTamanoArchivo } from '../_compartido/analisis.ts'
import { crearCors, estadoDe, mensajeDeBD, motivoSaneado, responderCon } from '../_compartido/http.ts'
import { crearTranscriptorCompatibleOpenAI, esMediaTranscribible, validarPedidoTranscripcion } from '../_compartido/transcripcion.ts'

const CORS = crearCors(Deno.env.get('CORS_ORIGEN'))
const responder = responderCon(CORS)

// El proveedor que queda anotado: el host del servicio (p. ej. "api.groq.com"), no la URL con rutas.
function nombreDelServicio(baseUrl: string): string {
  try { return new URL(baseUrl).hostname } catch { return 'desconocido' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder(405, { error: 'Método no permitido' })
  const token = req.headers.get('Authorization')
  if (!token) return responder(401, { error: 'Sesión requerida' })

  // 0. La forma del pedido, antes de tocar la BD (400 claro, sin texto interno).
  let pedido
  try {
    pedido = validarPedidoTranscripcion(await req.json())
  } catch (e) {
    return responder(400, { error: e instanceof ErrorIA ? e.message : 'Cuerpo inválido' })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const comoUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: token } },
    auth: { persistSession: false },
  })
  const conClaveSecreta = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  // 1. Permiso: lo da la BD con el token del usuario (equipo del proyecto, audio o video, tope diario).
  const { data: autorizado, error: errorPermiso } = await comoUsuario.rpc('autorizar_transcripcion', { p_evidencia_id: pedido.evidenciaId })
  if (errorPermiso) {
    console.error('[transcribir-evidencia] la BD no autorizó:', errorPermiso)
    return responder(estadoDe(errorPermiso.code), { error: mensajeDeBD(errorPermiso), code: errorPermiso.code })
  }
  const evidencia = Array.isArray(autorizado) ? autorizado[0] : autorizado
  if (!evidencia) return responder(403, { error: 'No tienes permiso para esta acción.' })

  // Quién pide (queda como autor de la transcripción y cuenta para su tope diario).
  const { data: sesion, error: errorSesion } = await comoUsuario.auth.getUser()
  if (errorSesion || !sesion.user) return responder(401, { error: 'Sesión requerida' })

  const proveedor = nombreDelServicio(Deno.env.get('IA_STT_BASE_URL') ?? '')
  const modelo = Deno.env.get('IA_STT_MODELO') ?? ''
  try {
    // 2. El archivo, con el token del usuario (el RLS de Storage decide).
    const { data: archivo, error: errorArchivo } = await comoUsuario.storage.from('evidencias').download(evidencia.archivo_ruta)
    if (errorArchivo || !archivo) throw new ErrorIA('No se pudo descargar el archivo de la evidencia.')
    const mime = evidencia.archivo_mime || archivo.type || 'application/octet-stream'
    if (!esMediaTranscribible(mime)) throw new ErrorIA('El archivo de la evidencia no es de audio ni de video.')
    verificarTamanoArchivo({ length: archivo.size }, mime)

    // 3. Transcribir.
    const transcriptor = crearTranscriptorCompatibleOpenAI({
      baseUrl: Deno.env.get('IA_STT_BASE_URL') ?? '',
      apiKey: Deno.env.get('IA_STT_API_KEY') ?? '',
      modelo,
    })
    const texto = await transcriptor.transcribir(new Uint8Array(await archivo.arrayBuffer()), mime)

    // 4. Registrar (solo la clave secreta puede).
    const { error: errorRegistro } = await conClaveSecreta.rpc('registrar_transcripcion', {
      p_evidencia_id: pedido.evidenciaId,
      p_texto: texto,
      p_proveedor: proveedor,
      p_modelo: modelo,
      p_autor_id: sesion.user.id,
    })
    if (errorRegistro) {
      console.error('[transcribir-evidencia] no se pudo guardar la transcripción:', errorRegistro)
      throw new ErrorIA('No se pudo guardar la transcripción.')
    }
    // El texto no viaja acá: la pantalla lo lee de la tabla con el RLS del usuario.
    return responder(200, { estado: 'Completado', evidenciaId: pedido.evidenciaId })
  } catch (e) {
    // Una falla del servicio, del archivo o del guardado es un resultado para mostrar, con un motivo
    // SANEADO (lo lee el cliente); el detalle técnico va solo al log del servidor.
    console.error('[transcribir-evidencia] falló:', e)
    return responder(200, { estado: 'Error', error: motivoSaneado(e) })
  }
})
