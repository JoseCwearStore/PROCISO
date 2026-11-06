import { useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  GripVertical,
  HelpCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react"
import { useApp } from "../context/AppContext"
import { servicioEscritura } from "../lib/servicios"
import { MENSAJES_ERROR_ESCRITURA } from "../lib/escrituras"
import { formatearFecha } from "../lib/datos"
import { Button } from "../components/ui/Button"
import { ConfirmDialog } from "../components/ui/ConfirmDialog"
import { Modal } from "../components/ui/Modal"
import { ProgressBar } from "../components/ui/ProgressBar"
import type { ActividadProceso, Proceso, TipoActividad } from "../types"

const PASOS = [
  "Identificación",
  "Entradas y salidas",
  "Recursos",
  "Controles y registros",
  "Indicadores",
  "Riesgos y problemas",
  "Observaciones y mejoras",
  "Secuencia",
  "Revisión final",
]

interface Borrador {
  id: string
  empresaId: string
  proyectoId: string
  nombre: string
  objetivo: string
  alcance: string
  responsableId: string
  puestoResponsable: string
  personalInvolucrado: string
  entradas: string
  salidas: string
  tieneProveedores: boolean
  proveedores: string
  clientes: string
  recursosMateriales: string
  equipos: string
  usaSistemas: boolean
  sistemas: string
  controles: string
  registros: string
  indicadores: string
  riesgos: string
  problemas: string
  observaciones: string
  mejoras: string
  noAplica: Record<string, string>
  actividades: ActividadProceso[]
}

const VACIO: Borrador = {
  id: "",
  empresaId: "",
  proyectoId: "",
  nombre: "",
  objetivo: "",
  alcance: "",
  responsableId: "",
  puestoResponsable: "",
  personalInvolucrado: "",
  entradas: "",
  salidas: "",
  tieneProveedores: true,
  proveedores: "",
  clientes: "",
  recursosMateriales: "",
  equipos: "",
  usaSistemas: true,
  sistemas: "",
  controles: "",
  registros: "",
  indicadores: "",
  riesgos: "",
  problemas: "",
  observaciones: "",
  mejoras: "",
  noAplica: {},
  actividades: [],
}

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-fg focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
const labelClass = "mb-1.5 block text-sm font-medium text-fg"

function lista(valor: string) {
  return valor
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
}

function Campo({
  label,
  value,
  onChange,
  required,
  help,
  multiline,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  help?: string
  multiline?: boolean
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className={labelClass}>
        {label} {required && <span className="text-red-500">*</span>}
        {help && (
          <span className="group relative ml-1 inline-flex align-middle">
            <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-56 -translate-x-1/2 rounded-lg bg-slate-800 p-2 text-xs font-normal text-white shadow-lg group-hover:block">
              {help}
            </span>
          </span>
        )}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className={inputClass}
          placeholder={placeholder}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
          placeholder={placeholder}
        />
      )}
    </label>
  )
}

function NoAplica({
  section,
  values,
  onChange,
}: {
  section: string
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
}) {
  const active = Object.prototype.hasOwnProperty.call(values, section)
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => {
            const next = { ...values }
            if (event.target.checked) next[section] = ""
            else delete next[section]
            onChange(next)
          }}
        />
        Esta sección no aplica
      </label>
      {active && (
        <label className="mt-3 block">
          <span className={labelClass}>
            Justificación <span className="text-red-500">*</span>
          </span>
          <textarea
            rows={2}
            value={values[section]}
            onChange={(event) =>
              onChange({ ...values, [section]: event.target.value })
            }
            className={inputClass}
            placeholder="Explica por qué no aplica al proceso."
          />
        </label>
      )}
    </div>
  )
}

const ACTIVIDAD_VACIA: Omit<ActividadProceso, "id" | "orden"> = {
  tipo: "Actividad",
  responsableId: "",
  descripcion: "",
  entradas: "",
  recursos: "",
  controles: "",
  resultado: "",
}

export default function LevantamientoProcesos() {
  const { state, dispatch, showToast, navigate, getUsuario } = useApp()
  const [iniciado, setIniciado] = useState(false)
  const [paso, setPaso] = useState(0)
  const [borrador, setBorrador] = useState<Borrador>(VACIO)
  const [errores, setErrores] = useState<string[]>([])
  const [actividad, setActividad] =
    useState<Omit<ActividadProceso, "id" | "orden">>(ACTIVIDAD_VACIA)
  const [actividadId, setActividadId] = useState<string | null>(null)
  const [modalActividad, setModalActividad] = useState(false)
  const [eliminarId, setEliminarId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  const proyectos = state.proyectos.filter(
    (proyecto) => proyecto.empresaId === borrador.empresaId,
  )
  const completos = PASOS.map((_, index) => seccionCompleta(index, borrador))
  const avance = Math.round(
    (completos.filter(Boolean).length / PASOS.length) * 100,
  )

  function set<K extends keyof Borrador>(key: K, value: Borrador[K]) {
    setBorrador((actual) => ({ ...actual, [key]: value }))
    setErrores([])
  }

  function validar(index: number) {
    const faltantes: string[] = []
    const esNoAplica = (section: string) =>
      Object.prototype.hasOwnProperty.call(borrador.noAplica, section)
    const requiere = (value: string, label: string) => {
      if (!value.trim()) faltantes.push(label)
    }
    if (index === 0) {
      requiere(borrador.nombre, "Nombre")
      requiere(borrador.objetivo, "Objetivo")
      requiere(borrador.alcance, "Alcance")
      requiere(borrador.responsableId, "Responsable")
      requiere(borrador.puestoResponsable, "Puesto")
      requiere(borrador.personalInvolucrado, "Personal involucrado")
    }
    if (index === 1) {
      requiere(borrador.entradas, "Entradas")
      requiere(borrador.salidas, "Salidas")
      requiere(borrador.clientes, "Clientes")
      if (borrador.tieneProveedores)
        requiere(borrador.proveedores, "Proveedores")
    }
    if (index === 2 && !esNoAplica("recursos")) {
      requiere(borrador.recursosMateriales, "Materiales")
      requiere(borrador.equipos, "Equipos")
      if (borrador.usaSistemas) requiere(borrador.sistemas, "Sistemas")
    }
    if (index === 3 && !esNoAplica("controles")) {
      requiere(borrador.controles, "Controles")
      requiere(borrador.registros, "Registros")
    }
    if (index === 4 && !esNoAplica("indicadores"))
      requiere(borrador.indicadores, "Indicadores")
    if (index === 5 && !esNoAplica("riesgos")) {
      requiere(borrador.riesgos, "Riesgos")
      requiere(borrador.problemas, "Problemas")
    }
    if (index === 7 && borrador.actividades.length === 0)
      faltantes.push("Al menos una actividad")
    const justificacion = [
      "recursos",
      "controles",
      "indicadores",
      "riesgos",
    ].find(
      (section) =>
        Object.prototype.hasOwnProperty.call(borrador.noAplica, section) &&
        !borrador.noAplica[section].trim(),
    )
    if (
      justificacion &&
      index ===
        ["recursos", "controles", "indicadores", "riesgos"].indexOf(
          justificacion,
        ) +
          2
    ) {
      faltantes.push("Justificación de “No aplica”")
    }
    setErrores(faltantes)
    return faltantes.length === 0
  }

  async function guardar(esFinal = false) {
    // UUID desde el navegador: el mismo id sirve para crear y para volver a guardar (upsert).
    const id = borrador.id || crypto.randomUUID()
    const proceso: Proceso = {
      id,
      nombre: borrador.nombre,
      proyectoId: borrador.proyectoId,
      responsableId: borrador.responsableId,
      estado: esFinal ? "Documentado" : "En levantamiento",
      descripcion: borrador.objetivo,
      // Igual que la BD (current_date, en UTC) y con el formato del resto de la app.
      fechaLevantamiento: formatearFecha(new Date().toISOString()),
      evidenciasIds: state.evidencias
        .filter((evidencia) => evidencia.procesoId === id)
        .map((evidencia) => evidencia.id),
      documentosIds: [],
      entradas: lista(borrador.entradas),
      salidas: lista(borrador.salidas),
      objetivo: borrador.objetivo,
      alcance: borrador.alcance,
      puestoResponsable: borrador.puestoResponsable,
      personalInvolucrado: borrador.personalInvolucrado,
      proveedores: lista(borrador.proveedores),
      clientes: lista(borrador.clientes),
      recursosMateriales: lista(borrador.recursosMateriales),
      equipos: lista(borrador.equipos),
      sistemas: lista(borrador.sistemas),
      controles: lista(borrador.controles),
      registros: lista(borrador.registros),
      indicadores: lista(borrador.indicadores),
      riesgos: lista(borrador.riesgos),
      problemas: lista(borrador.problemas),
      observaciones: borrador.observaciones,
      mejoras: borrador.mejoras,
      noAplica: borrador.noAplica,
      actividades: borrador.actividades,
    }
    const resultado = await servicioEscritura.guardarProceso(proceso)
    if (!resultado.ok) {
      showToast(MENSAJES_ERROR_ESCRITURA[resultado.error], "error")
      return
    }
    dispatch({ type: "UPSERT_PROCESO", proceso })
    setBorrador((actual) => ({ ...actual, id }))
    showToast(
      esFinal
        ? "Levantamiento completado y disponible en Procesos."
        : "Borrador guardado.",
      "success",
    )
    if (esFinal) navigate("procesos", { id })
  }

  function siguiente() {
    if (!validar(paso)) return
    setPaso((actual) => Math.min(actual + 1, PASOS.length - 1))
  }

  function abrirActividad(item?: ActividadProceso) {
    if (item) {
      const { id, orden: _orden, ...data } = item
      setActividadId(id)
      setActividad(data)
    } else {
      setActividadId(null)
      setActividad(ACTIVIDAD_VACIA)
    }
    setModalActividad(true)
  }

  function guardarActividad() {
    if (
      !actividad.descripcion.trim() ||
      !actividad.responsableId ||
      !actividad.entradas.trim() ||
      !actividad.recursos.trim() ||
      !actividad.controles.trim() ||
      !actividad.resultado.trim()
    ) return
    setBorrador((actual) => {
      const actividades = actividadId
        ? actual.actividades.map((item) =>
            item.id === actividadId ? { ...item, ...actividad } : item,
          )
        : [
            ...actual.actividades,
            {
              ...actividad,
              id: crypto.randomUUID(),
              orden: actual.actividades.length + 1,
            },
          ]
      return { ...actual, actividades }
    })
    setModalActividad(false)
  }

  function reordenar(destinoId: string) {
    if (!dragId || dragId === destinoId) return
    setBorrador((actual) => {
      const items = [...actual.actividades]
      const origen = items.findIndex((item) => item.id === dragId)
      const destino = items.findIndex((item) => item.id === destinoId)
      const [movida] = items.splice(origen, 1)
      items.splice(destino, 0, movida)
      return {
        ...actual,
        actividades: items.map((item, index) => ({
          ...item,
          orden: index + 1,
        })),
      }
    })
    setDragId(null)
  }

  if (!iniciado) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            Flujo D
          </p>
          <h2 className="mt-1 text-2xl font-bold text-navy">
            Levantamiento de procesos
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Selecciona el contexto antes de iniciar. Ningún campo se rellenará
            automáticamente.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              <span className={labelClass}>
                Empresa <span className="text-red-500">*</span>
              </span>
              <select
                className={inputClass}
                value={borrador.empresaId}
                onChange={(event) =>
                  setBorrador({ ...VACIO, empresaId: event.target.value })
                }
              >
                <option value="">Selecciona una empresa</option>
                {state.empresas
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
                value={borrador.proyectoId}
                disabled={!borrador.empresaId}
                onChange={(event) => set("proyectoId", event.target.value)}
              >
                <option value="">Selecciona un proyecto</option>
                {proyectos.map((proyecto) => (
                  <option key={proyecto.id} value={proyecto.id}>
                    {proyecto.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              disabled={!borrador.empresaId || !borrador.proyectoId}
              onClick={() => {
                setPaso(0)
                setIniciado(true)
              }}
              iconRight={<ArrowRight className="h-4 w-4" />}
            >
              Iniciar levantamiento
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            Flujo D · Levantamiento guiado
          </p>
          <h2 className="mt-1 text-xl font-bold text-navy">
            {borrador.nombre || "Nuevo proceso"}
          </h2>
          <p className="text-sm text-slate-500">
            {
              state.empresas.find((item) => item.id === borrador.empresaId)
                ?.nombre
            }
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => guardar(false)}
          icon={<Save className="h-4 w-4" />}
        >
          Guardar borrador
        </Button>
      </div>

      <div className="mb-5 rounded-xl border border-line bg-white p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">
            Avance del levantamiento
          </span>
          <span className="text-slate-500">
            {completos.filter(Boolean).length} de {PASOS.length} secciones
            completas
          </span>
        </div>
        <ProgressBar value={avance} showLabel size="md" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-line bg-white p-2">
          {PASOS.map((nombre, index) => (
            <button
              key={nombre}
              onClick={() => setPaso(index)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm ${
                paso === index
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {completos[index] ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300" />
              )}
              <span className="flex-1">
                {index + 1}. {nombre}
              </span>
            </button>
          ))}
        </aside>

        <section className="rounded-xl border border-line bg-white shadow-sm">
          <div className="border-b border-line px-5 py-4">
            <p className="text-xs text-slate-400">
              Paso {paso + 1} de {PASOS.length}
            </p>
            <h3 className="text-lg font-semibold text-navy">{PASOS[paso]}</h3>
          </div>
          <div className="space-y-5 p-5">
            {paso === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  label="Nombre del proceso"
                  value={borrador.nombre}
                  onChange={(value) => set("nombre", value)}
                  required
                  help="Usa el nombre reconocido por las personas que ejecutan el proceso."
                />
                <label>
                  <span className={labelClass}>
                    Responsable <span className="text-red-500">*</span>
                  </span>
                  <select
                    className={inputClass}
                    value={borrador.responsableId}
                    onChange={(event) =>
                      set("responsableId", event.target.value)
                    }
                  >
                    <option value="">Selecciona</option>
                    {state.proyectos
                      .find((p) => p.id === borrador.proyectoId)
                      ?.equipoIds.map((id) => {
                        const usuario = getUsuario(id)
                        return usuario ? (
                          <option key={id} value={id}>
                            {usuario.nombre}
                          </option>
                        ) : null
                      })}
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <Campo
                    label="Objetivo"
                    value={borrador.objetivo}
                    onChange={(value) => set("objetivo", value)}
                    required
                    multiline
                    help="Resultado que este proceso pretende lograr."
                  />
                </div>
                <div className="sm:col-span-2">
                  <Campo
                    label="Alcance"
                    value={borrador.alcance}
                    onChange={(value) => set("alcance", value)}
                    required
                    multiline
                    help="Indica dónde inicia, dónde termina y qué áreas comprende."
                  />
                </div>
                <Campo
                  label="Puesto del responsable"
                  value={borrador.puestoResponsable}
                  onChange={(value) => set("puestoResponsable", value)}
                  required
                />
                <Campo
                  label="Personal involucrado"
                  value={borrador.personalInvolucrado}
                  onChange={(value) => set("personalInvolucrado", value)}
                  required
                  help="Puestos o equipos participantes; no es necesario escribir datos personales."
                />
              </div>
            )}
            {paso === 1 && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo
                    label="Entradas"
                    value={borrador.entradas}
                    onChange={(value) => set("entradas", value)}
                    required
                    multiline
                    placeholder="Una entrada por línea"
                  />
                  <Campo
                    label="Salidas"
                    value={borrador.salidas}
                    onChange={(value) => set("salidas", value)}
                    required
                    multiline
                    placeholder="Una salida por línea"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={borrador.tieneProveedores}
                    onChange={(event) =>
                      set("tieneProveedores", event.target.checked)
                    }
                  />
                  ¿El proceso recibe entradas de proveedores internos o
                  externos?
                </label>
                {borrador.tieneProveedores && (
                  <Campo
                    label="Proveedores"
                    value={borrador.proveedores}
                    onChange={(value) => set("proveedores", value)}
                    required
                    multiline
                    placeholder="Uno por línea"
                  />
                )}
                <Campo
                  label="Clientes o receptores del resultado"
                  value={borrador.clientes}
                  onChange={(value) => set("clientes", value)}
                  required
                  multiline
                  placeholder="Uno por línea"
                />
              </div>
            )}
            {paso === 2 && (
              <div className="space-y-4">
                <NoAplica
                  section="recursos"
                  values={borrador.noAplica}
                  onChange={(value) => set("noAplica", value)}
                />
                {!Object.prototype.hasOwnProperty.call(
                  borrador.noAplica,
                  "recursos",
                ) && (
                  <>
                    <Campo
                      label="Materiales"
                      value={borrador.recursosMateriales}
                      onChange={(value) => set("recursosMateriales", value)}
                      required
                      multiline
                    />
                    <Campo
                      label="Equipos"
                      value={borrador.equipos}
                      onChange={(value) => set("equipos", value)}
                      required
                      multiline
                    />
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={borrador.usaSistemas}
                        onChange={(event) =>
                          set("usaSistemas", event.target.checked)
                        }
                      />
                      ¿Utiliza sistemas o aplicaciones?
                    </label>
                    {borrador.usaSistemas && (
                      <Campo
                        label="Sistemas"
                        value={borrador.sistemas}
                        onChange={(value) => set("sistemas", value)}
                        required
                        multiline
                      />
                    )}
                  </>
                )}
              </div>
            )}
            {paso === 3 && (
              <div className="space-y-4">
                <NoAplica
                  section="controles"
                  values={borrador.noAplica}
                  onChange={(value) => set("noAplica", value)}
                />
                {!Object.prototype.hasOwnProperty.call(
                  borrador.noAplica,
                  "controles",
                ) && (
                  <>
                    <Campo
                      label="Controles"
                      value={borrador.controles}
                      onChange={(value) => set("controles", value)}
                      required
                      multiline
                      help="Validaciones, autorizaciones o criterios que aseguran el resultado."
                    />
                    <Campo
                      label="Registros generados"
                      value={borrador.registros}
                      onChange={(value) => set("registros", value)}
                      required
                      multiline
                    />
                  </>
                )}
              </div>
            )}
            {paso === 4 && (
              <div className="space-y-4">
                <NoAplica
                  section="indicadores"
                  values={borrador.noAplica}
                  onChange={(value) => set("noAplica", value)}
                />
                {!Object.prototype.hasOwnProperty.call(
                  borrador.noAplica,
                  "indicadores",
                ) && (
                  <Campo
                    label="Indicadores"
                    value={borrador.indicadores}
                    onChange={(value) => set("indicadores", value)}
                    required
                    multiline
                    help="Incluye nombre, fórmula o unidad y frecuencia cuando estén definidos."
                  />
                )}
              </div>
            )}
            {paso === 5 && (
              <div className="space-y-4">
                <NoAplica
                  section="riesgos"
                  values={borrador.noAplica}
                  onChange={(value) => set("noAplica", value)}
                />
                {!Object.prototype.hasOwnProperty.call(
                  borrador.noAplica,
                  "riesgos",
                ) && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo
                      label="Riesgos"
                      value={borrador.riesgos}
                      onChange={(value) => set("riesgos", value)}
                      required
                      multiline
                    />
                    <Campo
                      label="Problemas actuales"
                      value={borrador.problemas}
                      onChange={(value) => set("problemas", value)}
                      required
                      multiline
                    />
                  </div>
                )}
              </div>
            )}
            {paso === 6 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  label="Observaciones"
                  value={borrador.observaciones}
                  onChange={(value) => set("observaciones", value)}
                  multiline
                />
                <Campo
                  label="Oportunidades de mejora"
                  value={borrador.mejoras}
                  onChange={(value) => set("mejoras", value)}
                  multiline
                />
              </div>
            )}
            {paso === 7 && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Arrastra las actividades para cambiar su orden.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => abrirActividad()}
                    icon={<Plus className="h-4 w-4" />}
                  >
                    Agregar actividad
                  </Button>
                </div>
                <div className="space-y-2">
                  {borrador.actividades.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
                      Aún no hay actividades registradas.
                    </p>
                  )}
                  {borrador.actividades.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDragId(item.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => reordenar(item.id)}
                      className="flex items-center gap-3 rounded-lg border border-line p-3"
                    >
                      <GripVertical className="h-5 w-5 cursor-grab text-slate-300" />
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                        {item.orden}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {item.descripcion}
                        </p>
                        <p className="text-xs text-slate-400">
                          {item.tipo} ·{" "}
                          {getUsuario(item.responsableId || "")?.nombre ||
                            "Sin responsable"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => abrirActividad(item)}
                        aria-label="Editar actividad"
                        icon={<Pencil className="h-4 w-4" />}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEliminarId(item.id)}
                        aria-label="Eliminar actividad"
                        icon={<Trash2 className="h-4 w-4 text-red-500" />}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {paso === 8 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-semibold text-emerald-800">
                    Revisión del levantamiento
                  </p>
                  <p className="mt-1 text-sm text-emerald-700">
                    Verifica cada sección antes de completar. Los campos vacíos
                    permanecerán vacíos.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PASOS.slice(0, -1).map((nombre, index) => (
                    <button
                      key={nombre}
                      onClick={() => setPaso(index)}
                      className="flex items-center gap-2 rounded-lg border border-line p-3 text-left text-sm"
                    >
                      <CheckCircle2
                        className={`h-4 w-4 ${
                          completos[index]
                            ? "text-emerald-500"
                            : "text-amber-500"
                        }`}
                      />
                      <span className="flex-1">{nombre}</span>
                      <span className="text-xs text-slate-400">
                        {completos[index] ? "Completa" : "Incompleta"}
                      </span>
                    </button>
                  ))}
                </div>
                <Button
                  variant="success"
                  disabled={!completos.slice(0, -1).every(Boolean)}
                  onClick={() => guardar(true)}
                  icon={<Check className="h-4 w-4" />}
                >
                  Completar levantamiento
                </Button>
              </div>
            )}
            {errores.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-medium">Completa los campos obligatorios:</p>
                <p>{errores.join(", ")}</p>
              </div>
            )}
          </div>
          <div className="flex justify-between border-t border-line bg-slate-50 px-5 py-4">
            <Button
              variant="outline"
              disabled={paso === 0}
              onClick={() => setPaso((actual) => actual - 1)}
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              Anterior
            </Button>
            {paso < PASOS.length - 1 && (
              <Button
                onClick={siguiente}
                iconRight={<ArrowRight className="h-4 w-4" />}
              >
                Siguiente
              </Button>
            )}
          </div>
        </section>
      </div>

      <Modal
        open={modalActividad}
        onClose={() => setModalActividad(false)}
        title={actividadId ? "Editar actividad" : "Nueva actividad"}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalActividad(false)}>
              Cancelar
            </Button>
            <Button
              onClick={guardarActividad}
              disabled={
                !actividad.descripcion.trim() ||
                !actividad.responsableId ||
                !actividad.entradas.trim() ||
                !actividad.recursos.trim() ||
                !actividad.controles.trim() ||
                !actividad.resultado.trim()
              }
            >
              Guardar actividad
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Tipo</span>
            <select
              className={inputClass}
              value={actividad.tipo}
              onChange={(event) =>
                setActividad({
                  ...actividad,
                  tipo: event.target.value as TipoActividad,
                })
              }
            >
              {([
                "Inicio",
                "Actividad",
                "Decisión",
                "Fin",
              ] as TipoActividad[]).map((tipo) => (
                <option key={tipo}>{tipo}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>
              Responsable <span className="text-red-500">*</span>
            </span>
            <select
              className={inputClass}
              value={actividad.responsableId}
              onChange={(event) =>
                setActividad({
                  ...actividad,
                  responsableId: event.target.value,
                })
              }
            >
              <option value="">Sin asignar</option>
              {state.proyectos
                .find((p) => p.id === borrador.proyectoId)
                ?.equipoIds.map((id) => {
                  const usuario = getUsuario(id)
                  return usuario ? (
                    <option key={id} value={id}>
                      {usuario.nombre}
                    </option>
                  ) : null
                })}
            </select>
          </label>
          <div className="sm:col-span-2">
            <Campo
              label="Descripción"
              required
              value={actividad.descripcion}
              onChange={(value) =>
                setActividad({ ...actividad, descripcion: value })
              }
              multiline
            />
          </div>
          <Campo
            label="Entradas"
            required
            value={actividad.entradas}
            onChange={(value) =>
              setActividad({ ...actividad, entradas: value })
            }
            multiline
          />
          <Campo
            label="Recursos"
            required
            value={actividad.recursos}
            onChange={(value) =>
              setActividad({ ...actividad, recursos: value })
            }
            multiline
          />
          <Campo
            label="Controles"
            required
            value={actividad.controles}
            onChange={(value) =>
              setActividad({ ...actividad, controles: value })
            }
            multiline
          />
          <Campo
            label="Resultado"
            required
            value={actividad.resultado}
            onChange={(value) =>
              setActividad({ ...actividad, resultado: value })
            }
            multiline
          />
        </div>
      </Modal>
      <ConfirmDialog
        open={!!eliminarId}
        onClose={() => setEliminarId(null)}
        onConfirm={() => {
          set(
            "actividades",
            borrador.actividades
              .filter((item) => item.id !== eliminarId)
              .map((item, index) => ({ ...item, orden: index + 1 })),
          )
          setEliminarId(null)
        }}
        title="Eliminar actividad"
        message="La actividad se eliminará de la secuencia del proceso."
        confirmLabel="Eliminar"
      />
    </div>
  )
}

function seccionCompleta(index: number, data: Borrador): boolean {
  const conJustificacion = (key: string) =>
    Object.prototype.hasOwnProperty.call(data.noAplica, key) &&
    !!data.noAplica[key].trim()
  if (index === 0)
    return [
      data.nombre,
      data.objetivo,
      data.alcance,
      data.responsableId,
      data.puestoResponsable,
      data.personalInvolucrado,
    ].every((value) => value.trim())
  if (index === 1)
    return (
      !!data.entradas.trim() &&
      !!data.salidas.trim() &&
      !!data.clientes.trim() &&
      (!data.tieneProveedores || !!data.proveedores.trim())
    )
  if (index === 2)
    return (
      conJustificacion("recursos") ||
      (!!data.recursosMateriales.trim() &&
        !!data.equipos.trim() &&
        (!data.usaSistemas || !!data.sistemas.trim()))
    )
  if (index === 3)
    return (
      conJustificacion("controles") ||
      (!!data.controles.trim() && !!data.registros.trim())
    )
  if (index === 4)
    return conJustificacion("indicadores") || !!data.indicadores.trim()
  if (index === 5)
    return (
      conJustificacion("riesgos") ||
      (!!data.riesgos.trim() && !!data.problemas.trim())
    )
  if (index === 6) return true
  if (index === 7) return data.actividades.length > 0
  return PASOS.slice(0, -1).every((_, paso) => seccionCompleta(paso, data))
}
