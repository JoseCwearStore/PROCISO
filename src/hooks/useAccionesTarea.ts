import { useApp } from '../context/AppContext'
import { usuariosAsignables } from '../lib/asignables'
import { formatearFecha } from '../lib/datos'
import { randomUUID } from '../lib/uuid'
import { type CambiosTarea, type NuevaTarea, mensajeDeError, type FallaEscritura } from '../lib/escrituras'
import { servicioEscritura } from '../lib/servicios'
import { fechaISO, hoyLocal, transicionesPermitidas } from '../lib/tareas'
import type { EstadoTarea, Rol, Tarea, Usuario } from '../types'

const EQUIPO: Rol[] = ['Admin PROCISO', 'Admin Consultoría', 'Consultor']

// Única puerta de escritura de tareas desde la interfaz. Escritura pesimista:
// primero la BD; si la BD acepta, se refleja en pantalla lo mismo que hizo el servidor.
export function useAccionesTarea() {
  const { state, dispatch, showToast } = useApp()
  const usuarioId = state.currentUser?.id
  const consultoriaId = state.currentUser?.consultoriaId ?? null
  // Quién ve el proyecto lo decide el RLS: si un consultor lo ve, es del equipo.
  const esEquipo = EQUIPO.includes(state.currentRole)

  const fallo = (falla: FallaEscritura) => {
    showToast(mensajeDeError(falla), 'error')
    return null
  }

  return {
    esEquipo,

    permitidas: (tarea: Pick<Tarea, 'estado' | 'asignadoAId'>) => transicionesPermitidas(tarea, usuarioId, esEquipo),

    // Mismo criterio que la BD (private.es_asignable): equipo del proyecto o clientes de su empresa.
    asignables: (proyectoId: string): Usuario[] => usuariosAsignables(state.usuarios, proyectoId),

    async crear(nueva: Omit<NuevaTarea, 'id'>): Promise<Tarea | null> {
      const resultado = await servicioEscritura.crearTarea(consultoriaId, { ...nueva, id: randomUUID() })
      if (!resultado.ok) return fallo(resultado)
      dispatch({ type: 'ADD_TAREA', tarea: resultado.valor })
      return resultado.valor
    },

    async editar(tarea: Tarea, cambios: CambiosTarea): Promise<Tarea | null> {
      if (Object.keys(cambios).length === 0) return tarea
      const resultado = await servicioEscritura.editarTarea(tarea.id, cambios)
      if (!resultado.ok) return fallo(resultado)
      // En pantalla, igual que lo guardó la BD: textos recortados y fecha dd/mm/aaaa.
      const updates: Partial<Tarea> = { ...cambios }
      if (cambios.titulo !== undefined) updates.titulo = cambios.titulo.trim()
      if (cambios.descripcion !== undefined) updates.descripcion = cambios.descripcion.trim()
      if (cambios.fechaVencimiento) updates.fechaVencimiento = formatearFecha(fechaISO(cambios.fechaVencimiento))
      dispatch({ type: 'UPDATE_TAREA', id: tarea.id, updates })
      return { ...tarea, ...updates }
    },

    async cambiarEstado(tarea: Tarea, estado: EstadoTarea, comentario?: string): Promise<Tarea | null> {
      const resultado = await servicioEscritura.cambiarEstadoTarea(tarea.id, estado, comentario)
      if (!resultado.ok) return fallo(resultado)

      // Lo mismo que hizo cambiar_estado_tarea en la BD: estado, historial y comentario.
      const fecha = formatearFecha(hoyLocal())
      const texto = comentario?.trim()
      const updates: Partial<Tarea> = {
        estado,
        fechaCompletada: estado === 'Completada' ? fecha : undefined,
        historial: [...tarea.historial, { fecha, autorId: usuarioId ?? '', de: tarea.estado, a: estado }],
        comentarios: texto
          ? [...tarea.comentarios, { id: randomUUID(), autorId: usuarioId ?? '', fecha, texto }]
          : tarea.comentarios,
      }
      dispatch({ type: 'UPDATE_TAREA', id: tarea.id, updates })
      return { ...tarea, ...updates }
    },

    async comentar(tarea: Tarea, texto: string): Promise<Tarea | null> {
      const resultado = await servicioEscritura.comentarTarea(consultoriaId, tarea, texto)
      if (!resultado.ok) return fallo(resultado)
      const comentarios = [...tarea.comentarios, resultado.valor]
      dispatch({ type: 'UPDATE_TAREA', id: tarea.id, updates: { comentarios } })
      return { ...tarea, comentarios }
    },
  }
}
