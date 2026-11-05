import { useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Boxes,
  CheckCircle2,
  FileText,
  GitBranch,
  Info,
  Paperclip,
  Search,
  ShieldAlert,
} from "lucide-react"
import { useApp } from "../context/AppContext"
import { Button } from "../components/ui/Button"
import { StatusBadge } from "../components/ui/StatusBadge"
import type { ActividadProceso, Proceso } from "../types"

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"

const TABS = [
  { id: "general", label: "Ficha general", icon: Info },
  { id: "actividades", label: "Actividades", icon: GitBranch },
  { id: "recursos", label: "Recursos y controles", icon: Boxes },
  { id: "riesgos", label: "Riesgos", icon: ShieldAlert },
  { id: "indicadores", label: "Indicadores", icon: BarChart3 },
  { id: "evidencias", label: "Evidencias", icon: Paperclip },
  { id: "documentos", label: "Documentos", icon: FileText },
]

function ElementoFlujo({ actividad }: { actividad: ActividadProceso }) {
  if (actividad.tipo === "Decisión") {
    return (
      <div className="flex flex-col items-center">
        <div className="flex h-28 w-28 rotate-45 items-center justify-center border-2 border-amber-400 bg-amber-50 shadow-sm">
          <span className="max-w-20 -rotate-45 text-center text-xs font-medium text-amber-900">
            {actividad.descripcion}
          </span>
        </div>
        <span className="mt-5 text-xs text-slate-400">
          {actividad.responsableId ? "Decisión" : "Decisión · Sin responsable"}
        </span>
      </div>
    )
  }
  const extremos = actividad.tipo === "Inicio" || actividad.tipo === "Fin"
  return (
    <div
      className={`w-full max-w-md border-2 p-3 text-center shadow-sm ${
        extremos
          ? "rounded-full border-emerald-400 bg-emerald-50"
          : "rounded-lg border-blue-300 bg-blue-50"
      }`}
    >
      <p className="text-sm font-medium text-slate-800">
        {actividad.descripcion}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
        {actividad.tipo}
      </p>
    </div>
  )
}

export default function Procesos() {
  const {
    state,
    getProyecto,
    getEmpresa,
    getUsuario,
    getDocumentos,
    navigate,
  } = useApp()
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(
    state.navParams.id || null,
  )
  const [tab, setTab] = useState("general")
  const [busqueda, setBusqueda] = useState("")
  const [proyectoFiltro, setProyectoFiltro] = useState("")
  const proceso = state.procesos.find((item) => item.id === seleccionadoId)

  const filtrados = state.procesos.filter((item) => {
    if (proyectoFiltro && item.proyectoId !== proyectoFiltro) return false
    if (
      busqueda &&
      !`${item.nombre} ${item.descripcion}`
        .toLowerCase()
        .includes(busqueda.toLowerCase())
    )
      return false
    return true
  })

  if (!proceso) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-navy">Procesos</h2>
            <p className="mt-1 text-sm text-slate-500">
              Consulta levantamientos, secuencias e información pendiente.
            </p>
          </div>
          <Button onClick={() => navigate("levantamiento")}>
            Nuevo levantamiento
          </Button>
        </div>
        <div className="mb-5 grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              className={`${inputClass} pl-9`}
              placeholder="Buscar proceso..."
            />
          </label>
          <select
            className={inputClass}
            value={proyectoFiltro}
            onChange={(event) => setProyectoFiltro(event.target.value)}
          >
            <option value="">Todos los proyectos</option>
            {state.proyectos.map((proyecto) => (
              <option key={proyecto.id} value={proyecto.id}>
                {proyecto.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((item) => {
            const proyecto = getProyecto(item.proyectoId)
            const empresa = proyecto
              ? getEmpresa(proyecto.empresaId)
              : undefined
            const faltantes = observaciones(
              item,
              state.evidencias.filter(
                (evidencia) => evidencia.procesoId === item.id,
              ),
            )
            return (
              <button
                key={item.id}
                onClick={() => setSeleccionadoId(item.id)}
                className="rounded-xl border border-line bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <GitBranch className="h-5 w-5" />
                  </div>
                  <StatusBadge status={item.estado} size="sm" />
                </div>
                <p className="mt-4 font-semibold text-slate-800">
                  {item.nombre}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {empresa?.nombre || "Empresa no identificada"} ·{" "}
                  {proyecto?.nombre || "Proyecto no identificado"}
                </p>
                <p className="mt-3 line-clamp-2 text-sm text-slate-500">
                  {item.descripcion || "Sin descripción"}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
                  <span className="text-slate-400">
                    {item.actividades?.length || 0} actividades
                  </span>
                  {faltantes.length > 0 && (
                    <span className="flex items-center gap-1 font-medium text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {faltantes.length} observaciones
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const proyecto = getProyecto(proceso.proyectoId)
  const empresa = proyecto ? getEmpresa(proyecto.empresaId) : undefined
  const evidencias = state.evidencias.filter(
    (item) => item.procesoId === proceso.id,
  )
  const documentos = getDocumentos(proceso.proyectoId).filter(
    (item) => item.procesoId === proceso.id,
  )
  const alertas = observaciones(proceso, evidencias)

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSeleccionadoId(null)}
          icon={<ArrowLeft className="h-4 w-4" />}
        >
          Volver a procesos
        </Button>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <StatusBadge status={proceso.estado} />
              <span className="text-xs text-slate-400">{proceso.id}</span>
            </div>
            <h2 className="text-2xl font-bold text-navy">{proceso.nombre}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {empresa?.nombre} · {proyecto?.nombre}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("levantamiento")}>
            Nuevo levantamiento
          </Button>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Observaciones para revisar
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {alertas.map((alerta) => (
              <div
                key={alerta}
                className="flex items-start gap-2 text-sm text-amber-700"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                {alerta}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="overflow-x-auto border-b border-line">
          <div className="flex min-w-max">
            {TABS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${
                    tab === item.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="p-5">
          {tab === "general" && (
            <FichaGeneral
              proceso={proceso}
              responsable={getUsuario(proceso.responsableId)?.nombre}
            />
          )}
          {tab === "actividades" && (
            <Actividades proceso={proceso} getUsuario={getUsuario} />
          )}
          {tab === "recursos" && <Recursos proceso={proceso} />}
          {tab === "riesgos" && (
            <ListaDoble
              tituloA="Riesgos"
              datosA={proceso.riesgos}
              tituloB="Problemas"
              datosB={proceso.problemas}
            />
          )}
          {tab === "indicadores" && (
            <Lista
              titulo="Indicadores definidos"
              datos={proceso.indicadores}
              vacio="No hay indicadores definidos."
            />
          )}
          {tab === "evidencias" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {evidencias.length === 0 ? (
                <Vacio texto="No hay evidencias vinculadas a este proceso." />
              ) : (
                evidencias.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-line p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{item.nombre}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px]">
                        {item.estado}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.tipo} · {item.categoria || "Sin categoría"}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
          {tab === "documentos" && (
            <div className="space-y-2">
              {documentos.length === 0 ? (
                <Vacio texto="No hay documentos vinculados a este proceso." />
              ) : (
                documentos.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-line p-4"
                  >
                    <FileText className="h-5 w-5 text-blue-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.nombre}</p>
                      <p className="text-xs text-slate-400">
                        Versión {item.version}
                      </p>
                    </div>
                    <StatusBadge status={item.estado} size="sm" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FichaGeneral({
  proceso,
  responsable,
}: {
  proceso: Proceso
  responsable?: string
}) {
  const filas = [
    ["Objetivo", proceso.objetivo || proceso.descripcion],
    ["Alcance", proceso.alcance],
    ["Responsable", responsable],
    ["Puesto", proceso.puestoResponsable],
    ["Personal involucrado", proceso.personalInvolucrado],
    ["Fecha de levantamiento", proceso.fechaLevantamiento],
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {filas.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <p className="mt-1 text-sm text-slate-700">
            {value || (
              <span className="text-amber-600">Información faltante</span>
            )}
          </p>
        </div>
      ))}
      <div className="sm:col-span-2">
        <ListaDoble
          tituloA="Entradas"
          datosA={proceso.entradas}
          tituloB="Salidas"
          datosB={proceso.salidas}
        />
      </div>
      <div className="sm:col-span-2">
        <ListaDoble
          tituloA="Proveedores"
          datosA={proceso.proveedores}
          tituloB="Clientes"
          datosB={proceso.clientes}
        />
      </div>
    </div>
  )
}

function Actividades({
  proceso,
  getUsuario,
}: {
  proceso: Proceso
  getUsuario: ReturnType<typeof useApp>["getUsuario"]
}) {
  const actividades = proceso.actividades || []
  if (actividades.length === 0)
    return <Vacio texto="No hay secuencia de actividades registrada." />
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <h3 className="mb-4 font-semibold text-slate-800">
          Secuencia detallada
        </h3>
        <div className="space-y-3">
          {actividades.map((item) => (
            <div key={item.id} className="rounded-lg border border-line p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
                  {item.orden}
                </span>
                <div>
                  <p className="text-sm font-semibold">{item.descripcion}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.tipo} ·{" "}
                    {getUsuario(item.responsableId || "")?.nombre ||
                      "Sin responsable"}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                {[
                  ["Entradas", item.entradas],
                  ["Recursos", item.recursos],
                  ["Controles", item.controles],
                  ["Resultado", item.resultado],
                ].map(([label, value]) => (
                  <div key={label} className="rounded bg-slate-50 p-2">
                    <span className="font-medium text-slate-500">
                      {label}:{" "}
                    </span>
                    <span
                      className={value ? "text-slate-600" : "text-amber-600"}
                    >
                      {value || "Información faltante"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-line bg-slate-50 p-5">
        <h3 className="mb-5 text-center font-semibold text-slate-800">
          Diagrama de flujo
        </h3>
        <div className="flex flex-col items-center">
          {actividades.map((item, index) => (
            <div key={item.id} className="flex w-full flex-col items-center">
              <ElementoFlujo actividad={item} />
              {index < actividades.length - 1 && (
                <div className="my-2 h-8 w-0.5 bg-slate-300 after:block after:h-2 after:w-2 after:-translate-x-[3px] after:translate-y-7 after:rotate-45 after:border-b-2 after:border-r-2 after:border-slate-400" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Recursos({ proceso }: { proceso: Proceso }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Lista
        titulo="Materiales"
        datos={proceso.recursosMateriales}
        vacio="Sin materiales definidos."
      />
      <Lista
        titulo="Equipos"
        datos={proceso.equipos}
        vacio="Sin equipos definidos."
      />
      <Lista
        titulo="Sistemas"
        datos={proceso.sistemas}
        vacio="Sin sistemas definidos."
      />
      <Lista
        titulo="Controles"
        datos={proceso.controles}
        vacio="Sin controles definidos."
      />
      <div className="md:col-span-2">
        <Lista
          titulo="Registros"
          datos={proceso.registros}
          vacio="Sin registros definidos."
        />
      </div>
    </div>
  )
}

function ListaDoble({
  tituloA,
  datosA,
  tituloB,
  datosB,
}: {
  tituloA: string
  datosA?: string[]
  tituloB: string
  datosB?: string[]
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Lista
        titulo={tituloA}
        datos={datosA}
        vacio={`Sin ${tituloA.toLowerCase()} identificados.`}
      />
      <Lista
        titulo={tituloB}
        datos={datosB}
        vacio={`Sin ${tituloB.toLowerCase()} identificadas.`}
      />
    </div>
  )
}

function Lista({
  titulo,
  datos,
  vacio,
}: {
  titulo: string
  datos?: string[]
  vacio: string
}) {
  return (
    <div className="rounded-lg border border-line p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{titulo}</h3>
      {datos?.length ? (
        <ul className="space-y-2">
          {datos.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="flex gap-2 text-sm text-slate-600"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-amber-600">{vacio}</p>
      )}
    </div>
  )
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
      {texto}
    </div>
  )
}

function observaciones(proceso: Proceso, evidencias: { id: string }[]) {
  const alertas: string[] = []
  if (!proceso.responsableId) alertas.push("Proceso sin responsable asignado.")
  if (!proceso.descripcion || proceso.descripcion.trim().length < 30)
    alertas.push("Descripción insuficiente; agrega objetivo y contexto.")
  if (!proceso.entradas.length || !proceso.salidas.length)
    alertas.push("Entradas o salidas sin identificar.")
  if (!evidencias.length) alertas.push("No hay evidencias vinculadas.")
  if (!proceso.controles?.length && !proceso.noAplica?.controles)
    alertas.push("Controles sin definir.")
  if (!proceso.indicadores?.length && !proceso.noAplica?.indicadores)
    alertas.push("Indicadores sin definir.")
  const actividades = proceso.actividades || []
  if (actividades.some((item) => !item.responsableId))
    alertas.push("Hay actividades sin responsable.")
  if (actividades.some((item) => item.descripcion.trim().length < 12))
    alertas.push("Hay actividades con descripción insuficiente.")
  const normalizadas = actividades
    .map((item) => item.descripcion.trim().toLowerCase())
    .filter(Boolean)
  if (new Set(normalizadas).size !== normalizadas.length)
    alertas.push("Se detectaron posibles actividades duplicadas.")
  return alertas
}
