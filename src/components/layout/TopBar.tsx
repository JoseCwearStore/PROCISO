import { Menu, Bell, ChevronDown, Save, RefreshCw, WifiOff, AlertCircle, LogOut, Search } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { Rol } from '../../types'
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

const ROLES: Rol[] = ['Admin PROCISO', 'Admin Consultoría', 'Consultor', 'Usuario Cliente']

const SAVE_STATE_UI = {
  saved: { icon: Save, text: 'Guardado', color: 'text-green-600' },
  saving: { icon: RefreshCw, text: 'Guardando…', color: 'text-blue-600' },
  pending: { icon: WifiOff, text: 'Pend. sincronización', color: 'text-amber-600' },
  error: { icon: AlertCircle, text: 'Error al guardar', color: 'text-red-600' },
}

export function TopBar() {
  const { state, dispatch, navigate, unreadCount } = useApp()
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const title = PAGE_TITLES[state.currentPage] ?? 'PROCISO'
  const saveUI = SAVE_STATE_UI[state.saveState]
  const SaveIcon = saveUI.icon

  function selectRole(role: Rol) {
    dispatch({ type: 'SET_ROLE', role })
    setRoleDropdownOpen(false)
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

      {/* DEMO badge */}
      <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-amber-200">
        DEMO
      </span>

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
        onClick={() => dispatch({ type: 'LOGOUT' })}
        className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
      >
        <LogOut className="w-4 h-4" />
      </button>

      {/* Role selector */}
      <div className="relative">
        <button
          onClick={() => setRoleDropdownOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          aria-haspopup="listbox"
          aria-expanded={roleDropdownOpen}
        >
          <span className="block font-medium max-w-20 sm:max-w-[140px] truncate">{state.currentRole}</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>

        {roleDropdownOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setRoleDropdownOpen(false)} />
            <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-40 w-52 py-1 overflow-hidden">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold px-3 py-2 border-b border-slate-100">
                Cambiar rol (Demo)
              </p>
              {ROLES.map((role) => (
                <button
                  key={role}
                  role="option"
                  aria-selected={state.currentRole === role}
                  onClick={() => selectRole(role)}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                    state.currentRole === role
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
