import { useRef, useState } from "react"
import {
  Camera,
  File,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Mic,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react"
import { useApp } from "../context/AppContext"
import { servicioArchivos, servicioEscritura } from "../lib/servicios"
import { mensajeDeError } from "../lib/escrituras"
import { formatearFecha } from "../lib/datos"
import { Button } from "../components/ui/Button"
import { Modal } from "../components/ui/Modal"
import { ProgressBar } from "../components/ui/ProgressBar"
import { PanelAnalisisIA } from "../components/PanelAnalisisIA"
import type { EstadoEvidencia, Evidencia, TipoEvidencia } from "../types"

const ESTADOS: EstadoEvidencia[] = [
  "Pendiente",
  "Revisada",
  "Aceptada",
  "Requiere corrección",
]
const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700"

interface Formulario {
  nombre: string
  descripcion: string
  empresaId: string
  proyectoId: string
  procesoId: string
  actividadId: string
  categoria: string
}

const FORM_VACIO: Formulario = {
  nombre: "",
  descripcion: "",
  empresaId: "",
  proyectoId: "",
  procesoId: "",
  actividadId: "",
  categoria: "",
}

function tipoArchivo(file: globalThis.File): TipoEvidencia {
  if (file.type.startsWith("image/")) return "Foto"
  if (file.type.startsWith("video/")) return "Video"
  if (file.type.startsWith("audio/")) return "Audio"
  return "Documento"
}

function IconoTipo({ tipo }: { tipo: TipoEvidencia }) {
  const Icon =
    tipo === "Foto"
      ? FileImage
      : tipo === "Video"
        ? FileVideo
        : tipo === "Audio"
          ? FileAudio
          : FileText
  return <Icon className="h-6 w-6" />
}

export default function Evidencias() {
  const { state, dispatch, getUsuario, showToast } = useApp()
  const [modalCaptura, setModalCaptura] = useState(false)
  const [form, setForm] = useState<Formulario>(FORM_VACIO)
  const [archivo, setArchivo] = useState<globalThis.File | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState<Evidencia | null>(null)
  const [progreso, setProgreso] = useState(0)
  const [estadoCarga, setEstadoCarga] =
    useState<"idle" | "uploading" | "error">("idle")
  const [errorCarga, setErrorCarga] = useState("")
  const [grabando, setGrabando] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [filtroTipo, setFiltroTipo] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("")
  const [filtroProyecto, setFiltroProyecto] = useState("")
  const timerRef = useRef<number | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const usuarioSesion = state.usuarios.find((item) => item.email === state.currentUser?.email)
  const usuarioCliente = usuarioSesion?.empresaId ? usuarioSesion : state.usuarios.find((item) => item.rol === "Usuario Cliente" && item.activo)
  const empresaClienteId = state.currentRole === "Usuario Cliente" ? usuarioCliente?.empresaId : undefined
  const empresasDisponibles = state.empresas.filter((item) => !empresaClienteId || item.id === empresaClienteId)
  const proyectosDisponibles = state.proyectos.filter((item) => !empresaClienteId || item.empresaId === empresaClienteId)
  const proyectoIdsDisponibles = new Set(proyectosDisponibles.map((item) => item.id))
  const proyectos = proyectosDisponibles.filter(
    (proyecto) => !form.empresaId || proyecto.empresaId === form.empresaId,
  )
  const procesos = state.procesos.filter(
    (proceso) => !form.proyectoId || proceso.proyectoId === form.proyectoId,
  )
  const procesoSeleccionado = state.procesos.find(
    (proceso) => proceso.id === form.procesoId,
  )

  const evidencias = state.evidencias.filter((evidencia) => {
    if (!proyectoIdsDisponibles.has(evidencia.proyectoId)) return false
    const texto =
      `${evidencia.nombre} ${evidencia.descripcion} ${evidencia.categoria || ""}`.toLowerCase()
    if (busqueda && !texto.includes(busqueda.toLowerCase())) return false
    if (filtroTipo && evidencia.tipo !== filtroTipo) return false
    if (filtroEstado && evidencia.estado !== filtroEstado) return false
    if (filtroProyecto && evidencia.proyectoId !== filtroProyecto) return false
    return true
  })

  function seleccionarArchivo(file: globalThis.File | null) {
    if (!file) {
      setArchivo(null)
      setEstadoCarga("idle")
      setProgreso(0)
      setErrorCarga("")
      return
    }
    setArchivo(file)
    setForm((actual) => ({ ...actual, nombre: actual.nombre || file.name }))
    setEstadoCarga("idle")
    setProgreso(0)
    setErrorCarga("")
  }

  function cancelarCarga() {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
    setEstadoCarga("idle")
    setProgreso(0)
  }

  async function iniciarCarga() {
    if (
      !archivo ||
      !form.nombre.trim() ||
      !form.empresaId ||
      !form.proyectoId ||
      !form.procesoId ||
      !form.categoria
    ) {
      setErrorCarga("Completa los campos obligatorios y selecciona un archivo.")
      setEstadoCarga("error")
      return
    }
    // Aviso rápido en el navegador; el límite real lo aplica el bucket en el servidor.
    if (archivo.size > 25 * 1024 * 1024) {
      setErrorCarga(
        "El archivo supera el límite de 25 MB. Selecciona uno más pequeño e intenta de nuevo.",
      )
      setEstadoCarga("error")
      return
    }
    setEstadoCarga("uploading")
    setErrorCarga("")
    // supabase-js no informa progreso de subida: la barra indica "en curso", sin inventar porcentajes.
    setProgreso(30)

    const resultado = await servicioEscritura.subirEvidencia(
      {
        id: crypto.randomUUID(),
        consultoriaId: state.currentUser?.consultoriaId ?? null,
        empresaId: form.empresaId,
        proyectoId: form.proyectoId,
        procesoId: form.procesoId,
        actividadId: form.actividadId,
        nombre: form.nombre,
        descripcion: form.descripcion,
        categoria: form.categoria,
        autor: state.currentUser?.nombre ?? "",
      },
      archivo,
    )
    if (!resultado.ok) {
      setErrorCarga(mensajeDeError(resultado))
      setEstadoCarga("error")
      setProgreso(0)
      return
    }

    setProgreso(100)
    const [evidencia] = await servicioArchivos.firmarEvidencias([resultado.valor])
    dispatch({ type: "ADD_EVIDENCIA", evidencia })
    setModalCaptura(false)
    setForm(FORM_VACIO)
    setArchivo(null)
    setEstadoCarga("idle")
    setProgreso(0)
    showToast("Evidencia cargada.", "success")
  }

  async function alternarGrabacion() {
    if (grabando) {
      recorderRef.current?.stop()
      setGrabando(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data)
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        })
        seleccionarArchivo(
          new globalThis.File([blob], `grabacion-${Date.now()}.webm`, {
            type: blob.type,
          }),
        )
        stream.getTracks().forEach((track) => track.stop())
      }
      recorder.start()
      recorderRef.current = recorder
      setGrabando(true)
    } catch {
      setEstadoCarga("error")
      setErrorCarga(
        "No fue posible acceder al micrófono. Revisa los permisos del navegador o selecciona un archivo de audio.",
      )
    }
  }

  async function cambiarEstado(evidencia: Evidencia, estadoNuevo: EstadoEvidencia) {
    if (evidencia.estado === estadoNuevo) return
    const resultado = await servicioEscritura.revisarEvidencia(evidencia.id, estadoNuevo)
    if (!resultado.ok) {
      showToast(mensajeDeError(resultado), "error")
      return
    }
    // La BD ya registró el cambio en el historial; acá se refleja sin recargar.
    dispatch({
      type: "UPDATE_EVIDENCIA",
      id: evidencia.id,
      updates: {
        estado: estadoNuevo,
        historial: [
          ...(evidencia.historial || []),
          {
            id: crypto.randomUUID(),
            fecha: formatearFecha(new Date().toISOString()),
            autor: state.currentUser?.nombre ?? "",
            estadoAnterior: evidencia.estado,
            estadoNuevo,
          },
        ],
      },
    })
    setVistaPrevia((actual) =>
      actual?.id === evidencia.id ? { ...actual, estado: estadoNuevo } : actual,
    )
    showToast(`Estado actualizado a “${estadoNuevo}”.`, "success")
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            Flujo H
          </p>
          <h2 className="mt-1 text-xl font-bold text-navy">
            Galería de evidencias
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Archivos y referencias vinculados al levantamiento de procesos.
          </p>
        </div>
        <Button
          onClick={() => setModalCaptura(true)}
          icon={<Plus className="h-4 w-4" />}
        >
          Agregar evidencia
        </Button>
      </div>


      <div className="mb-5 grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className={`${inputClass} pl-9`}
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar evidencia..."
          />
        </label>
        <select
          className={inputClass}
          value={filtroProyecto}
          onChange={(event) => setFiltroProyecto(event.target.value)}
        >
          <option value="">Todos los proyectos</option>
          {proyectosDisponibles.map((proyecto) => (
            <option key={proyecto.id} value={proyecto.id}>
              {proyecto.nombre}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          value={filtroTipo}
          onChange={(event) => setFiltroTipo(event.target.value)}
        >
          <option value="">Todos los tipos</option>
          {["Foto", "Video", "Audio", "Documento", "Formulario"].map((tipo) => (
            <option key={tipo}>{tipo}</option>
          ))}
        </select>
        <select
          className={inputClass}
          value={filtroEstado}
          onChange={(event) => setFiltroEstado(event.target.value)}
        >
          <option value="">Todos los estados</option>
          {[...ESTADOS, "Cargada"].map((estado) => (
            <option key={estado}>{estado}</option>
          ))}
        </select>
      </div>

      {evidencias.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <File className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 font-medium text-slate-600">
            No hay evidencias para estos filtros
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {evidencias.map((evidencia) => (
            <article
              key={evidencia.id}
              className="overflow-hidden rounded-xl border border-line bg-white shadow-sm"
            >
              <button
                onClick={() => setVistaPrevia(evidencia)}
                className="flex h-32 w-full items-center justify-center bg-slate-50 text-slate-400"
              >
                {evidencia.archivoUrl && evidencia.tipo === "Foto" ? (
                  <img
                    src={evidencia.archivoUrl}
                    alt={evidencia.nombre}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <IconoTipo tipo={evidencia.tipo} />
                )}
              </button>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {evidencia.nombre}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {evidencia.tipo}
                      {evidencia.fechaCarga ? ` · ${evidencia.fechaCarga}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                    {evidencia.estado}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                  {evidencia.descripcion || "Sin descripción"}
                </p>
                <select
                  className="mt-3 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-xs"
                  disabled={state.currentRole === "Usuario Cliente"}
                  value={evidencia.estado}
                  onChange={(event) =>
                    cambiarEstado(
                      evidencia,
                      event.target.value as EstadoEvidencia,
                    )
                  }
                >
                  {ESTADOS.map((estado) => (
                    <option key={estado}>{estado}</option>
                  ))}
                  {evidencia.estado === "Cargada" && <option>Cargada</option>}
                </select>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={modalCaptura}
        onClose={() => {
          cancelarCarga()
          setModalCaptura(false)
        }}
        title="Capturar evidencia"
        size="xl"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                cancelarCarga()
                setModalCaptura(false)
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={iniciarCarga}
              disabled={estadoCarga === "uploading"}
              icon={<Upload className="h-4 w-4" />}
            >
              Guardar referencia
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={labelClass}>
                Empresa <span className="text-red-500">*</span>
              </span>
              <select
                className={inputClass}
                value={form.empresaId}
                onChange={(event) =>
                  setForm({ ...FORM_VACIO, empresaId: event.target.value })
                }
              >
                <option value="">Selecciona</option>
                {empresasDisponibles
                  .filter((empresa) => empresa.activa)
                  .map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nombre}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>
                Proyecto <span className="text-red-500">*</span>
              </span>
              <select
                className={inputClass}
                value={form.proyectoId}
                disabled={!form.empresaId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    proyectoId: event.target.value,
                    procesoId: "",
                    actividadId: "",
                  })
                }
              >
                <option value="">Selecciona</option>
                {proyectos.map((proyecto) => (
                  <option key={proyecto.id} value={proyecto.id}>
                    {proyecto.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>
                Proceso <span className="text-red-500">*</span>
              </span>
              <select
                className={inputClass}
                value={form.procesoId}
                disabled={!form.proyectoId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    procesoId: event.target.value,
                    actividadId: "",
                  })
                }
              >
                <option value="">Selecciona</option>
                {procesos.map((proceso) => (
                  <option key={proceso.id} value={proceso.id}>
                    {proceso.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Actividad</span>
              <select
                className={inputClass}
                value={form.actividadId}
                disabled={!procesoSeleccionado?.actividades?.length}
                onChange={(event) =>
                  setForm({ ...form, actividadId: event.target.value })
                }
              >
                <option value="">Sin vincular</option>
                {procesoSeleccionado?.actividades?.map((actividad) => (
                  <option key={actividad.id} value={actividad.id}>
                    {actividad.orden}. {actividad.descripcion}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>
                Nombre <span className="text-red-500">*</span>
              </span>
              <input
                className={inputClass}
                value={form.nombre}
                onChange={(event) =>
                  setForm({ ...form, nombre: event.target.value })
                }
              />
            </label>
            <label>
              <span className={labelClass}>
                Categoría <span className="text-red-500">*</span>
              </span>
              <select
                className={inputClass}
                value={form.categoria}
                onChange={(event) =>
                  setForm({ ...form, categoria: event.target.value })
                }
              >
                <option value="">Selecciona</option>
                <option>Entrevista</option>
                <option>Registro</option>
                <option>Instalaciones</option>
                <option>Operación</option>
                <option>Control</option>
                <option>Otro</option>
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>Descripción</span>
              <textarea
                rows={2}
                className={inputClass}
                value={form.descripcion}
                onChange={(event) =>
                  setForm({ ...form, descripcion: event.target.value })
                }
              />
            </label>
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
            <div className="flex flex-wrap justify-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Upload className="h-4 w-4" />
                Seleccionar archivo
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(event) =>
                    seleccionarArchivo(event.target.files?.[0] || null)
                  }
                />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Camera className="h-4 w-4" />
                Tomar foto
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) =>
                    seleccionarArchivo(event.target.files?.[0] || null)
                  }
                />
              </label>
              <Button
                variant={grabando ? "danger" : "outline"}
                onClick={alternarGrabacion}
                icon={
                  grabando ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )
                }
              >
                {grabando ? "Detener grabación" : "Grabar audio"}
              </Button>
            </div>
            {archivo && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-line bg-white p-3">
                <IconoTipo tipo={tipoArchivo(archivo)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{archivo.name}</p>
                  <p className="text-xs text-slate-400">
                    {(archivo.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => seleccionarArchivo(null)}
                  aria-label="Quitar archivo"
                >
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              </div>
            )}
          </div>

          {estadoCarga === "uploading" && (
            <div>
              <div className="mb-2 flex justify-between text-xs text-slate-500">
                <span>Preparando referencia local…</span>
                <button
                  onClick={cancelarCarga}
                  className="font-medium text-red-600"
                >
                  Cancelar
                </button>
              </div>
              <ProgressBar value={progreso} showLabel />
            </div>
          )}
          {estadoCarga === "error" && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <span>{errorCarga}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={iniciarCarga}
                icon={<RefreshCw className="h-4 w-4" />}
              >
                Reintentar
              </Button>
            </div>
          )}
          <p className="flex items-start gap-2 rounded-lg border border-line bg-slate-50 p-3 text-xs text-slate-600">
            <FileAudio className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Los audios y videos se pueden preevaluar con IA desde el detalle de la evidencia: se transcribe su audio con
              un servicio externo, así que el archivo sale de la plataforma.
            </span>
          </p>
        </div>
      </Modal>

      <Modal
        open={!!vistaPrevia}
        onClose={() => setVistaPrevia(null)}
        title={vistaPrevia?.nombre || "Vista previa"}
        size="xl"
      >
        {vistaPrevia && (
          <div className="space-y-5">
            <div className="flex min-h-52 items-center justify-center rounded-xl bg-slate-950 text-white">
              {!vistaPrevia.archivoUrl && (
                <div className="text-center text-slate-400">
                  <IconoTipo tipo={vistaPrevia.tipo} />
                  <p className="mt-2 text-xs">
                    Archivo de demostración sin contenido local disponible
                  </p>
                </div>
              )}
              {vistaPrevia.archivoUrl && vistaPrevia.tipo === "Foto" && (
                <img
                  src={vistaPrevia.archivoUrl}
                  alt={vistaPrevia.nombre}
                  className="max-h-96 max-w-full object-contain"
                />
              )}
              {vistaPrevia.archivoUrl && vistaPrevia.tipo === "Video" && (
                <video
                  src={vistaPrevia.archivoUrl}
                  controls
                  className="max-h-96 w-full"
                />
              )}
              {vistaPrevia.archivoUrl && vistaPrevia.tipo === "Audio" && (
                <audio
                  src={vistaPrevia.archivoUrl}
                  controls
                  className="w-4/5"
                />
              )}
              {vistaPrevia.archivoUrl &&
                !["Foto", "Video", "Audio"].includes(vistaPrevia.tipo) && (
                  <a
                    href={vistaPrevia.archivoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-300"
                  >
                    <Play className="h-4 w-4" />
                    Abrir archivo local
                  </a>
                )}
            </div>
            <div className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-400">Autor</p>
                <p>{vistaPrevia.autor || "No registrado"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Fecha</p>
                <p>
                  {vistaPrevia.fecha ||
                    vistaPrevia.fechaCarga ||
                    "No registrada"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Categoría</p>
                <p>{vistaPrevia.categoria || "Sin categoría"}</p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                Estado de revisión
              </p>
              <select
                className={inputClass}
                disabled={state.currentRole === "Usuario Cliente"}
                value={vistaPrevia.estado}
                onChange={(event) =>
                  cambiarEstado(
                    vistaPrevia,
                    event.target.value as EstadoEvidencia,
                  )
                }
              >
                {ESTADOS.map((estado) => (
                  <option key={estado}>{estado}</option>
                ))}
                {vistaPrevia.estado === "Cargada" && <option>Cargada</option>}
              </select>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                Historial
              </p>
              {(
                state.evidencias.find((item) => item.id === vistaPrevia.id)
                  ?.historial || []
              ).length === 0 ? (
                <p className="text-sm text-slate-400">
                  Sin cambios registrados.
                </p>
              ) : (
                <div className="space-y-2">
                  {state.evidencias
                    .find((item) => item.id === vistaPrevia.id)
                    ?.historial?.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-line p-3 text-xs"
                      >
                        <p className="font-medium text-slate-700">
                          {item.estadoAnterior
                            ? `${item.estadoAnterior} → `
                            : ""}
                          {item.estadoNuevo}
                        </p>
                        <p className="mt-1 text-slate-400">
                          {item.fecha} · {item.autor}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <PanelAnalisisIA
              key={vistaPrevia.id}
              fuente={{ tipo: "evidencia", id: vistaPrevia.id, proyectoId: vistaPrevia.proyectoId, nombre: vistaPrevia.nombre }}
              tipoEvidencia={vistaPrevia.tipo}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
