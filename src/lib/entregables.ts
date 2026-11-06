import type { Documento, Entregable, EstadoEntregable } from '../types'

// Reglas de entregables que la pantalla necesita conocer. La SEGURIDAD vive en la
// BD (decidir_entregable); esto solo evita ofrecer acciones que el servidor rechaza.

// ¿El documento vinculado (o una versión posterior con el mismo código, en el mismo
// proyecto) ya está aprobado? Sin documento vinculado, no hay nada que esperar.
export function documentoListo(entregable: Pick<Entregable, 'documentoId'>, documentos: Documento[]): boolean {
  if (!entregable.documentoId) return true
  const vinculado = documentos.find((d) => d.id === entregable.documentoId)
  if (!vinculado) return false
  return documentos.some(
    (d) =>
      d.proyectoId === vinculado.proyectoId &&
      d.estado === 'Aprobado' &&
      (d.id === vinculado.id || (!!vinculado.codigo && d.codigo === vinculado.codigo)),
  )
}

// El equipo entrega (Pendiente/Rechazado → En revisión); el cliente aprueba o rechaza.
export function accionesEntregable(
  entregable: Pick<Entregable, 'estado'>,
  esEquipo: boolean,
): Exclude<EstadoEntregable, 'Pendiente'>[] {
  if (esEquipo) return entregable.estado === 'Pendiente' || entregable.estado === 'Rechazado' ? ['En revisión'] : []
  return entregable.estado === 'En revisión' ? ['Aprobado', 'Rechazado'] : []
}
