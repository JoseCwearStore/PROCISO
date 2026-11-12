import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Columns2,
  FilePlus2,
  FileText,
  History,
  Link2,
  MessageSquare,
  Plus,
  Save,
  Send,
  Table2,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { servicioEscritura } from '../lib/servicios'
import { mensajeDeError } from '../lib/escrituras'
import { formatearFecha } from '../lib/datos'
import {
  contenidoEditable,
  documentoVisibleParaRol,
  estadosVisiblesParaRol,
  puedeRedactarDocumentos,
  siguienteVersion,
  versionParaEnviar,
} from '../lib/documentos'
import { PENDIENTE, PLANTILLAS, crearSecciones, plantillaPorId } from '../lib/plantillas'
import { aplicarTextos, armarPedidoIA, camposIA } from '../lib/generacion'
import { useAccionesGeneracion } from '../hooks/useAccionesGeneracion'
import { descargar } from '../lib/descarga'
import { armarModelo, nombreArchivo } from '../lib/exportacion'
import { generarPdf } from '../lib/exportarPdf'
import { generarWord } from '../lib/exportarWord'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { PanelAnalisisIA } from '../components/PanelAnalisisIA'
import { IndicadorUsoIA } from '../components/IndicadorUsoIA'
import { StatusBadge } from '../components/ui/StatusBadge'
import type {
  CategoriaDocumento,
  Documento,
  SeccionDocumento,
  VersionDocumento,
} from '../types'

const inputClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700'

const CATEGORIAS: Array<{ id: CategoriaDocumento; titulo: string; elementos: string }> = [
  {
    id: 'A',
    titulo: 'Información general del sistema',
    elementos: 'Alcance, política, objetivos, contexto, partes interesadas, riesgos y oportunidades',
  },
  {
    id: 'B',
    titulo: 'Documentación operativa',
    elementos: 'Procedimientos, instrucciones, fichas de proceso, formatos, matrices y planes',
  },
  {
    id: 'C',
    titulo: 'Seguimiento y evaluación',
    elementos: 'No conformidades, auditorías internas y revisión por la dirección',
  },
]

interface Generador {
  empresaId: string
  proyectoId: string
  procesoId: string
  plantilla: string // id de la plantilla (src/lib/plantillas.ts); el tipo de documento sale de ella
  respuestas: Record<string, string> // cuestionario guiado, por id de pregunta
  usarIA: boolean // redactar con IA las partes que no salen de los datos (si falla, se usan las respuestas)
  codigo: string
  titulo: string
  edicionNorma: NonNullable<Documento['referenciaNormativa']>
}

const GENERADOR_VACIO: Generador = {
  empresaId: '',
  proyectoId: '',
  procesoId: '',
  plantilla: 'procedimiento',
  respuestas: {},
  usarIA: true,
  codigo: '',
  titulo: '',
  edicionNorma: 'ISO 9001:2026',
}

export default function Documentacion() {
  const { state, dispatch, getEmpresa, getProyecto, getUsuario, showToast } = useApp()
  const [vista, setVista] = useState<'lista' | 'editor'>('lista')
  const [documentoId, setDocumentoId] = useState<string | null>(null)
  const [generadorOpen, setGeneradorOpen] = useState(false)
  const [generador, setGenerador] = useState<Generador>(GENERADOR_VACIO)
  const [generandoIA, setGenerandoIA] = useState(false)
  const [exportando, setExportando] = useState<'pdf' | 'word' | null>(null)
  const { redactar, usoIA, estadoUsoIA } = useAccionesGeneracion()
  const [compararOpen, setCompararOpen] = useState(false)
  const [versionA, setVersionA] = useState('')
  const [versionB, setVersionB] = useState('')
  const [errores, setErrores] = useState<string[]>([])
  const [comentarioSeccion, setComentarioSeccion] = useState('')
  const [comentarioTexto, setComentarioTexto] = useState('')
  const [filtros, setFiltros] = useState({
    empresa: '',
    proyecto: '',
    tipo: '',
    estado: '',
    responsable: '',
    desde: '',
    hasta: '',
  })

  const usuarioSesion = state.usuarios.find((item) => item.email === state.currentUser?.email)
  const usuarioCliente = usuarioSesion?.empresaId ? usuarioSesion : state.usuarios.find((item) => item.rol === 'Usuario Cliente' && item.activo)
  const empresaClienteId = state.currentRole === 'Usuario Cliente' ? usuarioCliente?.empresaId : undefined
  const empresasDisponibles = state.empresas.filter((item) => !empresaClienteId || item.id === empresaClienteId)
  const proyectosDisponibles = state.proyectos.filter((item) => !empresaClienteId || item.empresaId === empresaClienteId)
  const proyectoIdsDisponibles = new Set(proyectosDisponibles.map((item) => item.id))
  const documentosDisponibles = state.documentos.filter(
    (item) => proyectoIdsDisponibles.has(item.proyectoId) && documentoVisibleParaRol(item, state.currentRole),
  )
  const documento = state.documentos.find((item) => item.id === documentoId)
  const proyectosGenerador = proyectosDisponibles.filter((item) => !generador.empresaId || item.empresaId === generador.empresaId)
  const procesosGenerador = state.procesos.filter((item) => !generador.proyectoId || item.proyectoId === generador.proyectoId)
  const plantillaElegida = plantillaPorId(generador.plantilla)
  // Al cambiar de plantilla se sugiere su código, salvo que el usuario ya haya escrito uno propio.
  function elegirPlantilla(id: string) {
    const nueva = plantillaPorId(id)
    const codigoSugerido = !generador.codigo || generador.codigo === plantillaElegida?.codigoBase
    setGenerador({ ...generador, plantilla: id, procesoId: '', respuestas: {}, codigo: codigoSugerido ? nueva?.codigoBase ?? '' : generador.codigo })
  }

  const documentos = useMemo(() => documentosDisponibles.filter((item) => {
    const proyecto = getProyecto(item.proyectoId)
    const empresaId = item.empresaId || proyecto?.empresaId
    if (filtros.empresa && empresaId !== filtros.empresa) return false
    if (filtros.proyecto && item.proyectoId !== filtros.proyecto) return false
    if (filtros.tipo && item.tipo !== filtros.tipo) return false
    if (filtros.estado && item.estado !== filtros.estado) return false
    if (filtros.responsable && item.creadoPorId !== filtros.responsable) return false
    if (filtros.desde && fechaISO(item.fechaCreacion) < filtros.desde) return false
    if (filtros.hasta && fechaISO(item.fechaCreacion) > filtros.hasta) return false
    return true
  }), [documentosDisponibles, filtros, getProyecto])

  async function generar() {
    const plantilla = plantillaPorId(generador.plantilla)
    const proceso = plantilla?.requiereProceso ? state.procesos.find((item) => item.id === generador.procesoId) : undefined
    if (!plantilla || (plantilla.requiereProceso && !proceso)) return
    if (!generador.empresaId || !generador.proyectoId || !generador.titulo.trim() || !generador.codigo.trim()) return
    const empresa = state.empresas.find((item) => item.id === generador.empresaId)
    const procesosDelProyecto = state.procesos.filter((item) => item.proyectoId === generador.proyectoId)
    const organizacion = empresa?.nombreComercial || empresa?.nombre
    // Primero el borrador con los datos y las respuestas: es el plan B si la IA falla.
    let secciones = crearSecciones(plantilla, {
      codigo: generador.codigo.trim(),
      edicionNorma: generador.edicionNorma,
      organizacion,
      proceso,
      procesos: procesosDelProyecto,
      nombreUsuario: (id) => (id ? getUsuario(id)?.nombre ?? '' : ''),
      respuestas: generador.respuestas,
    })
    let detalle = `Creado con la plantilla ${plantilla.nombre}.`
    let aviso: { texto: string; tipo: 'success' | 'warning' } = { texto: 'Borrador generado con la información disponible.', tipo: 'success' }
    // Con el tope diario agotado el borrador se genera igual, sin IA (el mismo plan B de siempre).
    const pedido = generador.usarIA && !estadoUsoIA?.agotado
      ? armarPedidoIA(plantilla, {
          consultoriaId: state.currentUser?.consultoriaId ?? null,
          proyectoId: generador.proyectoId,
          organizacion,
          respuestas: generador.respuestas,
          procesos: procesosDelProyecto.map((item) => item.nombre),
        })
      : null
    if (pedido) {
      setGenerandoIA(true)
      try {
        const redaccion = await redactar(pedido)
        if (redaccion.estado === 'Completado') {
          secciones = aplicarTextos(plantilla, secciones, redaccion.textos)
          detalle += ` Redactado con IA${redaccion.modelo ? ` (${redaccion.modelo})` : ''}: requiere revisión humana.`
          aviso = { texto: 'Borrador redactado con IA. Revísalo antes de enviarlo.', tipo: 'success' }
        } else {
          aviso = { texto: `La IA no estuvo disponible (${redaccion.error}). Se generó el borrador con tus respuestas.`, tipo: 'warning' }
        }
      } finally {
        setGenerandoIA(false)
      }
    }
    const ahora = formatearFecha(new Date().toISOString())
    const nuevo: Documento = {
      id: crypto.randomUUID(),
      codigo: generador.codigo.trim(),
      nombre: generador.titulo.trim(),
      tipo: plantilla.tipoDocumento,
      categoria: 'B',
      empresaId: generador.empresaId,
      proyectoId: generador.proyectoId,
      procesoId: proceso?.id,
      estado: 'Borrador',
      version: '0.1',
      fechaCreacion: ahora,
      fechaModificacion: ahora,
      creadoPorId: state.currentUser?.id ?? '',
      plantilla: plantilla.nombre,
      referenciaNormativa: generador.edicionNorma,
      secciones,
      evidenciasVinculadas: [],
      comentarios: [],
      historialVersiones: [],
      historial: [],
      contenidoPendiente: true,
      bloqueado: false,
    }
    if (!(await persistir(nuevo, { evento: { accion: 'Borrador generado', detalle } }))) return
    setDocumentoId(nuevo.id)
    setVista('editor')
    setGeneradorOpen(false)
    setGenerador(GENERADOR_VACIO)
    showToast(aviso.texto, aviso.tipo)
  }

  // Ediciones en pantalla: se guardan en la BD al pulsar Guardar o Enviar.
  function actualizar(updates: Partial<Documento>) {
    // Defensa en profundidad: la pantalla ya no ofrece editar al cliente, y la BD lo rechazaría igual.
    if (!documento || !puedeRedactarDocumentos(state.currentRole) || !contenidoEditable(documento)) return
    dispatch({
      type: 'UPSERT_DOCUMENTO',
      documento: { ...documento, ...updates, fechaModificacion: formatearFecha(new Date().toISOString()) },
    })
  }

  // Escritura pesimista: la pantalla se actualiza solo si la BD aceptó el cambio.
  async function persistir(
    doc: Documento,
    opciones: { version?: { version: string; comentario: string; motivo?: string }; evento: { accion: string; detalle: string } },
  ): Promise<boolean> {
    const resultado = await servicioEscritura.guardarDocumento(doc, opciones)
    if (!resultado.ok) {
      showToast(mensajeDeError(resultado), 'error')
      return false
    }
    const evento = {
      id: crypto.randomUUID(),
      fecha: formatearFecha(new Date().toISOString()),
      autorId: state.currentUser?.id ?? '',
      ...opciones.evento,
    }
    dispatch({ type: 'UPSERT_DOCUMENTO', documento: { ...doc, historial: [...(doc.historial || []), evento] } })
    return true
  }

  // Los comentarios se guardan aparte del documento: también se puede comentar uno aprobado.
  async function comentar(seccionId: string, texto: string): Promise<boolean> {
    if (!documento) return false
    const resultado = await servicioEscritura.comentarDocumento(state.currentUser?.consultoriaId ?? null, documento, seccionId, texto)
    if (!resultado.ok) {
      showToast(mensajeDeError(resultado), 'error')
      return false
    }
    dispatch({ type: 'UPSERT_DOCUMENTO', documento: { ...documento, comentarios: [...(documento.comentarios || []), resultado.valor] } })
    return true
  }

  async function guardarBorrador() {
    if (!documento) return
    const guardado = await persistir(
      { ...documento, estado: 'Borrador' },
      { evento: { accion: 'Borrador guardado', detalle: 'Cambios guardados.' } },
    )
    if (guardado) showToast('Borrador guardado.', 'success')
  }

  async function enviarRevision() {
    if (!documento) return
    const faltantes: string[] = []
    if (!documento.codigo?.trim() || documento.codigo.includes(PENDIENTE)) faltantes.push('Código')
    if (!documento.nombre.trim()) faltantes.push('Título')
    if (!documento.empresaId) faltantes.push('Empresa')
    if (!documento.proyectoId) faltantes.push('Proyecto')
    if (!documento.creadoPorId) faltantes.push('Elaborador')
    if (!documento.motivoCambio?.trim()) faltantes.push('Motivo de creación o cambio')
    if (!documento.secciones?.length) faltantes.push('Secciones')
    if (documento.secciones?.some((seccion) =>
      seccion.tipo === 'tabla'
        ? !seccion.filas?.length || seccion.filas.some((fila) => fila.some((celda) => !celda.trim()))
        : !seccion.contenido.trim() || seccion.contenido.includes(PENDIENTE)
    )) {
      faltantes.push('Información pendiente de confirmar')
    }
    setErrores(faltantes)
    if (faltantes.length) return
    const motivo = documento.motivoCambio || 'Envío a revisión'
    // La instantánea de una versión ya enviada no se pisa: si esta versión ya se envió
    // (p. ej. tras una corrección), el reenvío usa la versión siguiente.
    const version = versionParaEnviar(documento)
    const snapshot: VersionDocumento = {
      version,
      fecha: formatearFecha(new Date().toISOString()),
      autorId: state.currentUser?.id ?? '',
      comentario: motivo,
      motivo,
      secciones: documento.secciones?.map((seccion) => ({ ...seccion, filas: seccion.filas?.map((fila) => [...fila]) })),
      estado: 'Pendiente de revisión',
    }
    const enviado = await persistir(
      {
        ...documento,
        version,
        estado: 'Pendiente de revisión',
        historialVersiones: [...documento.historialVersiones.filter((item) => item.version !== snapshot.version), snapshot],
      },
      {
        version: { version, comentario: motivo, motivo },
        evento: { accion: 'Enviado a revisión', detalle: `Versión ${version}.` },
      },
    )
    if (enviado) showToast('Documento enviado al flujo de revisión.', 'success')
  }

  // Mientras está en revisión el contenido está congelado: para editarlo se retira de la revisión
  // (queda en el historial) y, al reenviarlo, sale como versión nueva.
  async function retirarRevision() {
    if (!documento) return
    const resultado = await servicioEscritura.retirarDocumento(documento.id)
    if (!resultado.ok) {
      showToast(mensajeDeError(resultado), 'error')
      return
    }
    const evento = {
      id: crypto.randomUUID(),
      fecha: formatearFecha(new Date().toISOString()),
      autorId: state.currentUser?.id ?? '',
      accion: 'Documento retirado de revisión',
      detalle: `Versión ${documento.version}.`,
    }
    dispatch({
      type: 'UPSERT_DOCUMENTO',
      documento: {
        ...documento,
        estado: 'Borrador',
        historialVersiones: documento.historialVersiones.map((item) =>
          item.version === documento.version ? { ...item, estado: 'Borrador' } : item
        ),
        historial: [...(documento.historial || []), evento],
      },
    })
    showToast('Documento retirado de la revisión. Ya puedes editarlo.', 'success')
  }

  async function nuevaVersion() {
    if (!documento) return
    const nueva: Documento = {
      ...documento,
      id: crypto.randomUUID(),
      version: siguienteVersion(documento.version),
      estado: 'Borrador',
      bloqueado: false,
      aprobadoPorId: undefined,
      fechaAprobacion: undefined,
      fechaRevision: undefined,
      motivoCambio: '',
      comentarios: [],
      // Cada versión es un registro propio: arranca sin instantáneas ni eventos.
      historialVersiones: [],
      historial: [],
    }
    const creada = await persistir(nueva, {
      evento: { accion: 'Nueva versión creada', detalle: `Derivada de la versión ${documento.version}.` },
    })
    if (!creada) return
    setDocumentoId(nueva.id)
    showToast(`Versión ${nueva.version} creada como borrador.`, 'success')
  }

  function abrirDocumento(item: Documento) {
    const proyecto = getProyecto(item.proyectoId)
    const normalizado: Documento = {
      ...item,
      codigo: item.codigo || PENDIENTE,
      empresaId: item.empresaId || proyecto?.empresaId,
      categoria: item.categoria || 'B',
      secciones: item.secciones || [{
        id: `sec-${item.id}`,
        titulo: 'Contenido disponible',
        contenido: PENDIENTE,
        tipo: 'texto',
      }],
      evidenciasVinculadas: item.evidenciasVinculadas || [],
      comentarios: item.comentarios || [],
      historial: item.historial || [],
      bloqueado: item.bloqueado ?? item.estado === 'Aprobado',
    }
    dispatch({ type: 'UPSERT_DOCUMENTO', documento: normalizado })
    setDocumentoId(item.id)
    setVista('editor')
  }

  async function exportar(formato: 'pdf' | 'word') {
    if (!documento) return
    const proyecto = getProyecto(documento.proyectoId)
    const empresa = getEmpresa(documento.empresaId || proyecto?.empresaId || '')
    const modelo = armarModelo(documento, { organizacion: empresa?.nombreComercial || empresa?.nombre, proyecto: proyecto?.nombre })
    const nombre = nombreArchivo(modelo, formato === 'pdf' ? 'pdf' : 'docx')
    setExportando(formato)
    try {
      descargar(formato === 'pdf' ? await generarPdf(modelo) : await generarWord(modelo), nombre)
      showToast(`Se descargó ${nombre}.`, 'success')
    } catch {
      showToast('No se pudo generar el archivo. Intenta de nuevo.', 'error')
    } finally {
      setExportando(null)
    }
  }

  if (vista === 'editor' && documento) {
    return (
      <EditorDocumento
        documento={documento}
        referenciaNormativa={documento.referenciaNormativa || getProyecto(documento.proyectoId)?.edicionNorma || 'ISO 9001:2026'}
        actualizar={actualizar}
        volver={() => { setVista('lista'); setErrores([]) }}
        guardar={guardarBorrador}
        enviar={enviarRevision}
        retirar={retirarRevision}
        nuevaVersion={nuevaVersion}
        errores={errores}
        evidencias={state.evidencias.filter((item) => item.proyectoId === documento.proyectoId)}
        usuarioId={state.currentUser?.id ?? ''}
        comentarioSeccion={comentarioSeccion}
        setComentarioSeccion={setComentarioSeccion}
        comentarioTexto={comentarioTexto}
        setComentarioTexto={setComentarioTexto}
        comentar={comentar}
        exportar={exportar}
        exportando={exportando}
        soloLectura={!puedeRedactarDocumentos(state.currentRole)}
        abrirComparacion={() => {
          const versiones = documento.historialVersiones
          setVersionA(versiones[0]?.version || '')
          setVersionB(versiones.at(-1)?.version || '')
          setCompararOpen(true)
        }}
      >
        <Comparador
          open={compararOpen}
          onClose={() => setCompararOpen(false)}
          documento={documento}
          versionA={versionA}
          versionB={versionB}
          setVersionA={setVersionA}
          setVersionB={setVersionB}
          getUsuario={getUsuario}
        />
      </EditorDocumento>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Flujo E</p>
          <h2 className="mt-1 text-xl font-bold text-navy">Documentación del SGC</h2>
          <p className="mt-1 text-sm text-slate-500">Control de borradores, versiones y documentos aprobados.</p>
        </div>
        {state.currentRole !== 'Usuario Cliente' && <Button onClick={() => setGeneradorOpen(true)} icon={<FilePlus2 className="h-4 w-4" />}>Generar borrador</Button>}
      </div>

      <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="font-semibold text-blue-900">Categorías documentales</p>
        <p className="mt-1 text-sm text-blue-700">No todos los documentos son obligatorios. Cada organización determina cuáles necesita según su contexto, procesos, riesgos y requisitos aplicables.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {CATEGORIAS.map((categoria) => <div key={categoria.id} className="rounded-lg border border-blue-100 bg-white p-3"><p className="text-sm font-semibold text-slate-800">({categoria.id}) {categoria.titulo}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{categoria.elementos}</p></div>)}
        </div>
      </div>

      <div className="mb-4 grid gap-2 rounded-xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <select className={inputClass} value={filtros.empresa} onChange={(event) => setFiltros({ ...filtros, empresa: event.target.value, proyecto: '' })}><option value="">Empresa</option>{empresasDisponibles.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
        <select className={inputClass} value={filtros.proyecto} onChange={(event) => setFiltros({ ...filtros, proyecto: event.target.value })}><option value="">Proyecto</option>{proyectosDisponibles.filter((item) => !filtros.empresa || item.empresaId === filtros.empresa).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
        <select className={inputClass} value={filtros.tipo} onChange={(event) => setFiltros({ ...filtros, tipo: event.target.value })}><option value="">Tipo</option>{[...new Set(documentosDisponibles.map((item) => item.tipo))].map((item) => <option key={item}>{item}</option>)}</select>
        <select className={inputClass} value={filtros.estado} onChange={(event) => setFiltros({ ...filtros, estado: event.target.value })}><option value="">Estado</option>{estadosVisiblesParaRol(state.currentRole).map((item) => <option key={item}>{item}</option>)}</select>
        <select className={inputClass} value={filtros.responsable} onChange={(event) => setFiltros({ ...filtros, responsable: event.target.value })}><option value="">Responsable</option>{[...new Set(documentosDisponibles.map((item) => item.creadoPorId))].map((id) => <option key={id} value={id}>{getUsuario(id)?.nombre || id}</option>)}</select>
        <input type="date" className={inputClass} value={filtros.desde} onChange={(event) => setFiltros({ ...filtros, desde: event.target.value })} aria-label="Fecha inicial" />
        <input type="date" className={inputClass} value={filtros.hasta} onChange={(event) => setFiltros({ ...filtros, hasta: event.target.value })} aria-label="Fecha final" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="min-w-[1500px] w-full text-sm">
          <thead><tr className="border-b border-line bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">{['Código', 'Título', 'Tipo', 'Empresa', 'Proyecto', 'Referencia normativa', 'Proceso', 'Elaborador', 'Creación', 'Versión', 'Estado', 'Revisión', 'Aprobador'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
          <tbody>{documentos.map((item) => {
            const proyecto = getProyecto(item.proyectoId)
            const empresa = getEmpresa(item.empresaId || proyecto?.empresaId || '')
            const proceso = state.procesos.find((procesoItem) => procesoItem.id === item.procesoId)
            return <tr key={item.id} onClick={() => abrirDocumento(item)} className="cursor-pointer border-b border-line last:border-0 hover:bg-blue-50/40"><td className="px-4 py-3 font-mono text-xs text-blue-600">{item.codigo || PENDIENTE}</td><td className="max-w-64 px-4 py-3 font-medium text-slate-800">{item.nombre}</td><td className="px-4 py-3">{item.tipo}</td><td className="px-4 py-3">{empresa?.nombreComercial || empresa?.nombre || '—'}</td><td className="max-w-52 truncate px-4 py-3">{proyecto?.nombre || '—'}</td><td className="whitespace-nowrap px-4 py-3">{item.referenciaNormativa || proyecto?.edicionNorma || '—'}</td><td className="px-4 py-3">{proceso?.nombre || '—'}</td><td className="px-4 py-3">{getUsuario(item.creadoPorId)?.nombre || '—'}</td><td className="px-4 py-3">{item.fechaCreacion}</td><td className="px-4 py-3">{item.version}</td><td className="px-4 py-3"><StatusBadge status={item.estado} size="sm" /></td><td className="px-4 py-3">{item.fechaRevision || (item.revisadoPorId ? getUsuario(item.revisadoPorId)?.nombre : '—')}</td><td className="px-4 py-3">{item.aprobadoPorId ? getUsuario(item.aprobadoPorId)?.nombre : '—'}</td></tr>
          })}</tbody>
        </table>
      </div>

      <Modal open={generadorOpen} onClose={() => setGeneradorOpen(false)} title="Generar borrador documental" size="lg" footer={<><Button variant="outline" onClick={() => setGeneradorOpen(false)}>Cancelar</Button><Button onClick={generar} disabled={generandoIA || !generador.empresaId || !generador.proyectoId || (plantillaElegida?.requiereProceso && !generador.procesoId) || !generador.codigo.trim() || !generador.titulo.trim()}>{generandoIA ? 'Redactando con IA…' : 'Generar borrador'}</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={labelClass}>Empresa *</span><select className={inputClass} value={generador.empresaId} onChange={(event) => setGenerador({ ...GENERADOR_VACIO, empresaId: event.target.value })}><option value="">Selecciona</option>{state.empresas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
          <label><span className={labelClass}>Proyecto *</span><select className={inputClass} value={generador.proyectoId} disabled={!generador.empresaId} onChange={(event) => { const proyecto = state.proyectos.find((item) => item.id === event.target.value); setGenerador({ ...generador, proyectoId: event.target.value, procesoId: '', edicionNorma: proyecto?.edicionNorma || 'ISO 9001:2026' }) }}><option value="">Selecciona</option>{proyectosGenerador.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
          <label><span className={labelClass}>Referencia normativa *</span><select className={inputClass} value={generador.edicionNorma} disabled={Boolean(generador.proyectoId)} onChange={(event) => setGenerador({ ...generador, edicionNorma: event.target.value as Generador['edicionNorma'] })}><option value="ISO 9001:2026">ISO 9001:2026 (vigente)</option><option value="ISO 9001:2015">ISO 9001:2015 (en transición)</option></select></label>
          <label><span className={labelClass}>Plantilla *</span><select className={inputClass} value={generador.plantilla} onChange={(event) => elegirPlantilla(event.target.value)}>{PLANTILLAS.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
          <label><span className={labelClass}>Tipo de documento</span><input className={inputClass} value={plantillaElegida?.tipoDocumento ?? ''} disabled readOnly /></label>
          {plantillaElegida?.requiereProceso && <label><span className={labelClass}>Proceso *</span><select className={inputClass} value={generador.procesoId} disabled={!generador.proyectoId} onChange={(event) => setGenerador({ ...generador, procesoId: event.target.value })}><option value="">Selecciona</option>{procesosGenerador.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>}
          <label><span className={labelClass}>Código *</span><input className={inputClass} value={generador.codigo} onChange={(event) => setGenerador({ ...generador, codigo: event.target.value })} placeholder={`Ej. ${plantillaElegida?.codigoBase ?? 'PR-COM-01'}`} /></label>
          <label className="sm:col-span-2"><span className={labelClass}>Título *</span><input className={inputClass} value={generador.titulo} onChange={(event) => setGenerador({ ...generador, titulo: event.target.value })} /></label>
          {generador.edicionNorma === 'ISO 9001:2015' && <p className="sm:col-span-2 text-xs text-amber-700">Este proyecto usa la edición ISO 9001:2015 (en transición).</p>}
          {plantillaElegida?.preguntas && (
            <fieldset className="sm:col-span-2 space-y-3 rounded-lg border border-line p-4">
              <legend className="px-1 text-sm font-semibold text-slate-700">Cuestionario guiado (opcional)</legend>
              <p className="text-xs text-slate-500">Lo que contestes se vuelca en el borrador. Lo que dejes en blanco queda como “{PENDIENTE}”.</p>
              {plantillaElegida.preguntas.map((pregunta) => (
                <label key={pregunta.id} className="block">
                  <span className={labelClass}>{pregunta.texto}</span>
                  <textarea rows={2} className={inputClass} value={generador.respuestas[pregunta.id] ?? ''} onChange={(event) => setGenerador({ ...generador, respuestas: { ...generador.respuestas, [pregunta.id]: event.target.value } })} />
                </label>
              ))}
            </fieldset>
          )}
          {camposIA(plantillaElegida?.id ?? '').length > 0 && (
            <label className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={generador.usarIA && !estadoUsoIA?.agotado}
                disabled={!!estadoUsoIA?.agotado}
                onChange={(event) => setGenerador({ ...generador, usarIA: event.target.checked })}
              />
              <span>
                <span className="font-medium">Redactar con IA</span> la declaración y las propuestas a partir de tus respuestas.{' '}
                Es un borrador: requiere tu revisión. Si la IA no responde, el documento se genera igual con tus respuestas.
              </span>
            </label>
          )}
          {camposIA(plantillaElegida?.id ?? '').length > 0 && (
            <div className="sm:col-span-2">
              <IndicadorUsoIA uso={usoIA} estado={estadoUsoIA} />
              {estadoUsoIA?.agotado && <p className="mt-1 text-xs text-slate-500">El documento se generará igual, con tus respuestas y sin IA.</p>}
            </div>
          )}
          <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">La plantilla se precargará exclusivamente con información existente. Los datos ausentes se marcarán como “{PENDIENTE}”.</div>
        </div>
      </Modal>
    </div>
  )
}

interface EditorProps {
  documento: Documento
  referenciaNormativa: NonNullable<Documento['referenciaNormativa']>
  actualizar: (updates: Partial<Documento>) => void
  volver: () => void
  guardar: () => void
  enviar: () => void
  retirar: () => void
  nuevaVersion: () => void
  errores: string[]
  evidencias: ReturnType<typeof useApp>['state']['evidencias']
  usuarioId: string
  comentarioSeccion: string
  setComentarioSeccion: (value: string) => void
  comentarioTexto: string
  setComentarioTexto: (value: string) => void
  // Guarda el comentario en la BD; devuelve true si se guardó.
  comentar: (seccionId: string, texto: string) => Promise<boolean>
  abrirComparacion: () => void
  // Exporta lo que se ve en pantalla (incluye ediciones sin guardar).
  exportar: (formato: 'pdf' | 'word') => Promise<void>
  exportando: 'pdf' | 'word' | null
  // El cliente ve el documento pero no lo redacta (ver puedeRedactarDocumentos).
  soloLectura: boolean
  children: React.ReactNode
}

function EditorDocumento(props: EditorProps) {
  const { documento, actualizar } = props
  const bloqueado = documento.bloqueado || documento.estado === 'Aprobado'
  // En revisión el contenido está congelado (AUD02-H1): se sale con "Retirar de revisión".
  const enRevision = documento.estado === 'Pendiente de revisión'
  // Contenido: no se edita si el documento está bloqueado, en revisión o si quien lo ve no redacta (cliente).
  // Los comentarios siguen su propia regla (`bloqueado`): el cliente sí puede comentar.
  const edicionBloqueada = !contenidoEditable(documento) || props.soloLectura

  function actualizarSeccion(id: string, updates: Partial<SeccionDocumento>) {
    actualizar({ secciones: documento.secciones?.map((item) => item.id === id ? { ...item, ...updates } : item) })
  }

  function agregarSeccion(tipo: 'texto' | 'tabla') {
    actualizar({
      secciones: [...(documento.secciones || []), {
        id: `sec-${Date.now()}`,
        titulo: '',
        contenido: '',
        tipo,
        filas: tipo === 'tabla' ? [['', '']] : undefined,
      }],
    })
  }

  async function agregarComentario() {
    if (!props.comentarioSeccion || !props.comentarioTexto.trim()) return
    if (await props.comentar(props.comentarioSeccion, props.comentarioTexto)) props.setComentarioTexto('')
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="sticky top-14 z-10 mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="font-semibold">Documento preliminar. Requiere revisión y aprobación de los responsables autorizados antes de su uso oficial.</p>
      </div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={props.volver} icon={<ArrowLeft className="h-4 w-4" />}>Volver al listado</Button>
          <div className="mt-2 flex items-center gap-2"><StatusBadge status={documento.estado} /><span className="text-xs text-slate-400">{documento.codigo} · Versión {documento.version}</span></div>
          <h2 className="mt-2 text-xl font-bold text-navy">{documento.nombre}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={props.abrirComparacion} disabled={documento.historialVersiones.length < 1} icon={<Columns2 className="h-4 w-4" />}>Comparar versiones</Button>
          <Button variant="outline" onClick={() => props.exportar('pdf')} disabled={props.exportando !== null}>{props.exportando === 'pdf' ? 'Generando PDF…' : 'Exportar PDF'}</Button>
          <Button variant="outline" onClick={() => props.exportar('word')} disabled={props.exportando !== null}>{props.exportando === 'word' ? 'Generando Word…' : 'Exportar Word'}</Button>
          {props.soloLectura ? null : bloqueado ? <Button onClick={props.nuevaVersion} icon={<FilePlus2 className="h-4 w-4" />}>Crear nueva versión</Button> : enRevision ? <Button variant="outline" onClick={props.retirar} icon={<Undo2 className="h-4 w-4" />}>Retirar de revisión</Button> : <><Button variant="outline" onClick={props.guardar} icon={<Save className="h-4 w-4" />}>Guardar borrador</Button><Button onClick={props.enviar} icon={<Send className="h-4 w-4" />}>Enviar a revisión</Button></>}
        </div>
      </div>

      {props.soloLectura && <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Estás viendo este documento en modo lectura. Puedes comentarlo y exportarlo; para aprobarlo o pedir correcciones usa «Revisiones y aprobaciones».</div>}
      {enRevision && !props.soloLectura && <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Este documento está en revisión y su contenido está congelado. Para editarlo, retíralo de la revisión: al reenviarlo saldrá como una versión nueva.</div>}
      {bloqueado && !props.soloLectura && <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">La versión aprobada está bloqueada para edición directa. Crea una nueva versión para realizar cambios.</div>}
      {props.errores.length > 0 && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><p className="font-semibold">No se puede enviar a revisión:</p><p>{props.errores.join(', ')}.</p></div>}
      {/* La IA lee el documento desde la BD: analiza la última versión GUARDADA. */}
      <details className="mb-5">
        <summary className="cursor-pointer text-sm font-medium text-violet-700">Preevaluación con IA · analiza la última versión guardada</summary>
        <div className="mt-3">
          <PanelAnalisisIA key={documento.id} fuente={{ tipo: 'documento', id: documento.id, proyectoId: documento.proyectoId, nombre: documento.nombre }} tipoDocumento={documento.tipo} />
        </div>
      </details>
      <div className="mb-5 grid gap-4 rounded-xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label><span className={labelClass}>Código documental *</span><input disabled={edicionBloqueada} className={inputClass} value={documento.codigo || ''} onChange={(event) => actualizar({ codigo: event.target.value })} /></label>
        <label><span className={labelClass}>Referencia normativa</span><input disabled className={inputClass} value={props.referenciaNormativa} /></label>
        <label><span className={labelClass}>Título *</span><input disabled={edicionBloqueada} className={inputClass} value={documento.nombre} onChange={(event) => actualizar({ nombre: event.target.value })} /></label>
        {props.referenciaNormativa === 'ISO 9001:2015' && <p className="sm:col-span-2 lg:col-span-3 text-xs text-amber-700">Este proyecto usa la edición ISO 9001:2015 (en transición).</p>}
        <label className="sm:col-span-2 lg:col-span-3"><span className={labelClass}>Motivo de creación o cambio</span><input disabled={edicionBloqueada} className={inputClass} value={documento.motivoCambio || ''} onChange={(event) => actualizar({ motivoCambio: event.target.value })} placeholder="Describe brevemente el motivo de esta versión." /></label>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-4">
          {(documento.secciones || []).map((seccion, index) => (
            <section key={seccion.id} className="rounded-xl border border-line bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">{index + 1}</span>
                <input disabled={edicionBloqueada} value={seccion.titulo} onChange={(event) => actualizarSeccion(seccion.id, { titulo: event.target.value })} className="flex-1 border-0 bg-transparent text-base font-semibold text-slate-800 outline-none" placeholder="Título de la sección" />
                {!edicionBloqueada && <Button variant="ghost" size="sm" onClick={() => actualizar({ secciones: documento.secciones?.filter((item) => item.id !== seccion.id) })} aria-label="Eliminar sección" icon={<Trash2 className="h-4 w-4 text-red-500" />} />}
              </div>
              {seccion.tipo === 'texto' ? <textarea disabled={edicionBloqueada} rows={5} value={seccion.contenido} onChange={(event) => actualizarSeccion(seccion.id, { contenido: event.target.value })} className={`${inputClass} leading-relaxed ${seccion.contenido.includes(PENDIENTE) ? 'border-amber-300 bg-amber-50' : ''}`} /> : <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{(seccion.filas || []).map((fila, filaIndex) => <tr key={filaIndex}>{fila.map((celda, columnaIndex) => <td key={columnaIndex} className="border border-line p-1"><input disabled={edicionBloqueada} value={celda} onChange={(event) => { const filas = seccion.filas?.map((item) => [...item]) || []; filas[filaIndex][columnaIndex] = event.target.value; actualizarSeccion(seccion.id, { filas }) }} className="w-full px-2 py-1 outline-none" placeholder={PENDIENTE} /></td>)}</tr>)}</tbody></table>{!edicionBloqueada && <Button variant="ghost" size="sm" className="mt-2" onClick={() => actualizarSeccion(seccion.id, { filas: [...(seccion.filas || []), Array(seccion.filas?.[0]?.length || 2).fill('')] })} icon={<Plus className="h-4 w-4" />}>Agregar fila</Button>}</div>}
              {(documento.comentarios || []).filter((item) => item.seccionId === seccion.id).map((item) => <div key={item.id} className="mt-3 flex gap-2 rounded-lg bg-violet-50 p-3 text-xs text-violet-800"><MessageSquare className="h-4 w-4 shrink-0" /><span>{item.texto}</span></div>)}
            </section>
          ))}
          {!edicionBloqueada && <div className="flex gap-2"><Button variant="outline" onClick={() => agregarSeccion('texto')} icon={<Plus className="h-4 w-4" />}>Agregar sección</Button><Button variant="outline" onClick={() => agregarSeccion('tabla')} icon={<Table2 className="h-4 w-4" />}>Agregar tabla</Button></div>}
        </main>

        <aside className="space-y-4">
          <div className="rounded-xl border border-line bg-white p-4"><p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><Link2 className="h-4 w-4" />Evidencias vinculadas</p><div className="max-h-56 space-y-2 overflow-y-auto">{props.evidencias.length === 0 ? <p className="text-xs text-slate-400">No hay evidencias del proyecto.</p> : props.evidencias.map((item) => <label key={item.id} className="flex items-start gap-2 rounded-lg border border-line p-2 text-xs"><input disabled={edicionBloqueada} type="checkbox" checked={documento.evidenciasVinculadas?.includes(item.id)} onChange={(event) => actualizar({ evidenciasVinculadas: event.target.checked ? [...(documento.evidenciasVinculadas || []), item.id] : documento.evidenciasVinculadas?.filter((id) => id !== item.id) })} /><span>{item.nombre}</span></label>)}</div></div>
          <div className="rounded-xl border border-line bg-white p-4"><p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><MessageSquare className="h-4 w-4" />Agregar comentario</p><select disabled={bloqueado} className={inputClass} value={props.comentarioSeccion} onChange={(event) => props.setComentarioSeccion(event.target.value)}><option value="">Selecciona una sección</option>{documento.secciones?.map((item) => <option key={item.id} value={item.id}>{item.titulo || 'Sin título'}</option>)}</select><textarea disabled={bloqueado} rows={3} className={`${inputClass} mt-2`} value={props.comentarioTexto} onChange={(event) => props.setComentarioTexto(event.target.value)} placeholder="Escribe un comentario anclado..." /><Button disabled={bloqueado || !props.comentarioSeccion || !props.comentarioTexto.trim()} className="mt-2 w-full" size="sm" onClick={agregarComentario}>Agregar comentario</Button></div>
          <div className="rounded-xl border border-line bg-white p-4"><p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><History className="h-4 w-4" />Historial completo</p><div className="space-y-3">{(documento.historial || []).length === 0 ? <p className="text-xs text-slate-400">Sin eventos registrados.</p> : documento.historial?.slice().reverse().map((item) => <div key={item.id} className="border-l-2 border-blue-200 pl-3"><p className="text-xs font-medium text-slate-700">{item.accion}</p><p className="mt-0.5 text-[10px] text-slate-400">{item.fecha}</p><p className="mt-1 text-xs text-slate-500">{item.detalle}</p></div>)}</div></div>
        </aside>
      </div>
      {props.children}
    </div>
  )
}

function Comparador({ open, onClose, documento, versionA, versionB, setVersionA, setVersionB, getUsuario }: {
  open: boolean
  onClose: () => void
  documento: Documento
  versionA: string
  versionB: string
  setVersionA: (value: string) => void
  setVersionB: (value: string) => void
  getUsuario: ReturnType<typeof useApp>['getUsuario']
}) {
  const a = documento.historialVersiones.find((item) => item.version === versionA)
  const b = documento.historialVersiones.find((item) => item.version === versionB)
  return <Modal open={open} onClose={onClose} title="Comparación de versiones" size="xl"><div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><select className={inputClass} value={versionA} onChange={(event) => setVersionA(event.target.value)}>{documento.historialVersiones.map((item) => <option key={item.version}>{item.version}</option>)}</select><select className={inputClass} value={versionB} onChange={(event) => setVersionB(event.target.value)}>{documento.historialVersiones.map((item) => <option key={item.version}>{item.version}</option>)}</select></div><div className="grid gap-4 lg:grid-cols-2"><VersionPanel version={a} otra={b} getUsuario={getUsuario} /><VersionPanel version={b} otra={a} getUsuario={getUsuario} /></div></div></Modal>
}

function VersionPanel({ version, otra, getUsuario }: { version?: VersionDocumento; otra?: VersionDocumento; getUsuario: ReturnType<typeof useApp>['getUsuario'] }) {
  if (!version) return <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-slate-400">Selecciona una versión.</div>
  return <div className="rounded-xl border border-line"><div className="border-b border-line bg-slate-50 p-4"><p className="font-semibold">Versión {version.version}</p><p className="mt-1 text-xs text-slate-400">{version.fecha} · {getUsuario(version.autorId)?.nombre || version.autorId}</p><p className="mt-1 text-xs text-slate-500">Motivo: {version.motivo || version.comentario}</p></div><div className="space-y-3 p-4">{version.secciones?.length ? version.secciones.map((seccion) => { const comparada = otra?.secciones?.find((item) => item.titulo === seccion.titulo); const cambio = comparada?.contenido !== seccion.contenido; return <div key={seccion.id} className={`rounded-lg border p-3 ${cambio ? 'border-amber-300 bg-amber-50' : 'border-line'}`}><p className="text-xs font-semibold text-slate-700">{seccion.titulo}</p><p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{seccion.contenido}</p>{cambio && <p className="mt-2 text-[10px] font-semibold uppercase text-amber-700">Cambio detectado</p>}</div> }) : <p className="text-sm text-slate-400">Esta versión histórica no contiene una instantánea de secciones.</p>}</div></div>
}

function fechaISO(fecha: string) {
  const [dia, mes, anio] = fecha.split('/')
  return anio && mes && dia ? `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}` : fecha
}
