import { useApp } from '../context/AppContext'
import { usuariosAsignables } from '../lib/asignables'
import { formatearFecha } from '../lib/datos'
import { mensajeDeError } from '../lib/escrituras'
import { servicioEscritura } from '../lib/servicios'
import { fechaISO } from '../lib/tareas'
import type { ListaVerificacion, Rol, Tarea, Usuario } from '../types'

const EQUIPO: Rol[] = ['Admin PROCISO', 'Admin Consultoría', 'Consultor']

// Única puerta de escritura de listas desde la interfaz. El cliente las ve en
// lectura (la BD lo exige); el equipo las guarda junto con las tareas de
// seguimiento de los hallazgos, en una sola transacción.
export function useAccionesLista() {
  const { state, dispatch, showToast } = useApp()
  const esEquipo = EQUIPO.includes(state.currentRole)

  return {
    esEquipo,
    // El responsable recibe las tareas de seguimiento: misma regla que la BD.
    responsables: (proyectoId: string): Usuario[] => usuariosAsignables(state.usuarios, proyectoId),

    // Devuelve las tareas que se crearon (null si la BD rechazó la lista).
    async guardar(lista: ListaVerificacion): Promise<Tarea[] | null> {
      const resultado = await servicioEscritura.guardarLista(lista)
      if (!resultado.ok) {
        showToast(mensajeDeError(resultado), 'error')
        return null
      }
      // En pantalla, igual que lo guardó la BD: textos recortados y fecha dd/mm/aaaa.
      dispatch({
        type: 'UPSERT_LISTA',
        lista: {
          ...lista,
          nombre: lista.nombre.trim(),
          area: (lista.area ?? '').trim(),
          fecha: formatearFecha(fechaISO(lista.fecha)),
          preguntas: lista.preguntas.map((p) => ({ ...p, pregunta: p.pregunta.trim() })),
        },
      })
      for (const tarea of resultado.valor) dispatch({ type: 'ADD_TAREA', tarea })
      return resultado.valor
    },
  }
}
