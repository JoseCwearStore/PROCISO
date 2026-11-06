import { useApp } from '../context/AppContext'
import { formatearFecha } from '../lib/datos'
import { accionesEntregable, documentoListo } from '../lib/entregables'
import { MENSAJES_ERROR_ESCRITURA, type NuevoEntregable } from '../lib/escrituras'
import { servicioEscritura } from '../lib/servicios'
import { hoyLocal } from '../lib/tareas'
import type { Entregable, EstadoEntregable, Rol } from '../types'

const EQUIPO: Rol[] = ['Admin PROCISO', 'Admin Consultoría', 'Consultor']

// Única puerta de escritura de entregables desde la interfaz. El equipo registra y
// entrega; el cliente aprueba o rechaza. Escritura pesimista: primero la BD.
export function useAccionesEntregable() {
  const { state, dispatch, showToast } = useApp()
  const esEquipo = EQUIPO.includes(state.currentRole)

  const fallo = (error: keyof typeof MENSAJES_ERROR_ESCRITURA) => {
    showToast(MENSAJES_ERROR_ESCRITURA[error], 'error')
    return null
  }

  return {
    esEquipo,
    acciones: (entregable: Entregable) => accionesEntregable(entregable, esEquipo),
    documentoListo: (entregable: Entregable) => documentoListo(entregable, state.documentos),
    documento: (entregable: Entregable) => state.documentos.find((d) => d.id === entregable.documentoId),

    async registrar(datos: NuevoEntregable): Promise<Entregable | null> {
      const resultado = await servicioEscritura.registrarEntregable(
        state.currentUser?.consultoriaId ?? null,
        crypto.randomUUID(),
        datos,
      )
      if (!resultado.ok) return fallo(resultado.error)
      dispatch({ type: 'ADD_ENTREGABLE', entregable: resultado.valor })
      return resultado.valor
    },

    // Lo mismo que hace decidir_entregable: estado y, si se aprueba, quién y cuándo.
    async decidir(entregable: Entregable, estado: Exclude<EstadoEntregable, 'Pendiente'>, comentario?: string): Promise<boolean> {
      const resultado = await servicioEscritura.decidirEntregable(entregable.id, estado, comentario)
      if (!resultado.ok) return fallo(resultado.error) !== null
      const aprobado = estado === 'Aprobado'
      dispatch({
        type: 'UPDATE_ENTREGABLE',
        id: entregable.id,
        updates: {
          estado,
          aprobadoPorId: aprobado ? state.currentUser?.id : undefined,
          fechaAprobacion: aprobado ? formatearFecha(hoyLocal()) : undefined,
        },
      })
      return true
    },
  }
}
