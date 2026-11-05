import { useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const colorMap = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
}

const iconColorMap = {
  success: 'text-green-600',
  error: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-blue-600',
}

export function ToastContainer() {
  const { state, dispatch } = useApp()

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {state.toasts.map((toast) => {
        const Icon = iconMap[toast.type]
        return (
          <div
            key={toast.id}
            className={`
              flex items-start gap-3 p-4 rounded-lg border shadow-lg pointer-events-auto
              animate-in slide-in-from-bottom-2 fade-in duration-200
              ${colorMap[toast.type]}
            `}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColorMap[toast.type]}`} />
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => dispatch({ type: 'REMOVE_TOAST', id: toast.id })}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function AutoDismiss({ id, duration = 4500 }: { id: string; duration?: number }) {
  const { dispatch } = useApp()
  useEffect(() => {
    const t = setTimeout(() => dispatch({ type: 'REMOVE_TOAST', id }), duration)
    return () => clearTimeout(t)
  }, [id, duration, dispatch])
  return null
}
