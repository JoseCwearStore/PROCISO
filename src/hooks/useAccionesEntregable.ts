import { useApp } from '../context/AppContext'
import { formatearFecha } from '../lib/datos'
import { accionesEntregable, documentoListo } from '../lib/entregables'
import { type NuevoEntregable, mensajeDeError, type FallaEscritura } from '../lib/escrituras'
import { entregableCambio } from '../lib/refresco'
import { servicioEscritura } from '../lib/servicios'
import { hoyLocal } from '../lib/tareas'
import type { Entregable, EstadoEntregable, Rol } from '../types'

const EQUIPO: Rol[] = ['Admin PROCISO', 'Admin Consultoría', 'Consultor']

// Única puerta de escritura de entregables desde la interfaz. El equipo registra y
// entrega; el cliente aprueba o rechaza. Escritura pesimista: primero la BD.
export function useAccionesEntregable() {
  const { state, dispatch, showToast, refrescarDatos } = useApp()
  const esEquipo = EQUIPO.includes(state.currentRole)

  const fallo = (falla: FallaEscritura) => {
    showToast(mensajeDeError(falla), 'error')
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
      if (!resultado.ok) return fallo(resultado)
      dispatch({ type: 'ADD_ENTREGABLE', entregable: resultado.valor })
      return resultado.valor
    },

    // Lo mismo que hace decidir_entregable: estado y, si se aprueba, quién y cuándo.
    async decidir(entregable: Entregable, estado: Exclude<EstadoEntregable, 'Pendiente'>, comentario?: string): Promise<boolean> {
      // AUD06-M1: antes de decidir se relee la BD. Si el entregable cambió mientras estaba abierto no se decide
      // (la BD no tiene control de versión para entregables: esta guarda es lo único que lo evita). Si la
      // relectura falla (sin red) se intenta igual: la BD tiene la última palabra.
      const fresco = await refrescarDatos()
      if (fresco && entregableCambio(entregable, fresco.entregables.find((e) => e.id === entregable.id))) {
        showToast('Este entregable cambió desde que lo abriste. Revisa la versión actual antes de decidir.', 'warning')
        return false
      }
      const resultado = await servicioEscritura.decidirEntregable(entregable.id, estado, comentario)
      if (!resultado.ok) return fallo(resultado) !== null
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
