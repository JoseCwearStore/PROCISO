import { useState } from 'react'
import {
  Plus,
  List,
  LayoutGrid,
  Columns,
  CalendarDays,
  Building2,
  User,
  CheckCircle,
  TrendingUp,
  Clock,
  AlertTriangle,
  FileText,
  ClipboardList,
  ArrowLeft,
  Package,
  Info,
  ChevronRight,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { ProgressBar } from '../components/ui/ProgressBar'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import { Tabs } from '../components/ui/Tabs'
import type { Column } from '../components/ui/DataTable'
import type { Proyecto, EstadoProyecto, Entregable, Tarea, Documento, Fase, NavParams, PageId, Usuario } from '../types'
import { servicioEscritura } from '../lib/servicios'
import { MENSAJES_ERROR_ESCRITURA, type NuevoEntregable, type NuevoProyecto } from '../lib/escrituras'
import { useAccionesEntregable } from '../hooks/useAccionesEntregable'
import { useAccionesGestion } from '../hooks/useAccionesGestion'
import { EquipoProyecto } from '../components/EquipoProyecto'

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTADOS_PROYECTO: EstadoProyecto[] = [
  'Planificación',
  'Diagnóstico',
  'Recopilación de información',
  'Análisis de procesos',
  'Elaboración documental',
  'Revisión',
  'Correcciones',
  'Validación',
  'Finalizado',
  'Suspendido',
]

const NORMAS: Array<{ value: Proyecto['edicionNorma']; label: string }> = [
  { value: 'ISO 9001:2026', label: 'ISO 9001:2026 (vigente)' },
  { value: 'ISO 9001:2015', label: 'ISO 9001:2015 (en transición)' },
]

const FORMULA_TOOLTIP =
  'Avance = 70% × (tareas completadas / tareas totales) + 30% × (entregables aprobados / entregables totales)'

type ViewMode = 'lista' | 'tarjetas' | 'kanban' | 'cronograma'

// ─── Utilities ────────────────────────────────────────────────────────────────

function parseDate(str: string): Date {
  if (!str) return new Date()
  if (str.includes('/')) {
    const [d, m, y] = str.split('/')
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  }
  return new Date(str)
}

function toDisplayDate(iso: string): string {
  if (!iso) return ''
  if (iso.includes('/')) return iso
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function inputCls(err?: string) {
  return `w-full h-9 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${err ? 'border-red-300' : 'border-slate-300'}`
}

function selectCls(err?: string) {
  return `w-full h-9 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${err ? 'border-red-300' : 'border-slate-300'}`
}

const filterCls = 'h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

// ─── Shared FormField ─────────────────────────────────────────────────────────

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ─── New Project Modal ────────────────────────────────────────────────────────

function NuevoProyectoModal({
  open,
  onClose,
  empresas,
  consultores,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  empresas: { id: string; nombre: string }[]
  consultores: Usuario[]
  // Devuelve true si se guardó. Si falla, el formulario conserva lo que se escribió.
  onCreated: (data: NuevoProyecto) => Promise<boolean>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{
    nombre: string; empresaId: string; consultorId: string; edicionNorma: Proyecto['edicionNorma']
    objetivo: string; alcance: string; fechaInicio: string; fechaFinEstimada: string
  }>({
    nombre: '', empresaId: '', consultorId: '', edicionNorma: 'ISO 9001:2026',
    objetivo: '', alcance: '', fechaInicio: '', fechaFinEstimada: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es requerido'
    if (!form.empresaId) e.empresaId = 'Selecciona una empresa'
    if (!form.consultorId) e.consultorId = 'Selecciona un consultor'
    if (!form.fechaInicio) e.fechaInicio = 'La fecha de inicio es requerida'
    if (!form.fechaFinEstimada) e.fechaFinEstimada = 'La fecha estimada es requerida'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    const guardado = await onCreated(form)
    setSaving(false)
    if (!guardado) return
    setForm({ nombre: '', empresaId: '', consultorId: '', edicionNorma: 'ISO 9001:2026', objetivo: '', alcance: '', fechaInicio: '', fechaFinEstimada: '' })
    setErrors({})
  }

  function handleClose() {
    setErrors({})
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nuevo proyecto"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={saving}>Crear proyecto</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Nombre del proyecto *" error={errors.nombre}>
          <input type="text" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            placeholder="Ej. Implementación SGC ISO 9001:2026" className={inputCls(errors.nombre)} />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Empresa cliente *" error={errors.empresaId}>
            <select value={form.empresaId} onChange={(e) => setForm((f) => ({ ...f, empresaId: e.target.value }))}
              className={selectCls(errors.empresaId)}>
              <option value="">Seleccionar empresa</option>
              {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
            </select>
          </FormField>
          <FormField label="Consultor asignado *" error={errors.consultorId}>
            <select value={form.consultorId} onChange={(e) => setForm((f) => ({ ...f, consultorId: e.target.value }))}
              className={selectCls(errors.consultorId)}>
              <option value="">Seleccionar consultor</option>
              {consultores.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Norma *">
          <select value={form.edicionNorma} onChange={(e) => setForm((f) => ({ ...f, edicionNorma: e.target.value as Proyecto['edicionNorma'] }))}
            className={selectCls()}>
            {NORMAS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
          </select>
        </FormField>
        <FormField label="Objetivo">
          <textarea value={form.objetivo} onChange={(e) => setForm((f) => ({ ...f, objetivo: e.target.value }))}
            placeholder="Objetivo general del proyecto..." rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </FormField>
        <FormField label="Alcance">
          <textarea value={form.alcance} onChange={(e) => setForm((f) => ({ ...f, alcance: e.target.value }))}
            placeholder="Alcance del sistema de gestión a implementar..." rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Fecha de inicio *" error={errors.fechaInicio}>
            <input type="date" value={form.fechaInicio} onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
              className={inputCls(errors.fechaInicio)} />
          </FormField>
          <FormField label="Fecha fin estimada *" error={errors.fechaFinEstimada}>
            <input type="date" value={form.fechaFinEstimada} onChange={(e) => setForm((f) => ({ ...f, fechaFinEstimada: e.target.value }))}
              className={inputCls(errors.fechaFinEstimada)} />
          </FormField>
        </div>
      </div>
    </Modal>
  )
}

// ─── View: Lista ──────────────────────────────────────────────────────────────

type ProyRow = Record<string, unknown> & Proyecto

function ListView({
  proyectos, onView, onNew, calcularAvance, getEmpresa, getUsuario,
}: {
  proyectos: Proyecto[]
  onView: (id: string) => void
  onNew?: () => void // sin esto, no se ofrece "Nuevo proyecto" (la BD solo deja a los admins)
  calcularAvance: (id: string) => number
  getEmpresa: (id: string) => { nombre: string; logoInicial: string } | undefined
  getUsuario: (id: string) => Usuario | undefined
}) {
  const columns: Column<ProyRow>[] = [
    {
      key: 'empresaId',
      label: 'Empresa',
      render: (_, row) => {
        const emp = getEmpresa(row.empresaId)
        return (
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
              {emp?.logoInicial ?? '?'}
            </span>
            <span className="text-sm text-slate-700 truncate max-w-[140px]">{emp?.nombre ?? '—'}</span>
          </div>
        )
      },
    },
    {
      key: 'nombre',
      label: 'Proyecto',
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="font-medium text-slate-800 truncate max-w-[220px]">{row.nombre}</p>
          <p className="text-xs text-slate-400">{row.edicionNorma}</p>
        </div>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (_, row) => <StatusBadge status={row.estado} size="sm" />,
    },
    {
      key: 'avance',
      label: 'Avance',
      render: (_, row) => {
        const avance = calcularAvance(row.id)
        return (
          <div className="flex items-center gap-2 min-w-[130px]" title={FORMULA_TOOLTIP}>
            <ProgressBar value={avance} size="sm" />
            <span className="text-xs font-medium text-slate-600 w-8 text-right">{avance}%</span>
          </div>
        )
      },
    },
    {
      key: 'consultorId',
      label: 'Consultor',
      render: (_, row) => {
        const u = getUsuario(row.consultorId)
        return (
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-600">{u?.nombre ?? '—'}</span>
          </div>
        )
      },
    },
    { key: 'fechaFinEstimada', label: 'Fin estimado', sortable: true, className: 'hidden lg:table-cell' },
    {
      key: 'id',
      label: '',
      render: (_, row) => (
        <Button variant="ghost" size="sm" iconRight={<ChevronRight className="w-4 h-4" />}
          onClick={(e) => { e.stopPropagation(); onView(row.id) }}>
          Ver detalle
        </Button>
      ),
    },
  ]

  return (
    <DataTable
      data={proyectos as ProyRow[]}
      columns={columns}
      searchPlaceholder="Buscar proyecto, empresa..."
      rowKey={(r) => r.id}
      onRowClick={(r) => onView(r.id)}
      emptyTitle="Sin proyectos encontrados"
      emptyDescription="No hay proyectos que coincidan con los filtros aplicados."
      emptyAction={onNew ? { label: 'Nuevo proyecto', onClick: onNew } : undefined}
    />
  )
}

// ─── View: Tarjetas ───────────────────────────────────────────────────────────

function TarjetasView({
  proyectos, onView, onNew, calcularAvance, getEmpresa, getUsuario,
}: {
  proyectos: Proyecto[]
  onView: (id: string) => void
  onNew?: () => void // sin esto, no se ofrece "Nuevo proyecto" (la BD solo deja a los admins)
  calcularAvance: (id: string) => number
  getEmpresa: (id: string) => { nombre: string; logoInicial: string } | undefined
  getUsuario: (id: string) => Usuario | undefined
}) {
  if (proyectos.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
        <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="font-medium text-slate-500">Sin proyectos encontrados</p>
        <p className="text-sm text-slate-400 mb-4">No hay proyectos que coincidan con los filtros aplicados.</p>
        {onNew && <Button size="sm" onClick={onNew} icon={<Plus className="w-4 h-4" />}>Nuevo proyecto</Button>}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {proyectos.map((p) => {
        const emp = getEmpresa(p.empresaId)
        const consultor = getUsuario(p.consultorId)
        const avance = calcularAvance(p.id)
        return (
          <div key={p.id}
            className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onView(p.id)}>
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center flex-shrink-0">
                {emp?.logoInicial ?? '?'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 truncate">{emp?.nombre ?? '—'}</p>
                <p className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2">{p.nombre}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <StatusBadge status={p.estado} size="sm" />
              <span className="text-xs text-slate-400">{p.edicionNorma}</span>
            </div>
            <div title={FORMULA_TOOLTIP}>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Avance</span>
                <span className="font-semibold">{avance}%</span>
              </div>
              <ProgressBar value={avance} size="sm" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="truncate">{consultor?.nombre ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-2">
              <span>Inicio: {p.fechaInicio}</span>
              <span>Fin: {p.fechaFinEstimada}</span>
            </div>
            <Button variant="outline" size="sm" className="w-full"
              onClick={(e) => { e.stopPropagation(); onView(p.id) }}>
              Ver detalle
            </Button>
          </div>
        )
      })}
    </div>
  )
}

// ─── View: Kanban ─────────────────────────────────────────────────────────────

function KanbanView({
  proyectos, onView, onNew, calcularAvance, getEmpresa,
  dragId, dragOver, onDragStart, onDragOver, onDrop, onDragEnter, onDragLeave,
}: {
  proyectos: Proyecto[]
  onView: (id: string) => void
  onNew?: () => void // sin esto, no se ofrece "Nuevo proyecto" (la BD solo deja a los admins)
  calcularAvance: (id: string) => number
  getEmpresa: (id: string) => { nombre: string; logoInicial: string } | undefined
  dragId: string | null
  dragOver: EstadoProyecto | null
  onDragStart: (id: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (estado: EstadoProyecto) => void
  onDragEnter: (estado: EstadoProyecto) => void
  onDragLeave: () => void
}) {
  if (proyectos.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
        <Columns className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="font-medium text-slate-500">Sin proyectos encontrados</p>
        <p className="text-sm text-slate-400 mb-4">No hay proyectos que coincidan con los filtros aplicados.</p>
        {onNew && <Button size="sm" onClick={onNew} icon={<Plus className="w-4 h-4" />}>Nuevo proyecto</Button>}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3" style={{ minWidth: `${ESTADOS_PROYECTO.length * 14}rem` }}>
        {ESTADOS_PROYECTO.map((estado) => {
          const colProyectos = proyectos.filter((p) => p.estado === estado)
          const isOver = dragOver === estado
          return (
            <div key={estado}
              className={`w-52 flex-shrink-0 rounded-xl border-2 transition-colors ${isOver ? 'border-blue-400 bg-blue-50/70' : 'border-slate-200 bg-slate-50'}`}
              onDragOver={onDragOver}
              onDrop={() => onDrop(estado)}
              onDragEnter={() => onDragEnter(estado)}
              onDragLeave={onDragLeave}>
              <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <StatusBadge status={estado} size="sm" />
                <span className="text-xs text-slate-400 font-semibold">{colProyectos.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-28">
                {colProyectos.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Sin proyectos</p>
                ) : colProyectos.map((p) => {
                  const emp = getEmpresa(p.empresaId)
                  const avance = calcularAvance(p.id)
                  return (
                    <div key={p.id} draggable
                      onDragStart={() => onDragStart(p.id)}
                      onClick={() => onView(p.id)}
                      className={`bg-white rounded-lg border border-slate-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-all select-none ${dragId === p.id ? 'opacity-40' : ''}`}>
                      <p className="text-xs text-slate-400 truncate">{emp?.nombre ?? '—'}</p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5 line-clamp-2">{p.nombre}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <ProgressBar value={avance} size="sm" />
                        <span className="text-xs text-slate-500 flex-shrink-0">{avance}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5" />
        Arrastra las tarjetas entre columnas para cambiar el estado del proyecto.
      </p>
    </div>
  )
}

// ─── View: Cronograma ─────────────────────────────────────────────────────────

function CronogramaView({
  proyectos, getEmpresa, onView,
}: {
  proyectos: Proyecto[]
  getEmpresa: (id: string) => { nombre: string } | undefined
  onView: (id: string) => void
}) {
  if (proyectos.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
        <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Sin proyectos para mostrar en el cronograma.</p>
      </div>
    )
  }

  const allDates = proyectos.flatMap((p) => [parseDate(p.fechaInicio), parseDate(p.fechaFinEstimada)])
  const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
  const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())))
  const totalMs = maxDate.getTime() - minDate.getTime() || 1

  const months: { label: string; pct: number }[] = []
  const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
  while (cursor.getTime() <= maxDate.getTime()) {
    months.push({
      label: cursor.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
      pct: ((cursor.getTime() - minDate.getTime()) / totalMs) * 100,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  function barColor(estado: EstadoProyecto) {
    if (estado === 'Finalizado') return 'bg-emerald-500'
    if (estado === 'Suspendido') return 'bg-red-400'
    return 'bg-blue-500'
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex">
        <div className="w-48 flex-shrink-0 border-r border-slate-200">
          <div className="h-10 border-b border-slate-200 bg-slate-50 px-4 flex items-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Proyecto</span>
          </div>
          {proyectos.map((p) => {
            const emp = getEmpresa(p.empresaId)
            return (
              <div key={p.id}
                className="h-14 border-b border-slate-100 last:border-0 px-4 flex flex-col justify-center cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => onView(p.id)}>
                <p className="text-xs font-medium text-slate-700 truncate">{p.nombre}</p>
                <p className="text-xs text-slate-400 truncate">{emp?.nombre ?? '—'}</p>
              </div>
            )
          })}
        </div>
        <div className="flex-1 overflow-x-auto min-w-0">
          <div className="h-10 border-b border-slate-200 bg-slate-50 relative min-w-full">
            {months.map((m, i) => (
              <span key={i} className="absolute top-1/2 -translate-y-1/2 text-xs text-slate-400 whitespace-nowrap pl-1 border-l border-slate-200 h-full flex items-center"
                style={{ left: `${m.pct}%` }}>
                {m.label}
              </span>
            ))}
          </div>
          {proyectos.map((p) => {
            const start = parseDate(p.fechaInicio)
            const end = parseDate(p.fechaFinEstimada)
            const leftPct = ((start.getTime() - minDate.getTime()) / totalMs) * 100
            const widthPct = Math.max(2, ((end.getTime() - start.getTime()) / totalMs) * 100)
            return (
              <div key={p.id} className="h-14 border-b border-slate-100 last:border-0 relative flex items-center">
                {months.map((m, i) => (
                  <span key={i} className="absolute inset-y-0 border-l border-slate-100" style={{ left: `${m.pct}%` }} />
                ))}
                <div
                  className={`absolute h-8 rounded-lg flex items-center px-2.5 overflow-hidden cursor-pointer hover:brightness-110 transition-all ${barColor(p.estado)}`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: '2.5rem' }}
                  title={`${p.nombre} — ${p.fechaInicio} → ${p.fechaFinEstimada}`}
                  onClick={() => onView(p.id)}>
                  <span className="text-white text-xs font-medium truncate">{p.nombre} · {p.avance}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main Proyectos Page ──────────────────────────────────────────────────────

export function Proyectos() {
  const { state, dispatch, navigate, getEmpresa, getUsuario, showToast, calcularAvance, getEntregables } = useApp()
  const permisos = useAccionesGestion()
  const abrirAlta = permisos.puedeCrearProyecto ? () => setCreateOpen(true) : undefined

  const [viewMode, setViewMode] = useState<ViewMode>('lista')
  const [createOpen, setCreateOpen] = useState(false)
  const [filterEmpresa, setFilterEmpresa] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterConsultor, setFilterConsultor] = useState('')
  const [filterNorma, setFilterNorma] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<EstadoProyecto | null>(null)

  const consultores = state.usuarios.filter((u) => u.rol === 'Consultor')

  let filtered = state.proyectos
  if (filterEmpresa) filtered = filtered.filter((p) => p.empresaId === filterEmpresa)
  if (filterEstado) filtered = filtered.filter((p) => p.estado === filterEstado)
  if (filterConsultor) filtered = filtered.filter((p) => p.consultorId === filterConsultor)
  if (filterNorma) filtered = filtered.filter((p) => p.edicionNorma === filterNorma)

  async function handleCreated(data: NuevoProyecto): Promise<boolean> {
    const resultado = await servicioEscritura.crearProyecto(state.currentUser?.consultoriaId ?? null, data)
    if (!resultado.ok) {
      showToast(MENSAJES_ERROR_ESCRITURA[resultado.error], 'error')
      return false
    }
    dispatch({ type: 'ADD_PROYECTO', proyecto: resultado.valor })
    setCreateOpen(false)
    showToast('Proyecto creado exitosamente.', 'success')
    return true
  }

  async function handleDrop(targetEstado: EstadoProyecto) {
    if (!dragId) return
    const proyecto = state.proyectos.find((p) => p.id === dragId)
    if (!proyecto || proyecto.estado === targetEstado) {
      setDragId(null)
      setDragOver(null)
      return
    }
    if (targetEstado === 'Finalizado') {
      const entregables = getEntregables(dragId)
      const pendientes = entregables.filter((e) => e.estado !== 'Aprobado')
      if (pendientes.length > 0) {
        const nombres = pendientes.map((e) => e.nombre).join(', ')
        showToast(`No se puede finalizar. Entregables sin aprobar: ${nombres}`, 'error')
        setDragId(null)
        setDragOver(null)
        return
      }
    }
    const id = dragId
    setDragId(null)
    setDragOver(null)
    const resultado = await servicioEscritura.cambiarEstadoProyecto(id, targetEstado)
    if (!resultado.ok) {
      showToast(MENSAJES_ERROR_ESCRITURA[resultado.error], 'error')
      return
    }
    dispatch({ type: 'UPDATE_PROYECTO', id, updates: { estado: targetEstado } })
    showToast(`Proyecto movido a "${targetEstado}".`, 'success')
  }

  const views: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'lista', label: 'Lista', icon: <List className="w-4 h-4" /> },
    { id: 'tarjetas', label: 'Tarjetas', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'kanban', label: 'Kanban', icon: <Columns className="w-4 h-4" /> },
    { id: 'cronograma', label: 'Cronograma', icon: <CalendarDays className="w-4 h-4" /> },
  ]

  return (
    <div className="p-6 max-w-full mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900">Proyectos</h2>
          <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-full">
            {state.proyectos.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
            {views.map((v) => (
              <button key={v.id} onClick={() => setViewMode(v.id)} title={v.label}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === v.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {v.icon}
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>
          {permisos.puedeCrearProyecto ? (
            <Button onClick={() => setCreateOpen(true)} icon={<Plus className="w-4 h-4" />}>
              Nuevo proyecto
            </Button>
          ) : (
            <p className="max-w-xs text-xs text-slate-500">{permisos.motivo}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)} className={filterCls}>
          <option value="">Todas las empresas</option>
          {state.empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
        </select>
        <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className={filterCls}>
          <option value="">Todos los estados</option>
          {ESTADOS_PROYECTO.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterConsultor} onChange={(e) => setFilterConsultor(e.target.value)} className={filterCls}>
          <option value="">Todos los consultores</option>
          {consultores.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <select value={filterNorma} onChange={(e) => setFilterNorma(e.target.value)} className={filterCls}>
          <option value="">Todas las normas</option>
          {NORMAS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
        </select>
      </div>

      {viewMode === 'lista' && (
        <ListView proyectos={filtered} onView={(id) => navigate('proyecto-detalle', { id })}
          onNew={abrirAlta} calcularAvance={calcularAvance}
          getEmpresa={getEmpresa} getUsuario={getUsuario} />
      )}
      {viewMode === 'tarjetas' && (
        <TarjetasView proyectos={filtered} onView={(id) => navigate('proyecto-detalle', { id })}
          onNew={abrirAlta} calcularAvance={calcularAvance}
          getEmpresa={getEmpresa} getUsuario={getUsuario} />
      )}
      {viewMode === 'kanban' && (
        <KanbanView
          proyectos={filtered} onView={(id) => navigate('proyecto-detalle', { id })}
          onNew={abrirAlta} calcularAvance={calcularAvance} getEmpresa={getEmpresa}
          dragId={dragId} dragOver={dragOver}
          onDragStart={(id) => setDragId(id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onDragEnter={(estado) => setDragOver(estado)}
          onDragLeave={() => setDragOver(null)} />
      )}
      {viewMode === 'cronograma' && (
        <CronogramaView proyectos={filtered} getEmpresa={getEmpresa}
          onView={(id) => navigate('proyecto-detalle', { id })} />
      )}

      <NuevoProyectoModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        // Solo empresas activas y consultores activos: la BD rechaza las archivadas y a los suspendidos.
        empresas={state.empresas.filter((e) => e.activa)}
        consultores={consultores.filter((u) => u.activo)}
        onCreated={handleCreated} />
    </div>
  )
}

// ─── ProyectoDetalle Tabs ─────────────────────────────────────────────────────

function TabResumen({ proyecto, empresa, consultor, avance }: {
  proyecto: Proyecto
  empresa: { nombre: string } | undefined
  consultor: Usuario | undefined
  avance: number
}) {
  const phaseColorMap: Record<Fase['estado'], 'green' | 'blue' | 'amber'> = {
    Completada: 'green', 'En curso': 'blue', Pendiente: 'amber',
  }
  const phaseIconMap: Record<Fase['estado'], React.ReactNode> = {
    Completada: <CheckCircle className="w-4 h-4 text-emerald-500" />,
    'En curso': <TrendingUp className="w-4 h-4 text-blue-500" />,
    Pendiente: <Clock className="w-4 h-4 text-slate-300" />,
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Información del proyecto</h3>
          <dl className="space-y-2 text-sm">
            {[
              { label: 'Empresa', value: empresa?.nombre ?? '—' },
              { label: 'Consultor', value: consultor?.nombre ?? '—' },
              { label: 'Norma', value: proyecto.edicionNorma },
              { label: 'Inicio', value: proyecto.fechaInicio },
              { label: 'Fin estimado', value: proyecto.fechaFinEstimada },
              ...(proyecto.fechaFinReal ? [{ label: 'Fin real', value: proyecto.fechaFinReal }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-2">
                <dt className="text-slate-400 w-28 flex-shrink-0">{label}:</dt>
                <dd className="text-slate-700 font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Objetivo y alcance</h3>
          {proyecto.objetivo ? (
            <div>
              <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Objetivo</p>
              <p className="text-sm text-slate-700">{proyecto.objetivo}</p>
            </div>
          ) : null}
          {proyecto.alcance ? (
            <div>
              <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Alcance</p>
              <p className="text-sm text-slate-700">{proyecto.alcance}</p>
            </div>
          ) : null}
          {!proyecto.objetivo && !proyecto.alcance && (
            <p className="text-sm text-slate-400">Sin información de objetivo o alcance registrada.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Avance general</h3>
          <span className="text-2xl font-bold text-slate-900">{avance}%</span>
        </div>
        <ProgressBar value={avance} size="md" />
        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          {FORMULA_TOOLTIP}
        </p>
      </div>

      {proyecto.fases.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Fases del proyecto</h3>
          <div className="space-y-4">
            {[...proyecto.fases].sort((a, b) => a.orden - b.orden).map((fase) => (
              <div key={fase.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {phaseIconMap[fase.estado]}
                    <span className="text-sm font-medium text-slate-700">{fase.nombre}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={fase.estado} size="sm" />
                    <span className="text-xs font-semibold text-slate-600 w-8 text-right">{fase.avance}%</span>
                  </div>
                </div>
                <ProgressBar value={fase.avance} size="sm" color={phaseColorMap[fase.estado]} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TabTareas({ tareas, getUsuario, navigate }: {
  tareas: Tarea[]
  getUsuario: (id: string) => Usuario | undefined
  navigate: (page: PageId, params?: NavParams) => void
}) {
  const prioridadColor: Record<string, string> = {
    Alta: 'text-red-600 bg-red-50',
    Media: 'text-amber-600 bg-amber-50',
    Baja: 'text-green-600 bg-green-50',
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => navigate('tablero-tareas')}
          icon={<ClipboardList className="w-4 h-4" />}>
          Ver tablero de tareas
        </Button>
      </div>
      {tareas.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Sin tareas asignadas a este proyecto.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tareas.map((t) => {
            const asignado = getUsuario(t.asignadoAId)
            return (
              <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm">{t.titulo}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${prioridadColor[t.prioridad] ?? 'bg-slate-100 text-slate-500'}`}>
                      {t.prioridad}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <User className="w-3 h-3" />{asignado?.nombre ?? '—'}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />Vence: {t.fechaVencimiento}
                    </span>
                  </div>
                </div>
                <StatusBadge status={t.estado} size="sm" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const ENTREGABLE_VACIO = (proyectoId: string): NuevoEntregable => ({ proyectoId, nombre: '', tipo: '', fechaEntrega: '', documentoId: '' })

// El equipo registra y entrega; el cliente aprueba o rechaza desde su panel de inicio.
function TabEntregables({ proyectoId, entregables, documentos }: { proyectoId: string; entregables: Entregable[]; documentos: Documento[] }) {
  const { showToast } = useApp()
  const acciones = useAccionesEntregable()
  const [nuevo, setNuevo] = useState<NuevoEntregable | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function registrar() {
    if (!nuevo || guardando) return
    if (!nuevo.nombre.trim()) {
      showToast('El entregable necesita un nombre.', 'error')
      return
    }
    setGuardando(true)
    const registrado = await acciones.registrar(nuevo)
    setGuardando(false)
    if (!registrado) return
    setNuevo(null)
    showToast(`Entregable "${registrado.nombre}" registrado.`, 'success')
  }

  async function entregar(entregable: Entregable) {
    if (guardando) return
    setGuardando(true)
    const ok = await acciones.decidir(entregable, 'En revisión')
    setGuardando(false)
    if (ok) showToast(`"${entregable.nombre}" entregado: el cliente ya puede aprobarlo.`, 'success')
  }

  const inputClass = 'w-full border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-3">
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          <strong>Aviso:</strong> La consultoría entrega y el cliente de la empresa aprueba desde su panel. La aprobación no equivale a una firma certificada.
        </p>
      </div>
      {acciones.esEquipo && (nuevo ? (
        <div className="bg-white rounded-xl border border-slate-200 p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input className={inputClass} placeholder="Nombre del entregable *" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
          <input className={inputClass} placeholder="Tipo (Informe, Manual…)" value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })} />
          <input className={inputClass} type="date" value={nuevo.fechaEntrega} onChange={(e) => setNuevo({ ...nuevo, fechaEntrega: e.target.value })} title="Fecha comprometida de entrega" />
          <select className={inputClass} value={nuevo.documentoId} onChange={(e) => setNuevo({ ...nuevo, documentoId: e.target.value })}>
            <option value="">Sin documento vinculado</option>
            {documentos.filter((d) => d.estado !== 'Obsoleto').map((d) => <option key={d.id} value={d.id}>{d.codigo ? `${d.codigo} · ` : ''}{d.nombre}</option>)}
          </select>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4 justify-end">
            <Button variant="outline" size="sm" onClick={() => setNuevo(null)}>Cancelar</Button>
            <Button size="sm" onClick={registrar} disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar entregable'}</Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setNuevo(ENTREGABLE_VACIO(proyectoId))}>Nuevo entregable</Button>
        </div>
      ))}
      {entregables.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Sin entregables registrados para este proyecto.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Nombre', 'Tipo', 'Documento', 'Estado', 'F. Entrega', 'F. Aprobación', ''].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entregables.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{e.nombre}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{e.tipo}</td>
                  <td className="px-4 py-3 text-xs">
                    {acciones.documento(e) ? (
                      <span className={acciones.documentoListo(e) ? 'text-emerald-600' : 'text-amber-600'}>
                        {acciones.documento(e)?.codigo ?? acciones.documento(e)?.nombre}
                        {!acciones.documentoListo(e) && ' · sin aprobar'}
                      </span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={e.estado} size="sm" /></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{e.fechaEntrega ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{e.fechaAprobacion ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {acciones.acciones(e).includes('En revisión') && (
                      <Button size="sm" variant="outline" disabled={guardando} onClick={() => entregar(e)}>
                        {e.estado === 'Rechazado' ? 'Volver a entregar' : 'Entregar'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TabDocumentos({ documentos }: { documentos: Documento[] }) {
  return (
    <div className="space-y-2">
      {documentos.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Sin documentos generados para este proyecto.</p>
        </div>
      ) : documentos.map((doc) => (
        <div key={doc.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-800 text-sm truncate">{doc.nombre}</p>
              <p className="text-xs text-slate-400">{doc.tipo} · v{doc.version} · {doc.fechaModificacion}</p>
              {doc.contenidoPendiente && (
                <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="w-3 h-3" />
                  Información pendiente de confirmar
                </p>
              )}
            </div>
          </div>
          <StatusBadge status={doc.estado} size="sm" />
        </div>
      ))}
    </div>
  )
}


// ─── ProyectoDetalle Page Export ──────────────────────────────────────────────

export function ProyectoDetalle() {
  const { state, dispatch, navigate, getEmpresa, getUsuario, getDocumentos, getEntregables, calcularAvance, showToast } = useApp()

  const id = state.navParams.id
  const proyecto = state.proyectos.find((p) => p.id === id)

  const [validacionOpen, setValidacionOpen] = useState(false)
  const [entregablesPendientes, setEntregablesPendientes] = useState<Entregable[]>([])

  if (!proyecto) {
    return (
      <div className="p-6 text-center">
        <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 mb-4">Proyecto no encontrado.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('proyectos')}>Volver a proyectos</Button>
      </div>
    )
  }

  const empresa = getEmpresa(proyecto.empresaId)
  const consultor = getUsuario(proyecto.consultorId)
  const equipo = proyecto.equipoIds.map((uid) => getUsuario(uid))
  const documentos = getDocumentos(proyecto.id)
  const entregables = getEntregables(proyecto.id)
  const tareas = state.tareas.filter((t) => t.proyectoId === proyecto.id)
  const avance = calcularAvance(proyecto.id)

  async function handleEstadoChange(nuevoEstado: EstadoProyecto) {
    if (!proyecto || nuevoEstado === proyecto.estado) return
    if (nuevoEstado === 'Finalizado') {
      const pendientes = entregables.filter((e) => e.estado !== 'Aprobado')
      if (pendientes.length > 0) {
        setEntregablesPendientes(pendientes)
        setValidacionOpen(true)
        return
      }
    }
    const resultado = await servicioEscritura.cambiarEstadoProyecto(proyecto.id, nuevoEstado)
    if (!resultado.ok) {
      showToast(MENSAJES_ERROR_ESCRITURA[resultado.error], 'error')
      return
    }
    dispatch({ type: 'UPDATE_PROYECTO', id: proyecto.id, updates: { estado: nuevoEstado } })
    showToast(`Estado actualizado a "${nuevoEstado}".`, 'success')
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('proyectos')}
          className="text-slate-400 hover:text-slate-600 mt-1.5 flex-shrink-0 transition-colors" aria-label="Volver">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusBadge status={proyecto.estado} />
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{proyecto.edicionNorma}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">{proyecto.nombre}</h2>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 flex-wrap">
            <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4" />{empresa?.nombre ?? '—'}</span>
            <span className="flex items-center gap-1.5"><User className="w-4 h-4" />{consultor?.nombre ?? '—'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div>
            <p className="text-xs text-slate-400 mb-1">Estado</p>
            <select value={proyecto.estado} onChange={(e) => handleEstadoChange(e.target.value as EstadoProyecto)}
              className="h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {ESTADOS_PROYECTO.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="text-right" title={FORMULA_TOOLTIP}>
            <p className="text-2xl font-bold text-slate-900">{avance}%</p>
            <p className="text-xs text-slate-400">avance</p>
          </div>
        </div>
      </div>

      {proyecto.edicionNorma === 'ISO 9001:2015' && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          Este proyecto usa la edición ISO 9001:2015 (en transición).
        </p>
      )}

      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
        <div className="flex justify-between text-xs text-slate-400 mb-2">
          <span>Inicio: {proyecto.fechaInicio}</span>
          <span>Fin estimado: {proyecto.fechaFinEstimada}</span>
        </div>
        <ProgressBar value={avance} size="md" />
      </div>

      <Tabs
        tabs={[
          { id: 'resumen', label: 'Resumen' },
          { id: 'tareas', label: 'Tareas', badge: tareas.length },
          { id: 'entregables', label: 'Entregables', badge: entregables.length },
          { id: 'documentos', label: 'Documentos', badge: documentos.length },
          { id: 'equipo', label: 'Equipo', badge: equipo.filter(Boolean).length },
        ]}
      >
        {(tab) => (
          <>
            {tab === 'resumen' && <TabResumen proyecto={proyecto} empresa={empresa} consultor={consultor} avance={avance} />}
            {tab === 'tareas' && <TabTareas tareas={tareas} getUsuario={getUsuario} navigate={navigate} />}
            {tab === 'entregables' && <TabEntregables proyectoId={proyecto.id} entregables={entregables} documentos={documentos} />}
            {tab === 'documentos' && <TabDocumentos documentos={documentos} />}
            {tab === 'equipo' && <EquipoProyecto proyecto={proyecto} />}
          </>
        )}
      </Tabs>

      <Modal
        open={validacionOpen}
        onClose={() => setValidacionOpen(false)}
        title="No se puede finalizar el proyecto"
        size="md"
        footer={<Button onClick={() => setValidacionOpen(false)}>Entendido</Button>}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Para marcar el proyecto como <strong>Finalizado</strong>, todos los entregables deben estar
              <strong> Aprobados</strong>. Los siguientes entregables aún requieren aprobación:
            </p>
          </div>
          <div className="space-y-2">
            {entregablesPendientes.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-sm text-slate-700">{e.nombre}</span>
                <StatusBadge status={e.estado} size="sm" />
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}
