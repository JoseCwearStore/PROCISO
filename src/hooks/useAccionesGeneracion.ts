import { useApp } from '../context/AppContext'
import { MENSAJES_ERROR_ESCRITURA, type ResultadoGeneracionIA } from '../lib/escrituras'
import type { PedidoGeneracionIA } from '../lib/generacion'
import { servicioEscritura } from '../lib/servicios'
import { refrescarUsoIA, useUsoIA } from './useUsoIA'

// Única puerta de la redacción con IA de borradores. Siempre devuelve un resultado: si la IA
// o el servicio fallan vuelve como "Error" con su motivo, porque el borrador se genera igual
// con las respuestas del usuario (plan B). La autorización real la hace la BD (RLS) en la
// Edge Function; el generador solo lo ve el equipo.
export function useAccionesGeneracion() {
  const { state } = useApp()
  const puedePedir = state.currentRole === 'Admin Consultoría' || state.currentRole === 'Consultor'
  const { uso: usoIA, estado: estadoUsoIA } = useUsoIA(state.currentUser?.id, puedePedir)

  return {
    usoIA,
    estadoUsoIA,
    async redactar(pedido: PedidoGeneracionIA): Promise<ResultadoGeneracionIA> {
      const resultado = await servicioEscritura.generarTextosConIA(pedido)
      // Pida lo que pida (también si lo rechazó el tope), el contador se vuelve a leer de la BD.
      if (state.currentUser) void refrescarUsoIA(state.currentUser.id)
      if (!resultado.ok) return { estado: 'Error', error: MENSAJES_ERROR_ESCRITURA[resultado.error] }
      return resultado.valor
    },
  }
}
