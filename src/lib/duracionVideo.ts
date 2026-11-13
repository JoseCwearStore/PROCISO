// Duración máxima de un video: espejo de supabase/functions/_compartido/duracion-video.ts.
// La regla la aplica el SERVIDOR (rechaza el pedido); acá solo se avisa antes, para no hacer esperar a nadie.
//
// Decisión del usuario (12/11, proyecto escolar): máximo 5 minutos por video. El manual de usuario debe decirlo.
// Es un tope de USO: la duración la mide el navegador (el servidor solo ve bytes), así que no es una barrera de seguridad.

export const MAX_VIDEO_SEGUNDOS = 300

// "4 min 30 s", "45 s", "5 min": redondeada al segundo más cercano.
export function formatearDuracion(segundos: number): string {
  const total = Math.round(segundos)
  const minutos = Math.floor(total / 60)
  const resto = total % 60
  if (minutos === 0) return `${resto} s`
  return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`
}

const legible = (segundos: unknown): segundos is number => typeof segundos === 'number' && Number.isFinite(segundos) && segundos > 0
// Un video de "5:00" suele medir 300,02 s: se compara redondeado al segundo, igual que el servidor.
const pasaDelTope = (segundos: number) => Math.round(segundos) > MAX_VIDEO_SEGUNDOS
const TOPE_EN_MINUTOS = MAX_VIDEO_SEGUNDOS / 60

export interface EstadoDuracionVideo {
  permitido: boolean
  // La duración todavía no se leyó: el botón espera, no acusa nada.
  leyendo: boolean
  motivo: string | null
}

// Para el botón "Analizar video" de una evidencia: la duración sale del reproductor (null = todavía no la leyó).
export function estadoDuracionVideo(segundos: number | null | undefined): EstadoDuracionVideo {
  if (segundos === null || segundos === undefined) return { permitido: false, leyendo: true, motivo: null }
  if (!legible(segundos)) {
    return { permitido: false, leyendo: false, motivo: 'No se pudo leer la duración del video. Vuelve a abrir la evidencia o prueba con otro archivo.' }
  }
  if (pasaDelTope(segundos)) {
    return {
      permitido: false,
      leyendo: false,
      motivo: `Este video dura ${formatearDuracion(segundos)}; el máximo para analizarlo es de ${TOPE_EN_MINUTOS} minutos. Acórtalo y súbelo de nuevo.`,
    }
  }
  return { permitido: true, leyendo: false, motivo: null }
}

// Para el formulario "Capturar evidencia": solo frena lo que SE SABE que pasa del tope. Si no se pudo leer la duración
// no bloquea la subida (un video sin metadatos legible puede ser válido): el análisis la vuelve a pedir.
export function motivoSubidaVideo(segundos: number | null | undefined): string | null {
  if (!legible(segundos) || !pasaDelTope(segundos)) return null
  return `Este video dura ${formatearDuracion(segundos)}; el máximo es de ${TOPE_EN_MINUTOS} minutos. Acórtalo antes de subirlo.`
}

// Lo mínimo que se necesita de un <video> (y que un reproductor falso puede imitar en los tests).
export interface ReproductorMedible extends EventTarget {
  duration: number
  currentTime: number
}

// Lee la duración de un <video>: la devuelve apenas la conoce, o null si falla o no llega a tiempo.
// Un archivo sin duración en la cabecera (p. ej. un WebM grabado en el navegador) la informa como Infinity: se fuerza
// el cálculo saltando muy adelante, y al terminar se vuelve al inicio.
export function esperarDuracion(video: ReproductorMedible, plazoMs = 8000): Promise<number | null> {
  return new Promise((resolver) => {
    let terminado = false
    let forzando = false
    let reloj: ReturnType<typeof setTimeout> | undefined

    const terminar = (valor: number | null) => {
      if (terminado) return
      terminado = true
      if (reloj !== undefined) clearTimeout(reloj)
      video.removeEventListener('loadedmetadata', revisar)
      video.removeEventListener('durationchange', revisar)
      video.removeEventListener('error', alFallar)
      if (forzando) video.currentTime = 0
      resolver(valor)
    }
    function revisar() {
      const d = video.duration
      if (Number.isFinite(d) && d > 0) return terminar(d)
      if (d === Infinity && !forzando) {
        forzando = true
        video.currentTime = 1e101
      }
    }
    function alFallar() {
      terminar(null)
    }

    video.addEventListener('loadedmetadata', revisar)
    video.addEventListener('durationchange', revisar)
    video.addEventListener('error', alFallar)
    reloj = setTimeout(() => terminar(null), plazoMs)
    revisar()
  })
}

// Mide un archivo recién elegido, con un <video> que no se muestra. Es pegamento con el navegador (no tiene test
// unitario): la lógica que decide está en esperarDuracion y motivoSubidaVideo, que sí lo tienen.
export async function medirDuracionDeArchivo(archivo: Blob): Promise<number | null> {
  const url = URL.createObjectURL(archivo)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.src = url
  try {
    return await esperarDuracion(video)
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}
