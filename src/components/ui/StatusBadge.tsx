import {
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Circle,
  Edit3,
  FileText,
  Pause,
  TrendingUp,
  CheckSquare,
  Archive,
  Search,
  BarChart2,
  RefreshCw,
  ShieldCheck,
  Ban,
  RotateCcw,
  Hourglass,
} from 'lucide-react'

type Status =
  // Project states (new 10-state)
  | 'Planificación'
  | 'Diagnóstico'
  | 'Recopilación de información'
  | 'Análisis de procesos'
  | 'Elaboración documental'
  | 'Revisión'
  | 'Correcciones'
  | 'Validación'
  | 'Finalizado'
  | 'Suspendido'
  // Legacy project states
  | 'Inicio'
  | 'En curso'
  | 'Pausado'
  | 'Completado'
  | 'Cancelado'
  // Task states (new 6-state)
  | 'Pendiente'
  | 'En proceso'
  | 'En revisión'
  | 'Requiere corrección'
  | 'Completada'
  | 'Vencida'
  // Legacy
  | 'En progreso'
  // Document states
  | 'Borrador'
  | 'En elaboración'
  | 'Pendiente de revisión'
  | 'En corrección'
  | 'Aprobado'
  | 'Rechazado'
  | 'Obsoleto'
  // Process states
  | 'En levantamiento'
  | 'Documentado'
  | 'Revisado'
  // Deliverable states
  | 'En revisión'
  // NC states
  | 'Abierta'
  | 'En análisis'
  | 'Verificada'
  | 'Cerrada'
  // Evidence states
  | 'Cargada'
  | 'Revisada'
  | 'Aceptada'
  // Priority
  | 'Alta'
  | 'Media'
  | 'Baja'
  // NC type
  | 'Mayor'
  | 'Menor'
  | 'Observación'
  // Misc
  | 'Activa'
  | 'Archivada'

type Size = 'sm' | 'md'

const config: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  // ── New project states ────────────────────────────────────────────────
  'Planificación': { label: 'Planificación', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Circle },
  'Diagnóstico': { label: 'Diagnóstico', color: 'bg-sky-50 text-sky-700 border-sky-200', icon: Search },
  'Recopilación de información': { label: 'Recopilación', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Hourglass },
  'Análisis de procesos': { label: 'Análisis', color: 'bg-violet-50 text-violet-700 border-violet-200', icon: BarChart2 },
  'Elaboración documental': { label: 'Elaboración doc.', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: Edit3 },
  'Revisión': { label: 'Revisión', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  'Correcciones': { label: 'Correcciones', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: RotateCcw },
  'Validación': { label: 'Validación', color: 'bg-teal-50 text-teal-700 border-teal-200', icon: ShieldCheck },
  'Finalizado': { label: 'Finalizado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  'Suspendido': { label: 'Suspendido', color: 'bg-red-50 text-red-600 border-red-200', icon: Ban },
  // ── Legacy project states ─────────────────────────────────────────────
  'Inicio': { label: 'Inicio', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Circle },
  'En curso': { label: 'En curso', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: TrendingUp },
  'Pausado': { label: 'Pausado', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Pause },
  'Completado': { label: 'Completado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  'Cancelado': { label: 'Cancelado', color: 'bg-red-50 text-red-600 border-red-200', icon: XCircle },
  // ── New task states ───────────────────────────────────────────────────
  'Pendiente': { label: 'Pendiente', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: Clock },
  'En proceso': { label: 'En proceso', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: TrendingUp },
  'En revisión': { label: 'En revisión', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: RefreshCw },
  'Requiere corrección': { label: 'Req. corrección', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: RotateCcw },
  'Completada': { label: 'Completada', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  'Vencida': { label: 'Vencida', color: 'bg-red-50 text-red-600 border-red-200', icon: AlertTriangle },
  // ── Legacy ───────────────────────────────────────────────────────────
  'En progreso': { label: 'En progreso', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: TrendingUp },
  // ── Document states ───────────────────────────────────────────────────
  'Borrador': { label: 'Borrador', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: FileText },
  'En elaboración': { label: 'En elaboración', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Edit3 },
  'Pendiente de revisión': { label: 'Pend. revisión', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  'En corrección': { label: 'En corrección', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: Edit3 },
  'Aprobado': { label: 'Aprobado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  'Rechazado': { label: 'Rechazado', color: 'bg-red-50 text-red-600 border-red-200', icon: XCircle },
  'Obsoleto': { label: 'Obsoleto', color: 'bg-slate-100 text-slate-400 border-slate-200', icon: Archive },
  // ── Process states ────────────────────────────────────────────────────
  'En levantamiento': { label: 'En levantamiento', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: TrendingUp },
  'Documentado': { label: 'Documentado', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: FileText },
  'Revisado': { label: 'Revisado', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: CheckSquare },
  // ── NC states ─────────────────────────────────────────────────────────
  'Abierta': { label: 'Abierta', color: 'bg-red-50 text-red-600 border-red-200', icon: AlertTriangle },
  'En análisis': { label: 'En análisis', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  'Verificada': { label: 'Verificada', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckSquare },
  'Cerrada': { label: 'Cerrada', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: CheckCircle },
  // ── Evidence states ───────────────────────────────────────────────────
  'Cargada': { label: 'Cargada', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle },
  'Revisada': { label: 'Revisada', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  'Aceptada': { label: 'Aceptada', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: ShieldCheck },
  // ── Priority ──────────────────────────────────────────────────────────
  'Alta': { label: 'Alta', color: 'bg-red-50 text-red-600 border-red-200', icon: AlertTriangle },
  'Media': { label: 'Media', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  'Baja': { label: 'Baja', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  // ── NC type ───────────────────────────────────────────────────────────
  'Mayor': { label: 'Mayor', color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
  'Menor': { label: 'Menor', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle },
  'Observación': { label: 'Observación', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Circle },
  // ── Misc ──────────────────────────────────────────────────────────────
  'Activa': { label: 'Activa', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  'Archivada': { label: 'Archivada', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: Archive },
}

interface StatusBadgeProps {
  status: Status | string
  size?: Size
}

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const cfg = config[status] ?? {
    label: status,
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: Circle,
  }
  const Icon = cfg.icon

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${cfg.color} ${sizeClasses[size]}`}
    >
      <Icon className="w-3 h-3 flex-shrink-0" />
      {cfg.label}
    </span>
  )
}
