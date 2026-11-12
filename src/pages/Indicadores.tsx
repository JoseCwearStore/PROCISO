import { useState } from 'react'
import { BarChart3, Building2, Plus, Settings2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { useAccionesIndicador } from '../hooks/useAccionesIndicador'
import type { IndicadorGestion } from '../types'

const inputClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500'
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700'
const vacio = (ambito: IndicadorGestion['ambito']): IndicadorGestion => ({
  id: crypto.randomUUID(),
  ambito,
  empresaId: '',
  proyectoId: '',
  nombre: '',
  descripcion: '',
  formula: '',
  unidad: '',
  frecuencia: '',
  responsableId: '',
  meta: '',
  periodo: '',
  valor: '',
})

export default function Indicadores() {
  const { state, getEmpresa, getUsuario, showToast } = useApp()
  const acciones = useAccionesIndicador()
  const [modalOpen, setModalOpen] = useState(false)
  const [indicador, setIndicador] = useState<IndicadorGestion>(vacio('PROCISO'))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Lo que la BD va a aceptar para el indicador abierto (la regla real está en el RLS).
  const editable = acciones.puedeGestionar(indicador.ambito, indicador.empresaId)
  const responsables = acciones.responsables(indicador.ambito, indicador.empresaId)

  function abrir(ambito: IndicadorGestion['ambito'], item?: IndicadorGestion) {
    // El ámbito lo fija la sección: un indicador interno no se convierte en uno de empresa.
    setIndicador(item ? { ...item, empresaId: item.empresaId ?? '', valor: item.valor ?? '' } : vacio(ambito))
    setError('')
    setModalOpen(true)
  }

  async function guardar() {
    if (guardando) return
    if (!indicador.nombre.trim() || !indicador.formula.trim() || !indicador.unidad || !indicador.frecuencia || !indicador.responsableId || !indicador.meta || !indicador.periodo) {
      setError('Completa nombre, fórmula, unidad, frecuencia, responsable, meta y periodo.')
      return
    }
    if (indicador.ambito === 'SGC' && !indicador.empresaId) {
      setError('Selecciona la empresa del indicador del SGC.')
      return
    }
    setGuardando(true)
    const guardado = await acciones.guardar(indicador)
    setGuardando(false)
    if (!guardado) return
    showToast('Indicador guardado.', 'success')
    setModalOpen(false)
  }

  const internos = state.indicadores.filter((item) => item.ambito === 'PROCISO')
  const sgc = state.indicadores.filter((item) => item.ambito === 'SGC')

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-navy">Indicadores e informes</h2><p className="mt-1 text-sm text-slate-500">{acciones.esCliente ? 'Indicadores del sistema de gestión de tu empresa, registrados por la consultoría.' : 'Configuración y seguimiento separado de la operación de la consultoría y del SGC de cada empresa.'}</p></div></div>
      {/* El cliente nunca ve los indicadores internos de la consultoría. */}
      {!acciones.esCliente && (
        <>
          <Seccion
            titulo="Indicadores de gestión de la consultoría"
            descripcion="Desempeño de la consultoría y avance de proyectos. Los gestiona el administrador."
            icon={<Settings2 className="h-5 w-5" />}
            indicadores={internos}
            puedeCrear={acciones.puedeGestionar('PROCISO')}
            onNew={() => abrir('PROCISO')}
            onEdit={(item) => abrir('PROCISO', item)}
            empresa={() => undefined}
            responsable={(item) => getUsuario(item.responsableId)?.nombre}
          />
          <div className="my-8 border-t border-line" />
        </>
      )}
      <Seccion
        titulo={acciones.esCliente ? 'Indicadores del SGC de tu empresa' : 'Indicadores del SGC de cada empresa'}
        descripcion="Medición de objetivos, procesos y resultados del sistema de gestión de calidad."
        icon={<Building2 className="h-5 w-5" />}
        indicadores={sgc}
        puedeCrear={acciones.empresasGestionables.length > 0}
        onNew={() => abrir('SGC')}
        onEdit={(item) => abrir('SGC', item)}
        empresa={(item) => item.empresaId ? getEmpresa(item.empresaId)?.nombre : undefined}
        responsable={(item) => getUsuario(item.responsableId)?.nombre}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editable ? 'Configurar indicador' : 'Indicador'} size="lg" footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>{editable ? 'Cancelar' : 'Volver'}</Button>{editable && <Button onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar indicador'}</Button>}</>}>
        {/* fieldset disabled: quien no puede gestionarlo lo ve en lectura. */}
        <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
          <label><span className={labelClass}>Ámbito</span><input className={inputClass} disabled value={indicador.ambito === 'PROCISO' ? 'Gestión interna de la consultoría' : 'SGC de empresa'} /></label>
          {indicador.ambito === 'SGC' && <label><span className={labelClass}>Empresa *</span><select className={inputClass} value={indicador.empresaId || ''} onChange={(event) => setIndicador({ ...indicador, empresaId: event.target.value, responsableId: '' })}><option value="">Selecciona</option>{(editable ? acciones.empresasGestionables : state.empresas).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>}
          <label><span className={labelClass}>Nombre *</span><input className={inputClass} value={indicador.nombre} onChange={(event) => setIndicador({ ...indicador, nombre: event.target.value })} /></label>
          <label><span className={labelClass}>Unidad *</span><input className={inputClass} value={indicador.unidad} onChange={(event) => setIndicador({ ...indicador, unidad: event.target.value })} placeholder="%, días, número..." /></label>
          <label className="sm:col-span-2"><span className={labelClass}>Descripción</span><textarea rows={2} className={inputClass} value={indicador.descripcion} onChange={(event) => setIndicador({ ...indicador, descripcion: event.target.value })} /></label>
          <label className="sm:col-span-2"><span className={labelClass}>Fórmula *</span><input className={inputClass} value={indicador.formula} onChange={(event) => setIndicador({ ...indicador, formula: event.target.value })} /></label>
          <label><span className={labelClass}>Frecuencia *</span><select className={inputClass} value={indicador.frecuencia} onChange={(event) => setIndicador({ ...indicador, frecuencia: event.target.value })}><option value="">Selecciona</option>{['Semanal', 'Mensual', 'Trimestral', 'Semestral', 'Anual'].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span className={labelClass}>Responsable *</span><select className={inputClass} value={indicador.responsableId} onChange={(event) => setIndicador({ ...indicador, responsableId: event.target.value })}><option value="">Selecciona</option>{(responsables.some((u) => u.id === indicador.responsableId) || !indicador.responsableId ? responsables : [...responsables, ...state.usuarios.filter((u) => u.id === indicador.responsableId)]).map((item) => <option key={item.id} value={item.id}>{item.nombre} · {item.rol}</option>)}</select></label>
          <label><span className={labelClass}>Meta *</span><input className={inputClass} value={indicador.meta} onChange={(event) => setIndicador({ ...indicador, meta: event.target.value })} /></label>
          <label><span className={labelClass}>Periodo *</span><input className={inputClass} value={indicador.periodo} onChange={(event) => setIndicador({ ...indicador, periodo: event.target.value })} placeholder="Ej. Octubre 2026" /></label>
          <label className="sm:col-span-2"><span className={labelClass}>Valor observado</span><input className={inputClass} value={indicador.valor || ''} onChange={(event) => setIndicador({ ...indicador, valor: event.target.value })} placeholder="Déjalo vacío si aún no existen datos." /></label>
          {error && <p className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </fieldset>
      </Modal>
    </div>
  )
}

function Seccion({ titulo, descripcion, icon, indicadores, puedeCrear, onNew, onEdit, empresa, responsable }: {
  titulo: string
  descripcion: string
  icon: React.ReactNode
  indicadores: IndicadorGestion[]
  puedeCrear: boolean
  onNew: () => void
  onEdit: (item: IndicadorGestion) => void
  empresa: (item: IndicadorGestion) => string | undefined
  responsable: (item: IndicadorGestion) => string | undefined
}) {
  return <section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">{icon}</div><div><h3 className="font-semibold text-slate-800">{titulo}</h3><p className="text-sm text-slate-500">{descripcion}</p></div></div>{puedeCrear && <Button size="sm" onClick={onNew} icon={<Plus className="h-4 w-4" />}>Nuevo indicador</Button>}</div>{indicadores.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><BarChart3 className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 font-medium text-slate-600">Sin datos suficientes</p><p className="mt-1 text-sm text-slate-400">{puedeCrear ? 'Configura un indicador y registra un valor para iniciar el seguimiento.' : 'Todavía no hay indicadores registrados.'}</p></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{indicadores.map((item) => <button key={item.id} onClick={() => onEdit(item)} className="rounded-xl border border-line bg-white p-5 text-left shadow-sm hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-800">{item.nombre}</p><p className="mt-1 text-xs text-slate-400">{empresa(item) || 'Consultoría'} · {item.periodo}</p></div><span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">Meta {item.meta}</span></div><div className="my-5 text-center"><p className={`font-bold ${item.valor ? 'text-3xl text-navy' : 'text-sm text-slate-400'}`}>{item.valor || 'Sin datos suficientes'}</p>{item.valor && <p className="text-xs text-slate-400">{item.unidad}</p>}</div><div className="border-t border-line pt-3 text-xs text-slate-500"><p>{item.frecuencia} · {responsable(item) || 'Sin responsable'}</p><p className="mt-1 truncate">Fórmula: {item.formula}</p></div></button>)}</div>}</section>
}
