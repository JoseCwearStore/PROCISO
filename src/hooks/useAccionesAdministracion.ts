import { useApp } from '../context/AppContext'
import { ROLES_DEL_EQUIPO, ROLES_INVITABLES, type NuevaConsultoria, type NuevaInvitacion, mensajeDeError, type FallaEscritura } from '../lib/escrituras'
import { servicioEscritura } from '../lib/servicios'
import type { Consultoria, Rol, Usuario } from '../types'

// Única puerta de escritura de la administración (consultorías y usuarios).
// Espejo de las reglas de la BD (solo UX; la BD decide):
//   · Admin PROCISO: todas las consultorías; Admin Consultoría: solo la suya.
//   · Nadie se administra a sí mismo; el Admin PROCISO no se administra desde la app.
//   · El rol cambia solo dentro del equipo (consultor ↔ admin de consultoría).
export function useAccionesAdministracion() {
  const { state, dispatch, showToast } = useApp()
  const yo = state.currentUser
  const esAdminProciso = state.currentRole === 'Admin PROCISO'
  const esAdminConsultoria = state.currentRole === 'Admin Consultoría'

  const puedeAdministrar = (usuario: Usuario) =>
    usuario.id !== yo?.id &&
    usuario.rol !== 'Admin PROCISO' &&
    (esAdminProciso || (esAdminConsultoria && !!yo?.consultoriaId && usuario.consultoriaId === yo.consultoriaId))

  const fallo = (falla: FallaEscritura) => {
    showToast(mensajeDeError(falla), 'error')
    return false
  }

  return {
    // Invitación: el Admin PROCISO elige la consultoría; el admin de consultoría, la suya.
    rolesInvitables: ROLES_INVITABLES,
    consultoriasParaInvitar: esAdminProciso
      ? state.consultorias.filter((c) => c.activa)
      : state.consultorias.filter((c) => c.id === yo?.consultoriaId),
    empresasDe: (consultoriaId: string) => state.empresas.filter((e) => e.consultoriaId === consultoriaId),

    async invitarUsuario(datos: NuevaInvitacion): Promise<boolean> {
      // El enlace del correo vuelve a esta misma app (tiene que estar en additional_redirect_urls).
      const resultado = await servicioEscritura.invitarUsuario(datos, window.location.origin)
      if (!resultado.ok) return fallo(resultado)
      dispatch({
        type: 'UPSERT_USUARIO',
        usuario: {
          id: resultado.valor.id,
          nombre: datos.nombre.trim(),
          email: resultado.valor.email,
          cargo: datos.cargo.trim(),
          rol: datos.rol,
          consultoriaId: datos.consultoriaId ?? undefined,
          empresaId: datos.empresaId ?? undefined,
          proyectosAsignados: [],
          activo: true,
          passwordTemp: true,
        },
      })
      return true
    },

    puedeAdministrar,
    puedeCambiarRol: (usuario: Usuario) => puedeAdministrar(usuario) && ROLES_DEL_EQUIPO.includes(usuario.rol),
    rolesDelEquipo: ROLES_DEL_EQUIPO,

    async cambiarRol(usuario: Usuario, rol: Rol): Promise<boolean> {
      const resultado = await servicioEscritura.administrarUsuario(usuario.id, { rol })
      if (!resultado.ok) return fallo(resultado)
      dispatch({ type: 'UPSERT_USUARIO', usuario: { ...usuario, rol } })
      return true
    },

    async cambiarAcceso(usuario: Usuario, activo: boolean): Promise<boolean> {
      const resultado = await servicioEscritura.administrarUsuario(usuario.id, { activo })
      if (!resultado.ok) return fallo(resultado)
      dispatch({ type: 'UPSERT_USUARIO', usuario: { ...usuario, activo } })
      return true
    },

    async crearConsultoria(datos: NuevaConsultoria): Promise<Consultoria | null> {
      const resultado = await servicioEscritura.crearConsultoria(datos)
      if (!resultado.ok) {
        fallo(resultado)
        return null
      }
      dispatch({ type: 'UPSERT_CONSULTORIA', consultoria: resultado.valor })
      return resultado.valor
    },

    async cambiarEstadoConsultoria(consultoria: Consultoria, activa: boolean): Promise<boolean> {
      const resultado = await servicioEscritura.cambiarEstadoConsultoria(consultoria.id, activa)
      if (!resultado.ok) return fallo(resultado)
      dispatch({ type: 'UPSERT_CONSULTORIA', consultoria: { ...consultoria, activa } })
      return true
    },
  }
}
