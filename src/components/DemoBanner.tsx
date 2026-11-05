import { X, FlaskConical } from 'lucide-react'
import { useApp } from '../context/AppContext'

export function DemoBanner() {
  const { state, dispatch } = useApp()
  if (state.bannerDismissed) return null

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3">
      <FlaskConical className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <p className="text-xs text-amber-800 flex-1">
        <strong>Prototipo con datos ficticios.</strong> Sin servidor ni almacenamiento real conectado. Los cambios se mantienen únicamente durante esta sesión de navegación.
      </p>
      <button
        onClick={() => dispatch({ type: 'DISMISS_BANNER' })}
        className="text-amber-600 hover:text-amber-800 transition-colors flex-shrink-0"
        aria-label="Cerrar aviso"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
