import { useState, useCallback } from 'react'
import {
  LayoutGrid,
  List,
  Plus,
  GripVertical,
  Calendar,
  ChevronDown,
  X,
  MessageSquare,
  Clock,
  CheckCircle,
  Send,
  Info,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import type { EstadoTarea, PrioridadTarea, Tarea } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTADOS: EstadoTarea[] = [
  'Pendiente',
  'En proceso',
  'En revisión',
  'Requiere corrección',
  'Completada',
  'Vencida',
]

const PRIORIDADES: PrioridadTarea[] = ['Alta', 'Media', 'Baja']

const TODAY = '2026-10-23'

const PRIORIDAD_COLORS: Record<PrioridadTarea, string> = {
  Alta: 'bg-red-100 text-red-700 border-red-200',
  Media: 'bg-amber-100 text-amber-700 border-amber-200',
  Baja: 'bg-slate-100 text-slate-600 border-slate-200',
}

const COLUMN_HEADER_COLORS: Record<EstadoTarea, string> = {
  'Pendiente': 'bg-slate-50 text-slate-600 border-slate-200',
  'En proceso': 'bg-blue-50 text-blue-700 border-blue-200',
  'En revisión': 'bg-amber-50 text-amber-700 border-amber-200',
  'Requiere corrección': 'bg-orange-50 text-orange-700 border-orange-200',
  'Completada': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Vencida': 'bg-red-50 text-red-700 border-red-200',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function parseFecha(fecha: string): string {
  // Support both dd/mm/yyyy and yyyy-mm-dd
  if (fecha.includes('-')) return fecha
  const [d, m, y] = fecha.split('/')
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function formatFecha(fecha: string): string {
  const iso = parseFecha(fecha)
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function isVencida(fecha: string): boolean {
  return parseFecha(fecha) < TODAY
}

// ─── Avatars ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
]

function avatarColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h]
}

function Avatar({ userId }: { userId: string }) {
  const { state } = useApp()
  const usuario = state.usuarios.find((u) => u.id === userId)
  const name = usuario?.nombre ?? userId
  const initials = getInitials(name)
  return (
    <span
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-semibold flex-shrink-0 ${avatarColor(userId)}`}
      title={name}
    >
      {initials}
    </span>
  )
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

interface KanbanCardProps {
  tarea: Tarea
  proyectoNombre: string
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
}

function KanbanCard({ tarea, proyectoNombre, onClick, onDragStart }: KanbanCardProps) {
  const vencida = isVencida(tarea.fechaVencimiento)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="bg-white rounded-lg border border-line shadow-sm hover:shadow-md transition-shadow cursor-pointer select-none group"
    >
      <div className="p-3">
        {/* Top row: project + priority badge */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span className="text-xs text-slate-400 truncate leading-tight">{proyectoNombre}</span>
          <span
            className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${PRIORIDAD_COLORS[tarea.prioridad]}`}
          >
            {tarea.prioridad}
          </span>
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-fg line-clamp-2 mb-3 leading-snug">{tarea.titulo}</p>

        {/* Bottom row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Avatar userId={tarea.asignadoAId} />
            <span className={`flex items-center gap-0.5 text-xs ${vencida ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
              <Calendar className="w-3 h-3" />
              {formatFecha(tarea.fechaVencimiento)}
            </span>
          </div>
          <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 cursor-grab flex-shrink-0" />
        </div>
      </div>
    </div>
  )
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  estado: EstadoTarea
  tareas: Tarea[]
  getProyectoNombre: (id: string) => string
  onDrop: (estado: EstadoTarea, taskId: string) => void
  onCardClick: (tarea: Tarea) => void
}

function KanbanColumn({ estado, tareas, getProyectoNombre, onDrop, onCardClick }: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false)
  const isVencidaCol = estado === 'Vencida'

  const handleDragOver = (e: React.DragEvent) => {
    if (isVencidaCol) return // no drop into Vencida
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (isVencidaCol) return
    const taskId = e.dataTransfer.getData('text/plain')
    if (taskId) onDrop(estado, taskId)
  }

  const headerColor = COLUMN_HEADER_COLORS[estado]

  return (
    <div
      className={`flex flex-col rounded-xl border transition-colors min-w-[220px] w-full ${
        dragOver ? 'border-blue-400 bg-blue-50/60' : 'border-line bg-canvas'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl border-b ${headerColor}`}>
        <span className="text-xs font-semibold">{estado}</span>
        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/60 min-w-[20px] text-center">
          {tareas.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-2 overflow-y-auto max-h-[calc(100vh-280px)]">
        {tareas.length === 0 && (
          <div className="text-xs text-slate-400 text-center py-6 italic">Sin tareas</div>
        )}
        {tareas.map((t) => (
          <KanbanCard
            key={t.id}
            tarea={t}
            proyectoNombre={getProyectoNombre(t.proyectoId)}
            onClick={() => onCardClick(t)}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Tarea Detail Modal ───────────────────────────────────────────────────────

interface TareaDetailModalProps {
  tarea: Tarea | null
  onClose: () => void
}

function TareaDetailModal({ tarea, onClose }: TareaDetailModalProps) {
  const { state, dispatch, showToast, getProyecto } = useApp()
  const [localTarea, setLocalTarea] = useState<Tarea | null>(tarea)
  const [nuevoComentario, setNuevoComentario] = useState('')

  // Sync when tarea prop changes
  if (tarea && localTarea?.id !== tarea.id) {
    setLocalTarea(tarea)
  }

  if (!localTarea) return null

  const proyecto = getProyecto(localTarea.proyectoId)
  const usuario = state.usuarios.find((u) => u.id === localTarea.asignadoAId)
  const completandoAhora = localTarea.estado === 'Completada' && tarea?.estado !== 'Completada'

  function handleGuardar() {
    if (!localTarea) return
    const updates: Partial<Tarea> = {
      estado: localTarea.estado,
      prioridad: localTarea.prioridad,
      asignadoAId: localTarea.asignadoAId,
      fechaVencimiento: localTarea.fechaVencimiento,
      descripcion: localTarea.descripcion,
      comentarios: localTarea.comentarios,
    }
    if (localTarea.estado === 'Completada' && tarea?.estado !== 'Completada') {
      updates.fechaCompletada = TODAY
    }
    // Add historial entry if estado changed
    if (tarea && localTarea.estado !== tarea.estado) {
      updates.historial = [
        ...(localTarea.historial ?? []),
        {
          fecha: formatFecha(TODAY),
          autorId: state.currentUser?.id ?? 'aaaaaaaa-0000-0000-0000-000000000002',
          de: tarea.estado,
          a: localTarea.estado,
        },
      ]
    }
    dispatch({ type: 'UPDATE_TAREA', id: localTarea.id, updates })
    showToast(`Tarea "${localTarea.titulo}" actualizada.`, 'success')
    onClose()
  }

  function handleAddComentario() {
    if (!nuevoComentario.trim() || !localTarea) return
    const comentario = {
      id: `com-${Date.now()}`,
      autorId: state.currentUser?.id ?? 'aaaaaaaa-0000-0000-0000-000000000002',
      fecha: formatFecha(TODAY),
      texto: nuevoComentario.trim(),
    }
    setLocalTarea({ ...localTarea, comentarios: [...localTarea.comentarios, comentario] })
    setNuevoComentario('')
  }

  const dependenciasTareas = localTarea.dependencias.map((id) =>
    state.tareas.find((t) => t.id === id)
  ).filter(Boolean) as Tarea[]

  return (
    <Modal
      open
      onClose={onClose}
      title={localTarea.titulo}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleGuardar}>Guardar cambios</Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Completada banner */}
        {completandoAhora && (
          <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-800">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            Al marcar como Completada, se actualizará el avance del proyecto.
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Descripción</label>
          <textarea
            className="w-full border border-line rounded-lg px-3 py-2 text-sm text-fg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            value={localTarea.descripcion}
            onChange={(e) => setLocalTarea({ ...localTarea, descripcion: e.target.value })}
          />
        </div>

        {/* Estado + Prioridad row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Estado</label>
            <select
              className="w-full border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localTarea.estado}
              onChange={(e) => setLocalTarea({ ...localTarea, estado: e.target.value as EstadoTarea })}
            >
              {ESTADOS.map((es) => (
                <option key={es} value={es}>{es}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Prioridad</label>
            <select
              className="w-full border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localTarea.prioridad}
              onChange={(e) => setLocalTarea({ ...localTarea, prioridad: e.target.value as PrioridadTarea })}
            >
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Asignado + Proyecto */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Asignado a</label>
            <select
              className="w-full border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localTarea.asignadoAId}
              onChange={(e) => setLocalTarea({ ...localTarea, asignadoAId: e.target.value })}
            >
              {state.usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Proyecto</label>
            <p className="text-sm text-fg px-3 py-2 border border-line rounded-lg bg-slate-50">
              {proyecto?.nombre ?? localTarea.proyectoId}
            </p>
          </div>
        </div>

        {/* Fecha vencimiento */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha de vencimiento</label>
          <input
            type="date"
            className="border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={parseFecha(localTarea.fechaVencimiento)}
            onChange={(e) =>
              setLocalTarea({ ...localTarea, fechaVencimiento: e.target.value })
            }
          />
        </div>

        {/* Dependencias */}
        {dependenciasTareas.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Dependencias</label>
            <ul className="space-y-1">
              {dependenciasTareas.map((dep) => (
                <li key={dep.id} className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                  {dep.titulo}
                  <StatusBadge status={dep.estado} size="sm" />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Historial */}
        {localTarea.historial.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Historial de cambios</label>
            <ul className="space-y-2">
              {localTarea.historial.map((h, i) => {
                const autor = state.usuarios.find((u) => u.id === h.autorId)
                return (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="font-medium">{h.fecha}</span>
                    <span>{autor?.nombre ?? h.autorId}</span>
                    <span className="text-slate-400">cambió de</span>
                    <StatusBadge status={h.de} size="sm" />
                    <span className="text-slate-400">a</span>
                    <StatusBadge status={h.a} size="sm" />
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Comentarios */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-2">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              Comentarios ({localTarea.comentarios.length})
            </span>
          </label>
          {localTarea.comentarios.length > 0 && (
            <ul className="space-y-2 mb-3">
              {localTarea.comentarios.map((c) => {
                const autor = state.usuarios.find((u) => u.id === c.autorId)
                return (
                  <li key={c.id} className="bg-slate-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-700">{autor?.nombre ?? c.autorId}</span>
                      <span className="text-xs text-slate-400">{c.fecha}</span>
                    </div>
                    <p className="text-sm text-slate-600">{c.texto}</p>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Agregar un comentario..."
              value={nuevoComentario}
              onChange={(e) => setNuevoComentario(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddComentario()}
            />
            <Button
              variant="outline"
              size="sm"
              icon={<Send className="w-3.5 h-3.5" />}
              onClick={handleAddComentario}
              disabled={!nuevoComentario.trim()}
            >
              Agregar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── New Task Modal ───────────────────────────────────────────────────────────

interface NuevaTareaModalProps {
  open: boolean
  onClose: () => void
}

function NuevaTareaModal({ open, onClose }: NuevaTareaModalProps) {
  const { state, dispatch, showToast } = useApp()
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [proyectoId, setProyectoId] = useState('')
  const [asignadoAId, setAsignadoAId] = useState('')
  const [prioridad, setPrioridad] = useState<PrioridadTarea>('Media')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleClose() {
    setTitulo('')
    setDescripcion('')
    setProyectoId('')
    setAsignadoAId('')
    setPrioridad('Media')
    setFechaVencimiento('')
    setErrors({})
    onClose()
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!titulo.trim()) e.titulo = 'El título es requerido'
    if (!proyectoId) e.proyectoId = 'Selecciona un proyecto'
    if (!asignadoAId) e.asignadoAId = 'Selecciona un responsable'
    if (!fechaVencimiento) e.fechaVencimiento = 'La fecha es requerida'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const newTarea: Tarea = {
      id: `tar-${Date.now()}`,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      proyectoId,
      asignadoAId,
      asignadoPorId: state.currentUser?.id ?? 'aaaaaaaa-0000-0000-0000-000000000002',
      estado: 'Pendiente',
      prioridad,
      fechaVencimiento,
      dependencias: [],
      comentarios: [],
      historial: [],
    }
    dispatch({ type: 'ADD_TAREA', tarea: newTarea })
    showToast('Tarea creada.', 'success')
    handleClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nueva tarea"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSubmit}>Crear tarea</Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Título */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Título <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={`w-full border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.titulo ? 'border-red-400' : 'border-line'}`}
            placeholder="Describe la tarea..."
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
          {errors.titulo && <p className="text-xs text-red-500 mt-1">{errors.titulo}</p>}
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Descripción</label>
          <textarea
            className="w-full border border-line rounded-lg px-3 py-2 text-sm text-fg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Detalles adicionales..."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        {/* Proyecto */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Proyecto <span className="text-red-500">*</span>
          </label>
          <select
            className={`w-full border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.proyectoId ? 'border-red-400' : 'border-line'}`}
            value={proyectoId}
            onChange={(e) => setProyectoId(e.target.value)}
          >
            <option value="">Seleccionar proyecto...</option>
            {state.proyectos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          {errors.proyectoId && <p className="text-xs text-red-500 mt-1">{errors.proyectoId}</p>}
        </div>

        {/* Asignado a */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Asignado a <span className="text-red-500">*</span>
          </label>
          <select
            className={`w-full border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.asignadoAId ? 'border-red-400' : 'border-line'}`}
            value={asignadoAId}
            onChange={(e) => setAsignadoAId(e.target.value)}
          >
            <option value="">Seleccionar usuario...</option>
            {state.usuarios.filter((u) => u.activo).map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>
          {errors.asignadoAId && <p className="text-xs text-red-500 mt-1">{errors.asignadoAId}</p>}
        </div>

        {/* Prioridad + Fecha */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Prioridad <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as PrioridadTarea)}
            >
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Fecha de vencimiento <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className={`w-full border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.fechaVencimiento ? 'border-red-400' : 'border-line'}`}
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
            />
            {errors.fechaVencimiento && <p className="text-xs text-red-500 mt-1">{errors.fechaVencimiento}</p>}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Filters ──────────────────────────────────────────────────────────────────

interface Filtros {
  proyectoId: string
  asignadoAId: string
  prioridad: string
  estado: string
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TableroTareas() {
  const { state, dispatch, getProyecto, showToast } = useApp()
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')
  const [filtros, setFiltros] = useState<Filtros>({ proyectoId: '', asignadoAId: '', prioridad: '', estado: '' })
  const [sortBy, setSortBy] = useState<'fechaVencimiento' | 'prioridad' | 'estado'>('fechaVencimiento')
  const [tareaDetalle, setTareaDetalle] = useState<Tarea | null>(null)
  const [nuevaTareaOpen, setNuevaTareaOpen] = useState(false)

  const usuarioSesion = state.usuarios.find((item) => item.email === state.currentUser?.email)
  const usuarioCliente = usuarioSesion?.empresaId ? usuarioSesion : state.usuarios.find((item) => item.rol === 'Usuario Cliente' && item.activo)
  const empresaClienteId = state.currentRole === 'Usuario Cliente' ? usuarioCliente?.empresaId : undefined
  const proyectosDisponibles = state.proyectos.filter((item) => !empresaClienteId || item.empresaId === empresaClienteId)
  const proyectoIdsDisponibles = new Set(proyectosDisponibles.map((item) => item.id))

  // Filtered tareas
  const tareasFiltradas = state.tareas.filter((t) => {
    if (!proyectoIdsDisponibles.has(t.proyectoId)) return false
    if (filtros.proyectoId && t.proyectoId !== filtros.proyectoId) return false
    if (filtros.asignadoAId && t.asignadoAId !== filtros.asignadoAId) return false
    if (filtros.prioridad && t.prioridad !== filtros.prioridad) return false
    if (filtros.estado && t.estado !== filtros.estado) return false
    return true
  })

  const getProyectoNombre = useCallback(
    (id: string) => getProyecto(id)?.nombre ?? id,
    [getProyecto]
  )

  // Sort for list view
  const PRIORIDAD_ORDER: Record<PrioridadTarea, number> = { Alta: 0, Media: 1, Baja: 2 }
  const ESTADO_ORDER: Record<EstadoTarea, number> = {
    Vencida: 0, 'En proceso': 1, 'En revisión': 2, 'Requiere corrección': 3, Pendiente: 4, Completada: 5,
  }

  const tareasOrdenadas = [...tareasFiltradas].sort((a, b) => {
    if (sortBy === 'prioridad') return PRIORIDAD_ORDER[a.prioridad] - PRIORIDAD_ORDER[b.prioridad]
    if (sortBy === 'estado') return ESTADO_ORDER[a.estado] - ESTADO_ORDER[b.estado]
    // fechaVencimiento asc
    return parseFecha(a.fechaVencimiento).localeCompare(parseFecha(b.fechaVencimiento))
  })

  function handleDrop(estado: EstadoTarea, taskId: string) {
    const tarea = state.tareas.find((t) => t.id === taskId)
    if (!tarea || tarea.estado === estado) return

    const updates: Partial<Tarea> = {
      estado,
      historial: [
        ...tarea.historial,
        {
          fecha: formatFecha(TODAY),
          autorId: state.currentUser?.id ?? 'aaaaaaaa-0000-0000-0000-000000000002',
          de: tarea.estado,
          a: estado,
        },
      ],
    }
    if (estado === 'Completada') {
      updates.fechaCompletada = TODAY
    }

    dispatch({ type: 'UPDATE_TAREA', id: taskId, updates })
    showToast(
      `"${tarea.titulo}" movida a ${estado}. El avance del proyecto se actualiza automáticamente.`,
      'success'
    )
  }

  const filterSelect = 'border border-line rounded-lg px-3 py-1.5 text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400'

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="bg-white border-b border-line px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-navy">Tablero de tareas</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {tareasFiltradas.length} tarea{tareasFiltradas.length !== 1 ? 's' : ''} · vista{' '}
              {view === 'kanban' ? 'Kanban' : 'Lista'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center border border-line rounded-lg overflow-hidden">
              <button
                onClick={() => setView('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === 'kanban' ? 'bg-navy text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
                title="Vista Kanban"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Kanban
              </button>
              <button
                onClick={() => setView('lista')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === 'lista' ? 'bg-navy text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
                title="Vista Lista"
              >
                <List className="w-3.5 h-3.5" />
                Lista
              </button>
            </div>
            {state.currentRole !== 'Usuario Cliente' && <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setNuevaTareaOpen(true)}
            >
              Nueva tarea
            </Button>}
          </div>
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            className={filterSelect}
            value={filtros.proyectoId}
            onChange={(e) => setFiltros({ ...filtros, proyectoId: e.target.value })}
          >
            <option value="">Todos los proyectos</option>
            {proyectosDisponibles.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>

          <select
            className={filterSelect}
            value={filtros.asignadoAId}
            onChange={(e) => setFiltros({ ...filtros, asignadoAId: e.target.value })}
          >
            <option value="">Todos los usuarios</option>
            {state.usuarios.filter((u) => u.activo).map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>

          <select
            className={filterSelect}
            value={filtros.prioridad}
            onChange={(e) => setFiltros({ ...filtros, prioridad: e.target.value })}
          >
            <option value="">Cualquier prioridad</option>
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select
            className={filterSelect}
            value={filtros.estado}
            onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((es) => (
              <option key={es} value={es}>{es}</option>
            ))}
          </select>

          {(filtros.proyectoId || filtros.asignadoAId || filtros.prioridad || filtros.estado) && (
            <button
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              onClick={() => setFiltros({ proyectoId: '', asignadoAId: '', prioridad: '', estado: '' })}
            >
              <X className="w-3.5 h-3.5" />
              Limpiar filtros
            </button>
          )}

          {view === 'lista' && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
              <span>Ordenar por</span>
              <select
                className={filterSelect + ' text-xs'}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="fechaVencimiento">Fecha vencimiento</option>
                <option value="prioridad">Prioridad</option>
                <option value="estado">Estado</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* ── KANBAN ─────────────────────────────────────────── */}
        {view === 'kanban' && (
          <div className="h-full overflow-x-auto">
            <div className="flex gap-3 p-4 h-full" style={{ minWidth: `${ESTADOS.length * 240}px` }}>
              {ESTADOS.map((estado) => (
                <div key={estado} className="flex-1 min-w-[210px]">
                  <KanbanColumn
                    estado={estado}
                    tareas={tareasFiltradas.filter((t) => t.estado === estado)}
                    getProyectoNombre={getProyectoNombre}
                    onDrop={handleDrop}
                    onCardClick={setTareaDetalle}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LISTA ──────────────────────────────────────────── */}
        {view === 'lista' && (
          <div className="h-full overflow-auto p-4">
            {tareasOrdenadas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
                <CheckCircle className="w-10 h-10 opacity-30" />
                <p className="text-sm">No hay tareas que coincidan con los filtros</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFiltros({ proyectoId: '', asignadoAId: '', prioridad: '', estado: '' })}
                >
                  Limpiar filtros
                </Button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-line overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-line">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Proyecto</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Título</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Prioridad</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Estado</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Asignado a</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">
                        <button
                          className="flex items-center gap-1 hover:text-slate-700 transition-colors"
                          onClick={() => setSortBy('fechaVencimiento')}
                        >
                          Vencimiento
                          <ChevronDown className={`w-3 h-3 transition-transform ${sortBy === 'fechaVencimiento' ? 'text-blue-600' : ''}`} />
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tareasOrdenadas.map((tarea, idx) => {
                      const proyecto = getProyecto(tarea.proyectoId)
                      const usuario = state.usuarios.find((u) => u.id === tarea.asignadoAId)
                      const vencida = isVencida(tarea.fechaVencimiento)
                      return (
                        <tr
                          key={tarea.id}
                          className={`border-b border-line last:border-b-0 hover:bg-slate-50 cursor-pointer transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/40'}`}
                          onClick={() => setTareaDetalle(tarea)}
                        >
                          <td className="px-4 py-3">
                            <span className="text-xs text-slate-500 max-w-[140px] truncate block">
                              {proyecto?.nombre ?? tarea.proyectoId}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-fg line-clamp-1 max-w-[280px]">{tarea.titulo}</span>
                            {tarea.descripcion && (
                              <span className="text-xs text-slate-400 block truncate max-w-[280px]">{tarea.descripcion}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${PRIORIDAD_COLORS[tarea.prioridad]}`}>
                              {tarea.prioridad}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={tarea.estado} size="sm" />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar userId={tarea.asignadoAId} />
                              <span className="text-xs text-slate-600 whitespace-nowrap">
                                {usuario?.nombre?.split(' ')[0] ?? tarea.asignadoAId}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs whitespace-nowrap ${vencida ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                              {formatFecha(tarea.fechaVencimiento)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setTareaDetalle(tarea)
                              }}
                            >
                              Ver detalle
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {tareaDetalle && (
        <TareaDetailModal
          tarea={tareaDetalle}
          onClose={() => setTareaDetalle(null)}
        />
      )}
      <NuevaTareaModal open={nuevaTareaOpen} onClose={() => setNuevaTareaOpen(false)} />
    </div>
  )
}
