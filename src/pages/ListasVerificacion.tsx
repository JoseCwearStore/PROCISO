import { useState } from 'react'
import { AlertTriangle, CheckSquare2, Plus, Save } from 'lucide-react'
import { randomUUID } from '../lib/uuid'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { useAccionesLista } from '../hooks/useAccionesLista'
import { fechaISO } from '../lib/tareas'
import type { EstadoVerificacion, ListaVerificacion, PreguntaVerificacion } from '../types'
import { conCantidad } from '../lib/plural'

const ESTADOS: EstadoVerificacion[] = [
  'Cumple según la evidencia revisada',
  'No cumple según la evidencia revisada',
  'Parcialmente atendido',
  'No aplica',
  'Pendiente de verificar',
]
const inputClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500'
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700'

const nuevaPregunta = (): PreguntaVerificacion => ({
  id: randomUUID(),
  pregunta: '',
  estado: 'Pendiente de verificar',
  referenciaRequisito: '',
})

const listaVacia = (): ListaVerificacion => ({
  id: randomUUID(),
  nombre: '',
  empresaId: '',
  proyectoId: '',
  procesoId: '',
  area: '',
  responsableId: '',
  fecha: '',
  edicionNorma: 'ISO 9001:2026',
  preguntas: [nuevaPregunta()],
})

export default function ListasVerificacion() {
  const { state, getEmpresa, getProyecto, showToast } = useApp()
  const [editorOpen, setEditorOpen] = useState(false)
  const [lista, setLista] = useState<ListaVerificacion>(listaVacia())
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const acciones = useAccionesLista()
  // El cliente ve la lista en lectura: la BD no le deja escribir.
  const puedeEditar = acciones.esEquipo
  const proyectos = state.proyectos.filter((item) => !lista.empresaId || item.empresaId === lista.empresaId)
  const procesos = state.procesos.filter((item) => !lista.proyectoId || item.proyectoId === lista.proyectoId)
  const evidencias = state.evidencias.filter((item) => !lista.proyectoId || item.proyectoId === lista.proyectoId)

  function abrir(item?: ListaVerificacion) {
    // El input de fecha trabaja en ISO; la app muestra dd/mm/aaaa.
    setLista(item ? { ...structuredClone(item), fecha: item.fecha ? fechaISO(item.fecha) : '' } : listaVacia())
    setError('')
    setEditorOpen(true)
  }

  function actualizarPregunta(id: string, updates: Partial<PreguntaVerificacion>) {
    setLista({ ...lista, preguntas: lista.preguntas.map((item) => item.id === id ? { ...item, ...updates } : item) })
  }

  async function guardar() {
    if (guardando) return
    if (!lista.nombre.trim() || !lista.empresaId || !lista.proyectoId || !lista.responsableId || !lista.fecha) {
      setError('Completa nombre, empresa, proyecto, responsable y fecha.')
      return
    }
    if (lista.preguntas.some((item) => !item.pregunta.trim())) {
      setError('Todas las preguntas deben tener texto.')
      return
    }
    if (lista.preguntas.some((item) => item.estado === 'No aplica' && !item.justificacionNoAplica?.trim())) {
      setError('Las respuestas “No aplica” requieren justificación.')
      return
    }
    // La BD guarda lista, preguntas y una tarea por hallazgo nuevo en UNA transacción:
    // si algo falla, no queda nada a medias y el editor sigue abierto.
    setGuardando(true)
    const creadas = await acciones.guardar(lista)
    setGuardando(false)
    if (!creadas) return
    showToast(
      creadas.length > 0
        ? `Lista guardada. Se generaron ${creadas.length} tarea(s) de seguimiento.`
        : 'Lista guardada. Sin hallazgos nuevos.',
      'success'
    )
    setEditorOpen(false)
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-bold text-navy">Listas de verificación</h2><p className="mt-1 text-sm text-slate-500">Autoevaluaciones configurables por proceso o área.</p></div>
        {puedeEditar && <Button onClick={() => abrir()} icon={<Plus className="h-4 w-4" />}>Nueva lista</Button>}
      </div>
      {!puedeEditar && (
        <p className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
          Estas son las revisiones que hizo la consultoría en tu empresa. Los hallazgos te llegan como tareas de seguimiento en el tablero.
        </p>
      )}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><strong>Esto es una autoevaluación o revisión documental; no sustituye una auditoría formal.</strong></div>
      <p className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">Las referencias a requisitos deben verificarse con el texto oficial de la norma antes de su uso.</p>
      {state.listasVerificacion.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center"><CheckSquare2 className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-medium text-slate-700">Sin listas configuradas</p><p className="mt-1 text-sm text-slate-400">Crea una lista y define sus preguntas de verificación.</p></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{state.listasVerificacion.map((item) => {
        const hallazgos = item.preguntas.filter((pregunta) => pregunta.estado.includes('No cumple') || pregunta.estado === 'Parcialmente atendido').length
        return <button key={item.id} onClick={() => abrir(item)} className="rounded-xl border border-line bg-white p-5 text-left shadow-sm hover:shadow-md"><div className="flex items-start justify-between"><CheckSquare2 className="h-6 w-6 text-blue-600" /><span className={`rounded-full px-2 py-1 text-xs ${hallazgos ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>{conCantidad(hallazgos, 'hallazgo', 'hallazgos')}</span></div><p className="mt-4 font-semibold text-slate-800">{item.nombre}</p><p className="mt-1 text-xs text-slate-400">{getEmpresa(item.empresaId)?.nombre} · {getProyecto(item.proyectoId)?.nombre}</p><p className="mt-2 text-xs font-medium text-blue-700">{item.edicionNorma || getProyecto(item.proyectoId)?.edicionNorma}</p><div className="mt-4 flex justify-between border-t border-line pt-3 text-xs text-slate-500"><span>{conCantidad(item.preguntas.length, 'pregunta', 'preguntas')}</span><span>{item.fecha}</span></div></button>
      })}</div>}

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={puedeEditar ? 'Configurar lista de verificación' : 'Lista de verificación'} size="xl" footer={<><Button variant="outline" onClick={() => setEditorOpen(false)}>{puedeEditar ? 'Cancelar' : 'Volver'}</Button>{puedeEditar && <Button onClick={guardar} disabled={guardando} icon={<Save className="h-4 w-4" />}>{guardando ? 'Guardando…' : 'Guardar lista'}</Button>}</>}>
        {/* fieldset disabled: el cliente ve todo en lectura con un solo atributo. */}
        <fieldset disabled={!puedeEditar} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label><span className={labelClass}>Nombre *</span><input className={inputClass} value={lista.nombre} onChange={(event) => setLista({ ...lista, nombre: event.target.value })} /></label>
            <label><span className={labelClass}>Empresa *</span><select className={inputClass} value={lista.empresaId} onChange={(event) => setLista({ ...lista, empresaId: event.target.value, proyectoId: '', procesoId: '' })}><option value="">Selecciona</option>{state.empresas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
            <label><span className={labelClass}>Proyecto *</span><select className={inputClass} value={lista.proyectoId} onChange={(event) => { const proyecto = state.proyectos.find((item) => item.id === event.target.value); setLista({ ...lista, proyectoId: event.target.value, procesoId: '', responsableId: '', edicionNorma: proyecto?.edicionNorma || 'ISO 9001:2026' }) }}><option value="">Selecciona</option>{proyectos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
            <label><span className={labelClass}>Referencia normativa *</span><select className={inputClass} value={lista.edicionNorma} disabled={Boolean(lista.proyectoId)} onChange={(event) => setLista({ ...lista, edicionNorma: event.target.value as ListaVerificacion['edicionNorma'] })}><option value="ISO 9001:2026">ISO 9001:2026 (vigente)</option><option value="ISO 9001:2015">ISO 9001:2015 (en transición)</option></select></label>
            <label><span className={labelClass}>Proceso</span><select className={inputClass} value={lista.procesoId} onChange={(event) => setLista({ ...lista, procesoId: event.target.value })}><option value="">Sin vincular</option>{procesos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
            <label><span className={labelClass}>Área</span><input className={inputClass} value={lista.area} onChange={(event) => setLista({ ...lista, area: event.target.value })} /></label>
            <label><span className={labelClass}>Responsable *</span><select className={inputClass} value={lista.responsableId} onChange={(event) => setLista({ ...lista, responsableId: event.target.value })}><option value="">{lista.proyectoId ? 'Selecciona' : 'Primero elige el proyecto'}</option>{(acciones.responsables(lista.proyectoId).some((u) => u.id === lista.responsableId) || !lista.responsableId
  ? acciones.responsables(lista.proyectoId)
  : [...acciones.responsables(lista.proyectoId), ...state.usuarios.filter((u) => u.id === lista.responsableId)]
).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
            <label><span className={labelClass}>Fecha *</span><input type="date" className={inputClass} value={lista.fecha} onChange={(event) => setLista({ ...lista, fecha: event.target.value })} /></label>
          </div>
          {lista.edicionNorma === 'ISO 9001:2015' && <p className="text-xs text-amber-700">Este proyecto usa la edición ISO 9001:2015 (en transición).</p>}
          <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">Las referencias a requisitos deben verificarse con el texto oficial de la norma antes de su uso.</p>
          <div className="space-y-3">
            {lista.preguntas.map((item, index) => <div key={item.id} className="rounded-xl border border-line p-4"><div className="mb-3 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">{index + 1}</span><input className="flex-1 border-0 text-sm font-medium outline-none" value={item.pregunta} onChange={(event) => actualizarPregunta(item.id, { pregunta: event.target.value })} placeholder="Pregunta o criterio de verificación" /></div><div className="grid gap-3 md:grid-cols-4"><input className={inputClass} value={item.referenciaRequisito || ''} onChange={(event) => actualizarPregunta(item.id, { referenciaRequisito: event.target.value })} placeholder="Referencia al requisito" /><select className={inputClass} value={item.estado} onChange={(event) => actualizarPregunta(item.id, { estado: event.target.value as EstadoVerificacion })}>{ESTADOS.map((estado) => <option key={estado}>{estado}</option>)}</select><select className={inputClass} value={item.evidenciaId || ''} onChange={(event) => actualizarPregunta(item.id, { evidenciaId: event.target.value })}><option value="">Sin evidencia vinculada</option>{evidencias.map((evidencia) => <option key={evidencia.id} value={evidencia.id}>{evidencia.nombre}</option>)}</select><input className={inputClass} value={item.observaciones || ''} onChange={(event) => actualizarPregunta(item.id, { observaciones: event.target.value })} placeholder="Observaciones" /></div>{item.estado === 'No aplica' && <textarea rows={2} className={`${inputClass} mt-3`} value={item.justificacionNoAplica || ''} onChange={(event) => actualizarPregunta(item.id, { justificacionNoAplica: event.target.value })} placeholder="Justificación obligatoria de No aplica" />}</div>)}
          </div>
          {puedeEditar && <Button variant="outline" onClick={() => setLista({ ...lista, preguntas: [...lista.preguntas, nuevaPregunta()] })} icon={<Plus className="h-4 w-4" />}>Agregar pregunta</Button>}
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </fieldset>
      </Modal>
    </div>
  )
}
