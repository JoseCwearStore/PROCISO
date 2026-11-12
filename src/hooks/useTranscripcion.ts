import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { mensajeDeError } from '../lib/escrituras'
import { servicioTranscripciones } from '../lib/servicios'
import type { Transcripcion } from '../lib/transcripciones'

export type TrabajoTranscripcion = 'transcribiendo' | 'guardando' | null

// Única puerta de la transcripción de un audio o video. Espejo de la BD (solo UX): el equipo transcribe y corrige;
// el cliente solo lee. Quien decide es la BD y la Edge Function. Sin id (la evidencia no es audio ni video) no hace nada.
//
// "No se pudo leer" (errorLectura) NO es lo mismo que "todavía no hay": con un error de lectura la pantalla no ofrece
// transcribir, porque pisaría un texto que el equipo ya corrigió.
export function useTranscripcion(evidenciaId: string | null) {
  const { showToast } = useApp()
  const [transcripcion, setTranscripcion] = useState<Transcripcion | null>(null)
  const [cargado, setCargado] = useState(false)
  const [errorLectura, setErrorLectura] = useState(false)
  const [trabajo, setTrabajo] = useState<TrabajoTranscripcion>(null)

  const leer = useCallback(async (id: string, vigente: () => boolean) => {
    const resultado = await servicioTranscripciones.leer(id)
    if (!vigente()) return
    setCargado(true)
    if (!resultado.ok) {
      setErrorLectura(true)
      return
    }
    setErrorLectura(false)
    setTranscripcion(resultado.valor)
  }, [])

  useEffect(() => {
    let activo = true
    setTranscripcion(null)
    setCargado(false)
    setErrorLectura(false)
    if (evidenciaId) void leer(evidenciaId, () => activo)
    return () => {
      activo = false
    }
  }, [evidenciaId, leer])

  return {
    transcripcion,
    cargado,
    errorLectura,
    trabajo,

    async recargar(): Promise<void> {
      if (!evidenciaId) return
      setCargado(false)
      await leer(evidenciaId, () => true)
    },

    async transcribir(): Promise<boolean> {
      if (!evidenciaId) return false
      setTrabajo('transcribiendo')
      const resultado = await servicioTranscripciones.transcribir(evidenciaId)
      setTrabajo(null)
      if (!resultado.ok) {
        showToast(mensajeDeError(resultado), 'error')
        return false
      }
      if (resultado.valor.estado === 'Error') {
        showToast(resultado.valor.error, 'error')
        return false
      }
      showToast('Transcripción lista. Revísala y corrígela antes de analizar.', 'success')
      await leer(evidenciaId, () => true)
      return true
    },

    async corregir(texto: string): Promise<boolean> {
      if (!evidenciaId) return false
      setTrabajo('guardando')
      const resultado = await servicioTranscripciones.corregir(evidenciaId, texto)
      setTrabajo(null)
      if (!resultado.ok) {
        showToast(mensajeDeError(resultado), 'error')
        return false
      }
      showToast('Corrección guardada.', 'success')
      await leer(evidenciaId, () => true)
      return true
    },
  }
}
