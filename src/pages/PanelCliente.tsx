import { AlertTriangle, CheckCircle2, FileCheck2, ListTodo, Paperclip, Upload } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'

export default function PanelCliente() {
  const { state, navigate, getProyecto } = useApp()
  const usuarioSesion = state.usuarios.find((item) => item.email === state.currentUser?.email)
  const usuarioCliente = usuarioSesion?.empresaId ? usuarioSesion : state.usuarios.find((item) => item.rol === 'Usuario Cliente' && item.activo)
  const empresa = state.empresas.find((item) => item.id === usuarioCliente?.empresaId)
  const proyectos = state.proyectos.filter((item) => item.empresaId === empresa?.id)
  const proyectoIds = new Set(proyectos.map((item) => item.id))
  const tareas = state.tareas.filter((item) => proyectoIds.has(item.proyectoId))
  const evidencias = state.evidencias.filter((item) => proyectoIds.has(item.proyectoId))
  const documentos = state.documentos.filter((item) => proyectoIds.has(item.proyectoId))
  const correcciones = [
    ...tareas.filter((item) => item.estado === 'Requiere corrección').map((item) => ({ id: item.id, titulo: item.titulo, tipo: 'Tarea' })),
    ...evidencias.filter((item) => item.estado === 'Requiere corrección').map((item) => ({ id: item.id, titulo: item.nombre, tipo: 'Evidencia' })),
    ...documentos.filter((item) => item.estado === 'En corrección' || item.estado === 'Rechazado').map((item) => ({ id: item.id, titulo: item.nombre, tipo: 'Documento' })),
  ]
  const solicitudes = tareas.filter((item) => ['Pendiente', 'En proceso', 'En revisión'].includes(item.estado)).length +
    evidencias.filter((item) => item.estado === 'Pendiente').length + correcciones.length
  const compartidos = documentos.filter((item) => item.estado === 'Aprobado')

  if (!empresa) {
    return <div className="p-6"><div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-amber-500" /><p className="mt-3 font-semibold text-amber-800">Usuario sin empresa asignada</p><p className="mt-1 text-sm text-amber-700">Solicita a la consultoría que vincule tu acceso con una empresa cliente.</p></div></div>
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Flujo J · Portal de empresa cliente</p><h2 className="mt-1 text-2xl font-bold text-navy">Hola, {usuarioCliente?.nombre.split(' ')[0]}</h2><p className="mt-1 text-sm text-slate-500">{empresa.nombre} · Solo se muestra información vinculada con tu empresa.</p></div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<AlertTriangle className="h-5 w-5" />} label="Solicitudes pendientes" value={solicitudes} color="amber" onClick={() => navigate('tablero-tareas')} />
        <Kpi icon={<ListTodo className="h-5 w-5" />} label="Tareas activas" value={tareas.filter((item) => item.estado !== 'Completada').length} color="blue" onClick={() => navigate('tablero-tareas')} />
        <Kpi icon={<FileCheck2 className="h-5 w-5" />} label="Documentos compartidos" value={compartidos.length} color="green" onClick={() => navigate('documentacion')} />
        <Kpi icon={<AlertTriangle className="h-5 w-5" />} label="Correcciones solicitadas" value={correcciones.length} color="red" onClick={() => navigate('notificaciones')} />
      </div>

      <div className="mb-6 flex flex-wrap gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4"><div className="min-w-0 flex-1"><p className="font-semibold text-blue-900">¿Necesitas compartir información del proceso?</p><p className="mt-1 text-sm text-blue-700">Carga una fotografía, video, audio o documento y vincúlalo con el proceso correspondiente.</p></div><Button onClick={() => navigate('evidencias')} icon={<Upload className="h-4 w-4" />}>Subir evidencia</Button></div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-slate-800">Mis tareas</h3><Button variant="ghost" size="sm" onClick={() => navigate('tablero-tareas')}>Ver tablero</Button></div>{tareas.length === 0 ? <Vacio texto="No hay tareas asignadas a tu empresa." /> : <div className="space-y-2">{tareas.slice(0, 6).map((item) => <button key={item.id} onClick={() => navigate('tablero-tareas')} className="flex w-full items-center gap-3 rounded-lg border border-line p-3 text-left hover:bg-slate-50"><ListTodo className="h-4 w-4 text-blue-500" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.titulo}</p><p className="mt-0.5 text-xs text-slate-400">{getProyecto(item.proyectoId)?.nombre} · Vence {item.fechaVencimiento}</p></div><StatusBadge status={item.estado} size="sm" /></button>)}</div>}</section>
        <section className="rounded-xl border border-line bg-white p-5"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-slate-800">Correcciones solicitadas</h3><span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-600">{correcciones.length}</span></div>{correcciones.length === 0 ? <Vacio texto="No tienes correcciones pendientes." success /> : <div className="space-y-2">{correcciones.map((item) => <div key={`${item.tipo}-${item.id}`} className="flex items-center gap-3 rounded-lg border border-red-100 bg-red-50 p-3"><AlertTriangle className="h-4 w-4 text-red-500" /><div><p className="text-sm font-medium text-red-800">{item.titulo}</p><p className="text-xs text-red-500">{item.tipo} · Requiere tu atención</p></div></div>)}</div>}</section>
        <section className="rounded-xl border border-line bg-white p-5 xl:col-span-2"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-slate-800">Documentos compartidos y aprobados</h3><Button variant="ghost" size="sm" onClick={() => navigate('documentacion')}>Abrir documentación</Button></div>{compartidos.length === 0 ? <Vacio texto="Aún no hay documentos aprobados para compartir." /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{compartidos.map((item) => <button key={item.id} onClick={() => navigate('documentacion')} className="rounded-lg border border-line p-4 text-left hover:border-blue-200"><div className="flex items-start gap-3"><Paperclip className="h-4 w-4 text-blue-500" /><div><p className="text-sm font-medium text-slate-700">{item.nombre}</p><p className="mt-1 text-xs text-slate-400">{item.codigo || 'Sin código'} · Versión {item.version}</p></div></div></button>)}</div>}</section>
      </div>
    </div>
  )
}

function Kpi({ icon, label, value, color, onClick }: { icon: React.ReactNode; label: string; value: number; color: 'amber' | 'blue' | 'green' | 'red'; onClick: () => void }) {
  const clases = { amber: 'bg-amber-50 text-amber-600', blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600', red: 'bg-red-50 text-red-600' }
  return <button onClick={onClick} className="rounded-xl border border-line bg-white p-4 text-left shadow-sm hover:shadow-md"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${clases[color]}`}>{icon}</div><p className="mt-4 text-2xl font-bold text-slate-800">{value}</p><p className="text-xs text-slate-500">{label}</p></button>
}
function Vacio({ texto, success }: { texto: string; success?: boolean }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-7 text-center">{success && <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />}<p className="text-sm text-slate-400">{texto}</p></div>
}
