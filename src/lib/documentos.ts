import type { Documento, EstadoDocumento, Rol } from '../types'

// Qué documentos ve cada rol. La SEGURIDAD vive en la BD (RLS, migración
// 20261109000000_documentos_visibles_cliente); esto solo evita pedir y mostrar
// filas que el servidor igual no devolvería, y mantiene la pantalla coherente.

// Trabajo interno del consultor: todavía no se le entregó al cliente.
export const ESTADOS_INTERNOS: readonly EstadoDocumento[] = ['Borrador', 'En elaboración']

export function documentoVisibleParaRol(documento: Pick<Documento, 'estado'>, rol: Rol): boolean {
  return rol !== 'Usuario Cliente' || !ESTADOS_INTERNOS.includes(documento.estado)
}
