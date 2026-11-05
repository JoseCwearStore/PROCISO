import { useState } from 'react'
import { AlertOctagon, CheckCircle2, Plus, Save, ShieldCheck } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { EstadoNC, NoConformidad, TipoNC } from '../types'

const inputClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700'

const nuevaNC = (): NoConformidad => ({
  id: `NC-${Date.now().toString().slice(-6)}`,
  titulo: '',
  descripcion: '',
  proyectoId: '',
  empresaId: '',
  procesoId: '',
  evidenciaIds: [],
  estado: 'Abierta',
  tipo: 'Menor',
  detectadaEn: '',
  fechaDeteccion: '',
  responsableId: '',
  correccionInmediata: '',
  analisisCausa: '',
  accionCorrectiva: '',
  responsableAccionId: '',
  fechaLimite: '',
  acciones: [],
  eficacia: 'Pendiente',
  verificacionEficacia: '',
  historial: [],
})

export default function NoConformidades() {
  const { state, dispatch, getEmpresa, getProyecto, getUsuario, showToast } = useApp()
  const [editorOpen, setEditorOpen] = useState(false)
  const [nc, setNc] = useState<NoConformidad>(nuevaNC())
  const [error, setError] = useState('')
  const proyectos = state.proyectos.filter((item) => !nc.empresaId || item.empresaId === nc.empresaId)
  const procesos = state.procesos.filter((item) => !nc.proyectoId || item.proyectoId === nc.proyectoId)
  const evidencias = state.evidencias.filter((item) => !nc.proyectoId || item.proyectoId === nc.proyectoId)

  function abrir(item?: NoConformidad) {
    if (item) {
      const proyecto = getProyecto(item.proyectoId)
      setNc(structuredClone({
        ...item,
        empresaId: item.empresaId || proyecto?.empresaId,
        evidenciaIds: item.evidenciaIds || [],
        correccionInmediata: item.correccionInmediata || '',
        analisisCausa: item.analisisCausa || '',
        accionCorrectiva: item.accionCorrectiva || item.acciones.join('\n'),
        responsableAccionId: item.responsableAccionId || item.responsableId,
        fechaLimite: item.fechaLimite || '',
        eficacia: item.eficacia || 'Pendiente',
        verificacionEficacia: item.verificacionEficacia || '',
        historial: item.historial || [],
      }))
    } else setNc(nuevaNC())
    setError('')
    setEditorOpen(true)
  }

  function guardar() {
    if (!nc.empresaId || !nc.proyectoId || !nc.descripcion.trim() || !nc.fechaDeteccion || !nc.responsableId) {
      setError('Completa empresa, proyecto, descripción, fecha y responsable.')
      return
    }
    if (nc.eficacia === 'Eficaz' && !nc.verificacionEficacia?.trim()) {
      setError('No se puede marcar “Eficaz” sin registrar la verificación de eficacia.')
      return
    }
    const accion = state.noConformidades.some((item) => item.id === nc.id) ? 'No conformidad actualizada' : 'No conformidad registrada'
    const guardada: NoConformidad = {
      ...nc,
      acciones: nc.accionCorrectiva ? [nc.accionCorrectiva] : [],
      historial: [...(nc.historial || []), {
        id: `hist-nc-${Date.now()}`,
        fecha: new Date().toLocaleString('es-MX'),
        autorId: state.currentUser?.id || 'usr-001',
        accion,
        detalle: `Estado: ${nc.estado}. Eficacia: ${nc.eficacia || 'Pendiente'}.`,
      }],
    }
    dispatch({ type: 'UPSERT_NC', noConformidad: guardada })
    dispatch({
      type: 'APPEND_AUDIT',
      entrada: {
        id: `hist-${Date.now()}`,
        fecha: new Date().toLocaleString('es-MX'),
        autorId: state.currentUser?.id || 'usr-001',
        accion,
        descripcion: `${guardada.id}: ${guardada.titulo || guardada.descripcion}`,
        entidadId: guardada.id,
        entidadTipo: 'proyecto',
      },
    })
    showToast(`${accion}.`, 'success')
    setEditorOpen(false)
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-red-600">Flujo I</p><h2 className="mt-1 text-xl font-bold text-navy">No conformidades y acciones correctivas</h2><p className="mt-1 text-sm text-slate-500">Registro, tratamiento de causa y verificación de eficacia.</p></div>
        <Button onClick={() => abrir()} icon={<Plus className="h-4 w-4" />}>Registrar no conformidad</Button>
      </div>
      <div className="grid gap-4">
        {state.noConformidades.map((item) => {
          const proyecto = getProyecto(item.proyectoId)
          const empresa = getEmpresa(item.empresaId || proyecto?.empresaId || '')
          return <button key={item.id} onClick={() => abrir(item)} className="rounded-xl border border-line bg-white p-5 text-left shadow-sm hover:shadow-md"><div className="flex flex-wrap items-start gap-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600"><AlertOctagon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-red-600">{item.id}</span><StatusBadge status={item.estado} size="sm" /><StatusBadge status={item.tipo} size="sm" /></div><p className="mt-2 font-semibold text-slate-800">{item.titulo}</p><p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.descripcion}</p><p className="mt-3 text-xs text-slate-400">{empresa?.nombreComercial || empresa?.nombre} · {proyecto?.nombre}</p></div><div className="rounded-lg bg-slate-50 px-4 py-3 text-center"><p className="text-xs text-slate-400">Eficacia</p><p className={`mt-1 text-sm font-semibold ${item.eficacia === 'Eficaz' ? 'text-emerald-600' : item.eficacia === 'No eficaz' ? 'text-red-600' : 'text-amber-600'}`}>{item.eficacia || 'Pendiente'}</p></div></div></button>
        })}
      </div>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={`${nc.id} · No conformidad`} size="xl" footer={<><Button variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button><Button onClick={guardar} icon={<Save className="h-4 w-4" />}>Guardar registro</Button></>}>
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label><span className={labelClass}>Empresa *</span><select className={inputClass} value={nc.empresaId || ''} onChange={(event) => setNc({ ...nc, empresaId: event.target.value, proyectoId: '', procesoId: '' })}><option value="">Selecciona</option>{state.empresas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
            <label><span className={labelClass}>Proyecto *</span><select className={inputClass} value={nc.proyectoId} onChange={(event) => setNc({ ...nc, proyectoId: event.target.value, procesoId: '' })}><option value="">Selecciona</option>{proyectos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
            <label><span className={labelClass}>Proceso</span><select className={inputClass} value={nc.procesoId || ''} onChange={(event) => setNc({ ...nc, procesoId: event.target.value })}><option value="">Sin vincular</option>{procesos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
            <label className="lg:col-span-2"><span className={labelClass}>Título</span><input className={inputClass} value={nc.titulo} onChange={(event) => setNc({ ...nc, titulo: event.target.value })} /></label>
            <label><span className={labelClass}>Tipo</span><select className={inputClass} value={nc.tipo} onChange={(event) => setNc({ ...nc, tipo: event.target.value as TipoNC })}>{['Mayor', 'Menor', 'Observación'].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="sm:col-span-2 lg:col-span-3"><span className={labelClass}>Descripción *</span><textarea rows={3} className={inputClass} value={nc.descripcion} onChange={(event) => setNc({ ...nc, descripcion: event.target.value })} /></label>
            <label><span className={labelClass}>Evidencia</span><select className={inputClass} value={nc.evidenciaIds?.[0] || ''} onChange={(event) => setNc({ ...nc, evidenciaIds: event.target.value ? [event.target.value] : [] })}><option value="">Sin vincular</option>{evidencias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
            <label><span className={labelClass}>Fecha de detección *</span><input type="date" className={inputClass} value={nc.fechaDeteccion} onChange={(event) => setNc({ ...nc, fechaDeteccion: event.target.value })} /></label>
            <label><span className={labelClass}>Responsable *</span><select className={inputClass} value={nc.responsableId} onChange={(event) => setNc({ ...nc, responsableId: event.target.value })}><option value="">Selecciona</option>{state.usuarios.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-blue-200 bg-blue-50 p-4"><div className="mb-3 flex items-center gap-2 text-blue-800"><CheckCircle2 className="h-5 w-5" /><h3 className="font-semibold">Corrección inmediata</h3></div><p className="mb-3 text-xs text-blue-700">Acción para contener o corregir el problema detectado ahora.</p><textarea rows={5} className={inputClass} value={nc.correccionInmediata || ''} onChange={(event) => setNc({ ...nc, correccionInmediata: event.target.value })} /></section>
            <section className="rounded-xl border border-violet-200 bg-violet-50 p-4"><div className="mb-3 flex items-center gap-2 text-violet-800"><ShieldCheck className="h-5 w-5" /><h3 className="font-semibold">Acción sobre la causa</h3></div><p className="mb-3 text-xs text-violet-700">Análisis y acción correctiva para evitar que el problema vuelva a ocurrir.</p><label><span className={labelClass}>Análisis de causa</span><textarea rows={3} className={inputClass} value={nc.analisisCausa || ''} onChange={(event) => setNc({ ...nc, analisisCausa: event.target.value })} /></label><label className="mt-3 block"><span className={labelClass}>Acción correctiva</span><textarea rows={3} className={inputClass} value={nc.accionCorrectiva || ''} onChange={(event) => setNc({ ...nc, accionCorrectiva: event.target.value })} /></label></section>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label><span className={labelClass}>Responsable de la acción</span><select className={inputClass} value={nc.responsableAccionId || ''} onChange={(event) => setNc({ ...nc, responsableAccionId: event.target.value })}><option value="">Selecciona</option>{state.usuarios.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
            <label><span className={labelClass}>Fecha límite</span><input type="date" className={inputClass} value={nc.fechaLimite || ''} onChange={(event) => setNc({ ...nc, fechaLimite: event.target.value })} /></label>
            <label><span className={labelClass}>Estado</span><select className={inputClass} value={nc.estado} onChange={(event) => setNc({ ...nc, estado: event.target.value as EstadoNC })}>{['Abierta', 'En análisis', 'En corrección', 'Verificada', 'Cerrada'].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span className={labelClass}>Eficacia</span><select className={inputClass} value={nc.eficacia || 'Pendiente'} onChange={(event) => setNc({ ...nc, eficacia: event.target.value as NoConformidad['eficacia'] })}>{['Pendiente', 'Eficaz', 'No eficaz'].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="sm:col-span-2 lg:col-span-4"><span className={labelClass}>Verificación de eficacia</span><textarea rows={3} className={inputClass} value={nc.verificacionEficacia || ''} onChange={(event) => setNc({ ...nc, verificacionEficacia: event.target.value })} placeholder="Describe la evidencia y el resultado de la verificación." /></label>
          </div>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {!!nc.historial?.length && <div><p className="mb-3 text-sm font-semibold text-slate-700">Historial</p><div className="space-y-2">{nc.historial.map((item) => <div key={item.id} className="rounded-lg border border-line p-3 text-xs"><p className="font-medium text-slate-700">{item.accion}</p><p className="mt-1 text-slate-400">{item.fecha} · {getUsuario(item.autorId)?.nombre || item.autorId}</p><p className="mt-1 text-slate-500">{item.detalle}</p></div>)}</div></div>}
        </div>
      </Modal>
    </div>
  )
}
