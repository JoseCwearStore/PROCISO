import { ShieldOff } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useApp } from '../context/AppContext'

export function Unauthorized() {
  const { navigate } = useApp()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
        <ShieldOff className="w-8 h-8 text-red-500" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-1">Acceso no autorizado</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Tu rol actual no tiene permiso para acceder a esta sección. Cambia de rol en el menú superior o contacta al administrador.
        </p>
      </div>
      <Button variant="outline" onClick={() => navigate('inicio')}>
        Volver al inicio
      </Button>
    </div>
  )
}
