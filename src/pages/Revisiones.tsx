import { useRef, useState } from 'react'
import { randomUUID } from '../lib/uuid'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  MessageSquare,
  RotateCcw,
  Search,
  ThumbsUp,
  XCircle,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { servicioEscritura } from '../lib/servicios'
import { mensajeDeError } from '../lib/escrituras'
import { documentoCambio } from '../lib/refresco'
import { formatearFecha } from '../lib/datos'
import {
  filtrarBandeja, historialParaMostrar, mensajeAprobacion, mensajeSinDecision, puedeDarVistoBueno, puedeDecidir, reemplazadosAlAprobar, textosDeDecision,
  vistoBuenoVigente, type VistaBandeja,
} from '../lib/aprobacion'
import { hayFiltrosActivos } from '../lib/filtros'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { Documento } from '../types'

const VACIO_DE_VISTA: Record<VistaBandeja, { titulo: string; detalle: string }> = {
  pendientes: { titulo: 'No hay revisiones pendientes', detalle: 'Los documentos enviados desde el editor aparecerán aquí.' },
  correccion: { titulo: 'No hay documentos en corrección', detalle: 'Aquí aparecen los documentos que se devolvieron para corregirlos.' },
  aprobados: { titulo: 'Todavía no hay documentos aprobados', detalle: 'Aquí aparecen los documentos que el cliente aprobó.' },
}

const inputClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'

export default function Revisiones() {
  const { state, dispatch, getProyecto, getEmpresa, getUsuario, showToast, refrescarDatos } = useApp()
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  const [seccionId, setSeccionId] = useState('')
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState('')

  // O21: cada contador abre su lista. O25: la lista se busca y se filtra por proyecto.
  const [vista, setVista] = useState<VistaBandeja>('pendientes')
  const [busqueda, setBusqueda] = useState('')
  const [filtroProyecto, setFiltroProyecto] = useState('')
  const comentarioRef = useRef<HTMLTextAreaElement>(null)
  const contar = (estado: Documento['estado']) => state.documentos.filter((item) => item.estado === estado).length
  const textoDe = (d: Documento) => {
    const p = getProyecto(d.proyectoId)
    const e = getEmpresa(d.empresaId || p?.empresaId || '')
    return [d.nombre, d.codigo, e?.nombreComercial, e?.nombre, p?.nombre, getUsuario(d.creadoPorId)?.nombre].filter(Boolean).join(' ')
  }
  const lista = filtrarBandeja(state.documentos, vista, { texto: busqueda, proyectoId: filtroProyecto }, textoDe)
  const ESTADOS_BANDEJA: Documento['estado'][] = ['Pendiente de revisión', 'En corrección', 'Aprobado']
  const proyectosFiltro = state.proyectos.filter((p) => state.documentos.some((d) => d.proyectoId === p.id && ESTADOS_BANDEJA.includes(d.estado)))
  const hayFiltros = hayFiltrosActivos({ busqueda, proyecto: filtroProyecto })
  const documento = state.documentos.find((item) => item.id === seleccionadoId)
  // Solo se muestran los botones que la BD va a aceptar (la regla real está en decidir_documento).
  const esCliente = state.currentRole === 'Usuario Cliente'
  const [decidiendo, setDecidiendo] = useState(false)
  const [confirmandoAprobacion, setConfirmandoAprobacion] = useState(false)

  // O23: el equipo deja su visto bueno a esta versión. No cambia el estado ni bloquea al cliente.
  async function darVistoBueno() {
    if (!documento || decidiendo) return
    setDecidiendo(true)
    const resultado = await servicioEscritura.darVistoBuenoDocumento(documento.id, documento.version)
    setDecidiendo(false)
    if (!resultado.ok) {
      setError(mensajeDeError(resultado))
      return
    }
    const fecha = formatearFecha(new Date().toISOString())
    const usuarioId = state.currentUser?.id ?? ''
    dispatch({
      type: 'SET_DOCUMENTOS',
      documentos: state.documentos.map((item) => item.id !== documento.id ? item : {
        ...item,
        vistoBuenoPorId: usuarioId,
        vistoBuenoEn: fecha,
        vistoBuenoVersion: item.version,
        historial: [...(item.historial || []), {
          id: randomUUID(), fecha, autorId: usuarioId, accion: 'Visto bueno del equipo', detalle: `Versión ${item.version}.`,
        }],
      }),
    })
    setError('')
    showToast('Visto bueno registrado.', 'success')
  }

  async function decidir(estado:'Aprobado' | 'En corrección' | 'Rechazado') {
    if (!documento || decidiendo) return
    if ((estado === 'Rechazado' || estado === 'En corrección') && (!seccionId || !comentario.trim())) {
      setError('Selecciona una sección y agrega el comentario que fundamenta la decisión.')
      return
    }
    setDecidiendo(true)
    // AUD06-M1: antes de decidir se relee la BD. Si el documento cambió mientras estaba abierto no se decide: la
    // pantalla ya muestra la versión actual para que se revise de nuevo (además, decidir_documento rechaza si la
    // versión que se vio ya no es la vigente). Si la relectura falla, se intenta igual.
    const fresco = await refrescarDatos()
    if (fresco && documentoCambio(documento, fresco.documentos.find((d) => d.id === documento.id))) {
      setDecidiendo(false)
      setError('Este documento cambió desde que lo abriste. Revisa la versión actual antes de decidir.')
      return
    }
    const resultado = await servicioEscritura.decidirDocumento(documento.id, estado, documento.version, seccionId, comentario)
    setDecidiendo(false)
    if (!resultado.ok) {
      setError(mensajeDeError(resultado))
      return
    }

    // La BD ya aplicó la decisión; acá se refleja igual que la función del servidor.
    const fecha = formatearFecha(new Date().toISOString())
    const fechaHora = fecha
    const usuarioId = state.currentUser?.id ?? ''
    const comentarioNuevo = seccionId && comentario.trim() ? {
      id: randomUUID(),
      seccionId,
      autorId: usuarioId,
      fecha: fechaHora,
      texto: comentario.trim(),
    } : null
    const accion = estado === 'Aprobado' ? 'Documento aprobado' : estado === 'Rechazado' ? 'Documento rechazado' : 'Corrección solicitada'
    const actualizado: Documento = {
      ...documento,
      estado,
      // Como en el servidor: el revisor es el equipo; el aprobador, el cliente.
      revisadoPorId: esCliente ? documento.revisadoPorId : usuarioId,
      aprobadoPorId: estado === 'Aprobado' ? usuarioId : documento.aprobadoPorId,
      fechaRevision: esCliente ? documento.fechaRevision : fecha,
      fechaAprobacion: estado === 'Aprobado' ? fecha : documento.fechaAprobacion,
      bloqueado: estado === 'Aprobado',
      comentarios: comentarioNuevo ? [...(documento.comentarios || []), comentarioNuevo] : documento.comentarios,
      historialVersiones: documento.historialVersiones.map((version) =>
        version.version === documento.version ? { ...version, estado } : version
      ),
      historial: [...(documento.historial || []), {
        id: randomUUID(),
        fecha: fechaHora,
        autorId: usuarioId,
        accion,
        detalle: comentario.trim() || `Versión ${documento.version}.`,
      }],
    }

    // La misma regla que usa la BD (y que le explica el diálogo al usuario antes de aprobar).
    const idsReemplazados = new Set(estado === 'Aprobado' ? reemplazadosAlAprobar(documento, state.documentos).map((item) => item.id) : [])
    const documentos = state.documentos.map((item) => {
      if (item.id === documento.id) return actualizado
      if (!idsReemplazados.has(item.id)) return item
      return {
        ...item,
        estado: 'Obsoleto' as const,
        bloqueado: true,
        historial: [...(item.historial || []), {
          id: randomUUID(),
          fecha: fechaHora,
          autorId: usuarioId,
          accion: 'Documento reemplazado',
          detalle: `Sustituido por ${documento.codigo || documento.nombre}, versión ${documento.version}.`,
        }],
      }
    })
    dispatch({ type: 'SET_DOCUMENTOS', documentos })
    setComentario('')
    setSeccionId('')
    setError('')
    showToast(`${accion}.`, estado === 'Aprobado' ? 'success' : estado === 'Rechazado' ? 'error' : 'warning')
    setSeleccionadoId(null)
  }

  if (!documento) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Flujo F</p>
          <h2 className="mt-1 text-xl font-bold text-navy">Revisiones y aprobaciones</h2>
          <p className="mt-1 text-sm text-slate-500">Bandeja de documentos que requieren una decisión autorizada.</p>
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Resumen icon={<Clock3 className="h-5 w-5" />} label="Pendientes" valor={contar('Pendiente de revisión')} color="blue" activo={vista === 'pendientes'} onClick={() => setVista('pendientes')} />
          <Resumen icon={<RotateCcw className="h-5 w-5" />} label="En corrección" valor={contar('En corrección')} color="amber" activo={vista === 'correccion'} onClick={() => setVista('correccion')} />
          <Resumen icon={<CheckCircle2 className="h-5 w-5" />} label="Aprobados" valor={contar('Aprobado')} color="green" activo={vista === 'aprobados'} onClick={() => setVista('aprobados')} />
        </div>
        <div className="mb-4 grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input className={`${inputClass} pl-9`} value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar por título, código, empresa, proyecto o elaborador..." />
          </label>
          <select className={inputClass} value={filtroProyecto} onChange={(event) => setFiltroProyecto(event.target.value)} aria-label="Filtrar por proyecto">
            <option value="">Todos los proyectos</option>
            {proyectosFiltro.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          {lista.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
              <p className="mt-3 font-medium text-slate-700">{hayFiltros ? 'No hay documentos para estos filtros' : VACIO_DE_VISTA[vista].titulo}</p>
              {hayFiltros
                ? <Button variant="secondary" className="mt-4" onClick={() => { setBusqueda(''); setFiltroProyecto('') }}>Limpiar filtros</Button>
                : <p className="mt-1 text-sm text-slate-400">{VACIO_DE_VISTA[vista].detalle}</p>}
            </div>
          ) : lista.map((item) => {
            const proyecto = getProyecto(item.proyectoId)
            const empresa = getEmpresa(item.empresaId || proyecto?.empresaId || '')
            return <button key={item.id} onClick={() => setSeleccionadoId(item.id)} className="flex w-full flex-wrap items-center gap-4 border-b border-line p-4 text-left last:border-0 hover:bg-slate-50"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Clock3 className="h-5 w-5" /></div><div className="min-w-56 flex-1"><p className="text-sm font-semibold text-slate-800">{item.nombre}</p><p className="mt-1 text-xs text-slate-400">{item.codigo || item.id} · Versión {item.version}</p></div><div className="min-w-48"><p className="text-xs text-slate-400">Empresa y proyecto</p><p className="mt-1 text-sm text-slate-600">{empresa?.nombreComercial || empresa?.nombre || '—'} · {proyecto?.nombre || '—'}</p></div><div className="min-w-40"><p className="text-xs text-slate-400">Elaborador</p><p className="mt-1 text-sm text-slate-600">{getUsuario(item.creadoPorId)?.nombre || '—'}</p></div><StatusBadge status={item.estado} size="sm" /></button>
          })}
        </div>
      </div>
    )
  }

  const textos = textosDeDecision(esCliente)
  const hayDecision = puedeDecidir(documento)

  // O19: "Comentar" solo elegía la sección en un desplegable lejano; ahora además lleva al cuadro de texto.
  function comentarSeccion(id: string) {
    setSeccionId(id)
    const cuadro = comentarioRef.current
    cuadro?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    cuadro?.focus({ preventScroll: true })
  }
  const eventos = historialParaMostrar(documento.historial)

  return (
    <div className="p-4 sm:p-6">
      <Button variant="ghost" size="sm" onClick={() => { setSeleccionadoId(null); setError('') }} icon={<ArrowLeft className="h-4 w-4" />}>Volver a la bandeja</Button>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div><div className="mb-2 flex items-center gap-2"><StatusBadge status={documento.estado} /><span className="text-xs text-slate-400">{documento.codigo} · Versión {documento.version}</span></div><h2 className="text-2xl font-bold text-navy">{documento.nombre}</h2><p className="mt-1 text-sm text-slate-500">Elaborado por {getUsuario(documento.creadoPorId)?.nombre || documento.creadoPorId}</p>{vistoBuenoVigente(documento) && <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-emerald-700"><ThumbsUp className="h-4 w-4" />Visto bueno del equipo: {getUsuario(documento.vistoBuenoPorId || '')?.nombre || 'Equipo'}{documento.vistoBuenoEn ? ` · ${documento.vistoBuenoEn}` : ''}</p>}</div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-4">
          {(documento.secciones || []).map((seccion, index) => (
            <section key={seccion.id} className={`rounded-xl border bg-white p-5 ${seccionId === seccion.id ? 'border-violet-400 ring-2 ring-violet-100' : 'border-line'}`}>
              <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-50 text-xs font-bold text-violet-600">{index + 1}</span><h3 className="font-semibold text-slate-800">{seccion.titulo || 'Sección sin título'}</h3></div>{hayDecision && <Button variant="ghost" size="sm" onClick={() => comentarSeccion(seccion.id)} icon={<MessageSquare className="h-4 w-4" />}>Comentar</Button>}</div>
              {seccion.tipo === 'texto' ? <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{seccion.contenido}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><tbody>{seccion.filas?.map((fila, filaIndex) => <tr key={filaIndex}>{fila.map((celda, celdaIndex) => <td key={celdaIndex} className="border border-line p-2">{celda || <span className="text-amber-600">Información pendiente de confirmar</span>}</td>)}</tr>)}</tbody></table></div>}
              {documento.comentarios?.filter((item) => item.seccionId === seccion.id).map((item) => <div key={item.id} className="mt-3 rounded-lg bg-violet-50 p-3 text-xs text-violet-800"><p>{item.texto}</p><p className="mt-1 text-[10px] text-violet-500">{item.fecha} · {getUsuario(item.autorId)?.nombre || item.autorId}</p></div>)}
            </section>
          ))}
        </main>

        <aside className="h-fit space-y-4 xl:sticky xl:top-20">
          {!hayDecision && <div className="rounded-xl border border-line bg-white p-4"><p className="font-semibold text-slate-800">Sin decisión pendiente</p><p className="mt-1 text-xs text-slate-500">{mensajeSinDecision(documento.estado)}</p></div>}{hayDecision && <div className="rounded-xl border border-line bg-white p-4"><p className="font-semibold text-slate-800">{textos.titulo}</p><p className="mt-1 text-xs text-slate-500">{textos.ayuda}</p><select className={`${inputClass} mt-4`} value={seccionId} onChange={(event) => setSeccionId(event.target.value)}><option value="">Selecciona una sección</option>{documento.secciones?.map((item) => <option key={item.id} value={item.id}>{item.titulo || 'Sin título'}</option>)}</select><textarea ref={comentarioRef} rows={4} className={`${inputClass} mt-3`} value={comentario} onChange={(event) => setComentario(event.target.value)} placeholder="Comentario de revisión..." />{error && <div className="mt-3 flex gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}<div className="mt-4 space-y-2">{esCliente && <Button className="w-full" variant="success" disabled={decidiendo} onClick={() => setConfirmandoAprobacion(true)} icon={<CheckCircle2 className="h-4 w-4" />}>Aprobar y fijar versión</Button>}{puedeDarVistoBueno(esCliente, documento) && <Button className="w-full" variant="outline" disabled={decidiendo} onClick={darVistoBueno} icon={<ThumbsUp className="h-4 w-4" />}>Dar visto bueno</Button>}<Button className="w-full" variant="outline" disabled={decidiendo} onClick={() => decidir('En corrección')} icon={<RotateCcw className="h-4 w-4" />}>Solicitar corrección</Button>{!esCliente && <Button className="w-full" variant="danger" disabled={decidiendo} onClick={() => decidir('Rechazado')} icon={<XCircle className="h-4 w-4" />}>Rechazar</Button>}</div></div>}
          <div className="rounded-xl border border-line bg-white p-4"><p className="mb-3 text-sm font-semibold text-slate-700">Historial completo</p><div className="space-y-3">{eventos.length === 0 ? <p className="text-xs text-slate-400">Sin eventos registrados.</p> : eventos.map((item) => <div key={item.id} className="border-l-2 border-violet-200 pl-3"><p className="text-xs font-medium text-slate-700">{item.accion}</p><p className="text-[10px] text-slate-400">{item.fecha}</p><p className="mt-1 text-xs text-slate-500">{item.detalle}</p></div>)}</div></div>
        </aside>
      </div>

      {/* O20: aprobar bloquea el documento y puede volver Obsoleto a otros: se confirma antes. */}
      <ConfirmDialog
        open={confirmandoAprobacion}
        onClose={() => setConfirmandoAprobacion(false)}
        onConfirm={() => { setConfirmandoAprobacion(false); void decidir('Aprobado') }}
        title="Aprobar y fijar versión"
        message={mensajeAprobacion(documento, reemplazadosAlAprobar(documento, state.documentos))}
        confirmLabel="Aprobar"
        variant="primary"
      />
    </div>
  )
}

function Resumen({ icon, label, valor, color, activo, onClick }: { icon: React.ReactNode; label: string; valor: number; color: 'blue' | 'amber' | 'green'; activo: boolean; onClick: () => void }) {
  const clases = { blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600', green: 'bg-emerald-50 text-emerald-600' }
  return <button type="button" aria-pressed={activo} onClick={onClick} className={`flex items-center gap-3 rounded-xl border bg-white p-4 text-left transition ${activo ? 'border-violet-400 ring-2 ring-violet-100' : 'border-line hover:bg-slate-50'}`}><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${clases[color]}`}>{icon}</div><div><p className="text-2xl font-bold text-slate-800">{valor}</p><p className="text-xs text-slate-500">{label}</p></div></button>
}
