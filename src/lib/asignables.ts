import type { Usuario } from '../types'

// Espejo de private.es_asignable (BD): quién puede ser asignado o responsable en un
// proyecto. El equipo del proyecto o un cliente de su empresa; proyectosAsignados
// ya lo calcula datos.ts según el rol.
export function usuariosAsignables(usuarios: Usuario[], proyectoId: string): Usuario[] {
  if (!proyectoId) return []
  return usuarios.filter((u) => u.activo && u.rol !== 'Admin PROCISO' && u.proyectosAsignados.includes(proyectoId))
}
