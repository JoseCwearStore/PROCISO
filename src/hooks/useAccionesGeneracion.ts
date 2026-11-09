import { MENSAJES_ERROR_ESCRITURA, type ResultadoGeneracionIA } from '../lib/escrituras'
import type { PedidoGeneracionIA } from '../lib/generacion'
import { servicioEscritura } from '../lib/servicios'

// Única puerta de la redacción con IA de borradores. Siempre devuelve un resultado: si la IA
// o el servicio fallan vuelve como "Error" con su motivo, porque el borrador se genera igual
// con las respuestas del usuario (plan B). La autorización real la hace la BD (RLS) en la
// Edge Function; el generador solo lo ve el equipo.
export function useAccionesGeneracion() {
  return {
    async redactar(pedido: PedidoGeneracionIA): Promise<ResultadoGeneracionIA> {
      const resultado = await servicioEscritura.generarTextosConIA(pedido)
      if (!resultado.ok) return { estado: 'Error', error: MENSAJES_ERROR_ESCRITURA[resultado.error] }
      return resultado.valor
    },
  }
}
