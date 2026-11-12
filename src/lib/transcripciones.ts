// Transcripción de audio y video con revisión humana ANTES de analizar. La transcripción automática puede
// equivocarse (códigos y cifras), así que se guarda, se le muestra al equipo y se puede corregir; la IA analiza el
// texto ya revisado. Las reglas viven en la BD (quién transcribe y corrige, tope diario, historial); esto traduce,
// valida la forma para avisar antes de ir a la BD y decide cuándo se puede analizar.

import { falla, type ErrorEscritura, type ResultadoEscritura } from './escrituras'

export interface Transcripcion {
  evidenciaId: string
  texto: string // lo que se analiza: el texto con las correcciones
  textoAutomatico: string // lo que escuchó la IA, siempre conservado
  proveedor?: string
  modelo?: string
  creadaEn: string
  corregidaPorId?: string
  corregidaEn?: string
}

// Espejo del check de la BD (solo para avisar antes y poner maxLength al cuadro de texto).
export const MAX_TRANSCRIPCION = 100000

const texto = (v: unknown): v is string => typeof v === 'string'
const opcional = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

export function adaptarTranscripcion(fila: unknown): Transcripcion | null {
  if (!fila || typeof fila !== 'object') return null
  const f = fila as Record<string, unknown>
  if (!texto(f.evidencia_id) || !texto(f.texto) || !f.texto || !texto(f.texto_automatico) || !texto(f.creada_en)) return null
  return {
    evidenciaId: f.evidencia_id,
    texto: f.texto,
    textoAutomatico: f.texto_automatico,
    proveedor: opcional(f.proveedor),
    modelo: opcional(f.modelo),
    creadaEn: f.creada_en,
    corregidaPorId: opcional(f.corregida_por),
    corregidaEn: opcional(f.corregida_en),
  }
}

// ─── Cuándo se puede analizar ───────────────────────────────────────────────
// Un audio o video no se analiza hasta tener la transcripción GUARDADA, y no se analiza un texto que la BD no
// tiene: si el cuadro tiene cambios sin guardar, primero se guardan. (Lo que no es audio ni video no depende de esto.)

export type EstadoTranscripcion = 'no_aplica' | 'falta' | 'sin_guardar' | 'lista'

export function estadoTranscripcion(
  tipoEvidencia: string | null | undefined,
  transcripcion: Transcripcion | null,
  textoEditado: string,
): EstadoTranscripcion {
  if (tipoEvidencia !== 'Audio' && tipoEvidencia !== 'Video') return 'no_aplica'
  if (!transcripcion) return 'falta'
  return textoEditado.trim() === transcripcion.texto ? 'lista' : 'sin_guardar'
}

export const puedeAnalizarConTranscripcion = (estado: EstadoTranscripcion): boolean => estado === 'no_aplica' || estado === 'lista'

export function mensajeDeEstado(estado: EstadoTranscripcion): string | null {
  if (estado === 'falta') return 'Antes de analizar, transcribe el archivo y revisa el texto.'
  if (estado === 'sin_guardar') return 'Hay cambios sin guardar en la transcripción: guárdalos antes de analizar.'
  return null
}

export function etiquetaTranscripcion(t: Transcripcion): string {
  return t.corregidaEn ? 'Corregida por una persona del equipo' : 'Transcripción automática, sin corregir'
}

// ─── Servicio ───────────────────────────────────────────────────────────────

interface ErrorBD {
  code?: string
  message: string
}

export interface ClienteTranscripciones {
  from(tabla: 'transcripciones'): {
    select(columnas: string): {
      eq(columna: string, valor: string): { maybeSingle(): PromiseLike<{ data: unknown; error: ErrorBD | null }> }
    }
  }
  rpc(funcion: 'corregir_transcripcion', args: { p_evidencia_id: string; p_texto: string }): PromiseLike<{ error: ErrorBD | null }>
  // El error trae el status HTTP de la respuesta de la función.
  functions: {
    invoke(
      nombre: 'transcribir-evidencia',
      opciones: { body: { evidenciaId: string } },
    ): PromiseLike<{ data: unknown; error: { message: string; status?: number } | null }>
  }
}

export type ResultadoTranscribir = { estado: 'Completado' } | { estado: 'Error'; error: string }

const errorDeFuncion = (status?: number): ErrorEscritura =>
  status === 403 ? 'sin_permiso' : status === 400 ? 'datos_invalidos' : status === 429 ? 'limite_transcripciones' : 'servicio'

export function crearServicioTranscripciones(cliente: ClienteTranscripciones) {
  const COLUMNAS = 'id, consultoria_id, proyecto_id, evidencia_id, texto_automatico, texto, proveedor, modelo, creada_por, creada_en, corregida_por, corregida_en'
  return {
    // La transcripción de la evidencia, la que la BD deja ver. ok con null = todavía no hay. ok:false = NO SE PUDO
    // LEER: no es lo mismo, porque la pantalla ofrecería transcribir y pisaría un texto ya corregido.
    async leer(evidenciaId: string): Promise<ResultadoEscritura<Transcripcion | null>> {
      try {
        const { data, error } = await cliente.from('transcripciones').select(COLUMNAS).eq('evidencia_id', evidenciaId).maybeSingle()
        if (error) return { ok: false, error: 'servicio' }
        if (data === null || data === undefined) return { ok: true, valor: null }
        const adaptada = adaptarTranscripcion(data)
        return adaptada ? { ok: true, valor: adaptada } : { ok: false, error: 'servicio' }
      } catch {
        return { ok: false, error: 'servicio' }
      }
    },

    // Una falla del servicio de transcripción (sin voz, archivo ilegible…) NO es una falla de escritura: vuelve con su
    // motivo para mostrarlo. Solo manda el id: el archivo, el proyecto y el permiso los decide el servidor.
    async transcribir(evidenciaId: string): Promise<ResultadoEscritura<ResultadoTranscribir>> {
      if (!evidenciaId) return { ok: false, error: 'datos_invalidos' }
      try {
        const { data, error } = await cliente.functions.invoke('transcribir-evidencia', { body: { evidenciaId } })
        if (error) return { ok: false, error: errorDeFuncion(error.status) }
        const r = (data && typeof data === 'object' ? data : {}) as { estado?: unknown; error?: unknown }
        if (r.estado === 'Completado') return { ok: true, valor: { estado: 'Completado' } }
        return { ok: true, valor: { estado: 'Error', error: typeof r.error === 'string' && r.error ? r.error : 'No se pudo transcribir el archivo.' } }
      } catch {
        return { ok: false, error: 'servicio' }
      }
    },

    async corregir(evidenciaId: string, nuevoTexto: string): Promise<ResultadoEscritura<void>> {
      const limpio = nuevoTexto.trim()
      if (!evidenciaId || !limpio || limpio.length > MAX_TRANSCRIPCION) return { ok: false, error: 'datos_invalidos' }
      try {
        const { error } = await cliente.rpc('corregir_transcripcion', { p_evidencia_id: evidenciaId, p_texto: limpio })
        return error ? falla(error) : { ok: true, valor: undefined }
      } catch {
        return { ok: false, error: 'servicio' }
      }
    },
  }
}

export type ServicioTranscripciones = ReturnType<typeof crearServicioTranscripciones>
