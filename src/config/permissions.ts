import type { PageId, Rol } from '../types'

const TODOS: Rol[] = ['Admin PROCISO', 'Admin Consultoría', 'Consultor', 'Usuario Cliente']
const EQUIPO: Rol[] = ['Admin Consultoría', 'Consultor']
const OPERACION: Rol[] = ['Admin Consultoría', 'Consultor']
const COLABORACION_CLIENTE: Rol[] = ['Admin Consultoría', 'Consultor', 'Usuario Cliente']

export const PAGE_PERMISSIONS: Partial<Record<PageId, Rol[]>> = {
  inicio: TODOS,
  empresas: EQUIPO,
  'empresa-detalle': EQUIPO,
  proyectos: OPERACION,
  'proyecto-detalle': OPERACION,
  levantamiento: OPERACION,
  procesos: OPERACION,
  evidencias: COLABORACION_CLIENTE,
  documentacion: COLABORACION_CLIENTE,
  revisiones: EQUIPO,
  tareas: COLABORACION_CLIENTE,
  'tablero-tareas': COLABORACION_CLIENTE,
  'listas-verificacion': OPERACION,
  'no-conformidades': OPERACION,
  indicadores: EQUIPO,
  notificaciones: TODOS,
  usuarios: ['Admin PROCISO', 'Admin Consultoría'],
  configuracion: ['Admin PROCISO', 'Admin Consultoría'],
  ayuda: TODOS,
  unauthorized: TODOS,
}

export function canAccess(page: PageId, role: Rol) {
  return PAGE_PERMISSIONS[page]?.includes(role) ?? false
}
