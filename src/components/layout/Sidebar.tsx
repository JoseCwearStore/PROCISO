import {
  Home,
  Building2,
  FolderKanban,
  ClipboardList,
  GitBranch,
  Paperclip,
  FileText,
  CheckSquare,
  LayoutDashboard,
  ClipboardCheck,
  AlertOctagon,
  BarChart2,
  Bell,
  Users,
  Settings,
  HelpCircle,
  ChevronRight,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { PageId } from '../../types'
import { canAccess } from '../../config/permissions'

interface NavItem {
  id: PageId
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: 'vencidas' | 'unread'
}

const NAV_ITEMS: NavItem[] = [
  { id: 'inicio', label: 'Inicio', icon: Home },
  { id: 'empresas', label: 'Empresas cliente', icon: Building2 },
  { id: 'proyectos', label: 'Proyectos', icon: FolderKanban },
  { id: 'levantamiento', label: 'Levantamiento de procesos', icon: ClipboardList },
  { id: 'procesos', label: 'Procesos', icon: GitBranch },
  { id: 'evidencias', label: 'Evidencias', icon: Paperclip },
  { id: 'documentacion', label: 'Documentación', icon: FileText },
  { id: 'revisiones', label: 'Revisiones y aprobaciones', icon: CheckSquare },
  { id: 'tablero-tareas', label: 'Tablero de tareas', icon: LayoutDashboard, badge: 'vencidas' },
  { id: 'listas-verificacion', label: 'Listas de verificación', icon: ClipboardCheck },
  { id: 'no-conformidades', label: 'No conformidades', icon: AlertOctagon },
  { id: 'indicadores', label: 'Indicadores e informes', icon: BarChart2 },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell, badge: 'unread' },
  { id: 'usuarios', label: 'Usuarios y permisos', icon: Users },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
  { id: 'ayuda', label: 'Ayuda y soporte', icon: HelpCircle },
]

const NAVY_BACKGROUND_ITEMS = new Set<PageId>([
  'empresas',
  'proyectos',
  'levantamiento',
  'procesos',
  'evidencias',
  'documentacion',
  'revisiones',
  'listas-verificacion',
  'no-conformidades',
  'indicadores',
  'usuarios',
  'configuracion',
  'ayuda',
])

export function Sidebar() {
  const { state, dispatch, navigate, unreadCount, tareasVencidas } = useApp()
  // La consultoría real de quien inició sesión (el Admin PROCISO no pertenece a ninguna).
  const nombreConsultoria = state.consultorias.find((c) => c.id === state.currentUser?.consultoriaId)?.nombre ?? 'PROCISO'
  const visibleItems = NAV_ITEMS.filter((item) => canAccess(item.id, state.currentRole))

  return (
    <>
      {/* Mobile overlay */}
      {state.sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => dispatch({ type: 'SET_SIDEBAR', open: false })}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40 flex flex-col w-64
          transition-[width,transform] duration-300
          ${state.sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}
          ${state.sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ backgroundColor: '#0B2545' }}
      >
        {/* Logo */}
        <div
          className={`flex items-center justify-between h-14 flex-shrink-0 px-5 ${state.sidebarCollapsed ? 'lg:px-3' : ''}`}
          style={{
            backgroundColor: '#0B2545',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <img
            src="/prociso-logo-horizontal-dark.svg"
            alt="PROCISO"
            className={`h-9 w-auto max-w-44 ${state.sidebarCollapsed ? 'lg:hidden' : ''}`}
          />
          <img
            src="/prociso-icon.svg"
            alt="PROCISO"
            className={`h-10 w-10 ${state.sidebarCollapsed ? 'hidden lg:block' : 'hidden'}`}
          />
          <button
            onClick={() => dispatch({ type: 'SET_SIDEBAR', open: false })}
            className="lg:hidden text-white/60 hover:text-white"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR_COLLAPSED' })}
          className="absolute -right-3 top-20 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-navy lg:flex"
          aria-label={state.sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          title={state.sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {state.sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>

        {/* Role badge */}
        <div
          className={`px-4 pt-3 pb-1 ${state.sidebarCollapsed ? 'lg:hidden' : ''}`}
          style={{ backgroundColor: '#0B2545' }}
        >
          <div className="rounded-md px-3 py-2 text-xs" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <span className="text-white/50 block text-[10px] uppercase tracking-wider mb-0.5">Rol actual</span>
            <span className="text-white/90 font-medium">{state.currentRole}</span>
          </div>
        </div>

        {/* Nav */}
        <nav
          className="flex-1 overflow-y-auto py-2 px-2"
          aria-label="Navegación principal"
          style={{ backgroundColor: '#0B2545' }}
        >
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive = state.currentPage === item.id || (state.currentPage === 'empresa-detalle' && item.id === 'empresas') || (state.currentPage === 'proyecto-detalle' && item.id === 'proyectos')
            const badgeCount = item.badge === 'unread' ? unreadCount : item.badge === 'vencidas' ? tareasVencidas : 0

            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-100 mb-0.5 text-left
                  ${state.sidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}
                  ${isActive
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/65 hover:text-white hover:bg-white/10'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
                style={
                  item.id === 'inicio' && isActive
                    ? { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
                    : NAVY_BACKGROUND_ITEMS.has(item.id)
                      ? { backgroundColor: '#0B2545' }
                      : undefined
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className={`flex-1 truncate ${state.sidebarCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                {badgeCount > 0 && (
                  <span className={`
                    text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1
                    ${state.sidebarCollapsed ? 'lg:hidden' : ''}
                    ${item.badge === 'vencidas' ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-900'}
                  `}>
                    {badgeCount}
                  </span>
                )}
                {isActive && <ChevronRight className={`w-3.5 h-3.5 opacity-60 flex-shrink-0 ${state.sidebarCollapsed ? 'lg:hidden' : ''}`} />}
              </button>
            )
          })}
        </nav>

        {/* Bottom */}
        <div
          className={`px-4 py-3 flex-shrink-0 ${state.sidebarCollapsed ? 'lg:hidden' : ''}`}
          style={{
            backgroundColor: '#0B2545',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <p className="text-[10px] text-white/30 text-center">{nombreConsultoria} · ISO 9001:2026</p>
        </div>
      </aside>
    </>
  )
}
