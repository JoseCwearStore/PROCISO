import { Menu, Bell, Save, RefreshCw, WifiOff, AlertCircle, LogOut, Search } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { servicioAuth } from '../../lib/servicios'
import { GlobalSearch } from '../GlobalSearch'

const PAGE_TITLES: Record<string, string> = {
  inicio: 'Inicio',
  empresas: 'Empresas cliente',
  'empresa-detalle': 'Detalle de empresa',
  proyectos: 'Proyectos',
  'proyecto-detalle': 'Detalle de proyecto',
  levantamiento: 'Levantamiento de procesos',
  procesos: 'Procesos',
  evidencias: 'Evidencias',
  documentacion: 'Documentación',
  revisiones: 'Revisiones y aprobaciones',
  tareas: 'Tablero de tareas',
  'listas-verificacion': 'Listas de verificación',
  'no-conformidades': 'No conformidades',
  indicadores: 'Indicadores e informes',
  'tablero-tareas': 'Tablero de tareas',
  notificaciones: 'Notificaciones',
  usuarios: 'Usuarios y permisos',
  configuracion: 'Configuración',
  ayuda: 'Ayuda y soporte',
  unauthorized: 'Acceso no autorizado',
}

const SAVE_STATE_UI = {
  saved: { icon: Save, text: 'Guardado', color: 'text-green-600' },
  saving: { icon: RefreshCw, text: 'Guardando…', color: 'text-blue-600' },
  pending: { icon: WifiOff, text: 'Pend. sincronización', color: 'text-amber-600' },
  error: { icon: AlertCircle, text: 'Error al guardar', color: 'text-red-600' },
}

export function TopBar() {
  const { state, dispatch, navigate, unreadCount } = useApp()
  const [searchOpen, setSearchOpen] = useState(false)
  const title = PAGE_TITLES[state.currentPage] ?? 'PROCISO'
  const saveUI = SAVE_STATE_UI[state.saveState]
  const SaveIcon = saveUI.icon

  async function cerrarSesion() {
    await servicioAuth.cerrarSesion()
    dispatch({ type: 'LOGOUT' })
  }

  return (
    <header className={`fixed top-0 left-0 ${state.sidebarCollapsed ? 'lg:left-20' : 'lg:left-64'} right-0 h-14 z-20 bg-white border-b border-slate-200 flex items-center px-4 gap-3 transition-[left] duration-300`}>
      {/* Hamburger mobile */}
      <button
        onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Title */}
      <h1 className="font-semibold text-slate-900 text-sm flex-1 truncate">{title}</h1>

      {/* Save state indicator */}
      <div className={`hidden sm:flex items-center gap-1.5 text-xs ${saveUI.color}`}>
        <SaveIcon className="w-3.5 h-3.5" />
        <span>{saveUI.text}</span>
        <span className="text-slate-400 text-[10px] font-medium ml-1 bg-slate-100 px-1.5 py-0.5 rounded">
          Requiere integración
        </span>
      </div>

      {/* Notifications */}
      <button
        onClick={() => setSearchOpen(true)}
        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        aria-label="Abrir búsqueda global"
        title="Búsqueda global"
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Notifications */}
      <button
        onClick={() => navigate('notificaciones')}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        aria-label={`Notificaciones${unreadCount > 0 ? `, ${unreadCount} sin leer` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Logout */}
      <button
        onClick={cerrarSesion}
        className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
      >
        <LogOut className="w-4 h-4" />
      </button>

      {/* Usuario de la sesión: el rol viene de la base de datos, no se elige */}
      <div className="flex flex-col items-end leading-tight px-3 py-1 rounded-lg border border-slate-200 text-slate-700">
        <span className="block text-sm font-medium max-w-20 sm:max-w-[160px] truncate">{state.currentUser?.nombre}</span>
        <span className="block text-[11px] text-slate-500 max-w-20 sm:max-w-[160px] truncate">{state.currentRole}</span>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
