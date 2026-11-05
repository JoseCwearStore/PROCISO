import { useState } from 'react'
import { Bell, BookOpen, Building2, Library, CreditCard, Lock, Save, ShieldCheck } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'

const inputClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700'

export default function Configuracion() {
  const { state, showToast } = useApp()
  const [tab, setTab] = useState('consultoria')
  const [config, setConfig] = useState({
    nombre: 'ConsultiCalidad S.C.',
    rfc: 'CCA210401HX7',
    email: '',
    telefono: '',
    zona: 'America/Mexico_City',
    tareas: true,
    documentos: true,
    vencimientos: true,
    resumen: false,
    sesion: '30',
    dobleFactor: false,
    catalogos: 'Procesos estratégicos\nProcesos operativos\nProcesos de apoyo',
    plantillas: 'Procedimiento\nInstrucción de trabajo\nFicha de proceso\nFormato',
  })
  const tabs = [
    ['consultoria', 'Consultoría', Building2],
    ['notificaciones', 'Notificaciones', Bell],
    ['regional', 'Zona horaria', BookOpen],
    ['plantillas', 'Plantillas y catálogos', Library],
    ['seguridad', 'Seguridad', Lock],
    ['plan', 'Plan de servicio', CreditCard],
  ] as const

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5"><h2 className="text-xl font-bold text-navy">Configuración</h2><p className="mt-1 text-sm text-slate-500">Preferencias administrativas del entorno demostrativo.</p></div>
      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="h-fit rounded-xl border border-line bg-white p-2">{tabs.map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm ${tab === id ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
        <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
          {tab === 'consultoria' && <Panel titulo="Datos de la consultoría" descripcion="Información general visible en el entorno de trabajo."><div className="grid gap-4 sm:grid-cols-2"><Campo label="Razón social" value={config.nombre} set={(value) => setConfig({ ...config, nombre: value })} /><Campo label="RFC" value={config.rfc} set={(value) => setConfig({ ...config, rfc: value })} /><Campo label="Correo de contacto" value={config.email} set={(value) => setConfig({ ...config, email: value })} /><Campo label="Teléfono" value={config.telefono} set={(value) => setConfig({ ...config, telefono: value })} /></div></Panel>}
          {tab === 'notificaciones' && <Panel titulo="Preferencias de notificación" descripcion="Selecciona los avisos que debe mostrar PROCISO."><div className="space-y-3">{[['tareas', 'Asignación y cambios en tareas'], ['documentos', 'Documentos enviados a revisión'], ['vencimientos', 'Vencimientos y retrasos'], ['resumen', 'Resumen semanal']].map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-lg border border-line p-3 text-sm"><span>{label}</span><input type="checkbox" checked={config[key as keyof typeof config] as boolean} onChange={(event) => setConfig({ ...config, [key]: event.target.checked })} /></label>)}</div></Panel>}
          {tab === 'regional' && <Panel titulo="Zona horaria" descripcion="Las fechas y recordatorios se mostrarán usando esta zona."><label><span className={labelClass}>Zona horaria</span><select className={inputClass} value={config.zona} onChange={(event) => setConfig({ ...config, zona: event.target.value })}><option value="America/Mexico_City">Ciudad de México</option><option value="America/Monterrey">Monterrey</option><option value="America/Tijuana">Tijuana</option><option value="America/Cancun">Cancún</option></select></label></Panel>}
          {tab === 'plantillas' && <Panel titulo="Plantillas y catálogos" descripcion="Catálogos internos para estandarizar la captura."><div className="grid gap-4 sm:grid-cols-2"><label><span className={labelClass}>Plantillas documentales</span><textarea rows={8} className={inputClass} value={config.plantillas} onChange={(event) => setConfig({ ...config, plantillas: event.target.value })} /></label><label><span className={labelClass}>Catálogo de clasificación</span><textarea rows={8} className={inputClass} value={config.catalogos} onChange={(event) => setConfig({ ...config, catalogos: event.target.value })} /></label></div></Panel>}
          {tab === 'seguridad' && <Panel titulo="Seguridad" descripcion="Políticas generales de acceso al prototipo."><div className="space-y-4"><label><span className={labelClass}>Tiempo de sesión inactiva</span><select className={inputClass} value={config.sesion} onChange={(event) => setConfig({ ...config, sesion: event.target.value })}><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">60 minutos</option></select></label><label className="flex items-center justify-between rounded-lg border border-line p-3 text-sm"><span><strong>Autenticación de dos factores</strong><span className="mt-1 block text-xs text-slate-400">Requiere integración con un proveedor de identidad.</span></span><input type="checkbox" checked={config.dobleFactor} onChange={(event) => setConfig({ ...config, dobleFactor: event.target.checked })} /></label><div className="flex gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><ShieldCheck className="h-5 w-5 shrink-0" />Las suspensiones y restablecimientos de acceso quedan registrados en auditoría.</div></div></Panel>}
          {tab === 'plan' && <Panel titulo="Plan de servicio" descripcion="Resumen demostrativo del uso contratado."><div className="grid gap-4 sm:grid-cols-2"><Dato label="Plan actual" value="Professional" /><Dato label="Usuarios" value={`${state.usuarios.filter((item) => item.activo).length} activos`} /><Dato label="Almacenamiento" value="Uso demostrativo · sin almacenamiento real" /><Dato label="Renovación" value="Información pendiente de confirmar" /></div><div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><p className="font-semibold">Sin cobros reales</p><p className="mt-1">La administración de pagos y renovaciones requiere integración de facturación.</p><span className="mt-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold">Requiere integración de facturación</span></div></Panel>}
          {tab !== 'plan' && <div className="mt-6 flex justify-end"><Button onClick={() => showToast('Configuración guardada durante esta sesión.', 'success')} icon={<Save className="h-4 w-4" />}>Guardar cambios</Button></div>}
        </section>
      </div>
    </div>
  )
}

function Panel({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: React.ReactNode }) {
  return <div><h3 className="text-lg font-semibold text-slate-800">{titulo}</h3><p className="mb-5 mt-1 text-sm text-slate-500">{descripcion}</p>{children}</div>
}
function Campo({ label, value, set }: { label: string; value: string; set: (value: string) => void }) {
  return <label><span className={labelClass}>{label}</span><input className={inputClass} value={value} onChange={(event) => set(event.target.value)} /></label>
}
function Dato({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-700">{value}</p></div>
}
