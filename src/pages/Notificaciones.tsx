import { useState } from 'react'
import { Bell, CheckCheck, CheckCircle, History, MessageSquare, Send } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import type { ComentarioGlobal, TipoNotificacion } from '../types'
import { canAccess } from '../config/permissions'
import { useAccionesNotificacion } from '../hooks/useAccionesNotificacion'
import { useAccionesComentario } from '../hooks/useAccionesComentario'

const ETIQUETA_ENTIDAD: Record<ComentarioGlobal['entidadTipo'], string> = {
  tarea: 'Tarea', proceso: 'Proceso', documento: 'Documento', evidencia: 'Evidencia', no_conformidad: 'No conformidad', entregable: 'Entregable',
}

const inputClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'

export function Notificaciones() {
  const { state, navigate, getUsuario, showToast } = useApp()
  const { marcarLeidas } = useAccionesNotificacion()
  const { comentar } = useAccionesComentario()
  const [tab, setTab] = useState<'notificaciones' | 'comentarios' | 'actividad'>('notificaciones')
  const [tipo, setTipo] = useState('')
  const [entidadTipo, setEntidadTipo] = useState<ComentarioGlobal['entidadTipo']>('tarea')
  const [entidadId, setEntidadId] = useState('')
  const [texto, setTexto] = useState('')

  // El estado ya trae solo lo que el RLS deja ver a este usuario: no se filtra a mano.
  const opciones: Record<ComentarioGlobal['entidadTipo'], { id: string; nombre: string; proyectoId: string }[]> = {
    tarea: state.tareas.map((item) => ({ id: item.id, nombre: item.titulo, proyectoId: item.proyectoId })),
    proceso: state.procesos.map((item) => ({ id: item.id, nombre: item.nombre, proyectoId: item.proyectoId })),
    documento: state.documentos.map((item) => ({ id: item.id, nombre: item.nombre, proyectoId: item.proyectoId })),
    evidencia: state.evidencias.map((item) => ({ id: item.id, nombre: item.nombre, proyectoId: item.proyectoId })),
    no_conformidad: state.noConformidades.map((item) => ({ id: item.id, nombre: `${item.folio} ${item.titulo || item.descripcion}`, proyectoId: item.proyectoId })),
    entregable: state.entregables.map((item) => ({ id: item.id, nombre: item.nombre, proyectoId: item.proyectoId })),
  }
  const nombreDe = new Map(Object.values(opciones).flat().map((item) => [item.id, item.nombre]))
  const entidades = opciones[entidadTipo]
  const visibles = state.notificaciones.filter(
    (item) =>
      // La BD ya calculó las de este usuario; la página es un resguardo de UX.
      !item.pagina || canAccess(item.pagina, state.currentRole)
  )
  const filtradas = visibles.filter((item) => !tipo || item.tipo === tipo)
  const noLeidas = visibles.filter((item) => !item.leida).length

  async function agregarComentario() {
    const entidad = entidades.find((item) => item.id === entidadId)
    if (!entidad || !texto.trim()) return
    if (await comentar({ entidadTipo, entidadId, proyectoId: entidad.proyectoId }, texto)) {
      setTexto('')
      showToast('Comentario agregado.', 'success')
    }
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><select className={`${inputClass} max-w-56`} value={tipo} onChange={(event) => setTipo(event.target.value)}><option value="">Todos los tipos</option>{(['info', 'success', 'warning', 'error'] as TipoNotificacion[]).map((item) => <option key={item} value={item}>{item === 'info' ? 'Información' : item === 'success' ? 'Éxito' : item === 'warning' ? 'Advertencia' : 'Error'}</option>)}</select>{noLeidas > 0 && <Button variant="outline" size="sm" onClick={() => void marcarLeidas(visibles.filter((item) => !item.leida).map((item) => item.id))} icon={<CheckCheck className="h-4 w-4" />}>Marcar todas como leídas</Button>}</div>
        {filtradas.length === 0 ? <EmptyState icon={<CheckCircle className="h-7 w-7" />} title="Sin notificaciones" description="No hay notificaciones para este filtro." /> : <div className="space-y-2">{filtradas.map((item) => <button key={item.id} onClick={() => { if (!item.leida) void marcarLeidas([item.id]); if (item.pagina) navigate(item.pagina) }} className={`w-full rounded-xl border bg-white p-4 text-left ${item.leida ? 'border-line' : 'border-blue-200 shadow-sm'}`}><div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.tipo === 'error' ? 'bg-red-500' : item.tipo === 'warning' ? 'bg-amber-500' : item.tipo === 'success' ? 'bg-emerald-500' : 'bg-blue-500'}`} /><div className="flex-1"><div className="flex justify-between gap-3"><p className={`text-sm ${item.leida ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}>{item.titulo}</p><span className="text-xs text-slate-400">{item.fecha}</span></div><p className="mt-1 text-xs text-slate-500">{item.descripcion}</p></div></div></button>)}</div>}
      </div>}

      {tab === 'comentarios' && <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="h-fit space-y-3 rounded-xl border border-line bg-white p-4"><p className="font-semibold text-slate-800">Nuevo comentario</p><select className={inputClass} value={entidadTipo} onChange={(event) => { setEntidadTipo(event.target.value as ComentarioGlobal['entidadTipo']); setEntidadId('') }}><option value="tarea">Tarea</option><option value="proceso">Proceso</option><option value="documento">Documento</option><option value="evidencia">Evidencia</option><option value="no_conformidad">No conformidad</option></select><select className={inputClass} value={entidadId} onChange={(event) => setEntidadId(event.target.value)}><option value="">Selecciona un registro</option>{entidades.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select><textarea rows={4} className={inputClass} value={texto} onChange={(event) => setTexto(event.target.value)} placeholder="Escribe un comentario contextual..." /><Button className="w-full" disabled={!entidadId || !texto.trim()} onClick={agregarComentario} icon={<Send className="h-4 w-4" />}>Agregar comentario</Button></div>
        <div className="space-y-3">{state.comentariosGlobales.length === 0 ? <EmptyState icon={<MessageSquare className="h-7 w-7" />} title="Sin comentarios transversales" description="Los comentarios de tareas, procesos, documentos, evidencias y no conformidades aparecerán aquí." /> : state.comentariosGlobales.map((item) => <div key={item.id} className="rounded-xl border border-line bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{getUsuario(item.autorId)?.nombre || item.autorId}</p><p className="mt-0.5 text-xs text-blue-600">{ETIQUETA_ENTIDAD[item.entidadTipo]} · {nombreDe.get(item.entidadId) ?? '(sin acceso)'}{item.seccionId ? ` · sección ${item.seccionId}` : ''}</p></div><span className="text-xs text-slate-400">{item.fecha}</span></div><p className="mt-3 text-sm text-slate-600">{item.texto}</p></div>)}</div>
      </div>}

      {tab === 'actividad' && <div><div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"><strong>Registro de solo lectura.</strong> Nadie puede editar ni borrar los registros de auditoría.</div><div className="space-y-2">{state.auditoria.map((item) => <div key={item.id} className="flex gap-4 rounded-xl border border-line bg-white p-4"><History className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><div className="flex-1"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold text-slate-700">{item.accion}</p><span className="text-xs text-slate-400">{item.fecha}</span></div><p className="mt-1 text-sm text-slate-500">{item.descripcion}</p><p className="mt-2 text-xs text-slate-400">{getUsuario(item.autorId)?.nombre || item.autorId} · {item.entidadTipo} {item.entidadId}</p></div></div>)}</div></div>}
    </div>
  )
}
