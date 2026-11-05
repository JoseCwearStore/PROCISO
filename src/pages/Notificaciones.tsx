import { useState } from 'react'
import { Bell, CheckCheck, CheckCircle, History, MessageSquare, Send } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import type { ComentarioGlobal, TipoNotificacion } from '../types'
import { canAccess } from '../config/permissions'

const inputClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'

export function Notificaciones() {
  const { state, dispatch, navigate, getUsuario, showToast } = useApp()
  const [tab, setTab] = useState<'notificaciones' | 'comentarios' | 'actividad'>('notificaciones')
  const [tipo, setTipo] = useState('')
  const [entidadTipo, setEntidadTipo] = useState<ComentarioGlobal['entidadTipo']>('tarea')
  const [entidadId, setEntidadId] = useState('')
  const [texto, setTexto] = useState('')

  const usuarioSesion = state.usuarios.find((item) => item.email === state.currentUser?.email)
  const usuarioCliente = usuarioSesion?.empresaId ? usuarioSesion : state.usuarios.find((item) => item.rol === 'Usuario Cliente' && item.activo)
  const proyectosCliente = new Set(state.proyectos.filter((item) => item.empresaId === usuarioCliente?.empresaId).map((item) => item.id))
  const tareasDisponibles = state.tareas.filter((item) => state.currentRole !== 'Usuario Cliente' || proyectosCliente.has(item.proyectoId))
  const procesosDisponibles = state.procesos.filter((item) => state.currentRole !== 'Usuario Cliente' || proyectosCliente.has(item.proyectoId))
  const documentosDisponibles = state.documentos.filter((item) => state.currentRole !== 'Usuario Cliente' || proyectosCliente.has(item.proyectoId))
  const evidenciasDisponibles = state.evidencias.filter((item) => state.currentRole !== 'Usuario Cliente' || proyectosCliente.has(item.proyectoId))
  const idsDisponibles = new Set([
    ...tareasDisponibles.map((item) => item.id),
    ...procesosDisponibles.map((item) => item.id),
    ...documentosDisponibles.map((item) => item.id),
    ...evidenciasDisponibles.map((item) => item.id),
  ])
  const comentariosVisibles = state.comentariosGlobales.filter(
    (item) => state.currentRole !== 'Usuario Cliente' || idsDisponibles.has(item.entidadId)
  )
  const entidades = entidadTipo === 'tarea'
    ? tareasDisponibles.map((item) => ({ id: item.id, nombre: item.titulo }))
    : entidadTipo === 'proceso'
      ? procesosDisponibles.map((item) => ({ id: item.id, nombre: item.nombre }))
      : entidadTipo === 'documento'
        ? documentosDisponibles.map((item) => ({ id: item.id, nombre: item.nombre }))
        : evidenciasDisponibles.map((item) => ({ id: item.id, nombre: item.nombre }))
  const visibles = state.notificaciones.filter(
    (item) =>
      (!item.pagina || canAccess(item.pagina, state.currentRole)) &&
      (state.currentRole !== 'Usuario Cliente' || !item.proyectoId || proyectosCliente.has(item.proyectoId))
  )
  const filtradas = visibles.filter((item) => !tipo || item.tipo === tipo)
  const noLeidas = visibles.filter((item) => !item.leida).length

  function agregarComentario() {
    if (!entidadId || !texto.trim()) return
    dispatch({
      type: 'ADD_COMENTARIO_GLOBAL',
      comentario: {
        id: `comentario-global-${Date.now()}`,
        entidadTipo,
        entidadId,
        autorId: state.currentUser?.id || 'usr-001',
        fecha: new Date().toLocaleString('es-MX'),
        texto: texto.trim(),
      },
    })
    dispatch({
      type: 'APPEND_AUDIT',
      entrada: {
        id: `hist-${Date.now()}`,
        fecha: new Date().toLocaleString('es-MX'),
        autorId: state.currentUser?.id || 'usr-001',
        accion: 'Comentario agregado',
        descripcion: `Comentario en ${entidadTipo} ${entidadId}.`,
        entidadId,
        entidadTipo: entidadTipo === 'proceso' ? 'proyecto' : entidadTipo,
      },
    })
    setTexto('')
    showToast('Comentario agregado.', 'success')
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-5"><h2 className="text-xl font-bold text-navy">Centro de actividad</h2><p className="mt-1 text-sm text-slate-500">Notificaciones, conversación contextual y registro de auditoría.</p></div>
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {[
          { id: 'notificaciones', label: `Notificaciones (${noLeidas})`, icon: Bell },
          { id: 'comentarios', label: 'Comentarios', icon: MessageSquare },
          { id: 'actividad', label: 'Historial de actividad', icon: History },
        ].filter((item) =>
          state.currentRole === 'Admin PROCISO'
            ? item.id === 'notificaciones'
            : state.currentRole === 'Usuario Cliente'
              ? item.id !== 'actividad'
              : true
        ).map((item) => {
          const Icon = item.icon
          return <button key={item.id} onClick={() => setTab(item.id as typeof tab)} className={`flex min-w-max items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${tab === item.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}><Icon className="h-4 w-4" />{item.label}</button>
        })}
      </div>

      {tab === 'notificaciones' && <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><select className={`${inputClass} max-w-56`} value={tipo} onChange={(event) => setTipo(event.target.value)}><option value="">Todos los tipos</option>{(['info', 'success', 'warning', 'error'] as TipoNotificacion[]).map((item) => <option key={item} value={item}>{item === 'info' ? 'Información' : item === 'success' ? 'Éxito' : item === 'warning' ? 'Advertencia' : 'Error'}</option>)}</select>{noLeidas > 0 && <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'MARCAR_TODAS_LEIDAS' })} icon={<CheckCheck className="h-4 w-4" />}>Marcar todas como leídas</Button>}</div>
        {filtradas.length === 0 ? <EmptyState icon={<CheckCircle className="h-7 w-7" />} title="Sin notificaciones" description="No hay notificaciones para este filtro." /> : <div className="space-y-2">{filtradas.map((item) => <button key={item.id} onClick={() => { dispatch({ type: 'MARCAR_LEIDA', id: item.id }); if (item.pagina) navigate(item.pagina) }} className={`w-full rounded-xl border bg-white p-4 text-left ${item.leida ? 'border-line' : 'border-blue-200 shadow-sm'}`}><div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.tipo === 'error' ? 'bg-red-500' : item.tipo === 'warning' ? 'bg-amber-500' : item.tipo === 'success' ? 'bg-emerald-500' : 'bg-blue-500'}`} /><div className="flex-1"><div className="flex justify-between gap-3"><p className={`text-sm ${item.leida ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}>{item.titulo}</p><span className="text-xs text-slate-400">{item.fecha}</span></div><p className="mt-1 text-xs text-slate-500">{item.descripcion}</p></div></div></button>)}</div>}
      </div>}

      {tab === 'comentarios' && <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="h-fit space-y-3 rounded-xl border border-line bg-white p-4"><p className="font-semibold text-slate-800">Nuevo comentario</p><select className={inputClass} value={entidadTipo} onChange={(event) => { setEntidadTipo(event.target.value as ComentarioGlobal['entidadTipo']); setEntidadId('') }}><option value="tarea">Tarea</option><option value="proceso">Proceso</option><option value="documento">Documento</option><option value="evidencia">Evidencia</option></select><select className={inputClass} value={entidadId} onChange={(event) => setEntidadId(event.target.value)}><option value="">Selecciona un registro</option>{entidades.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><textarea rows={4} className={inputClass} value={texto} onChange={(event) => setTexto(event.target.value)} placeholder="Escribe un comentario contextual..." /><Button className="w-full" disabled={!entidadId || !texto.trim()} onClick={agregarComentario} icon={<Send className="h-4 w-4" />}>Agregar comentario</Button></div>
        <div className="space-y-3">{comentariosVisibles.length === 0 ? <EmptyState icon={<MessageSquare className="h-7 w-7" />} title="Sin comentarios transversales" description="Los comentarios de tareas, procesos, documentos y evidencias aparecerán aquí." /> : comentariosVisibles.slice().reverse().map((item) => <div key={item.id} className="rounded-xl border border-line bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{getUsuario(item.autorId)?.nombre || item.autorId}</p><p className="mt-0.5 text-xs text-blue-600">{item.entidadTipo} · {item.entidadId}</p></div><span className="text-xs text-slate-400">{item.fecha}</span></div><p className="mt-3 text-sm text-slate-600">{item.texto}</p></div>)}</div>
      </div>}

      {tab === 'actividad' && <div><div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"><strong>Registro de solo lectura.</strong> Nadie puede editar ni borrar los registros de auditoría.</div><div className="space-y-2">{state.auditoria.map((item) => <div key={item.id} className="flex gap-4 rounded-xl border border-line bg-white p-4"><History className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><div className="flex-1"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold text-slate-700">{item.accion}</p><span className="text-xs text-slate-400">{item.fecha}</span></div><p className="mt-1 text-sm text-slate-500">{item.descripcion}</p><p className="mt-2 text-xs text-slate-400">{getUsuario(item.autorId)?.nombre || item.autorId} · {item.entidadTipo} {item.entidadId}</p></div></div>)}</div></div>}
    </div>
  )
}
