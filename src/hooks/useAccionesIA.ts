import { useApp } from '../context/AppContext'
import { formatearFecha } from '../lib/datos'
import { mensajeDeError } from '../lib/escrituras'
import { textoAvisoFallo } from '../lib/ia'
import { servicioEscritura } from '../lib/servicios'
import type { AnalisisIA } from '../types'
import { refrescarUsoIA, useUsoIA } from './useUsoIA'

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
  const { uso: usoIA, estado: estadoUsoIA } = useUsoIA(state.currentUser?.id, puedePedir)

  return {
    puedePedir,
    usoIA,
    estadoUsoIA,
    criterios: state.criterios,
    analisisDe: (fuente: FuenteAnalisis): AnalisisIA[] =>
      state.analisisIA.filter((a) => (fuente.tipo === 'documento' ? a.documentoId : a.evidenciaId) === fuente.id),

    // `duracionSegundos` solo viaja en modo video: el servidor la exige y rechaza lo que pase de 5 minutos.
    async analizar(fuente: FuenteAnalisis, criterioIds: string[], modo: 'texto' | 'video' = 'texto', duracionSegundos?: number): Promise<AnalisisIA | null> {
      if (!state.currentUser) return null
      // Variable aparte (no un literal): la propiedad extra pasa el control de tipos sin tocar el tipo del pedido en escrituras.ts.
      const pedido = {
        consultoriaId: state.currentUser.consultoriaId ?? null,
        proyectoId: fuente.proyectoId,
        fuenteTipo: fuente.tipo,
        documentoId: fuente.tipo === 'documento' ? fuente.id : undefined,
        evidenciaId: fuente.tipo === 'evidencia' ? fuente.id : undefined,
        criterioIds,
        ...(modo === 'video' ? { modo, duracionSegundos } : {}),
      }
      const resultado = await servicioEscritura.analizarConIA(
        pedido,
        state.currentUser.id,
        formatearFecha(new Date().toISOString()),
      )
      // Pida lo que pida (también si lo rechazó el tope), el contador se vuelve a leer de la BD.
      void refrescarUsoIA(state.currentUser.id)
      if (!resultado.ok) {
        showToast(mensajeDeError(resultado), 'error')
        return null
      }
      dispatch({ type: 'ADD_ANALISIS_IA', analisis: resultado.valor })
      if (resultado.valor.estado === 'Error') showToast(textoAvisoFallo(resultado.valor), 'error')
      else showToast('Preevaluación lista. Revísala antes de usarla.', 'success')
      return resultado.valor
    },
  }
}
