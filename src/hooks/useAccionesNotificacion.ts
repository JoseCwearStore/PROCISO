import { useApp } from '../context/AppContext'
import { mensajeDeError } from '../lib/escrituras'
import { servicioEscritura } from '../lib/servicios'

// Única puerta de escritura de notificaciones: lo único que se guarda es "leída".
// Las notificaciones en sí las calcula la BD (mis_notificaciones); acá no se crean.
// Pesimista: si la BD no la guardó, sigue sin leer.
export function useAccionesNotificacion() {
  const { dispatch, showToast } = useApp()

  return {
    async marcarLeidas(ids: string[]): Promise<boolean> {
      if (ids.length === 0) return true
      const resultado = await servicioEscritura.marcarNotificacionesLeidas(ids)
      if (!resultado.ok) {
        showToast(mensajeDeError(resultado), 'error')
        return false
      }
      dispatch({ type: 'MARCAR_LEIDAS', ids })
      return true
    },
  }
}
