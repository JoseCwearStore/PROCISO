import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { MENSAJES_ERROR_ESCRITURA } from '../lib/escrituras'
import { servicioSoporte } from '../lib/servicios'
import type { ReporteSoporte, TipoReporte } from '../lib/soporte'

// Única puerta de la pantalla de soporte. Espejo de la BD (solo UX): cualquiera envía; el autor ve
// los suyos; el Admin Consultoría ve los de su consultoría y el Admin PROCISO todos, y solo ellos
// los marcan como atendidos. Quien decide es la BD.
export function useSoporte() {
  const { state, showToast } = useApp()
  const [reportes, setReportes] = useState<ReporteSoporte[] | null>(null)
  const [enviando, setEnviando] = useState(false)
  const miId = state.currentUser?.id
  const esAdmin = state.currentRole === 'Admin Consultoría' || state.currentRole === 'Admin PROCISO'

  const cargar = useCallback(async () => setReportes(await servicioSoporte.listar()), [])
  useEffect(() => {
    void cargar()
  }, [cargar, miId])

  return {
    reportes,
    miId,
    esAdmin,
    enviando,

    async enviar(pedido: { tipo: TipoReporte; asunto: string; mensaje: string }): Promise<boolean> {
      setEnviando(true)
      const resultado = await servicioSoporte.enviar(pedido)
      setEnviando(false)
      if (!resultado.ok) {
        showToast(MENSAJES_ERROR_ESCRITURA[resultado.error], 'error')
        return false
      }
      showToast('Reporte enviado. Un administrador lo revisará.', 'success')
      await cargar()
      return true
    },

    async atender(id: string): Promise<void> {
      const resultado = await servicioSoporte.atender(id)
      if (!resultado.ok) showToast(MENSAJES_ERROR_ESCRITURA[resultado.error], 'error')
      else showToast('Reporte marcado como atendido.', 'success')
      await cargar()
    },
  }
}
