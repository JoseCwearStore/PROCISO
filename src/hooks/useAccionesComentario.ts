import { useApp } from '../context/AppContext'
import { mensajeDeError } from '../lib/escrituras'
import { servicioEscritura } from '../lib/servicios'
import type { ComentarioGlobal } from '../types'

// Única puerta de escritura de la conversación transversal (public.comentarios).
// La BD decide: comenta quien ve el proyecto, a su nombre, sobre una entidad que
// existe en ese proyecto. Pesimista: si la BD lo rechaza, la pantalla no cambia.
export function useAccionesComentario() {
  const { state, dispatch, showToast } = useApp()

  return {
    async comentar(ref: Pick<ComentarioGlobal, 'entidadTipo' | 'entidadId' | 'proyectoId'>, texto: string): Promise<boolean> {
      const resultado = await servicioEscritura.comentar(state.currentUser?.consultoriaId ?? null, ref, texto)
      if (!resultado.ok) {
        showToast(mensajeDeError(resultado), 'error')
        return false
      }
      const comentario = resultado.valor
      dispatch({ type: 'ADD_COMENTARIO_GLOBAL', comentario })

      // La tarea muestra sus propios comentarios: que se vea sin recargar.
      const tarea = ref.entidadTipo === 'tarea' ? state.tareas.find((t) => t.id === ref.entidadId) : undefined
      if (tarea) {
        dispatch({
          type: 'UPDATE_TAREA',
          id: tarea.id,
          updates: {
            comentarios: [
              ...tarea.comentarios,
              { id: comentario.id, autorId: comentario.autorId, fecha: comentario.fecha, texto: comentario.texto },
            ],
          },
        })
      }
      return true
    },
  }
}
