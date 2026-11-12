import type { AnalisisIA, CriterioEvaluacion, Documento } from '../types'

// AUD04-M1 (c), L5f. El contenido que se analiza (un documento o un archivo de evidencia) lo carga la propia
// empresa evaluada, que tiene interés en que el resultado sea "Cubierto" y podría intentar influir en la IA. La
// defensa técnica vive en las Edge Functions (L4: delimitador con nonce y "datos no confiables"); esta nota le
// dice a quien lee el resultado —equipo o cliente— de dónde sale lo que se analizó.
export const NOTA_CONTENIDO_NO_CONFIABLE =
  'La IA analizó contenido cargado en la plataforma, que puede venir de la empresa evaluada: ella tiene interés en el resultado y podría intentar influir en él. ' +
  'Por eso esta preevaluación no es un dictamen: revísala siempre contra el documento o la evidencia original antes de usarla.'

// Para analizar un audio o un video se transcribe su audio con un servicio EXTERNO: el archivo sale de la plataforma.
// Se avisa en el punto donde se pide el análisis. Del video no se analiza la imagen.
export function avisoTranscripcion(tipoEvidencia: string | null | undefined): string | null {
  if (tipoEvidencia === 'Audio') {
    return 'Para analizar un audio primero se transcribe con un servicio externo: el archivo sale de la plataforma. ' +
      'La transcripción es automática y puede tener errores; revísala y corrígela antes de analizar.'
  }
  if (tipoEvidencia === 'Video') {
    return 'Para analizar un video primero se transcribe su audio con un servicio externo: el archivo sale de la plataforma. ' +
      'La transcripción es automática y puede tener errores, y no se analiza la imagen del video; revísala y corrígela antes de analizar.'
  }
  return null
}

export function fuenteAnalizada(tipo: AnalisisIA['fuenteTipo']): string {
  return tipo === 'documento'
    ? 'Se analizó el contenido de un documento de la plataforma.'
    : 'Se analizó un archivo cargado como evidencia, que puede venir de la empresa evaluada.'
}

// Cláusulas que conviene revisar según el tipo de documento (sugerencia editable:
// el consultor agrega o quita). Para una evidencia no se adivina: elige el consultor.
const SUGERENCIAS: Record<Documento['tipo'], string[]> = {
  'Política': ['5.2.1', '5.2.2'],
  'Manual': ['4.3', '4.4', '7.5.1'],
  'Procedimiento': ['7.5.2', '7.5.3', '8.1'],
  'Instrucción de trabajo': ['7.5.2', '8.5.1'],
  'Ficha de proceso': ['4.4', '8.1'],
  'Formato': ['7.5.2', '7.5.3'],
  'Lista de verificación': ['9.2.1', '9.2.2'],
  'Matriz': ['4.2', '6.1'],
  'Plan': ['6.2.2', '6.3'],
  'Registro': ['7.5.3'],
  'Alcance': ['4.3'],
  'Objetivos': ['6.2.1', '6.2.2'],
  'Mapa de procesos': ['4.4'],
}

export function clausulasSugeridas(tipo: Documento['tipo'] | null): string[] {
  return tipo ? [...(SUGERENCIAS[tipo] ?? [])] : []
}

// Las sugeridas como ids del catálogo, en el orden del catálogo. Si el Excel ya
// no tiene alguna, se ignora en silencio (la sugerencia es solo una ayuda).
export function criteriosSugeridos(tipo: Documento['tipo'] | null, catalogo: CriterioEvaluacion[]): string[] {
  const clausulas = new Set(clausulasSugeridas(tipo))
  return [...catalogo].sort((a, b) => a.orden - b.orden).filter((c) => clausulas.has(c.clausula)).map((c) => c.id)
}

// ─── Análisis de video nativo (un modelo de video de Google mira la imagen y oye el audio) ──────────────────

export const AVISO_VIDEO_NATIVO =
  'Al analizar el video, el archivo sale de la plataforma hacia un proveedor externo de IA, que mira la imagen y oye el audio. ' +
  'Lo que no se ve en el video (equipo de protección, controles, registros) figura como "No evaluable": no se toma como un incumplimiento. ' +
  'Una persona debe revisar el resultado contra el video antes de usarlo.'

export const ETIQUETA_SUGERENCIA_IA = 'Sugerencia de la IA: verificar con el video'

// El análisis de video queda registrado con el proveedor "gemini" (ver analizar-ia): así se distingue del de texto.
export const esAnalisisDeVideo = (a: { proveedor?: string | null }): boolean => a.proveedor === 'gemini'

// Etiqueta de la sugerencia de un análisis: dice contra qué se verifica. Video nativo → el video;
// audio (o la transcripción del audio de un video) → el audio; el resto mantiene "Sugerencia".
export function etiquetaSugerencia(tipoEvidencia: string | null | undefined, analisis: { proveedor?: string | null }): string {
  if (esAnalisisDeVideo(analisis)) return ETIQUETA_SUGERENCIA_IA
  if (tipoEvidencia === 'Audio' || tipoEvidencia === 'Video') return 'Sugerencia de la IA: verificar con el audio'
  return 'Sugerencia'
}

// Un video de ~10 minutos pesa decenas de MB; el resto de los archivos mantiene el tope de 25 MB.
export const limiteSubidaMb = (tipo: string): number => (tipo === 'Video' ? 200 : 25)

// MM:SS (o M:SS), igual que la guarda de supabase/functions/_compartido/video.ts.
const MARCA_TIEMPO = /(?<![\d:.])[0-5]?\d:[0-5]\d(?!\d|:\d)/g

// Parte un texto en tramos para resaltar las marcas de tiempo; la unión de los tramos es el texto original.
export function partirMarcasDeTiempo(texto: string): { texto: string; marca: boolean }[] {
  const tramos: { texto: string; marca: boolean }[] = []
  let desde = 0
  for (const m of texto.matchAll(MARCA_TIEMPO)) {
    if (m.index > desde) tramos.push({ texto: texto.slice(desde, m.index), marca: false })
    tramos.push({ texto: m[0], marca: true })
    desde = m.index + m[0].length
  }
  if (desde < texto.length) tramos.push({ texto: texto.slice(desde), marca: false })
  return tramos
}
