import React, { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts'
import {
  Building2,
  FolderKanban,
  Clock,
  AlertTriangle,
  FileText,
  TrendingUp,
  ArrowRight,
  ClipboardList,
  ShieldAlert,
  BarChart2,
  Upload,
  XCircle,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Button } from '../components/ui/Button'
import type { PageId } from '../types'
import { EVOLUCION_AVANCE } from '../data/demo'
import { estaVencida, fechaISO, hoyLocal } from '../lib/tareas'

// ─── Constants ───────────────────────────────────────────────────────────────

// "Today" fixed as Oct 23, 2026 per spec

const CHART_COLORS = {
  navy: '#1e3a5f',
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  violet: '#8b5cf6',
  slate: '#94a3b8',
}

const ESTADO_PROYECTO_LIST = [
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
] as const

const DOC_ESTADO_COLORS: Record<string, string> = {
  'Borrador': CHART_COLORS.navy,
  'En elaboración': CHART_COLORS.blue,
  'Pendiente de revisión': CHART_COLORS.amber,
  'En corrección': CHART_COLORS.red,
  'Aprobado': CHART_COLORS.emerald,
  'Obsoleto': CHART_COLORS.slate,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(s: string): Date {
  const [d, m, y] = s.split('/').map(Number)
  return new Date(y, m - 1, d)
}

function getPageForEntidad(tipo: string): PageId {
  const map: Record<string, PageId> = {
    proyecto: 'proyecto-detalle',
    empresa: 'empresa-detalle',
    tarea: 'tareas',
    documento: 'documentacion',
    evidencia: 'levantamiento',
  }
  return map[tipo] ?? 'inicio'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KPICardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: number | string
  subtext?: string
  iconBg: string
  highlight?: boolean
  onClick?: () => void
  children?: React.ReactNode
}

function KPICard({
  icon: Icon,
  label,
  value,
  subtext,
  iconBg,
  highlight = false,
  onClick,
  children,
}: KPICardProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={[
        'bg-white rounded-xl border p-5 text-left transition-all w-full shadow-sm',
        highlight ? 'border-red-200 shadow-red-50' : 'border-line',
        onClick ? 'hover:shadow-md cursor-pointer group' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
        {onClick && (
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        )}
      </div>
      {value !== undefined && (
        <div className={`text-3xl font-bold mb-1 ${highlight ? 'text-red-600' : 'text-fg'}`}>
          {value}
        </div>
      )}
      <div className="text-sm font-medium text-fg/60">{label}</div>
      {subtext && <div className="text-xs text-fg/40 mt-0.5">{subtext}</div>}
      {children}
    </Tag>
  )
}

function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {action && onAction && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAction}
          iconRight={<ArrowRight className="w-3.5 h-3.5" />}
        >
          {action}
        </Button>
      )}
    </div>
  )
}

function ChartEmpty({ hint }: { hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[180px] gap-2 text-center">
      <BarChart2 className="w-8 h-8 text-slate-200" />
      <p className="text-sm font-medium text-slate-400">Sin datos suficientes</p>
      {hint && <p className="text-xs text-slate-300">{hint}</p>}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { state, navigate, calcularAvance, getUsuario } = useApp()
  const { tareas, proyectos, empresas } = state

  // ── Filter state ──────────────────────────────────────────────────────────

  const [empresaFilter, setEmpresaFilter] = useState('all')
  const [proyectoFilter, setProyectoFilter] = useState('all')
  const [responsableFilter, setResponsableFilter] = useState('all')
  const [periodoFilter, setPeriodoFilter] = useState('all')
  const [estadoFilter, setEstadoFilter] = useState('all')

  const isFiltered =
    empresaFilter !== 'all' ||
    proyectoFilter !== 'all' ||
    responsableFilter !== 'all' ||
    periodoFilter !== 'all' ||
    estadoFilter !== 'all'

  function clearFilters() {
    setEmpresaFilter('all')
    setProyectoFilter('all')
    setResponsableFilter('all')
    setPeriodoFilter('all')
    setEstadoFilter('all')
  }

  // ── Filter options ────────────────────────────────────────────────────────

  const consultores = useMemo(
    () => state.usuarios.filter((u) => u.rol === 'Consultor' || u.rol === 'Admin Consultoría'),
    [state.usuarios]
  )

  const periodosDisponibles = useMemo(() => {
    const years = new Set<string>()
    proyectos.forEach((p) => {
      const parts = p.fechaInicio.split('/')
      if (parts[2]) years.add(parts[2])
    })
    return Array.from(years).sort()
  }, [proyectos])

  const proyectosParaSelector = useMemo(
    () => proyectos.filter((p) => empresaFilter === 'all' || p.empresaId === empresaFilter),
    [proyectos, empresaFilter]
  )

  // ── Filtered data ─────────────────────────────────────────────────────────

  const filteredProyectos = useMemo(() => {
    return proyectos.filter((p) => {
      if (empresaFilter !== 'all' && p.empresaId !== empresaFilter) return false
      if (proyectoFilter !== 'all' && p.id !== proyectoFilter) return false
      if (responsableFilter !== 'all' && p.consultorId !== responsableFilter) return false
      if (estadoFilter !== 'all' && p.estado !== estadoFilter) return false
      if (periodoFilter !== 'all') {
        const year = p.fechaInicio.split('/')[2]
        if (year !== periodoFilter) return false
      }
      return true
    })
  }, [proyectos, empresaFilter, proyectoFilter, responsableFilter, estadoFilter, periodoFilter])

  const filteredIds = useMemo(
    () => new Set(filteredProyectos.map((p) => p.id)),
    [filteredProyectos]
  )

  const filteredTareas = useMemo(
    () => tareas.filter((t) => filteredIds.has(t.proyectoId)),
    [tareas, filteredIds]
  )

  const filteredDocumentos = useMemo(
    () => state.documentos.filter((d) => filteredIds.has(d.proyectoId)),
    [filteredIds, state.documentos]
  )

  const filteredEvidencias = useMemo(
    () => state.evidencias.filter((e) => filteredIds.has(e.proyectoId)),
    [filteredIds, state.evidencias]
  )

  // ── KPI values ────────────────────────────────────────────────────────────

  const kpiEmpresasCount = useMemo(
    () => new Set(filteredProyectos.map((p) => p.empresaId)).size,
    [filteredProyectos]
  )

  const kpiProyectosActivos = useMemo(
    () => filteredProyectos.filter((p) => p.estado !== 'Finalizado' && p.estado !== 'Suspendido').length,
    [filteredProyectos]
  )

  const kpiEvidenciasPendientes = useMemo(
    () => filteredEvidencias.filter((e) => e.estado === 'Pendiente').length,
    [filteredEvidencias]
  )

  // Vence hoy o en los próximos 7 días (fecha local; las vencidas van aparte).
  const kpiProximosVencer = useMemo(() => {
    const hoy = hoyLocal()
    const limite = new Date()
    limite.setDate(limite.getDate() + 7)
    const hasta = hoyLocal(limite)
    return filteredTareas.filter((t) => {
      if (t.estado === 'Completada' || !t.fechaVencimiento) return false
      const fecha = fechaISO(t.fechaVencimiento)
      return fecha >= hoy && fecha <= hasta
    }).length
  }, [filteredTareas])

  const kpiVencidas = useMemo(() => {
    const hoy = hoyLocal()
    return filteredTareas.filter((t) => estaVencida(t, hoy)).length
  }, [filteredTareas])

  const kpiEvidenciasCargadas = useMemo(
    () => filteredEvidencias.filter((e) => e.estado === 'Cargada').length,
    [filteredEvidencias]
  )

  const docEstadoCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredDocumentos.forEach((d) => {
      counts[d.estado] = (counts[d.estado] ?? 0) + 1
    })
    return Object.entries(counts)
  }, [filteredDocumentos])

  // ── Chart data ────────────────────────────────────────────────────────────

  // Chart 1: Proyectos por estado (horizontal bar — all 10 states)
  const chartProyectosPorEstado = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredProyectos.forEach((p) => {
      counts[p.estado] = (counts[p.estado] ?? 0) + 1
    })
    return ESTADO_PROYECTO_LIST.map((e) => ({ estado: e, Proyectos: counts[e] ?? 0 })).filter(
      (d) => d.Proyectos > 0
    )
  }, [filteredProyectos])

  // Chart 2: Avance promedio por empresa (vertical bar)
  const chartAvancePorEmpresa = useMemo(() => {
    const byEmpresa: Record<string, number[]> = {}
    filteredProyectos.forEach((p) => {
      const avance = calcularAvance(p.id)
      if (!byEmpresa[p.empresaId]) byEmpresa[p.empresaId] = []
      byEmpresa[p.empresaId].push(avance)
    })
    return empresas
      .filter((e) => byEmpresa[e.id])
      .map((e) => {
        const arr = byEmpresa[e.id]
        const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
        return {
          empresa: e.nombreComercial ?? e.nombre.split(' ').slice(0, 2).join(' '),
          Avance: avg,
        }
      })
  }, [filteredProyectos, calcularAvance, empresas])

  // Chart 3: Documentos por estado de revisión (pie)
  const chartDocsPorEstado = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredDocumentos.forEach((d) => {
      counts[d.estado] = (counts[d.estado] ?? 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [filteredDocumentos])

  // Chart 4: Tareas completadas vs pendientes por proyecto
  const chartTareasPorProyecto = useMemo(() => {
    return filteredProyectos.map((p) => {
      const ts = filteredTareas.filter((t) => t.proyectoId === p.id)
      const completadas = ts.filter((t) => t.estado === 'Completada').length
      const pendientes = ts.filter((t) => t.estado !== 'Completada').length
      const emp = empresas.find((e) => e.id === p.empresaId)
      const label = emp?.nombreComercial ?? emp?.nombre.split(' ')[0] ?? p.id
      return { proyecto: label, Completadas: completadas, Pendientes: pendientes }
    })
  }, [filteredProyectos, filteredTareas, empresas])

  // Chart 5: Evolución del avance — uses demo data directly
  const evolucionSeries: Array<{ key: string; color: string }> = [
    { key: 'Manufact. Norte', color: CHART_COLORS.navy },
    { key: 'Dist. Altiplano', color: CHART_COLORS.blue },
    { key: 'Revisión 2023', color: CHART_COLORS.emerald },
  ]

  // ── Historial reciente ────────────────────────────────────────────────────

  const historialReciente = useMemo(
    () =>
      [...state.auditoria]
        .sort((a, b) => parseDate(b.fecha).getTime() - parseDate(a.fecha).getTime())
        .slice(0, 5),
    [state.auditoria]
  )

  // ── Styles ────────────────────────────────────────────────────────────────

  const selectClass =
    'h-8 px-3 text-xs text-fg bg-canvas border border-line rounded-full appearance-none cursor-pointer ' +
    'hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors'

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      {/* Page heading */}
      <div>
        <h2 className="text-xl font-bold text-fg">Panel de control</h2>
        <p className="text-sm text-fg/60 mt-0.5">
          Vista general del avance de proyectos ISO 9001:2026 &middot;{' '}
          {new Date().toLocaleDateString('es-MX', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white border border-line rounded-xl px-4 py-3 flex flex-wrap gap-2 items-center shadow-sm">
        <span className="text-xs font-semibold text-fg/40 uppercase tracking-wide mr-1">Filtrar:</span>

        <select
          value={empresaFilter}
          onChange={(e) => {
            setEmpresaFilter(e.target.value)
            setProyectoFilter('all')
          }}
          className={selectClass}
        >
          <option value="all">Todas las empresas</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombreComercial ?? e.nombre}
            </option>
          ))}
        </select>

        <select
          value={proyectoFilter}
          onChange={(e) => setProyectoFilter(e.target.value)}
          className={selectClass}
        >
          <option value="all">Todos los proyectos</option>
          {proyectosParaSelector.map((p) => {
            const emp = empresas.find((e) => e.id === p.empresaId)
            return (
              <option key={p.id} value={p.id}>
                {p.nombre} ({emp?.nombreComercial ?? emp?.nombre.split(' ')[0] ?? ''})
              </option>
            )
          })}
        </select>

        <select
          value={responsableFilter}
          onChange={(e) => setResponsableFilter(e.target.value)}
          className={selectClass}
        >
          <option value="all">Todos los responsables</option>
          {consultores.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>

        <select
          value={periodoFilter}
          onChange={(e) => setPeriodoFilter(e.target.value)}
          className={selectClass}
        >
          <option value="all">Todos los periodos</option>
          {periodosDisponibles.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
          className={selectClass}
        >
          <option value="all">Todos los estados</option>
          {ESTADO_PROYECTO_LIST.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {isFiltered && (
          <button
            onClick={clearFilters}
            className="h-8 px-3 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors flex items-center gap-1.5 ml-1"
          >
            <XCircle className="w-3.5 h-3.5" />
            Limpiar filtros
          </button>
        )}
      </div>

      {/* ── KPI Row 1 (4 cards) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Building2}
          label="Empresas cliente"
          value={kpiEmpresasCount}
          subtext={`${empresas.length} registradas en total`}
          iconBg="bg-slate-100 text-navy"
          onClick={() => navigate('empresas')}
        />
        <KPICard
          icon={FolderKanban}
          label="Proyectos activos"
          value={kpiProyectosActivos}
          subtext={`${filteredProyectos.length} proyectos en el filtro`}
          iconBg="bg-blue-50 text-blue-600"
          onClick={() => navigate('proyectos')}
        />
        <KPICard
          icon={Clock}
          label="Pendientes de información"
          value={kpiEvidenciasPendientes}
          subtext="Evidencias sin cargar"
          iconBg={
            kpiEvidenciasPendientes > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
          }
          onClick={() => navigate('levantamiento')}
        />
        <KPICard
          icon={AlertTriangle}
          label="Próximos a vencer"
          value={kpiProximosVencer}
          subtext="Tareas en los próximos 7 días"
          iconBg={
            kpiProximosVencer > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
          }
          highlight={kpiProximosVencer > 0}
          onClick={() => navigate('tablero-tareas')}
        />
      </div>

      {/* ── KPI Row 2 (3 wider cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Documentos por estado — inline mini bar */}
        <KPICard
          icon={FileText}
          label="Documentos por estado"
          iconBg="bg-indigo-50 text-indigo-600"
          onClick={() => navigate('documentacion')}
        >
          {docEstadoCounts.length === 0 ? (
            <p className="text-xs text-slate-400 mt-3">Sin documentos para el filtro.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {docEstadoCounts.map(([estado, count]) => {
                const total = filteredDocumentos.length
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={estado} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 truncate flex-1 pr-2">{estado}</span>
                      <span className="text-xs font-semibold text-slate-700 flex-shrink-0">
                        {count}
                      </span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-1 rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: DOC_ESTADO_COLORS[estado] ?? CHART_COLORS.slate,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </KPICard>

        {/* Actividades vencidas */}
        <KPICard
          icon={ShieldAlert}
          label="Actividades vencidas"
          value={kpiVencidas}
          subtext={kpiVencidas > 0 ? 'Requieren atención inmediata' : 'Sin tareas vencidas'}
          iconBg={kpiVencidas > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}
          highlight={kpiVencidas > 0}
          onClick={() => navigate('tablero-tareas')}
        />

        {/* Evidencias por validar */}
        <KPICard
          icon={Upload}
          label="Evidencias por validar"
          value={kpiEvidenciasCargadas}
          subtext="Evidencias cargadas pendientes de revisión"
          iconBg="bg-sky-50 text-sky-600"
          onClick={() => navigate('levantamiento')}
        />
      </div>

      {/* ── Charts — 2-col grid, last chart full-width ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Proyectos por estado (horizontal bar) */}
        <div className="bg-white border border-line rounded-xl p-5 shadow-sm">
          <SectionHeader title="Proyectos por estado" />
          {chartProyectosPorEstado.length === 0 ? (
            <ChartEmpty hint="Ajusta los filtros para ver datos" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chartProyectosPorEstado}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis
                  type="category"
                  dataKey="estado"
                  width={152}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  formatter={(v) => [v, 'Proyectos']}
                />
                <Bar dataKey="Proyectos" fill={CHART_COLORS.navy} radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 2: Avance promedio por empresa (vertical bar) */}
        <div className="bg-white border border-line rounded-xl p-5 shadow-sm">
          <SectionHeader title="Avance promedio por empresa" />
          {chartAvancePorEmpresa.length === 0 ? (
            <ChartEmpty hint="Sin proyectos para el filtro seleccionado" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chartAvancePorEmpresa}
                margin={{ top: 10, right: 24, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="empresa" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  formatter={(v) => [`${v}%`, 'Avance promedio']}
                />
                <Bar dataKey="Avance" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 3: Documentos por estado (donut pie) */}
        <div className="bg-white border border-line rounded-xl p-5 shadow-sm">
          <SectionHeader title="Documentos por estado de revisión" />
          {chartDocsPorEstado.length === 0 ? (
            <ChartEmpty hint="Sin documentos para el filtro seleccionado" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={chartDocsPorEstado}
                  cx="50%"
                  cy="45%"
                  outerRadius={90}
                  innerRadius={44}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={2}
                >
                  {chartDocsPorEstado.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        DOC_ESTADO_COLORS[entry.name] ??
                        Object.values(CHART_COLORS)[index % Object.keys(CHART_COLORS).length]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  formatter={(v, name) => [v, name]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 4: Tareas completadas vs pendientes (stacked bar) */}
        <div className="bg-white border border-line rounded-xl p-5 shadow-sm">
          <SectionHeader title="Tareas por proyecto" />
          {chartTareasPorProyecto.length === 0 ||
          chartTareasPorProyecto.every((d) => d.Completadas === 0 && d.Pendientes === 0) ? (
            <ChartEmpty hint="Sin tareas registradas para el filtro seleccionado" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chartTareasPorProyecto}
                margin={{ top: 10, right: 24, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="proyecto" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="Completadas"
                  stackId="a"
                  fill={CHART_COLORS.emerald}
                  maxBarSize={56}
                />
                <Bar
                  dataKey="Pendientes"
                  stackId="a"
                  fill={CHART_COLORS.amber}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={56}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 5: Evolución del avance — full width */}
        <div className="bg-white border border-line rounded-xl p-5 shadow-sm lg:col-span-2">
          <SectionHeader title="Evolución del avance por empresa" />
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart
              data={EVOLUCION_AVANCE}
              margin={{ top: 10, right: 24, left: 0, bottom: 0 }}
            >
              <defs>
                {evolucionSeries.map((s) => (
                  <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                formatter={(v) => [`${v}%`]}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              {evolucionSeries.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#grad-${s.key})`}
                  dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Actividad reciente ── */}
      <div className="bg-white border border-line rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <h3 className="text-sm font-semibold text-fg">Actividad reciente</h3>
          <span className="text-xs text-fg/40">Últimas 5 acciones</span>
        </div>
        {historialReciente.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-400">Sin datos suficientes</p>
            <p className="text-xs text-slate-300 mt-1">
              Registra actividad en los proyectos para ver el historial.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-line">
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-fg/40 uppercase tracking-wide whitespace-nowrap">
                    Fecha
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-fg/40 uppercase tracking-wide whitespace-nowrap">
                    Acción
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-fg/40 uppercase tracking-wide hidden md:table-cell">
                    Descripción
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-fg/40 uppercase tracking-wide hidden sm:table-cell whitespace-nowrap">
                    Responsable
                  </th>
                </tr>
              </thead>
              <tbody>
                {historialReciente.map((h, i) => {
                  const autor = getUsuario(h.autorId)
                  return (
                    <tr
                      key={h.id}
                      onClick={() =>
                        navigate(getPageForEntidad(h.entidadTipo), { id: h.entidadId })
                      }
                      className={[
                        'border-b border-slate-50 last:border-0 cursor-pointer transition-colors hover:bg-blue-50/40',
                        i % 2 !== 0 ? 'bg-slate-50/40' : '',
                      ].join(' ')}
                    >
                      <td className="px-5 py-3 text-xs text-fg/60 whitespace-nowrap">{h.fecha}</td>
                      <td className="px-5 py-3">
                        <span className="inline-block text-xs font-medium text-fg bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {h.accion}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-fg/60 hidden md:table-cell max-w-xs">
                        <span className="line-clamp-1">{h.descripcion}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-fg/60 hidden sm:table-cell whitespace-nowrap">
                        {autor?.nombre ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Quick links ── */}
      <div>
        <h3 className="text-sm font-semibold text-fg mb-4">Accesos rápidos</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(
            [
              {
                label: 'Tablero de tareas',
                icon: ClipboardList,
                page: 'tablero-tareas' as PageId,
                card: 'bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100/70 hover:border-blue-300',
                ib: 'bg-blue-100 text-blue-600',
              },
              {
                label: 'Documentación',
                icon: FileText,
                page: 'documentacion' as PageId,
                card: 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100/70 hover:border-indigo-300',
                ib: 'bg-indigo-100 text-indigo-600',
              },
              {
                label: 'No conformidades',
                icon: ShieldAlert,
                page: 'no-conformidades' as PageId,
                card: 'bg-red-50 border-red-100 text-red-700 hover:bg-red-100/70 hover:border-red-300',
                ib: 'bg-red-100 text-red-600',
              },
              {
                label: 'Indicadores',
                icon: TrendingUp,
                page: 'indicadores' as PageId,
                card: 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100/70 hover:border-emerald-300',
                ib: 'bg-emerald-100 text-emerald-600',
              },
            ] as const
          ).map(({ label, icon: Icon, page, card, ib }) => (
            <button
              key={page}
              onClick={() => navigate(page)}
              className={`flex flex-col items-center gap-3 p-5 rounded-xl border transition-all text-center group ${card}`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${ib}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold leading-snug">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
