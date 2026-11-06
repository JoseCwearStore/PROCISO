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
  // El equipo revisa y el cliente aprueba (decisión de negocio).
  revisiones: COLABORACION_CLIENTE,
  tareas: COLABORACION_CLIENTE,
  'tablero-tareas': COLABORACION_CLIENTE,
  // El cliente las ve en lectura (la BD no le deja escribir).
  'listas-verificacion': COLABORACION_CLIENTE,
  // El cliente participa: documenta corrección, causa y acción (la BD decide qué puede cada uno).
  'no-conformidades': COLABORACION_CLIENTE,
  // El cliente ve el SGC de su empresa en lectura (nunca los internos; lo decide la BD).
  indicadores: COLABORACION_CLIENTE,
  notificaciones: TODOS,
  usuarios: ['Admin PROCISO', 'Admin Consultoría'],
  configuracion: ['Admin PROCISO', 'Admin Consultoría'],
  ayuda: TODOS,
  unauthorized: TODOS,
}

export function canAccess(page: PageId, role: Rol) {
  return PAGE_PERMISSIONS[page]?.includes(role) ?? false
}
