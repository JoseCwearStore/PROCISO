// Soporte y reporte de errores (L5a2, AUD07-M2). Antes el formulario descartaba el mensaje; ahora
// se guarda en la BD (tabla soporte_reportes). Las reglas viven allá: quién lo ve (autor, admin
// de su consultoría, Admin PROCISO), quién lo atiende (solo admins) y el tope de 10 por día.
// Esto solo traduce y valida la forma para dar un aviso claro antes de ir a la BD.

import type { ErrorEscritura, ResultadoEscritura } from './escrituras'

export type TipoReporte = 'Soporte' | 'Error'
export type EstadoReporte = 'Abierto' | 'Atendido'

export interface ReporteSoporte {
  id: string
  consultoriaId?: string // el Admin PROCISO no pertenece a ninguna consultoría
  usuarioId: string
  tipo: TipoReporte
  asunto: string
  mensaje: string
  estado: EstadoReporte
  atendidoPorId?: string
  atendidoEn?: string
  creadoEn: string
}

// Espejo de los check de la BD (solo para avisar antes y poner maxLength en los campos).
export const MAX_ASUNTO = 120
export const MAX_MENSAJE = 2000

const texto = (v: unknown): v is string => typeof v === 'string'
const opcional = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

export function adaptarReporte(fila: unknown): ReporteSoporte | null {
  if (!fila || typeof fila !== 'object') return null
  const f = fila as Record<string, unknown>
  if (!texto(f.id) || !texto(f.usuario_id) || !texto(f.asunto) || !texto(f.mensaje) || !texto(f.creado_en)) return null
  if (f.tipo !== 'Soporte' && f.tipo !== 'Error') return null
  if (f.estado !== 'Abierto' && f.estado !== 'Atendido') return null
  return {
    id: f.id,
    consultoriaId: opcional(f.consultoria_id),
    usuarioId: f.usuario_id,
    tipo: f.tipo,
    asunto: f.asunto,
    mensaje: f.mensaje,
    estado: f.estado,
    atendidoPorId: opcional(f.atendido_por),
    atendidoEn: opcional(f.atendido_en),
    creadoEn: f.creado_en,
  }
}

interface ErrorBD {
  code?: string
  message: string
}

export interface ClienteSoporte {
  from(tabla: string): {
    select(columnas: string): {
      order(columna: string, opciones: { ascending: boolean }): PromiseLike<{ data: unknown[] | null; error: ErrorBD | null }>
    }
    insert(fila: Record<string, unknown>): PromiseLike<{ error: ErrorBD | null }>
  }
  rpc(funcion: 'atender_reporte', args: { p_id: string }): PromiseLike<{ error: ErrorBD | null }>
}

const aError = (code?: string): ErrorEscritura => {
  if (code === 'LM429') return 'limite_reportes'
  if (code === '42501') return 'sin_permiso'
  if (code === '23514' || code === '22023') return 'datos_invalidos'
  return 'servicio'
}

export function crearServicioSoporte(cliente: ClienteSoporte) {
  const COLUMNAS = 'id, consultoria_id, usuario_id, tipo, asunto, mensaje, estado, atendido_por, atendido_en, creado_en'
  return {
    // Los reportes que la BD deja ver (los propios; los de la consultoría si es admin; todos si es Admin PROCISO).
    // null = no se pudo leer: la pantalla muestra el formulario igual.
    async listar(): Promise<ReporteSoporte[] | null> {
      try {
        const { data, error } = await cliente.from('soporte_reportes').select(COLUMNAS).order('creado_en', { ascending: false })
        if (error || !data) return null
        return data.map(adaptarReporte).filter((r): r is ReporteSoporte => r !== null)
      } catch {
        return null
      }
    },

    // Solo manda tipo, asunto y mensaje: el usuario y la consultoría los pone la BD.
    async enviar(pedido: { tipo: TipoReporte; asunto: string; mensaje: string }): Promise<ResultadoEscritura<void>> {
      const asunto = pedido.asunto.trim()
      const mensaje = pedido.mensaje.trim()
      if (!asunto || !mensaje || asunto.length > MAX_ASUNTO || mensaje.length > MAX_MENSAJE) return { ok: false, error: 'datos_invalidos' }
      try {
        const { error } = await cliente.from('soporte_reportes').insert({ tipo: pedido.tipo, asunto, mensaje })
        return error ? { ok: false, error: aError(error.code) } : { ok: true, valor: undefined }
      } catch {
        return { ok: false, error: 'servicio' }
      }
    },

    async atender(id: string): Promise<ResultadoEscritura<void>> {
      try {
        const { error } = await cliente.rpc('atender_reporte', { p_id: id })
        return error ? { ok: false, error: aError(error.code) } : { ok: true, valor: undefined }
      } catch {
        return { ok: false, error: 'servicio' }
      }
    },
  }
}

export type ServicioSoporte = ReturnType<typeof crearServicioSoporte>
