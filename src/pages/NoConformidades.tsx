import { useState } from 'react'
import { AlertOctagon, CheckCircle2, Plus, Save, ShieldCheck } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useAccionesNC } from '../hooks/useAccionesNC'
import type { DatosNC, TratamientoNC } from '../lib/escrituras'
import type { AccionNC } from '../lib/noConformidades'
import { fechaISO, hoyLocal } from '../lib/tareas'
import type { NoConformidad, TipoNC } from '../types'

const inputClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500'
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700'

// Lo que se edita en el formulario: el registro (equipo) + el tratamiento (equipo y cliente).
interface Borrador extends DatosNC, TratamientoNC {
  empresaId: string
}

const CAMPOS_REGISTRO: (keyof DatosNC)[] = [
  'proyectoId', 'titulo', 'descripcion', 'tipo', 'detectadaEn', 'fechaDeteccion', 'procesoId',
  'evidenciaIds', 'responsableId', 'responsableAccionId', 'fechaLimite', 'observaciones',
]

const borradorVacio = (): Borrador => ({
  empresaId: '', proyectoId: '', titulo: '', descripcion: '', tipo: 'Menor', detectadaEn: '',
  fechaDeteccion: hoyLocal(), procesoId: '', evidenciaIds: [], responsableId: '', responsableAccionId: '',
  fechaLimite: '', observaciones: '', correccion: '', causa: '', accion: '',
})

// Los inputs de fecha trabajan en ISO; la app muestra dd/mm/aaaa.
const aBorrador = (nc: NoConformidad, empresaId: string): Borrador => ({
  empresaId,
  proyectoId: nc.proyectoId,
  titulo: nc.titulo,
  descripcion: nc.descripcion,
  tipo: nc.tipo,
  detectadaEn: nc.detectadaEn,
  fechaDeteccion: nc.fechaDeteccion ? fechaISO(nc.fechaDeteccion) : '',
  procesoId: nc.procesoId ?? '',
  evidenciaIds: nc.evidenciaIds ?? [],
  responsableId: nc.responsableId,
  responsableAccionId: nc.responsableAccionId ?? '',
  fechaLimite: nc.fechaLimite ? fechaISO(nc.fechaLimite) : '',
  observaciones: nc.observaciones ?? '',
  correccion: nc.correccionInmediata ?? '',
  causa: nc.analisisCausa ?? '',
  accion: nc.accionCorrectiva ?? '',
})

export default function NoConformidades() {
  const { state, getEmpresa, getProyecto, getUsuario, showToast } = useApp()
  const acciones = useAccionesNC()
  const [editorOpen, setEditorOpen] = useState(false)
  const [actual, setActual] = useState<NoConformidad | null>(null) // null = NC nueva
  const [b, setB] = useState<Borrador>(borradorVacio())
  const [verificacion, setVerificacion] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Lo que la BD va a aceptar: el registro es del equipo; el tratamiento, de ambos hasta verificar.
  const puedeRegistro = acciones.esEquipo
  const puedeTratamiento = !actual || acciones.tratamientoEditable(actual)
  const accionesDisponibles = actual ? acciones.acciones(actual) : []

  const proyectos = state.proyectos.filter((item) => !b.empresaId || item.empresaId === b.empresaId)
  const procesos = state.procesos.filter((item) => item.proyectoId === b.proyectoId)
  const evidencias = state.evidencias.filter((item) => item.proyectoId === b.proyectoId)
  const responsables = acciones.responsables(b.proyectoId)
  // El responsable actual siempre aparece, aunque ya no sea asignable.
  const opcionesResponsable = (id: string) =>
    !id || responsables.some((u) => u.id === id) ? responsables : [...responsables, ...state.usuarios.filter((u) => u.id === id)]

  function abrir(item?: NoConformidad) {
    setActual(item ?? null)
    setB(item ? aBorrador(item, item.empresaId || getProyecto(item.proyectoId)?.empresaId || '') : borradorVacio())
    setVerificacion('')
    setError('')
    setEditorOpen(true)
  }

  function validar(): boolean {
    if (!b.empresaId || !b.proyectoId || !b.descripcion.trim() || !b.fechaDeteccion || !b.responsableId) {
      setError('Completa empresa, proyecto, descripción, fecha y responsable.')
      return false
    }
    return true
  }

  // Guarda solo lo que cambió y lo que este usuario puede escribir.
  async function persistir(): Promise<NoConformidad | null> {
    const { empresaId: _empresa, correccion, causa, accion, ...datos } = b
    const tratamiento = { correccion, causa, accion }
    if (!actual) return acciones.registrar(datos, tratamiento)
    const original = aBorrador(actual, b.empresaId)
    const cambioRegistro = CAMPOS_REGISTRO.some((campo) => JSON.stringify(original[campo]) !== JSON.stringify(b[campo]))
    return acciones.guardar(actual, puedeRegistro && cambioRegistro ? datos : null, tratamiento)
  }

  async function guardar() {
    if (guardando || !validar()) return
    setGuardando(true)
    const nc = await persistir()
    setGuardando(false)
    if (!nc) return
    showToast(actual ? `${nc.folio} actualizada.` : `No conformidad ${nc.folio} registrada.`, 'success')
    setEditorOpen(false)
  }

  async function ejecutar(accion: AccionNC) {
    if (!actual || guardando) return
    if (accion.requiereVerificacion && !verificacion.trim()) {
      setError('Describe qué se revisó para verificar la eficacia.')
      return
    }
    if (!validar()) return
    setGuardando(true)
    // Primero lo editado (pasar a corrección exige causa y acción guardadas), después el estado.
    const guardada = await persistir()
    const movida = guardada && (await acciones.cambiarEstado(guardada, accion.estado, accion.requiereVerificacion ? verificacion : undefined))
    setGuardando(false)
    if (!movida) return
    setActual(movida)
    setB(aBorrador(movida, b.empresaId))
    setVerificacion('')
    setError('')
    showToast(`${movida.folio}: ${accion.etiqueta}.`, 'success')
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-red-600">Flujo I</p><h2 className="mt-1 text-xl font-bold text-navy">No conformidades y acciones correctivas</h2><p className="mt-1 text-sm text-slate-500">Registro, tratamiento de causa y verificación de eficacia.</p></div>
        {acciones.esEquipo && <Button onClick={() => abrir()} icon={<Plus className="h-4 w-4" />}>Registrar no conformidad</Button>}
      </div>
      {!acciones.esEquipo && (
        <p className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
          Documenta la corrección, el análisis de causa y la acción correctiva de cada no conformidad. La consultoría verifica la eficacia y la cierra.
        </p>
      )}
      <div className="grid gap-4">
        {state.noConformidades.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center"><AlertOctagon className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-medium text-slate-700">Sin no conformidades registradas</p></div>
        )}
        {state.noConformidades.map((item) => {
          const proyecto = getProyecto(item.proyectoId)
          const empresa = getEmpresa(item.empresaId || proyecto?.empresaId || '')
          return <button key={item.id} onClick={() => abrir(item)} className="rounded-xl border border-line bg-white p-5 text-left shadow-sm hover:shadow-md"><div className="flex flex-wrap items-start gap-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600"><AlertOctagon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-red-600">{item.folio}</span><StatusBadge status={item.estado} size="sm" /><StatusBadge status={item.tipo} size="sm" /></div><p className="mt-2 font-semibold text-slate-800">{item.titulo}</p><p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.descripcion}</p><p className="mt-3 text-xs text-slate-400">{empresa?.nombreComercial || empresa?.nombre} · {proyecto?.nombre} · Responsable: {getUsuario(item.responsableId)?.nombre ?? '—'}</p></div><div className="rounded-lg bg-slate-50 px-4 py-3 text-center"><p className="text-xs text-slate-400">Eficacia</p><p className={`mt-1 text-sm font-semibold ${item.eficacia === 'Eficaz' ? 'text-emerald-600' : item.eficacia === 'No eficaz' ? 'text-red-600' : 'text-amber-600'}`}>{item.eficacia || 'Pendiente'}</p></div></div></button>
        })}
      </div>

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={`${actual?.folio ?? 'Nueva'} · No conformidad`}
        size="xl"
        footer={<><Button variant="outline" onClick={() => setEditorOpen(false)}>Volver</Button>{(puedeRegistro || puedeTratamiento) && <Button onClick={guardar} disabled={guardando} icon={<Save className="h-4 w-4" />}>{guardando ? 'Guardando…' : actual ? 'Guardar cambios' : 'Registrar'}</Button>}</>}
      >
        <div className="space-y-6">
          {actual && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-slate-50 p-3 text-sm">
              <span className="text-slate-500">Estado</span><StatusBadge status={actual.estado} size="sm" />
              <span className="ml-2 text-slate-500">Eficacia</span>
              <span className={`font-semibold ${actual.eficacia === 'Eficaz' ? 'text-emerald-600' : actual.eficacia === 'No eficaz' ? 'text-red-600' : 'text-amber-600'}`}>{actual.eficacia || 'Pendiente'}</span>
              {actual.fechaCierre && <span className="ml-auto text-xs text-slate-500">Cerrada el {actual.fechaCierre}</span>}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label><span className={labelClass}>Empresa *</span><select disabled={!puedeRegistro} className={inputClass} value={b.empresaId} onChange={(event) => setB({ ...b, empresaId: event.target.value, proyectoId: '', procesoId: '', evidenciaIds: [], responsableId: '', responsableAccionId: '' })}><option value="">Selecciona</option>{state.empresas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
            <label><span className={labelClass}>Proyecto *</span><select disabled={!puedeRegistro || !!actual} className={inputClass} value={b.proyectoId} onChange={(event) => setB({ ...b, proyectoId: event.target.value, procesoId: '', evidenciaIds: [], responsableId: '', responsableAccionId: '' })}><option value="">Selecciona</option>{proyectos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
            <label><span className={labelClass}>Proceso</span><select disabled={!puedeRegistro} className={inputClass} value={b.procesoId} onChange={(event) => setB({ ...b, procesoId: event.target.value })}><option value="">Sin vincular</option>{procesos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
            <label className="lg:col-span-2"><span className={labelClass}>Título</span><input disabled={!puedeRegistro} className={inputClass} value={b.titulo} onChange={(event) => setB({ ...b, titulo: event.target.value })} /></label>
            <label><span className={labelClass}>Tipo</span><select disabled={!puedeRegistro} className={inputClass} value={b.tipo} onChange={(event) => setB({ ...b, tipo: event.target.value as TipoNC })}>{['Mayor', 'Menor', 'Observación'].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="sm:col-span-2 lg:col-span-3"><span className={labelClass}>Descripción *</span><textarea disabled={!puedeRegistro} rows={3} className={inputClass} value={b.descripcion} onChange={(event) => setB({ ...b, descripcion: event.target.value })} /></label>
            <label><span className={labelClass}>Detectada en</span><input disabled={!puedeRegistro} className={inputClass} value={b.detectadaEn} onChange={(event) => setB({ ...b, detectadaEn: event.target.value })} placeholder="Ej.: levantamiento del proceso" /></label>
            <label><span className={labelClass}>Evidencia</span><select disabled={!puedeRegistro} className={inputClass} value={b.evidenciaIds[0] || ''} onChange={(event) => setB({ ...b, evidenciaIds: event.target.value ? [event.target.value] : [] })}><option value="">Sin vincular</option>{evidencias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
            <label><span className={labelClass}>Fecha de detección *</span><input disabled={!puedeRegistro} type="date" className={inputClass} value={b.fechaDeteccion} onChange={(event) => setB({ ...b, fechaDeteccion: event.target.value })} /></label>
            <label><span className={labelClass}>Responsable *</span><select disabled={!puedeRegistro || !b.proyectoId} className={inputClass} value={b.responsableId} onChange={(event) => setB({ ...b, responsableId: event.target.value })}><option value="">{b.proyectoId ? 'Selecciona' : 'Primero elige el proyecto'}</option>{opcionesResponsable(b.responsableId).map((item) => <option key={item.id} value={item.id}>{item.nombre} · {item.rol}</option>)}</select></label>
            <label><span className={labelClass}>Responsable de la acción</span><select disabled={!puedeRegistro || !b.proyectoId} className={inputClass} value={b.responsableAccionId} onChange={(event) => setB({ ...b, responsableAccionId: event.target.value })}><option value="">El mismo responsable</option>{opcionesResponsable(b.responsableAccionId).map((item) => <option key={item.id} value={item.id}>{item.nombre} · {item.rol}</option>)}</select></label>
            <label><span className={labelClass}>Fecha límite</span><input disabled={!puedeRegistro} type="date" className={inputClass} value={b.fechaLimite} onChange={(event) => setB({ ...b, fechaLimite: event.target.value })} /></label>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-blue-200 bg-blue-50 p-4"><div className="mb-3 flex items-center gap-2 text-blue-800"><CheckCircle2 className="h-5 w-5" /><h3 className="font-semibold">Corrección inmediata</h3></div><p className="mb-3 text-xs text-blue-700">Acción para contener o corregir el problema detectado ahora.</p><textarea disabled={!puedeTratamiento} rows={5} className={inputClass} value={b.correccion} onChange={(event) => setB({ ...b, correccion: event.target.value })} /></section>
            <section className="rounded-xl border border-violet-200 bg-violet-50 p-4"><div className="mb-3 flex items-center gap-2 text-violet-800"><ShieldCheck className="h-5 w-5" /><h3 className="font-semibold">Acción sobre la causa</h3></div><p className="mb-3 text-xs text-violet-700">Análisis y acción correctiva para evitar que el problema vuelva a ocurrir (una acción por línea).</p><label><span className={labelClass}>Análisis de causa</span><textarea disabled={!puedeTratamiento} rows={3} className={inputClass} value={b.causa} onChange={(event) => setB({ ...b, causa: event.target.value })} /></label><label className="mt-3 block"><span className={labelClass}>Acción correctiva</span><textarea disabled={!puedeTratamiento} rows={3} className={inputClass} value={b.accion} onChange={(event) => setB({ ...b, accion: event.target.value })} /></label></section>
          </div>

          {actual && (
            <section className="rounded-xl border border-line p-4">
              <h3 className="mb-3 font-semibold text-slate-800">Seguimiento</h3>
              {actual.verificacionEficacia && <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600"><span className="font-medium">Última verificación:</span> {actual.verificacionEficacia}</p>}
              {accionesDisponibles.some((item) => item.requiereVerificacion) && (
                <label className="mb-3 block"><span className={labelClass}>Verificación de eficacia *</span><textarea rows={3} className={inputClass} value={verificacion} onChange={(event) => setVerificacion(event.target.value)} placeholder="Describe la evidencia revisada y el resultado." /></label>
              )}
              {accionesDisponibles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {accionesDisponibles.map((item) => (
                    <Button key={item.etiqueta} variant={item.estado === 'En análisis' && item.requiereVerificacion ? 'outline' : 'primary'} disabled={guardando} onClick={() => ejecutar(item)}>{item.etiqueta}</Button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  {actual.estado === 'Cerrada' ? 'No conformidad cerrada.' : 'La consultoría verifica la eficacia y cierra la no conformidad.'}
                </p>
              )}
            </section>
          )}

          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {!!actual?.historial?.length && <div><p className="mb-3 text-sm font-semibold text-slate-700">Historial</p><div className="space-y-2">{actual.historial.map((item) => <div key={item.id} className="rounded-lg border border-line p-3 text-xs"><p className="font-medium text-slate-700">{item.accion}</p><p className="mt-1 text-slate-400">{item.fecha} · {getUsuario(item.autorId)?.nombre || '—'}</p><p className="mt-1 text-slate-500">{item.detalle}</p></div>)}</div></div>}
        </div>
      </Modal>
    </div>
  )
}
