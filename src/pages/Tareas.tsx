import { useState } from 'react'
import { CheckCircle, Circle, Clock, AlertTriangle, MessageSquare, ChevronDown, Plus } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import type { Tarea, EstadoTarea } from '../types'
import { USUARIOS } from '../data/demo'

const ESTADOS: EstadoTarea[] = ['Pendiente', 'En proceso', 'En revisión', 'Requiere corrección', 'Completada', 'Vencida']
const PRIORIDADES = ['Alta', 'Media', 'Baja'] as const

function TareaRow({
  tarea,
  onClick,
  onStatusChange,
  proyectoNombre,
  asignadoNombre,
}: {
  tarea: Tarea
  onClick: () => void
  onStatusChange: (id: string, estado: EstadoTarea) => void
  proyectoNombre: string
  asignadoNombre: string
}) {
  const [statusOpen, setStatusOpen] = useState(false)
  const prioridadColor = {
    Alta: 'text-red-600 bg-red-50 border-red-200',
    Media: 'text-amber-600 bg-amber-50 border-amber-200',
    Baja: 'text-green-600 bg-green-50 border-green-200',
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        {/* Status toggle button */}
        <button
          onClick={() => onStatusChange(tarea.id, tarea.estado === 'Completada' ? 'Pendiente' : 'Completada')}
          className="mt-0.5 flex-shrink-0 text-slate-300 hover:text-green-500 transition-colors"
          aria-label={tarea.estado === 'Completada' ? 'Marcar como pendiente' : 'Marcar como completada'}
        >
          {tarea.estado === 'Completada' ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : tarea.estado === 'Vencida' ? (
            <AlertTriangle className="w-5 h-5 text-red-400" />
          ) : tarea.estado === 'En proceso' ? (
            <Clock className="w-5 h-5 text-blue-400" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>

        <div className="flex-1 min-w-0" onClick={onClick} style={{ cursor: 'pointer' }}>
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium leading-snug ${tarea.estado === 'Completada' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
              {tarea.titulo}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${prioridadColor[tarea.prioridad]}`}>
                {tarea.prioridad}
              </span>
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setStatusOpen((o) => !o) }}
                  className="flex items-center gap-1 text-xs"
                  aria-label="Cambiar estado"
                >
                  <StatusBadge status={tarea.estado} size="sm" />
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
                {statusOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setStatusOpen(false) }} />
                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 w-44">
                      {ESTADOS.map((e) => (
                        <button
                          key={e}
                          onClick={(ev) => {
                            ev.stopPropagation()
                            onStatusChange(tarea.id, e)
                            setStatusOpen(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 ${tarea.estado === e ? 'font-medium text-blue-600' : 'text-slate-700'}`}
                        >
                          <StatusBadge status={e} size="sm" />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-xs text-slate-400 truncate max-w-[180px]">{proyectoNombre}</span>
            <span className="text-xs text-slate-400">{asignadoNombre}</span>
            <span className={`text-xs font-medium ${tarea.estado === 'Vencida' ? 'text-red-500' : 'text-slate-400'}`}>
              Vence: {tarea.fechaVencimiento}
            </span>
            {tarea.comentarios.length > 0 && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {tarea.comentarios.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Tareas() {
  const { state, dispatch, navigate, getProyecto, getUsuario, showToast } = useApp()
  const [estadoFilter, setEstadoFilter] = useState('')
  const [prioridadFilter, setPrioridadFilter] = useState('')
  const [proyectoFilter, setProyectoFilter] = useState('')
  const [selectedTarea, setSelectedTarea] = useState<Tarea | null>(null)
  const [nuevoComentario, setNuevoComentario] = useState('')

  function handleStatusChange(id: string, estado: EstadoTarea) {
    const updates: Partial<Tarea> = { estado }
    if (estado === 'Completada') updates.fechaCompletada = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
    else updates.fechaCompletada = undefined
    dispatch({ type: 'UPDATE_TAREA', id, updates })
    showToast(`Tarea marcada como "${estado}"`, estado === 'Completada' ? 'success' : 'info')
    if (selectedTarea?.id === id) setSelectedTarea((t) => t ? { ...t, ...updates } : t)
  }

  function handleAddComentario() {
    if (!selectedTarea || !nuevoComentario.trim()) return
    const comentario = {
      id: `com-${Date.now()}`,
      autorId: 'usr-001',
      fecha: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      texto: nuevoComentario.trim(),
    }
    const updates: Partial<Tarea> = {
      comentarios: [...selectedTarea.comentarios, comentario],
    }
    dispatch({ type: 'UPDATE_TAREA', id: selectedTarea.id, updates })
    setSelectedTarea((t) => t ? { ...t, ...updates } : t)
    setNuevoComentario('')
    showToast('Comentario agregado', 'success')
  }

  let filtered = state.tareas
  if (estadoFilter) filtered = filtered.filter((t) => t.estado === estadoFilter)
  if (prioridadFilter) filtered = filtered.filter((t) => t.prioridad === prioridadFilter)
  if (proyectoFilter) filtered = filtered.filter((t) => t.proyectoId === proyectoFilter)

  const counts = {
    total: filtered.length,
    pendiente: filtered.filter((t) => t.estado === 'Pendiente').length,
    enProgreso: filtered.filter((t) => t.estado === 'En proceso').length,
    completada: filtered.filter((t) => t.estado === 'Completada').length,
    vencida: filtered.filter((t) => t.estado === 'Vencida').length,
  }

  const currentTarea = selectedTarea
    ? state.tareas.find((t) => t.id === selectedTarea.id) ?? selectedTarea
    : null

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Tareas</h2>
          <p className="text-sm text-slate-500">{state.tareas.length} tareas en total</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pendientes', count: counts.pendiente + counts.enProgreso, color: 'bg-blue-50 text-blue-700' },
          { label: 'Completadas', count: counts.completada, color: 'bg-green-50 text-green-700' },
          { label: 'Vencidas', count: counts.vencida, color: 'bg-red-50 text-red-700' },
          { label: 'Total filtradas', count: counts.total, color: 'bg-slate-100 text-slate-600' },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">{label}</span>
            <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${color}`}>{count}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <input
            type="text"
            readOnly
            placeholder="Buscar tarea..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-not-allowed opacity-50"
            title="Usa los filtros de abajo"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className="h-9 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={prioridadFilter} onChange={(e) => setPrioridadFilter(e.target.value)} className="h-9 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Toda prioridad</option>
          {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={proyectoFilter} onChange={(e) => setProyectoFilter(e.target.value)} className="h-9 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los proyectos</option>
          {state.proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre.substring(0, 35)}…</option>)}
        </select>
        {(estadoFilter || prioridadFilter || proyectoFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setEstadoFilter(''); setPrioridadFilter(''); setProyectoFilter('') }}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<CheckCircle className="w-7 h-7" />}
          title="Sin datos suficientes"
          description="No hay tareas que coincidan con los filtros aplicados."
          action={{ label: 'Limpiar filtros', onClick: () => { setEstadoFilter(''); setPrioridadFilter(''); setProyectoFilter('') } }}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((tarea) => {
            const proyecto = getProyecto(tarea.proyectoId)
            const asignado = getUsuario(tarea.asignadoAId)
            return (
              <TareaRow
                key={tarea.id}
                tarea={tarea}
                onClick={() => setSelectedTarea(tarea)}
                onStatusChange={handleStatusChange}
                proyectoNombre={proyecto?.nombre ?? '—'}
                asignadoNombre={asignado?.nombre ?? '—'}
              />
            )
          })}
        </div>
      )}

      {/* Tarea detail modal */}
      {currentTarea && (
        <Modal
          open={!!currentTarea}
          onClose={() => setSelectedTarea(null)}
          title="Detalle de tarea"
          size="md"
          footer={
            <Button variant="outline" onClick={() => setSelectedTarea(null)}>Cerrar</Button>
          }
        >
          <div className="space-y-4">
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-base font-semibold text-slate-900">{currentTarea.titulo}</h3>
                <StatusBadge status={currentTarea.estado} />
              </div>
              <p className="text-sm text-slate-600">{currentTarea.descripcion}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-0.5">Prioridad</p>
                <StatusBadge status={currentTarea.prioridad} size="sm" />
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-0.5">Vencimiento</p>
                <p className={`text-sm font-medium ${currentTarea.estado === 'Vencida' ? 'text-red-600' : 'text-slate-700'}`}>{currentTarea.fechaVencimiento}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-0.5">Asignado a</p>
                <p className="text-sm text-slate-700">{getUsuario(currentTarea.asignadoAId)?.nombre ?? '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-0.5">Proyecto</p>
                <p className="text-sm text-slate-700 truncate">{getProyecto(currentTarea.proyectoId)?.nombre ?? '—'}</p>
              </div>
            </div>

            {currentTarea.fechaCompletada && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Completada el {currentTarea.fechaCompletada}
              </p>
            )}

            {/* Change status */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Cambiar estado</p>
              <div className="flex gap-2 flex-wrap">
                {ESTADOS.map((e) => (
                  <button
                    key={e}
                    onClick={() => handleStatusChange(currentTarea.id, e)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${currentTarea.estado === e ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Comentarios ({currentTarea.comentarios.length})</p>
              {currentTarea.comentarios.length === 0 ? (
                <p className="text-xs text-slate-400 mb-2">Sin comentarios aún.</p>
              ) : (
                <div className="space-y-2 mb-3">
                  {currentTarea.comentarios.map((c) => {
                    const autor = getUsuario(c.autorId)
                    return (
                      <div key={c.id} className="bg-slate-50 rounded-lg px-3 py-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-slate-700">{autor?.nombre ?? '—'}</span>
                          <span className="text-xs text-slate-400">{c.fecha}</span>
                        </div>
                        <p className="text-xs text-slate-600">{c.texto}</p>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevoComentario}
                  onChange={(e) => setNuevoComentario(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComentario()}
                  placeholder="Agregar comentario..."
                  className="flex-1 h-8 px-3 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button size="sm" onClick={handleAddComentario} icon={<Plus className="w-3.5 h-3.5" />}>
                  Agregar
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
