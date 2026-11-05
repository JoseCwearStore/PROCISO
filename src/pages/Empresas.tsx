import { useState } from 'react'
import {
  Building2, Plus, Search, X, ChevronRight, Archive, Users,
  Briefcase, FileText, FolderOpen, Clock, Eye, Edit3, CheckCircle,
  AlertTriangle, MapPin, Phone, Mail, User, BarChart2,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Tabs } from '../components/ui/Tabs'
import { USUARIOS, HISTORIAL } from '../data/demo'
import type { Empresa, Proyecto } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function logoColor(id: string) {
  const colors = [
    'bg-navy text-white',
    'bg-blue-600 text-white',
    'bg-emerald-600 text-white',
    'bg-violet-600 text-white',
    'bg-amber-500 text-white',
  ]
  const idx = id.charCodeAt(id.length - 1) % colors.length
  return colors[idx]
}

// ─── Registration Form ─────────────────────────────────────────────────────────

const SECTORES = ['Manufactura', 'Comercio', 'Servicios', 'Construcción', 'Salud', 'Educación', 'Tecnología', 'Alimentos', 'Transporte y logística', 'Otro']
const TAMANOS = ['Micro (1-10 empleados)', 'Pequeña (11-50 empleados)', 'Mediana (51-250 empleados)', 'Grande (251+ empleados)']
const NORMAS: Array<{ value: NonNullable<Empresa['normaInteres']>; label: string }> = [
  { value: 'ISO 9001:2026', label: 'ISO 9001:2026 (vigente)' },
  { value: 'ISO 9001:2015', label: 'ISO 9001:2015 (en transición)' },
]
const ESTADOS_MX = ['CDMX', 'Jalisco', 'Nuevo León', 'Estado de México', 'Puebla', 'Guanajuato', 'Chihuahua', 'Sonora', 'Baja California', 'Tamaulipas', 'Otro']

interface FormData {
  nombre: string
  nombreComercial: string
  rfc: string
  sector: string
  tamano: string
  ciudad: string
  estado: string
  direccion: string
  contactoPrincipal: string
  cargoContacto: string
  emailContacto: string
  telefonoContacto: string
  procesosprincipales: string
  alcanceInicial: string
  normaInteres: NonNullable<Empresa['normaInteres']>
  consultorAsignadoId: string
  observaciones: string
  trabajadores: string
}

const emptyForm: FormData = {
  nombre: '', nombreComercial: '', rfc: '', sector: '', tamano: '',
  ciudad: '', estado: '', direccion: '', contactoPrincipal: '', cargoContacto: '',
  emailContacto: '', telefonoContacto: '', procesosprincipales: '', alcanceInicial: '',
  normaInteres: 'ISO 9001:2026', consultorAsignadoId: '', observaciones: '', trabajadores: '',
}

function EmpresaForm({
  initial = emptyForm,
  onSubmit,
  onCancel,
  submitLabel = 'Registrar empresa',
}: {
  initial?: FormData
  onSubmit: (data: FormData) => void
  onCancel: () => void
  submitLabel?: string
}) {
  const [form, setForm] = useState<FormData>(initial)
  const [errors, setErrors] = useState<Partial<FormData>>({})
  const consultores = USUARIOS.filter((u) => u.rol === 'Consultor' || u.rol === 'Admin Consultoría')

  function set(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: '' }))
  }

  function validate(): boolean {
    const e: Partial<FormData> = {}
    if (!form.nombre.trim()) e.nombre = 'Requerido'
    if (!form.rfc.trim()) e.rfc = 'Requerido'
    if (!form.sector) e.sector = 'Requerido'
    if (!form.tamano) e.tamano = 'Requerido'
    if (!form.ciudad.trim()) e.ciudad = 'Requerido'
    if (!form.estado) e.estado = 'Requerido'
    if (!form.contactoPrincipal.trim()) e.contactoPrincipal = 'Requerido'
    if (!form.emailContacto.trim()) e.emailContacto = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) onSubmit(form)
  }

  const field = (label: string, key: keyof FormData, type = 'text', required = false, placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-fg/70 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/50 transition ${errors[key] ? 'border-red-300' : 'border-line'}`}
      />
      {errors[key] && <p className="text-xs text-red-500 mt-0.5">{errors[key]}</p>}
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto max-h-[70vh] pr-1">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-fg/40 mb-3">Datos de la empresa</p>
        <div className="grid grid-cols-2 gap-3">
          {field('Nombre o razón social', 'nombre', 'text', true, 'Manufactura Ejemplo S.A. de C.V.')}
          {field('Nombre comercial', 'nombreComercial', 'text', false, 'Nombre corto')}
          {field('RFC', 'rfc', 'text', true, 'MNX880712AB3')}
          <div>
            <label className="block text-xs font-medium text-fg/70 mb-1">Número de trabajadores</label>
            <input type="number" value={form.trabajadores} onChange={(e) => set('trabajadores', e.target.value)} className="w-full px-3 py-2 border border-line rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 transition" placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg/70 mb-1">Sector<span className="text-red-500 ml-0.5">*</span></label>
            <select value={form.sector} onChange={(e) => set('sector', e.target.value)} className={`w-full px-3 py-2 border rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 transition ${errors.sector ? 'border-red-300' : 'border-line'}`}>
              <option value="">Seleccionar...</option>
              {SECTORES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.sector && <p className="text-xs text-red-500 mt-0.5">{errors.sector}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-fg/70 mb-1">Tamaño<span className="text-red-500 ml-0.5">*</span></label>
            <select value={form.tamano} onChange={(e) => set('tamano', e.target.value)} className={`w-full px-3 py-2 border rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 transition ${errors.tamano ? 'border-red-300' : 'border-line'}`}>
              <option value="">Seleccionar...</option>
              {TAMANOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.tamano && <p className="text-xs text-red-500 mt-0.5">{errors.tamano}</p>}
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-fg/40 mb-3">Ubicación</p>
        <div className="grid grid-cols-2 gap-3">
          {field('Ciudad', 'ciudad', 'text', true)}
          <div>
            <label className="block text-xs font-medium text-fg/70 mb-1">Estado<span className="text-red-500 ml-0.5">*</span></label>
            <select value={form.estado} onChange={(e) => set('estado', e.target.value)} className={`w-full px-3 py-2 border rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 transition ${errors.estado ? 'border-red-300' : 'border-line'}`}>
              <option value="">Seleccionar...</option>
              {ESTADOS_MX.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.estado && <p className="text-xs text-red-500 mt-0.5">{errors.estado}</p>}
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-fg/70 mb-1">Dirección</label>
            <input type="text" value={form.direccion} onChange={(e) => set('direccion', e.target.value)} className="w-full px-3 py-2 border border-line rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 transition" placeholder="Calle, número, colonia, CP" />
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-fg/40 mb-3">Contacto principal</p>
        <div className="grid grid-cols-2 gap-3">
          {field('Nombre del contacto', 'contactoPrincipal', 'text', true)}
          {field('Cargo', 'cargoContacto')}
          {field('Correo electrónico', 'emailContacto', 'email', true)}
          {field('Teléfono', 'telefonoContacto', 'tel', false, '55 1234 5678')}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-fg/40 mb-3">Alcance del SGC</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-fg/70 mb-1">Norma de interés</label>
            <select value={form.normaInteres} onChange={(e) => set('normaInteres', e.target.value as FormData['normaInteres'])} className="w-full px-3 py-2 border border-line rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 transition">
              {NORMAS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg/70 mb-1">Procesos principales</label>
            <textarea value={form.procesosprincipales} onChange={(e) => set('procesosprincipales', e.target.value)} rows={2} className="w-full px-3 py-2 border border-line rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 transition resize-none" placeholder="Manufactura, control de calidad, compras..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg/70 mb-1">Alcance inicial propuesto</label>
            <textarea value={form.alcanceInicial} onChange={(e) => set('alcanceInicial', e.target.value)} rows={2} className="w-full px-3 py-2 border border-line rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 transition resize-none" placeholder="Describe las áreas o procesos que aplican..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg/70 mb-1">Consultor asignado</label>
            <select value={form.consultorAsignadoId} onChange={(e) => set('consultorAsignadoId', e.target.value)} className="w-full px-3 py-2 border border-line rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 transition">
              <option value="">Sin asignar</option>
              {consultores.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg/70 mb-1">Observaciones generales</label>
            <textarea value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} rows={2} className="w-full px-3 py-2 border border-line rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 transition resize-none" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-line sticky bottom-0 bg-white pb-1">
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" type="submit">{submitLabel}</Button>
      </div>
    </form>
  )
}

// ─── Archive Confirm ───────────────────────────────────────────────────────────

function ArchiveConfirm({ empresa, onConfirm, onCancel }: { empresa: Empresa; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-start p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">¿Archivar empresa?</p>
          <p className="text-sm text-amber-700 mt-1">
            <strong>{empresa.nombre}</strong> se marcará como inactiva. Sus proyectos y datos históricos se conservarán.
            Puedes reactivarla en cualquier momento.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button variant="danger" onClick={onConfirm} icon={<Archive className="w-4 h-4" />}>Archivar empresa</Button>
      </div>
    </div>
  )
}

// ─── Empresa Detail ────────────────────────────────────────────────────────────

export function EmpresaDetalle() {
  const { state, navigate, dispatch, showToast, getProcesos, getDocumentos } = useApp()
  const { navParams, empresas } = state
  const empresa = empresas.find((e) => e.id === navParams.id)

  const [showArchive, setShowArchive] = useState(false)

  if (!empresa) {
    return (
      <div className="p-8 text-center">
        <Building2 className="w-10 h-10 text-fg/20 mx-auto mb-2" />
        <p className="text-fg/50">Empresa no encontrada.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('empresas')}>Volver a Empresas</Button>
      </div>
    )
  }

  const proyectosEmpresa = state.proyectos.filter((p) => p.empresaId === empresa.id)
  const procesos = proyectosEmpresa.flatMap((p) => getProcesos(p.id))
  const documentos = proyectosEmpresa.flatMap((p) => getDocumentos(p.id))
  const evidenciasEmpresa = state.evidencias.filter((ev) => proyectosEmpresa.some((p) => p.id === ev.proyectoId))
  const usuariosEmpresa = USUARIOS.filter((u) => u.empresaId === empresa.id)
  const historialEmpresa = HISTORIAL.filter((h) => h.entidadId === empresa.id || proyectosEmpresa.some((p) => p.id === h.entidadId))
  const consultor = USUARIOS.find((u) => u.id === empresa.consultorAsignadoId)

  function handleArchive() {
    dispatch({ type: 'UPDATE_EMPRESA', id: empresa!.id, updates: { activa: false } })
    showToast(`"${empresa!.nombre}" fue archivada.`, 'success')
    navigate('empresas')
  }

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'proyectos', label: `Proyectos (${proyectosEmpresa.length})`, icon: <Briefcase className="w-4 h-4" /> },
    { id: 'procesos', label: `Procesos (${procesos.length})`, icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'documentos', label: `Documentos (${documentos.length})`, icon: <FileText className="w-4 h-4" /> },
    { id: 'evidencias', label: `Evidencias (${evidenciasEmpresa.length})`, icon: <Eye className="w-4 h-4" /> },
    { id: 'usuarios', label: `Usuarios (${usuariosEmpresa.length})`, icon: <Users className="w-4 h-4" /> },
    { id: 'historial', label: 'Historial', icon: <Clock className="w-4 h-4" /> },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-fg/40 mb-4">
        <button onClick={() => navigate('empresas')} className="hover:text-fg transition">Empresas</button>
        <ChevronRight className="w-4 h-4" />
        <span className="text-fg/70 font-medium truncate">{empresa.nombre}</span>
      </div>

      {/* Header */}
      <div className="bg-white border border-line rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold ${logoColor(empresa.id)}`}>
              {empresa.logoInicial}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-fg">{empresa.nombre}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${empresa.activa ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                  {empresa.activa ? 'Activa' : 'Archivada'}
                </span>
              </div>
              {empresa.nombreComercial && <p className="text-sm text-fg/50">{empresa.nombreComercial}</p>}
              <div className="flex items-center gap-3 mt-1 text-xs text-fg/50">
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{empresa.ciudad}, {empresa.estado}</span>
                <span>·</span>
                <span>{empresa.sector}</span>
                {empresa.normaInteres && <><span>·</span><span className="font-medium text-navy">{empresa.normaInteres}</span></>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {empresa.activa && (
              <Button variant="ghost" size="sm" icon={<Archive className="w-4 h-4" />} onClick={() => setShowArchive(true)}>
                Archivar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Archive confirm modal */}
      <Modal open={showArchive} title="Archivar empresa" size="sm" onClose={() => setShowArchive(false)}>
        <ArchiveConfirm empresa={empresa} onConfirm={handleArchive} onCancel={() => setShowArchive(false)} />
      </Modal>

      {/* Tabs */}
      <Tabs tabs={tabs}>
        {(activeTab) => (
          <>
            {activeTab === 'resumen' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-white border border-line rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-fg mb-3 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-navy" />Datos generales</h3>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between"><dt className="text-fg/50">RFC</dt><dd className="font-medium">{empresa.rfc}</dd></div>
                      <div className="flex justify-between"><dt className="text-fg/50">Sector</dt><dd>{empresa.sector}</dd></div>
                      <div className="flex justify-between"><dt className="text-fg/50">Tamaño</dt><dd>{empresa.tamano}</dd></div>
                      {empresa.trabajadores && <div className="flex justify-between"><dt className="text-fg/50">Trabajadores</dt><dd>{empresa.trabajadores}</dd></div>}
                      <div className="flex justify-between"><dt className="text-fg/50">Alta en sistema</dt><dd>{empresa.fechaAlta}</dd></div>
                    </dl>
                  </div>
                  <div className="bg-white border border-line rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-fg mb-3 flex items-center gap-1.5"><User className="w-4 h-4 text-navy" />Contacto principal</h3>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between"><dt className="text-fg/50">Nombre</dt><dd className="font-medium">{empresa.contactoPrincipal}</dd></div>
                      <div className="flex justify-between"><dt className="text-fg/50">Cargo</dt><dd>{empresa.cargoContacto}</dd></div>
                      <div className="flex items-center justify-between"><dt className="text-fg/50">Correo</dt><dd className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-navy" />{empresa.emailContacto}</dd></div>
                      <div className="flex items-center justify-between"><dt className="text-fg/50">Teléfono</dt><dd className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-navy" />{empresa.telefonoContacto}</dd></div>
                    </dl>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-white border border-line rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-fg mb-3 flex items-center gap-1.5"><FolderOpen className="w-4 h-4 text-navy" />Alcance del SGC</h3>
                    <dl className="space-y-3 text-sm">
                      <div><dt className="text-fg/50 mb-0.5">Norma</dt><dd className="font-medium text-navy">{empresa.normaInteres || '—'}</dd></div>
                      {empresa.procesosprincipales && <div><dt className="text-fg/50 mb-0.5">Procesos principales</dt><dd className="text-fg/80 leading-relaxed">{empresa.procesosprincipales}</dd></div>}
                      {empresa.alcanceInicial && <div><dt className="text-fg/50 mb-0.5">Alcance inicial</dt><dd className="text-fg/80 leading-relaxed">{empresa.alcanceInicial}</dd></div>}
                    </dl>
                  </div>
                  <div className="bg-white border border-line rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-fg mb-3 flex items-center gap-1.5"><Users className="w-4 h-4 text-navy" />Consultor asignado</h3>
                    {consultor ? (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center text-sm font-bold text-navy">{consultor.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div>
                        <div><p className="text-sm font-medium text-fg">{consultor.nombre}</p><p className="text-xs text-fg/50">{consultor.cargo}</p></div>
                      </div>
                    ) : (
                      <p className="text-sm text-fg/40">Sin consultor asignado</p>
                    )}
                  </div>
                  {empresa.observaciones && (
                    <div className="bg-white border border-line rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-fg mb-2">Observaciones</h3>
                      <p className="text-sm text-fg/70 leading-relaxed">{empresa.observaciones}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'proyectos' && (
              <div className="space-y-3">
                {proyectosEmpresa.length === 0 ? (
                  <div className="text-center py-12">
                    <Briefcase className="w-10 h-10 text-fg/20 mx-auto mb-2" />
                    <p className="text-fg/40 text-sm">Sin proyectos registrados</p>
                    <Button variant="secondary" className="mt-3" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => navigate('proyectos')}>Ir a Proyectos</Button>
                  </div>
                ) : proyectosEmpresa.map((p) => <ProyectoCard key={p.id} proyecto={p} />)}
              </div>
            )}

            {activeTab === 'procesos' && (
              <div className="space-y-2">
                {procesos.length === 0 ? (
                  <div className="text-center py-12"><FolderOpen className="w-10 h-10 text-fg/20 mx-auto mb-2" /><p className="text-fg/40 text-sm">Sin procesos registrados</p></div>
                ) : procesos.map((proc) => (
                  <div key={proc.id} className="bg-white border border-line rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-fg">{proc.nombre}</p>
                      <p className="text-xs text-fg/50 mt-0.5">{proc.descripcion}</p>
                    </div>
                    <StatusBadge status={proc.estado} size="sm" />
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'documentos' && (
              <div className="space-y-2">
                {documentos.length === 0 ? (
                  <div className="text-center py-12"><FileText className="w-10 h-10 text-fg/20 mx-auto mb-2" /><p className="text-fg/40 text-sm">Sin documentos</p></div>
                ) : documentos.map((doc) => (
                  <div key={doc.id} className="bg-white border border-line rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-fg">{doc.nombre}</p>
                      <p className="text-xs text-fg/50 mt-0.5">{doc.tipo} · v{doc.version} · {doc.fechaModificacion}</p>
                    </div>
                    <StatusBadge status={doc.estado} size="sm" />
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'evidencias' && (
              <div className="space-y-2">
                {evidenciasEmpresa.length === 0 ? (
                  <div className="text-center py-12"><Eye className="w-10 h-10 text-fg/20 mx-auto mb-2" /><p className="text-fg/40 text-sm">Sin evidencias cargadas</p></div>
                ) : evidenciasEmpresa.map((ev) => (
                  <div key={ev.id} className="bg-white border border-line rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-fg">{ev.nombre}</p>
                      <p className="text-xs text-fg/50 mt-0.5">{ev.tipo} {ev.fechaCarga ? `· ${ev.fechaCarga}` : ''}</p>
                    </div>
                    <StatusBadge status={ev.estado} size="sm" />
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'usuarios' && (
              <div className="space-y-2">
                {usuariosEmpresa.length === 0 ? (
                  <div className="text-center py-12"><Users className="w-10 h-10 text-fg/20 mx-auto mb-2" /><p className="text-fg/40 text-sm">Sin usuarios del cliente</p></div>
                ) : usuariosEmpresa.map((u) => (
                  <div key={u.id} className="bg-white border border-line rounded-xl p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center text-sm font-bold text-navy">{u.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-fg">{u.nombre}</p>
                      <p className="text-xs text-fg/50">{u.email} · {u.cargo}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${u.activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'historial' && (
              <div className="space-y-2">
                {historialEmpresa.length === 0 ? (
                  <div className="text-center py-12"><Clock className="w-10 h-10 text-fg/20 mx-auto mb-2" /><p className="text-fg/40 text-sm">Sin entradas en el historial</p></div>
                ) : historialEmpresa.map((h) => (
                  <div key={h.id} className="bg-white border border-line rounded-xl p-4 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-navy/10 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle className="w-3.5 h-3.5 text-navy" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-fg">{h.accion}</p>
                        <span className="text-xs text-fg/40">{h.fecha}</span>
                      </div>
                      <p className="text-xs text-fg/60 mt-0.5">{h.descripcion}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Tabs>
    </div>
  )
}

// ─── Small ProyectoCard used in Empresas detail ────────────────────────────────

function ProyectoCard({ proyecto }: { proyecto: Proyecto }) {
  const { navigate, calcularAvance } = useApp()
  const avance = calcularAvance(proyecto.id)
  return (
    <div className="bg-white border border-line rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-fg truncate">{proyecto.nombre}</p>
        <p className="text-xs text-fg/50 mt-0.5">{proyecto.fechaInicio} → {proyecto.fechaFinEstimada}</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 bg-line rounded-full h-1.5 max-w-[160px]">
            <div className="bg-navy h-1.5 rounded-full transition-all" style={{ width: `${avance}%` }} />
          </div>
          <span className="text-xs font-medium text-fg/60">{avance}%</span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <StatusBadge status={proyecto.estado} size="sm" />
        <Button variant="ghost" size="sm" icon={<Eye className="w-4 h-4" />} onClick={() => navigate('proyecto-detalle', { id: proyecto.id })}>Ver</Button>
      </div>
    </div>
  )
}

// ─── Main Empresas list ────────────────────────────────────────────────────────

export function Empresas() {
  const { state, navigate, dispatch, showToast } = useApp()
  const { empresas } = state

  const [search, setSearch] = useState('')
  const [filterSector, setFilterSector] = useState('')
  const [filterActiva, setFilterActiva] = useState('')
  const [showModal, setShowModal] = useState(false)

  const filtered = empresas.filter((e) => {
    const q = search.toLowerCase()
    if (q && !e.nombre.toLowerCase().includes(q) && !e.nombreComercial?.toLowerCase().includes(q)) return false
    if (filterSector && e.sector !== filterSector) return false
    if (filterActiva === 'activa' && !e.activa) return false
    if (filterActiva === 'archivada' && e.activa) return false
    return true
  })

  function handleCreate(form: FormData) {
    const initials = form.nombre.split(' ').filter((w) => w.length > 2).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || form.nombre.slice(0, 2).toUpperCase()
    const nueva: Empresa = {
      id: `emp-${Date.now()}`,
      nombre: form.nombre,
      nombreComercial: form.nombreComercial,
      rfc: form.rfc,
      sector: form.sector,
      tamano: form.tamano,
      ciudad: form.ciudad,
      estado: form.estado,
      direccion: form.direccion,
      contactoPrincipal: form.contactoPrincipal,
      cargoContacto: form.cargoContacto,
      emailContacto: form.emailContacto,
      telefonoContacto: form.telefonoContacto,
      procesosprincipales: form.procesosprincipales,
      alcanceInicial: form.alcanceInicial,
      normaInteres: form.normaInteres,
      consultorAsignadoId: form.consultorAsignadoId || undefined,
      observaciones: form.observaciones,
      trabajadores: form.trabajadores,
      activa: true,
      fechaAlta: new Date().toLocaleDateString('es-MX'),
      proyectosIds: [],
      logoInicial: initials,
    }
    dispatch({ type: 'ADD_EMPRESA', empresa: nueva })
    showToast(`"${nueva.nombre}" registrada exitosamente.`, 'success')
    setShowModal(false)
    navigate('empresa-detalle', { id: nueva.id })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-fg">Empresas cliente</h1>
          <p className="text-sm text-fg/50 mt-0.5">{empresas.filter((e) => e.activa).length} empresa{empresas.filter((e) => e.activa).length !== 1 ? 's' : ''} activa{empresas.filter((e) => e.activa).length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowModal(true)}>
          Nueva empresa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/30 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-line rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 w-64"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-fg/30 hover:text-fg/60"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <select value={filterSector} onChange={(e) => setFilterSector(e.target.value)} className="px-3 py-2 border border-line rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-navy/20">
          <option value="">Todos los sectores</option>
          {SECTORES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterActiva} onChange={(e) => setFilterActiva(e.target.value)} className="px-3 py-2 border border-line rounded-lg text-sm text-fg bg-white focus:outline-none focus:ring-2 focus:ring-navy/20">
          <option value="">Activas e inactivas</option>
          <option value="activa">Solo activas</option>
          <option value="archivada">Solo archivadas</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-10 h-10 text-fg/20 mx-auto mb-3" />
          <p className="text-fg/40 font-medium">Sin datos suficientes</p>
          <p className="text-sm text-fg/30 mt-1">No se encontraron empresas con los filtros actuales.</p>
          <Button variant="secondary" className="mt-4" onClick={() => { setSearch(''); setFilterSector(''); setFilterActiva('') }}>Limpiar filtros</Button>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left text-xs font-semibold text-fg/40 uppercase tracking-wide px-4 py-3">Empresa</th>
                <th className="text-left text-xs font-semibold text-fg/40 uppercase tracking-wide px-4 py-3">Sector</th>
                <th className="text-left text-xs font-semibold text-fg/40 uppercase tracking-wide px-4 py-3">Ubicación</th>
                <th className="text-left text-xs font-semibold text-fg/40 uppercase tracking-wide px-4 py-3">Proyectos</th>
                <th className="text-left text-xs font-semibold text-fg/40 uppercase tracking-wide px-4 py-3">Norma</th>
                <th className="text-left text-xs font-semibold text-fg/40 uppercase tracking-wide px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((empresa) => (
                <tr
                  key={empresa.id}
                  className="hover:bg-canvas cursor-pointer transition"
                  onClick={() => navigate('empresa-detalle', { id: empresa.id })}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${logoColor(empresa.id)}`}>
                        {empresa.logoInicial}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-fg">{empresa.nombre}</p>
                        {empresa.nombreComercial && <p className="text-xs text-fg/40">{empresa.nombreComercial}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-fg/70">{empresa.sector}</td>
                  <td className="px-4 py-3 text-sm text-fg/70">{empresa.ciudad}, {empresa.estado}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-fg">{empresa.proyectosIds.length}</span>
                  </td>
                  <td className="px-4 py-3">
                    {empresa.normaInteres ? (
                      <span className="text-xs font-medium text-navy bg-navy/5 px-2 py-0.5 rounded-md">{empresa.normaInteres}</span>
                    ) : <span className="text-fg/30 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={empresa.activa ? 'Activa' : 'Obsoleto'} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate('empresa-detalle', { id: empresa.id }) }}
                      className="text-fg/30 hover:text-navy transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Registration modal */}
      <Modal open={showModal} title="Registrar empresa cliente" size="lg" onClose={() => setShowModal(false)}>
        <EmpresaForm onSubmit={handleCreate} onCancel={() => setShowModal(false)} />
      </Modal>
    </div>
  )
}
