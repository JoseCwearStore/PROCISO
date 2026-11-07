import { useApp } from '../context/AppContext'
import { formatearFecha } from '../lib/datos'
import { MENSAJES_ERROR_ESCRITURA } from '../lib/escrituras'
import { servicioEscritura } from '../lib/servicios'
import type { AnalisisIA } from '../types'

export interface FuenteAnalisis {
  tipo: 'documento' | 'evidencia'
  id: string
  proyectoId: string
  nombre: string
}

// Única puerta de la preevaluación con IA. Espejo de la BD (solo UX): el equipo
// del proyecto pide; el cliente lee. La BD y la Edge Function deciden.
export function useAccionesIA() {
  const { state, dispatch, showToast } = useApp()
  const puedePedir = state.currentRole === 'Admin Consultoría' || state.currentRole === 'Consultor'

  return {
    puedePedir,
    criterios: state.criterios,
    analisisDe: (fuente: FuenteAnalisis): AnalisisIA[] =>
      state.analisisIA.filter((a) => (fuente.tipo === 'documento' ? a.documentoId : a.evidenciaId) === fuente.id),

    async analizar(fuente: FuenteAnalisis, criterioIds: string[]): Promise<AnalisisIA | null> {
      if (!state.currentUser) return null
      const resultado = await servicioEscritura.analizarConIA(
        {
          consultoriaId: state.currentUser.consultoriaId ?? null,
          proyectoId: fuente.proyectoId,
          fuenteTipo: fuente.tipo,
          documentoId: fuente.tipo === 'documento' ? fuente.id : undefined,
          evidenciaId: fuente.tipo === 'evidencia' ? fuente.id : undefined,
          criterioIds,
        },
        state.currentUser.id,
        formatearFecha(new Date().toISOString()),
      )
      if (!resultado.ok) {
        showToast(MENSAJES_ERROR_ESCRITURA[resultado.error], 'error')
        return null
      }
      dispatch({ type: 'ADD_ANALISIS_IA', analisis: resultado.valor })
      if (resultado.valor.estado === 'Error') showToast('El análisis no se pudo completar. El motivo quedó registrado.', 'warning')
      else showToast('Preevaluación lista. Revísala antes de usarla.', 'success')
      return resultado.valor
    },
  }
}
