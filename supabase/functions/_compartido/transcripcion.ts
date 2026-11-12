// Transcripción de audio y video (lógica PURA, sin APIs de Deno: la prueba Vitest).
//
// Mismo esquema que el análisis: puerto + adaptador.
//   · El PUERTO es Transcriptor: "pasame este audio a texto".
//   · El adaptador habla con cualquier servicio compatible con OpenAI en
//     /audio/transcriptions: Groq, OpenAI, Mistral… Cambiar de servicio = cambiar
//     IA_STT_BASE_URL, IA_STT_MODELO e IA_STT_API_KEY.
//
// Por qué en el servidor y no en el navegador: medido el 2026-11-11 con un audio real, Whisper
// en el navegador dio 88 % (base) y 41 % (small) de palabras equivocadas en español, y una
// transcripción hecha en el cliente no se puede verificar en el servidor.
//
// Estos servicios aceptan mp4, m4a y webm directo y extraen el audio solos: el mismo adaptador
// sirve para el audio de un video.

import { ErrorIA, MAX_MEDIA_BYTES, type FuenteIA } from './analisis.ts'
import { esUuid } from './validar.ts'

export { MAX_MEDIA_BYTES }

// ─── Validación del pedido de transcripción ─────────────────────────────────
// Solo se pide el id de la evidencia: el proyecto, la consultoría y el archivo los decide la BD
// (autorizar_transcripcion), nunca quien llama. Lo que sobre en el cuerpo se ignora.

export interface PedidoTranscripcion {
  evidenciaId: string
}

export function validarPedidoTranscripcion(entrada: unknown): PedidoTranscripcion {
  if (!entrada || typeof entrada !== 'object') throw new ErrorIA('El pedido de transcripción es inválido.')
  const { evidenciaId } = entrada as Record<string, unknown>
  if (!esUuid(evidenciaId)) throw new ErrorIA('evidenciaId no es un identificador válido.')
  return { evidenciaId }
}

export interface Transcriptor {
  transcribir(bytes: Uint8Array, mime: string): Promise<string>
}

// Debe quedar por debajo del límite de tiempo del runtime de la función.
const TIMEOUT_TRANSCRIPCION_MS = 90_000

// El servicio admite hasta ~224 tokens: orienta la ortografía de los términos del dominio
// (en una prueba real "quejas" salió como "CPSAS"). No es una instrucción para el modelo de análisis.
export const VOCABULARIO_ISO =
  'Procedimiento de atención a quejas y reclamaciones. Sistema de gestión de la calidad ISO 9001. No conformidad, acción correctiva, auditoría interna, indicadores, registros, código documental.'

export const esMediaTranscribible = (mime: string): boolean => mime.startsWith('audio/') || mime.startsWith('video/')

// El análisis de un audio o video usa el texto GUARDADO (el que el equipo pudo corregir), no vuelve a
// transcribir: lo que se analiza es lo que una persona vio. Si todavía no hay transcripción, se pide
// transcribir primero. Del video solo se transcribe el audio.
export function fuenteDeTranscripcion(
  fila: { texto: string; corregida_en: string | null } | null | undefined,
  esVideo: boolean,
): FuenteIA {
  if (!fila) throw new ErrorIA('Antes de analizar un audio o un video hay que transcribirlo y revisar el texto (botón "Transcribir").')
  return {
    texto: fila.texto,
    imagenes: [],
    origen: esVideo ? 'transcripcion-video' : 'transcripcion-audio',
    revisada: Boolean(fila.corregida_en),
  }
}

// Whisper inventa texto cuando el audio no tiene voz (aprendió de subtítulos de video). Medido el 2026-11-11 con
// Groq: 3 s de silencio devolvieron "Gracias por ver el video." con no_speech_prob = 0, así que ese campo NO sirve
// para detectarlo con este modelo. Lo que sí se puede sostener es descartar una transcripción que sea ENTERA una
// de estas frases. Solo la primera se observó aquí; las demás son las alucinaciones habituales de Whisper en español.
const ALUCINACIONES_DEL_SILENCIO = new Set([
  'gracias por ver el video',
  'gracias por ver',
  'subtitulos realizados por la comunidad de amara org',
  'subtitulado por la comunidad de amara org',
  'suscribete al canal',
])

const comparable = (texto: string): string =>
  texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim()

// El servicio detecta el formato por la extensión del nombre: se elige por el tipo (nunca se
// manda el nombre que puso el usuario).
const EXTENSIONES: Record<string, string> = {
  'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/m4a': 'm4a',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav',
  'audio/webm': 'webm', 'video/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac', 'audio/x-flac': 'flac',
  'video/mp4': 'mp4',
}

const sinParametros = (mime: string): string => mime.split(';')[0].trim().toLowerCase()

export const extensionDeMime = (mime: string): string => EXTENSIONES[sinParametros(mime)] ?? 'mp3'

export function crearTranscriptorCompatibleOpenAI(config: {
  baseUrl: string
  apiKey: string
  modelo: string
  idioma?: string
  fetch?: typeof fetch
  timeoutMs?: number
}): Transcriptor {
  if (!config.baseUrl || !config.apiKey || !config.modelo) {
    throw new ErrorIA('La transcripción no está configurada: faltan IA_STT_BASE_URL, IA_STT_API_KEY o IA_STT_MODELO en el entorno de la función.')
  }
  const url = `${config.baseUrl.replace(/\/+$/, '')}/audio/transcriptions`
  const llamar = config.fetch ?? fetch
  const timeoutMs = config.timeoutMs ?? TIMEOUT_TRANSCRIPCION_MS

  return {
    async transcribir(bytes, mime) {
      const tipo = sinParametros(mime)
      const cuerpo = new FormData()
      cuerpo.append('file', new Blob([bytes], { type: tipo }), `audio.${extensionDeMime(tipo)}`)
      cuerpo.append('model', config.modelo)
      cuerpo.append('language', config.idioma ?? 'es')
      cuerpo.append('response_format', 'json')
      cuerpo.append('temperature', '0')
      cuerpo.append('prompt', VOCABULARIO_ISO)

      let respuesta: Response
      try {
        // Sin Content-Type a mano: fetch lo arma con el "boundary" al ver un FormData.
        respuesta = await llamar(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${config.apiKey}` },
          body: cuerpo,
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (e) {
        const nombre = e instanceof Error ? e.name : ''
        if (nombre === 'TimeoutError' || nombre === 'AbortError') {
          throw new ErrorIA(`El servicio de transcripción tardó demasiado en responder (más de ${Math.round(timeoutMs / 1000)} s). Inténtalo de nuevo.`)
        }
        console.error('[IA] no se pudo conectar con el servicio de transcripción:', e)
        throw new ErrorIA('No se pudo conectar con el servicio de transcripción.')
      }

      if (!respuesta.ok) {
        // El cuerpo del error puede traer cuentas, URLs o identificadores: va al log del
        // servidor, no al mensaje que lee el cliente (AUD04-B3).
        console.error(`[IA] el servicio de transcripción respondió ${respuesta.status}:`, (await respuesta.text().catch(() => '')).slice(0, 200))
        if (respuesta.status === 401 || respuesta.status === 403) throw new ErrorIA('La clave del servicio de transcripción es inválida o no tiene permiso (revisa IA_STT_API_KEY).')
        if (respuesta.status === 404) throw new ErrorIA('El modelo de transcripción no existe en el servicio (revisa IA_STT_MODELO e IA_STT_BASE_URL).')
        if (respuesta.status === 413) throw new ErrorIA('El archivo es demasiado grande para el servicio de transcripción.')
        if (respuesta.status === 429) throw new ErrorIA('Se alcanzó el límite de uso del servicio de transcripción. Inténtalo más tarde.')
        if (respuesta.status === 400) throw new ErrorIA('El servicio de transcripción no pudo procesar el archivo (formato no admitido o archivo dañado).')
        throw new ErrorIA(`El servicio de transcripción respondió ${respuesta.status}.`)
      }

      let datos: { text?: unknown }
      try {
        datos = await respuesta.json()
      } catch {
        throw new ErrorIA('El servicio de transcripción devolvió una respuesta no válida.')
      }
      const texto = typeof datos?.text === 'string' ? datos.text.trim() : ''
      if (!texto) throw new ErrorIA('No se detectó voz en el archivo: la transcripción salió vacía.')
      if (ALUCINACIONES_DEL_SILENCIO.has(comparable(texto))) {
        console.error('[IA] la transcripción es una frase típica de audio sin voz:', texto)
        throw new ErrorIA('No se detectó voz en el archivo: el servicio devolvió solo una frase que suele inventar con audios en silencio.')
      }
      return texto
    },
  }
}
