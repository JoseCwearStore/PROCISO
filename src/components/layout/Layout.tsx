import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { DemoBanner } from '../DemoBanner'
import { ToastContainer } from '../ui/Toast'
import { useApp } from '../../context/AppContext'
import { Dashboard } from '../../pages/Dashboard'
import { Empresas } from '../../pages/Empresas'
import { EmpresaDetalle } from '../../pages/EmpresaDetalle'
import { Proyectos } from '../../pages/Proyectos'
import { ProyectoDetalle } from '../../pages/ProyectoDetalle'
import { Notificaciones } from '../../pages/Notificaciones'
import { PlaceholderPage } from '../../pages/PlaceholderPage'
import { Unauthorized } from '../../pages/Unauthorized'
import TableroTareas from '../../pages/TableroTareas'
import LevantamientoProcesos from '../../pages/LevantamientoProcesos'
import Procesos from '../../pages/Procesos'
import Evidencias from '../../pages/Evidencias'
import Documentacion from '../../pages/Documentacion'
import Revisiones from '../../pages/Revisiones'
import ListasVerificacion from '../../pages/ListasVerificacion'
import NoConformidades from '../../pages/NoConformidades'
import Indicadores from '../../pages/Indicadores'
import Usuarios from '../../pages/Usuarios'
import Configuracion from '../../pages/Configuracion'
import Ayuda from '../../pages/Ayuda'
import { canAccess } from '../../config/permissions'
import PanelCliente from '../../pages/PanelCliente'
import PanelAdminProciso from '../../pages/PanelAdminProciso'

function PageRenderer() {
  const { state } = useApp()
  const { currentPage, currentRole } = state

  if (!canAccess(currentPage, currentRole)) {
    return <Unauthorized />
  }

  switch (currentPage) {
    case 'inicio':
      if (currentRole === 'Admin PROCISO') return <PanelAdminProciso />
      if (currentRole === 'Usuario Cliente') return <PanelCliente />
      return <Dashboard />
    case 'empresas': return <Empresas />
    case 'empresa-detalle': return <EmpresaDetalle />
    case 'proyectos': return <Proyectos />
    case 'proyecto-detalle': return <ProyectoDetalle />
    case 'levantamiento': return <LevantamientoProcesos />
    case 'procesos': return <Procesos />
    case 'evidencias': return <Evidencias />
    case 'documentacion': return <Documentacion />
    case 'revisiones': return <Revisiones />
    case 'listas-verificacion': return <ListasVerificacion />
    case 'no-conformidades': return <NoConformidades />
    case 'indicadores': return <Indicadores />
    case 'usuarios': return <Usuarios />
    case 'configuracion': return <Configuracion />
    case 'ayuda': return <Ayuda />
    case 'tareas': return <TableroTareas />
    case 'tablero-tareas': return <TableroTareas />
    case 'notificaciones': return <Notificaciones />
    case 'unauthorized': return <Unauthorized />
    default:
      return <PlaceholderPage />
  }
}

export function Layout() {
  const { state } = useApp()
  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar />
      <div className={`${state.sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} flex flex-col min-h-screen transition-[margin] duration-300`}>
        <TopBar />
        <DemoBanner />
        <main className="flex-1 pt-14">
          <PageRenderer />
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}
