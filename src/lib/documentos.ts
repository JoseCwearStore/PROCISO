import type { Documento, EstadoDocumento, Rol } from '../types'

// Qué documentos ve cada rol. La SEGURIDAD vive en la BD (RLS, migración
// 20261109000000_documentos_visibles_cliente); esto solo evita pedir y mostrar
// filas que el servidor igual no devolvería, y mantiene la pantalla coherente.

// Trabajo interno del consultor: todavía no se le entregó al cliente.
export const ESTADOS_INTERNOS: readonly EstadoDocumento[] = ['Borrador', 'En elaboración']

const TODOS_LOS_ESTADOS: readonly EstadoDocumento[] = [
  'Borrador',
  'En elaboración',
  'Pendiente de revisión',
  'En corrección',
  'Aprobado',
  'Rechazado',
  'Obsoleto',
]

// Los estados que el selector de filtro puede ofrecerle a cada rol.
export function estadosVisiblesParaRol(rol: Rol): EstadoDocumento[] {
  return TODOS_LOS_ESTADOS.filter((estado) => documentoVisibleParaRol({ estado }, rol))
}

// Quién redacta (edita, versiona, envía a revisión). Espejo de la BD: las políticas de
// `documentos` y `guardar_documento` solo dejan escribir al equipo del proyecto. El cliente
// lee, comenta y decide (aprueba o pide corrección) en Revisiones.
export function puedeRedactarDocumentos(rol: Rol): boolean {
  return rol !== 'Usuario Cliente'
}

// "0.1" → "0.2", "1.9" → "1.10". Cada reenvío a revisión usa una versión nueva (AUD02-H1).
export function siguienteVersion(version: string): string {
  const [major = '0', minor = '0'] = version.split('.')
  return `${major}.${Number(minor) + 1}`
}

// La instantánea de una versión ya enviada no se pisa (la BD lo rechaza): si esa versión ya
// tiene instantánea, el envío sube la versión; si no, se envía la actual.
export function versionParaEnviar(documento: Pick<Documento, 'version' | 'historialVersiones'>): string {
  return documento.historialVersiones.some((item) => item.version === documento.version)
    ? siguienteVersion(documento.version)
    : documento.version
}

// Espejo de guardar_documento: el contenido no se edita si está bloqueado, aprobado, obsoleto
// o EN REVISIÓN (congelado: para editarlo hay que retirarlo de la revisión).
export function contenidoEditable(documento: Pick<Documento, 'estado' | 'bloqueado'>): boolean {
  return !documento.bloqueado
    && documento.estado !== 'Aprobado'
    && documento.estado !== 'Obsoleto'
    && documento.estado !== 'Pendiente de revisión'
}

export function documentoVisibleParaRol(documento: Pick<Documento, 'estado'>, rol: Rol): boolean {
  return rol !== 'Usuario Cliente' || !ESTADOS_INTERNOS.includes(documento.estado)
}
