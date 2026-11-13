import type { PageId } from '../types'

export type TarjetaInicio =
  | 'empresas'
  | 'proyectos'
  | 'pendientes-informacion'
  | 'proximos-vencer'
  | 'documentos'
  | 'actividades-vencidas'
  | 'evidencias-por-validar'

const DESTINO_TARJETA: Record<TarjetaInicio, PageId> = {
  empresas: 'empresas',
  proyectos: 'proyectos',
  'pendientes-informacion': 'evidencias',
  'proximos-vencer': 'tablero-tareas',
  documentos: 'documentacion',
  'actividades-vencidas': 'tablero-tareas',
  'evidencias-por-validar': 'evidencias',
}

export function destinoDeTarjeta(tarjeta: TarjetaInicio): PageId {
  return DESTINO_TARJETA[tarjeta]
}

const DESTINO_ENTIDAD: Record<string, PageId> = {
  proyecto: 'proyecto-detalle',
  empresa: 'empresa-detalle',
  tarea: 'tareas',
  documento: 'documentacion',
  evidencia: 'evidencias',
}

export function destinoDeEntidad(tipo: string): PageId {
  return DESTINO_ENTIDAD[tipo] ?? 'inicio'
}
