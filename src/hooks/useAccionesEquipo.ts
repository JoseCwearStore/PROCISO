import { useApp } from '../context/AppContext'
import { mensajeDeError, type ResultadoEscritura } from '../lib/escrituras'
import { servicioEscritura } from '../lib/servicios'
import type { Proyecto } from '../types'

type ProyectoEquipo = Pick<Proyecto, 'id' | 'consultorId' | 'equipoIds'>

// Única puerta del equipo de un proyecto (L5d, AUD05-M2, D8). Espejo de la BD (solo UX): solo el Admin de
// la consultoría arma el equipo; un consultor lo ve pero no lo cambia. La BD decide y deja historial.
// Escritura pesimista: primero la BD; si acepta, se refleja lo mismo que hizo el servidor.
export function useAccionesEquipo() {
  const { state, dispatch, showToast } = useApp()
  const puedeGestionar = state.currentRole === 'Admin Consultoría'
  const consultoriaId = state.currentUser?.consultoriaId

  async function aplicar(
    operacion: Promise<ResultadoEscritura<void>>,
    proyectoId: string,
    cambios: Partial<Proyecto>,
    exito: string,
  ): Promise<boolean> {
    const resultado = await operacion
    if (!resultado.ok) {
      showToast(mensajeDeError(resultado), 'error')
      return false
    }
    dispatch({ type: 'UPDATE_PROYECTO', id: proyectoId, updates: cambios })
    showToast(exito, 'success')
    return true
  }

  return {
    puedeGestionar,
    consultoriaId,

    agregar: (proyecto: ProyectoEquipo, usuarioId: string) =>
      aplicar(servicioEscritura.agregarMiembroProyecto(proyecto.id, usuarioId), proyecto.id,
        { equipoIds: [...new Set([...proyecto.equipoIds, usuarioId])] }, 'Persona agregada al equipo.'),

    quitar: (proyecto: ProyectoEquipo, usuarioId: string) =>
      aplicar(servicioEscritura.quitarMiembroProyecto(proyecto.id, usuarioId), proyecto.id,
        { equipoIds: proyecto.equipoIds.filter((id) => id !== usuarioId) }, 'Persona quitada del equipo.'),

    // La BD suma al nuevo responsable al equipo si no estaba: la pantalla lo refleja igual.
    cambiarResponsable: (proyecto: ProyectoEquipo, usuarioId: string) =>
      aplicar(servicioEscritura.cambiarConsultorProyecto(proyecto.id, usuarioId), proyecto.id,
        { consultorId: usuarioId, equipoIds: [...new Set([...proyecto.equipoIds, usuarioId])] }, 'Consultor responsable actualizado.'),
  }
}
