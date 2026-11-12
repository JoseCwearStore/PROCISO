import { useState } from 'react'
import { Building2, CircleDollarSign, Plus, ShieldCheck, Users } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Modal } from '../components/ui/Modal'
import { useAccionesAdministracion } from '../hooks/useAccionesAdministracion'
import type { Consultoria } from '../types'

const inputClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const PLANES = [
  { nombre: 'Básico', usuarios: 3, almacenamiento: 1 },
  { nombre: 'Professional', usuarios: 10, almacenamiento: 5 },
  { nombre: 'Enterprise', usuarios: 50, almacenamiento: 25 },
]

export default function PanelAdminProciso() {
  const { state, showToast } = useApp()
  const acciones = useAccionesAdministracion()
  const [modalOpen, setModalOpen] = useState(false)
  const [cambiarEstado, setCambiarEstado] = useState<Consultoria | null>(null)
  const [form, setForm] = useState({ nombre: '', rfc: '', contacto: '', email: '', plan: 'Básico' })
  const consultores = state.usuarios.filter((item) => item.rol === 'Consultor' || item.rol === 'Admin Consultoría')

  async function crear() {
    if (!form.nombre.trim() || !form.rfc.trim() || !form.contacto.trim() || !form.email.trim()) return
    const plan = PLANES.find((item) => item.nombre === form.plan)!
    const creada = await acciones.crearConsultoria({ ...form, limiteUsuarios: plan.usuarios, almacenamientoGb: plan.almacenamiento })
    if (!creada) return
    setModalOpen(false)
    setForm({ nombre: '', rfc: '', contacto: '', email: '', plan: 'Básico' })
    showToast('Consultoría creada.', 'success')
  }

  async function alternarEstado(item: Consultoria) {
    if (await acciones.cambiarEstadoConsultoria(item, !item.activa)) {
      showToast(item.activa ? 'Consultoría suspendida: su equipo y sus clientes perdieron el acceso.' : 'Consultoría reactivada.', 'success')
    }
    setCambiarEstado(null)
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Administración de plataforma</p><h2 className="mt-1 text-2xl font-bold text-navy">Panel Admin PROCISO</h2><p className="mt-1 text-sm text-slate-500">Gestión de cuentas de consultoría y de sus planes.</p></div>
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Acceso de soporte auditado</p><p className="mt-1 text-xs">Este rol puede consultar la información de todas las consultorías para dar soporte. Sus acciones administrativas (alta y suspensión de consultorías y usuarios) quedan registradas en el historial.</p></div></div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi icon={<Building2 className="h-5 w-5" />} label="Consultorías activas" value={state.consultorias.filter((item) => item.activa).length} />
        <Kpi icon={<Users className="h-5 w-5" />} label="Usuarios registrados" value={state.usuarios.length} />
        <Kpi icon={<Users className="h-5 w-5" />} label="Consultores" value={consultores.length} />
      </div>
      <div>
        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-white"><div className="flex items-center justify-between border-b border-line p-4"><div><h3 className="font-semibold text-slate-800">Consultorías</h3><p className="text-xs text-slate-400">Administración de cuentas, no de contenido privado.</p></div><Button size="sm" onClick={() => setModalOpen(true)} icon={<Plus className="h-4 w-4" />}>Crear consultoría</Button></div>{state.consultorias.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-4 border-b border-line p-4 last:border-0"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 font-bold text-violet-600">{item.nombre.slice(0, 2).toUpperCase()}</div><div className="min-w-52 flex-1"><p className="text-sm font-semibold text-slate-800">{item.nombre}</p><p className="text-xs text-slate-400">{item.rfc} · {item.contacto || 'Sin contacto'}</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-600">{item.plan}</span><span className={`rounded-full px-2 py-1 text-xs font-medium ${item.activa ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{item.activa ? 'Activa' : 'Suspendida'}</span><Button variant="outline" size="sm" onClick={() => item.activa ? setCambiarEstado(item) : alternarEstado(item)}>{item.activa ? 'Suspender' : 'Activar'}</Button></div>)}</section>
          <section><h3 className="mb-3 font-semibold text-slate-800">Planes de servicio</h3><div className="grid gap-3 sm:grid-cols-3">{PLANES.map((plan) => <div key={plan.nombre} className="rounded-xl border border-line bg-white p-4"><CircleDollarSign className="h-5 w-5 text-blue-600" /><p className="mt-3 font-semibold text-slate-800">{plan.nombre}</p><p className="mt-2 text-xs text-slate-500">{plan.usuarios} usuarios</p><p className="text-xs text-slate-500">{plan.almacenamiento} GB</p></div>)}</div></section>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Crear consultoría" footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button><Button onClick={crear} disabled={!form.nombre.trim() || !form.rfc.trim() || !form.contacto.trim() || !form.email.trim()}>Crear consultoría</Button></>}>
        <div className="space-y-4"><Campo label="Nombre o razón social *" value={form.nombre} set={(value) => setForm({ ...form, nombre: value })} /><Campo label="RFC *" value={form.rfc} set={(value) => setForm({ ...form, rfc: value })} /><Campo label="Contacto administrador *" value={form.contacto} set={(value) => setForm({ ...form, contacto: value })} /><Campo label="Correo *" value={form.email} set={(value) => setForm({ ...form, email: value })} type="email" /><label className="block"><span className="mb-1.5 block text-sm font-medium">Plan</span><select className={inputClass} value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })}>{PLANES.map((item) => <option key={item.nombre}>{item.nombre}</option>)}</select></label></div>
      </Modal>
      <ConfirmDialog open={!!cambiarEstado} onClose={() => setCambiarEstado(null)} onConfirm={() => cambiarEstado && alternarEstado(cambiarEstado)} title="Suspender consultoría" message={`Se bloqueará el acceso de ${cambiarEstado?.nombre || 'esta consultoría'} sin eliminar sus datos. No se inspeccionará contenido privado.`} confirmLabel="Suspender" />
    </div>
  )
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-xl border border-line bg-white p-4"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">{icon}</div><p className="mt-4 text-2xl font-bold text-slate-800">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
}
function Campo({ label, value, set, type = 'text' }: { label: string; value: string; set: (value: string) => void; type?: string }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium">{label}</span><input type={type} className={inputClass} value={value} onChange={(event) => set(event.target.value)} /></label>
}
