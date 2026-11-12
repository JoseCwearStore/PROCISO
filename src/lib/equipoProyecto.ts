// Qué le ofrece la pantalla de equipo del proyecto al Admin de la consultoría (L5d, AUD05-M2, D8).
//
// Espejo de las reglas de la BD, solo para UX: en un proyecto solo pueden estar consultores y admins
// ACTIVOS de la MISMA consultoría (private.validar_miembro_equipo). Quien decide es la BD; esto evita
// ofrecer opciones que ella va a rechazar.

import type { Proyecto, Usuario } from '../types'

type ProyectoEquipo = Pick<Proyecto, 'consultorId' | 'equipoIds'>

export interface MiembroEquipo {
  usuario: Usuario
  esResponsable: boolean
}

const ROLES_DEL_EQUIPO: Usuario['rol'][] = ['Consultor', 'Admin Consultoría']
const porNombre = (a: Usuario, b: Usuario) => a.nombre.localeCompare(b.nombre, 'es')

// Elegibles para ser parte de un equipo: activos, de esa consultoría y del equipo (no clientes).
function elegibles(usuarios: Usuario[], consultoriaId: string | null | undefined): Usuario[] {
  if (!consultoriaId) return []
  return usuarios.filter((u) => u.activo && u.consultoriaId === consultoriaId && ROLES_DEL_EQUIPO.includes(u.rol))
}

// El responsable primero y luego los demás por nombre.
export function miembrosDelEquipo(proyecto: ProyectoEquipo, usuarios: Usuario[]): MiembroEquipo[] {
  return proyecto.equipoIds
    .map((id) => usuarios.find((u) => u.id === id))
    .filter((u): u is Usuario => !!u)
    .map((usuario) => ({ usuario, esResponsable: usuario.id === proyecto.consultorId }))
    .sort((a, b) => Number(b.esResponsable) - Number(a.esResponsable) || porNombre(a.usuario, b.usuario))
}

// A quién se puede agregar al equipo: los elegibles que todavía no están.
export function candidatosEquipo(proyecto: ProyectoEquipo, usuarios: Usuario[], consultoriaId: string | null | undefined): Usuario[] {
  return elegibles(usuarios, consultoriaId)
    .filter((u) => !proyecto.equipoIds.includes(u.id))
    .sort(porNombre)
}

// Quién puede pasar a ser el responsable: los elegibles distintos del actual (si no está en el equipo,
// la BD lo suma al cambiarlo).
export function candidatosResponsable(proyecto: ProyectoEquipo, usuarios: Usuario[], consultoriaId: string | null | undefined): Usuario[] {
  return elegibles(usuarios, consultoriaId)
    .filter((u) => u.id !== proyecto.consultorId)
    .sort(porNombre)
}
