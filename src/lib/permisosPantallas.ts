// Matriz "qué pantalla ve cada rol", DERIVADA de config/permissions.ts (AUD07-M3, L5c, D7).
//
// Antes estaba escrita a mano en Usuarios.tsx y contradecía a permissions.ts: quien decide roles e
// invitaciones se guiaba por una tabla equivocada sobre qué ve el cliente. Derivarla significa que
// no puede desfasarse: si cambia el permiso de una pantalla, cambia la matriz.

import { canAccess, PAGE_PERMISSIONS } from '../config/permissions'
import type { PageId, Rol } from '../types'

export const ROLES_MATRIZ: Rol[] = ['Admin PROCISO', 'Admin Consultoría', 'Consultor', 'Usuario Cliente']

// Pantallas de permissions.ts que no son una fila propia: el detalle cuelga de su listado, "tareas"
// es el alias de "tablero-tareas" y "unauthorized" es la pantalla de acceso denegado.
export const PANTALLAS_SIN_FILA: PageId[] = ['empresa-detalle', 'proyecto-detalle', 'tareas', 'unauthorized']

// Mismos nombres que el menú lateral, en el mismo orden.
export const NOMBRES_PANTALLA: Partial<Record<PageId, string>> = {
  inicio: 'Inicio',
  empresas: 'Empresas cliente',
  proyectos: 'Proyectos',
  levantamiento: 'Levantamiento de procesos',
  procesos: 'Procesos',
  evidencias: 'Evidencias',
  documentacion: 'Documentación',
  revisiones: 'Revisiones y aprobaciones',
  'tablero-tareas': 'Tablero de tareas',
  'listas-verificacion': 'Listas de verificación',
  'no-conformidades': 'No conformidades',
  indicadores: 'Indicadores e informes',
  notificaciones: 'Notificaciones',
  usuarios: 'Usuarios y permisos',
  configuracion: 'Configuración',
  ayuda: 'Ayuda y soporte',
}

export interface FilaMatriz {
  id: PageId
  nombre: string
  roles: Record<Rol, boolean>
}

export function matrizDePermisos(): FilaMatriz[] {
  return (Object.keys(NOMBRES_PANTALLA) as PageId[])
    .filter((id) => id in PAGE_PERMISSIONS)
    .map((id) => ({
      id,
      nombre: NOMBRES_PANTALLA[id] as string,
      roles: Object.fromEntries(ROLES_MATRIZ.map((rol) => [rol, canAccess(id, rol)])) as Record<Rol, boolean>,
    }))
}
