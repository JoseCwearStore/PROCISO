// Qué puede hacer cada rol en las pantallas de GESTIÓN (empresas y proyectos). AUD07-M1 (L5b).
//
// Espejo de la BD, solo para UX: las políticas "admins crean empresas", "admins editan empresas" y
// "admins crean proyectos" dejan crear y archivar únicamente al Admin PROCISO y al Admin de la
// consultoría. Si la pantalla se lo ofrece al Consultor, llena 20 campos y recibe un 403 al final.
// Quien decide sigue siendo la BD; esto solo evita ofrecer lo que ella va a rechazar.
//
// Lo que el Consultor SÍ puede (y no se toca): cambiar el estado de sus proyectos y levantar procesos.

import type { Rol } from '../types'

export const AVISO_SOLO_ADMIN = 'Solo el administrador de la consultoría crea empresas y proyectos.'

export interface PermisosGestion {
  puedeCrearEmpresa: boolean
  puedeArchivarEmpresa: boolean
  // Reactivar es el mismo UPDATE de "activa" que archivar (política "admins editan empresas"): O2.
  puedeReactivarEmpresa: boolean
  puedeCrearProyecto: boolean
  // Por qué no puede (para mostrarlo en pantalla); null si puede.
  motivo: string | null
}

export function permisosGestion(rol: Rol): PermisosGestion {
  const esAdmin = rol === 'Admin PROCISO' || rol === 'Admin Consultoría'
  return {
    puedeCrearEmpresa: esAdmin,
    puedeArchivarEmpresa: esAdmin,
    puedeReactivarEmpresa: esAdmin,
    puedeCrearProyecto: esAdmin,
    motivo: esAdmin ? null : AVISO_SOLO_ADMIN,
  }
}
