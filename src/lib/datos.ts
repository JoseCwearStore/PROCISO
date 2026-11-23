import type {
  ActividadProceso,
  AnalisisIA,
  ComentarioGlobal,
  CriterioEvaluacion,
  EstadoAnalisisIA,
  EstadoResultadoIA,
  ResultadoAnalisisIA,
  ComentarioDocumento,
  ComentarioTarea,
  Consultoria,
  Documento,
  SeccionDocumento,
  Empresa,
  Entregable,
  EntradaHistorial,
  Evidencia,
  Fase,
  IndicadorGestion,
  ListaVerificacion,
  NoConformidad,
  PreguntaVerificacion,
  Notificacion,
  PageId,
  Proceso,
  Proyecto,
  Rol,
  Tarea,
  TipoNotificacion,
  Usuario,
} from '../types'
import { mapearRol, type RolBD } from './auth'
import { lineasDeAccion } from './noConformidades'

// ─── Filas tal como las devuelve la BD (ya filtradas por RLS) ───────────────

export interface FilaConsultoria {
  id: string
  nombre: string
  rfc: string | null
  plan: string
  activa: boolean
  contacto: string | null
  email: string | null
  limite_usuarios: number | null
  almacenamiento_gb: number | null
  renovacion: string | null
  creado_en: string
}

export interface FilaEmpresa {
  id: string
  consultoria_id: string
  nombre: string
  nombre_comercial: string | null
  rfc: string | null
  sector: string | null
  tamano: string | null
  trabajadores: string | null
  ciudad: string | null
  entidad_federativa: string | null
  direccion: string | null
  contacto_principal: string | null
  cargo_contacto: string | null
  email_contacto: string | null
  telefono_contacto: string | null
  procesos_principales: string | null
  alcance_inicial: string | null
  norma_interes: 'ISO 9001:2026' | 'ISO 9001:2015'
  consultor_asignado_id: string | null
  observaciones: string | null
  activa: boolean
  creado_en: string
}

export interface FilaPerfil {
  id: string
  nombre: string
  email: string
  rol: RolBD
  consultoria_id: string | null
  empresa_id: string | null
  cargo: string | null
  activo: boolean
  password_temporal: boolean
}

export interface FilaProyecto {
  id: string
  consultoria_id: string
  empresa_id: string
  consultor_id: string | null
  nombre: string
  objetivo: string | null
  alcance: string | null
  descripcion: string | null
  estado: Proyecto['estado']
  avance: number
  edicion_norma: 'ISO 9001:2026' | 'ISO 9001:2015'
  fecha_inicio: string | null
  fecha_fin_estimada: string | null
  fecha_fin_real: string | null
}

export interface FilaFase {
  id: string
  proyecto_id: string
  nombre: string
  estado: Fase['estado']
  avance: number
  orden: number
}

export interface FilaMiembro {
  proyecto_id: string
  usuario_id: string
}

export interface FilaProceso {
  id: string
  proyecto_id: string
  responsable_id: string | null
  nombre: string
  descripcion: string | null
  estado: Proceso['estado']
  tipo: Proceso['tipo'] | null
  fecha_levantamiento: string | null
  objetivo: string | null
  alcance: string | null
  puesto_responsable: string | null
  personal_involucrado: string | null
  entradas: string[]
  salidas: string[]
  proveedores: string[]
  clientes: string[]
  recursos_materiales: string[]
  equipos: string[]
  sistemas: string[]
  controles: string[]
  registros: string[]
  indicadores: string[]
  riesgos: string[]
  problemas: string[]
  observaciones: string | null
  mejoras: string | null
  no_aplica: Record<string, string>
}

export interface FilaActividad {
  id: string
  proceso_id: string
  responsable_id: string | null
  tipo: ActividadProceso['tipo']
  descripcion: string
  entradas: string | null
  recursos: string | null
  controles: string | null
  resultado: string | null
  orden: number
}

export interface FilaEvidencia {
  id: string
  proyecto_id: string
  proceso_id: string | null
  actividad_id: string | null
  subido_por: string | null
  nombre: string
  tipo: Evidencia['tipo']
  estado: Evidencia['estado']
  descripcion: string | null
  categoria: string | null
  archivo_ruta: string | null
  archivo_nombre: string | null
  archivo_mime: string | null
  creado_en: string
  eliminada_en?: string | null
  eliminada_por?: string | null
  motivo_eliminacion?: string | null
}

export interface FilaDocumento {
  id: string
  proyecto_id: string
  proceso_id: string | null
  nombre: string
  tipo: Documento['tipo']
  estado: Documento['estado']
  version: string
  codigo: string | null
  categoria: Documento['categoria'] | null
  plantilla: string | null
  secciones: SeccionDocumento[]
  referencia_normativa: 'ISO 9001:2026' | 'ISO 9001:2015'
  motivo_cambio: string | null
  bloqueado: boolean
  contenido_pendiente: boolean
  creado_por: string | null
  revisado_por: string | null
  aprobado_por: string | null
  fecha_revision: string | null
  fecha_aprobacion: string | null
  visto_bueno_por: string | null
  visto_bueno_en: string | null
  visto_bueno_version: string | null
  creado_en: string
  actualizado_en: string
}

export interface FilaVersion {
  documento_id: string
  version: string
  autor_id: string | null
  comentario: string | null
  motivo: string | null
  secciones: SeccionDocumento[]
  estado: Documento['estado'] | null
  creado_en: string
}

export interface FilaVinculo {
  documento_id: string
  evidencia_id: string
}

export interface FilaComentario {
  id: string
  proyecto_id: string
  entidad_tipo: string
  entidad_id: string
  seccion_id: string | null
  autor_id: string
  texto: string
  creado_en: string
}

export interface FilaHistorial {
  id: number
  entidad_tipo: string
  entidad_id: string
  // La BD siempre la pide (nula en eventos sin proyecto, p. ej. de usuarios); opcional aquí por las filas de prueba.
  proyecto_id?: string | null
  autor_id: string | null
  accion: string
  descripcion: string | null
  estado_anterior: string | null
  estado_nuevo: string | null
  creado_en: string
}

export interface FilaTarea {
  id: string
  proyecto_id: string
  titulo: string
  descripcion: string
  asignado_a: string
  asignado_por: string | null
  estado: Tarea['estado']
  prioridad: Tarea['prioridad']
  fecha_vencimiento: string
  fecha_completada: string | null
  dependencias: string[]
}

export interface FilaIndicador {
  id: string
  ambito: IndicadorGestion['ambito']
  empresa_id: string | null
  nombre: string
  descripcion: string
  formula: string
  unidad: string
  frecuencia: string
  responsable_id: string
  meta: string
  periodo: string
  valor: string
}

export interface FilaEntregable {
  id: string
  proyecto_id: string
  nombre: string
  tipo: string
  estado: Entregable['estado']
  fecha_entrega: string | null
  fecha_aprobacion: string | null
  aprobado_por: string | null
  documento_id: string | null
}

export interface FilaLista {
  id: string
  proyecto_id: string
  proceso_id: string | null
  nombre: string
  area: string
  responsable_id: string
  fecha: string
  edicion_norma: ListaVerificacion['edicionNorma']
}

export interface FilaPregunta {
  id: string
  lista_id: string
  orden: number
  pregunta: string
  estado: PreguntaVerificacion['estado']
  referencia_requisito: string
  evidencia_id: string | null
  observaciones: string
  justificacion_no_aplica: string
}

export interface FilaNoConformidad {
  id: string
  proyecto_id: string
  folio: string
  titulo: string
  descripcion: string
  tipo: NoConformidad['tipo']
  detectada_en: string
  fecha_deteccion: string
  proceso_id: string | null
  evidencia_ids: string[]
  responsable_id: string
  responsable_accion_id: string | null
  fecha_limite: string | null
  estado: NoConformidad['estado']
  correccion_inmediata: string
  analisis_causa: string
  accion_correctiva: string
  eficacia: NonNullable<NoConformidad['eficacia']>
  verificacion_eficacia: string
  fecha_cierre: string | null
  observaciones: string
}

export interface FilaCriterio {
  id: string
  clausula: string
  titulo: string
  intencion: string
  evidencia_esperada: string[]
  preguntas: string[]
  senales_de_hueco: string[]
  puede_no_aplicar: boolean
  condicion_no_aplica: string | null
  orden: number
}

export interface FilaAnalisis {
  id: string
  proyecto_id: string
  fuente_tipo: 'documento' | 'evidencia'
  documento_id: string | null
  evidencia_id: string | null
  criterio_ids: string[]
  solicitado_por: string
  estado: EstadoAnalisisIA
  resumen: string | null
  error_detalle: string | null
  proveedor: string | null
  modelo: string | null
  creado_en: string
}

export interface FilaResultadoAnalisis {
  analisis_id: string
  criterio_id: string
  estado: EstadoResultadoIA
  hallazgos: string | null
  sugerencias: string | null
  orden: number
}

// Una fila de mis_notificaciones(): la BD ya decidió qué le toca a quién.
export interface FilaNotificacion {
  clave: string
  tipo: TipoNotificacion
  titulo: string
  descripcion: string
  fecha: string
  pagina: PageId | null
  proyecto_id: string | null
  entidad_tipo: string
  entidad_id: string
  leida: boolean
}

export interface FilasSesion {
  consultorias: FilaConsultoria[]
  empresas: FilaEmpresa[]
  perfiles: FilaPerfil[]
  proyectos: FilaProyecto[]
  fases: FilaFase[]
  miembros: FilaMiembro[]
  procesos: FilaProceso[]
  actividades: FilaActividad[]
  evidencias: FilaEvidencia[]
  historial: FilaHistorial[]
  documentos: FilaDocumento[]
  versiones: FilaVersion[]
  vinculos: FilaVinculo[]
  comentarios: FilaComentario[]
  tareas: FilaTarea[]
  noConformidades: FilaNoConformidad[]
  listas: FilaLista[]
  preguntas: FilaPregunta[]
  entregables: FilaEntregable[]
  indicadores: FilaIndicador[]
  criterios: FilaCriterio[]
  analisis: FilaAnalisis[]
  analisisResultados: FilaResultadoAnalisis[]
  notificaciones: FilaNotificacion[]
}

export interface DatosSesion {
  criterios: CriterioEvaluacion[]
  analisisIA: AnalisisIA[]
  comentariosGlobales: ComentarioGlobal[]
  notificaciones: Notificacion[]
  historial: EntradaHistorial[]
  tareas: Tarea[]
  noConformidades: NoConformidad[]
  listasVerificacion: ListaVerificacion[]
  entregables: Entregable[]
  indicadores: IndicadorGestion[]
  consultorias: Consultoria[]
  empresas: Empresa[]
  usuarios: Usuario[]
  proyectos: Proyecto[]
  procesos: Proceso[]
  evidencias: Evidencia[]
  // Solo llegan para el Admin PROCISO (el RLS las esconde al resto). Van aparte para que no se cuenten en
  // el tablero, el buscador ni los procesos.
  evidenciasEliminadas: Evidencia[]
  documentos: Documento[]
}

// ─── Lectura ────────────────────────────────────────────────────────────────

export interface ClienteDatos {
  from(tabla: string): {
    select(columnas: string): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
  }
  rpc(funcion: 'mis_notificaciones'): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
}

const CONSULTAS = {
  consultorias: ['consultorias', 'id, nombre, rfc, plan, activa, contacto, email, limite_usuarios, almacenamiento_gb, renovacion, creado_en'],
  empresas: ['empresas', '*'],
  perfiles: ['perfiles', 'id, nombre, email, rol, consultoria_id, empresa_id, cargo, activo, password_temporal'],
  proyectos: ['proyectos', '*'],
  fases: ['fases', 'id, proyecto_id, nombre, estado, avance, orden'],
  miembros: ['proyecto_miembros', 'proyecto_id, usuario_id'],
  procesos: ['procesos', '*'],
  actividades: ['actividades', 'id, proceso_id, responsable_id, tipo, descripcion, entradas, recursos, controles, resultado, orden'],
  evidencias: ['evidencias', 'id, proyecto_id, proceso_id, actividad_id, subido_por, nombre, tipo, estado, descripcion, categoria, archivo_ruta, archivo_nombre, archivo_mime, creado_en, eliminada_en, eliminada_por, motivo_eliminacion'],
  historial: ['historial', 'id, entidad_tipo, entidad_id, proyecto_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo, creado_en'],
  documentos: ['documentos', '*'],
  versiones: ['documento_versiones', 'documento_id, version, autor_id, comentario, motivo, secciones, estado, creado_en'],
  vinculos: ['documento_evidencias', 'documento_id, evidencia_id'],
  comentarios: ['comentarios', 'id, proyecto_id, entidad_tipo, entidad_id, seccion_id, autor_id, texto, creado_en'],
  tareas: ['tareas', 'id, proyecto_id, titulo, descripcion, asignado_a, asignado_por, estado, prioridad, fecha_vencimiento, fecha_completada, dependencias'],
  noConformidades: [
    'no_conformidades',
    'id, proyecto_id, folio, titulo, descripcion, tipo, detectada_en, fecha_deteccion, proceso_id, evidencia_ids, responsable_id, responsable_accion_id, fecha_limite, estado, correccion_inmediata, analisis_causa, accion_correctiva, eficacia, verificacion_eficacia, fecha_cierre, observaciones',
  ],
  indicadores: [
    'indicadores',
    'id, ambito, empresa_id, nombre, descripcion, formula, unidad, frecuencia, responsable_id, meta, periodo, valor',
  ],
  entregables: [
    'entregables',
    'id, proyecto_id, nombre, tipo, estado, fecha_entrega, fecha_aprobacion, aprobado_por, documento_id',
  ],
  criterios: [
    'criterios_evaluacion',
    'id, clausula, titulo, intencion, evidencia_esperada, preguntas, senales_de_hueco, puede_no_aplicar, condicion_no_aplica, orden',
  ],
  analisis: [
    'analisis_ia',
    'id, proyecto_id, fuente_tipo, documento_id, evidencia_id, criterio_ids, solicitado_por, estado, resumen, error_detalle, proveedor, modelo, creado_en',
  ],
  analisisResultados: ['analisis_ia_resultados', 'analisis_id, criterio_id, estado, hallazgos, sugerencias, orden'],
  listas: ['listas_verificacion', 'id, proyecto_id, proceso_id, nombre, area, responsable_id, fecha, edicion_norma'],
  preguntas: [
    'lista_preguntas',
    'id, lista_id, orden, pregunta, estado, referencia_requisito, evidencia_id, observaciones, justificacion_no_aplica',
  ],
} as const satisfies Record<Exclude<keyof FilasSesion, 'notificaciones'>, readonly [string, string]>

// L3 · D3: al cliente la BD le cierra las tablas consultorias (plan, RFC, cuotas) y empresas
// (observaciones internas del consultor). Lee en su lugar vistas de solo lectura con las MISMAS
// columnas y lo sensible en nulo, así el resto de la app no distingue el origen.
const FUENTES_DEL_CLIENTE: Partial<Record<keyof typeof CONSULTAS, string>> = {
  consultorias: 'mi_consultoria',
  empresas: 'mi_empresa',
}

// El RLS decide qué filas devuelve cada tabla: acá no se filtra nada a mano.
// Las notificaciones no son una tabla: las calcula mis_notificaciones() en cada lectura.
export async function cargarFilasSesion(cliente: ClienteDatos, rol: Rol): Promise<{ ok: true; filas: FilasSesion } | { ok: false }> {
  const claves = Object.keys(CONSULTAS) as (keyof typeof CONSULTAS)[]
  const esCliente = rol === 'Usuario Cliente'
  const [notificaciones, ...respuestas] = await Promise.all([
    cliente.rpc('mis_notificaciones'),
    ...claves.map((clave) => {
      const [tabla, columnas] = CONSULTAS[clave]
      return cliente.from((esCliente && FUENTES_DEL_CLIENTE[clave]) || tabla).select(columnas)
    }),
  ])

  if ([notificaciones, ...respuestas].some((respuesta) => respuesta.error || !respuesta.data)) return { ok: false }

  const filas = {
    ...Object.fromEntries(claves.map((clave, i) => [clave, respuestas[i].data])),
    notificaciones: notificaciones.data,
  } as unknown as FilasSesion
  return { ok: true, filas }
}

// ─── Traducción BD → tipos de la interfaz ───────────────────────────────────

// El calendario de México: un timestamp de las 01:30 UTC del 7 es del día 6 allá.
const CALENDARIO_MEXICO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' })

// '2026-09-01' → '01/09/2026' (una fecha sin hora no se mueve).
// '2026-09-01T03:00:00+00:00' → '31/08/2026' (un timestamp se lee en hora de México).
export function formatearFecha(valor: string | null): string {
  if (!valor) return ''
  const iso = valor.length > 10 ? CALENDARIO_MEXICO.format(new Date(valor)) : valor
  const [anio, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${anio}`
}

export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/)
  const letras = palabras.length > 1 ? palabras[0][0] + palabras[1][0] : palabras[0].slice(0, 2)
  return letras.toUpperCase()
}

const opcional = <T>(valor: T | null): T | undefined => valor ?? undefined

export function traducirConsultoria(fila: FilaConsultoria): Consultoria {
  return {
    id: fila.id,
    nombre: fila.nombre,
    rfc: fila.rfc ?? '',
    plan: fila.plan,
    activa: fila.activa,
    contacto: opcional(fila.contacto),
    email: opcional(fila.email),
    fechaAlta: formatearFecha(fila.creado_en),
    renovacion: opcional(fila.renovacion) && formatearFecha(fila.renovacion),
    limiteUsuarios: opcional(fila.limite_usuarios),
    almacenamientoGb: opcional(fila.almacenamiento_gb),
  }
}

export function traducirEmpresa(fila: FilaEmpresa, proyectos: FilaProyecto[]): Empresa {
  return {
    id: fila.id,
    consultoriaId: fila.consultoria_id,
    nombre: fila.nombre,
    nombreComercial: opcional(fila.nombre_comercial),
    rfc: fila.rfc ?? '',
    sector: fila.sector ?? '',
    tamano: fila.tamano ?? '',
    ciudad: fila.ciudad ?? '',
    estado: fila.entidad_federativa ?? '',
    direccion: opcional(fila.direccion),
    contactoPrincipal: fila.contacto_principal ?? '',
    cargoContacto: fila.cargo_contacto ?? '',
    emailContacto: fila.email_contacto ?? '',
    telefonoContacto: fila.telefono_contacto ?? '',
    procesosprincipales: opcional(fila.procesos_principales),
    alcanceInicial: opcional(fila.alcance_inicial),
    normaInteres: fila.norma_interes,
    consultorAsignadoId: opcional(fila.consultor_asignado_id),
    observaciones: opcional(fila.observaciones),
    activa: fila.activa,
    fechaAlta: formatearFecha(fila.creado_en),
    proyectosIds: proyectos.filter((proyecto) => proyecto.empresa_id === fila.id).map((proyecto) => proyecto.id),
    logoInicial: iniciales(fila.nombre_comercial ?? fila.nombre),
    trabajadores: opcional(fila.trabajadores),
  }
}

export function traducirProyecto(fila: FilaProyecto, fases: FilaFase[], miembros: FilaMiembro[]): Proyecto {
  const equipo = [fila.consultor_id, ...miembros.filter((m) => m.proyecto_id === fila.id).map((m) => m.usuario_id)]

  return {
    id: fila.id,
    nombre: fila.nombre,
    objetivo: opcional(fila.objetivo),
    alcance: opcional(fila.alcance),
    empresaId: fila.empresa_id,
    consultorId: fila.consultor_id ?? '',
    equipoIds: [...new Set(equipo.filter((id): id is string => Boolean(id)))],
    estado: fila.estado,
    // Sin `avance`: el de la fila no se mantiene; el avance de un proyecto sale de calcularAvance (E4).
    edicionNorma: fila.edicion_norma,
    fechaInicio: formatearFecha(fila.fecha_inicio),
    fechaFinEstimada: formatearFecha(fila.fecha_fin_estimada),
    fechaFinReal: fila.fecha_fin_real ? formatearFecha(fila.fecha_fin_real) : undefined,
    descripcion: fila.descripcion ?? '',
    fases: fases
      .filter((fase) => fase.proyecto_id === fila.id)
      .sort((a, b) => a.orden - b.orden)
      .map(({ id, nombre, estado, avance, orden }) => ({ id, nombre, estado, avance, orden })),
    // Ninguna pantalla los lee: la relación vive del lado del hijo.
    procesosIds: [],
    entregablesIds: [],
  }
}

function traducirActividad(fila: FilaActividad): ActividadProceso {
  return {
    id: fila.id,
    tipo: fila.tipo,
    responsableId: opcional(fila.responsable_id),
    descripcion: fila.descripcion,
    entradas: fila.entradas ?? '',
    recursos: fila.recursos ?? '',
    controles: fila.controles ?? '',
    resultado: fila.resultado ?? '',
    orden: fila.orden,
  }
}

export function traducirProceso(
  fila: FilaProceso,
  actividades: FilaActividad[],
  evidencias: { id: string; procesoId?: string }[],
  documentos: { id: string; procesoId?: string }[],
): Proceso {
  return {
    id: fila.id,
    nombre: fila.nombre,
    proyectoId: fila.proyecto_id,
    responsableId: fila.responsable_id ?? '',
    estado: fila.estado,
    descripcion: fila.descripcion ?? '',
    tipo: fila.tipo ?? undefined,
    fechaLevantamiento: fila.fecha_levantamiento ? formatearFecha(fila.fecha_levantamiento) : undefined,
    evidenciasIds: evidencias.filter((e) => e.procesoId === fila.id).map((e) => e.id),
    documentosIds: documentos.filter((d) => d.procesoId === fila.id).map((d) => d.id),
    entradas: fila.entradas,
    salidas: fila.salidas,
    objetivo: opcional(fila.objetivo),
    alcance: opcional(fila.alcance),
    puestoResponsable: opcional(fila.puesto_responsable),
    personalInvolucrado: opcional(fila.personal_involucrado),
    proveedores: fila.proveedores,
    clientes: fila.clientes,
    recursosMateriales: fila.recursos_materiales,
    equipos: fila.equipos,
    sistemas: fila.sistemas,
    controles: fila.controles,
    registros: fila.registros,
    indicadores: fila.indicadores,
    riesgos: fila.riesgos,
    problemas: fila.problemas,
    observaciones: opcional(fila.observaciones),
    mejoras: opcional(fila.mejoras),
    noAplica: fila.no_aplica,
    actividades: actividades
      .filter((a) => a.proceso_id === fila.id)
      .sort((a, b) => a.orden - b.orden)
      .map(traducirActividad),
  }
}

export function traducirEvidencia(
  fila: FilaEvidencia,
  proyectos: FilaProyecto[],
  perfiles: FilaPerfil[],
  historial: FilaHistorial[],
): Evidencia {
  const nombreDe = (id: string | null) => perfiles.find((p) => p.id === id)?.nombre
  const fechaCarga = formatearFecha(fila.creado_en)

  return {
    id: fila.id,
    nombre: fila.nombre,
    tipo: fila.tipo,
    procesoId: opcional(fila.proceso_id),
    actividadId: opcional(fila.actividad_id),
    proyectoId: fila.proyecto_id,
    empresaId: proyectos.find((p) => p.id === fila.proyecto_id)?.empresa_id,
    estado: fila.estado,
    descripcion: fila.descripcion ?? '',
    categoria: opcional(fila.categoria),
    archivoNombre: opcional(fila.archivo_nombre),
    archivoMime: opcional(fila.archivo_mime),
    archivoRuta: opcional(fila.archivo_ruta),
    autor: nombreDe(fila.subido_por),
    fechaCarga,
    fecha: fechaCarga,
    eliminadaEn: fila.eliminada_en ? formatearFecha(fila.eliminada_en) : undefined,
    eliminadaPor: nombreDe(fila.eliminada_por ?? null),
    motivoEliminacion: opcional(fila.motivo_eliminacion ?? null),
    historial: historial
      .filter((h) => h.entidad_tipo === 'evidencia' && h.entidad_id === fila.id)
      .sort((a, b) => a.creado_en.localeCompare(b.creado_en))
      .map((h) => ({
        id: String(h.id),
        fecha: formatearFecha(h.creado_en),
        autor: nombreDe(h.autor_id) ?? '',
        estadoAnterior: opcional(h.estado_anterior) as Evidencia['estado'] | undefined,
        estadoNuevo: opcional(h.estado_nuevo) as Evidencia['estado'] | undefined,
        // Eventos sin cambio de estado (eliminada, reactivada): se muestra la acción.
        accion: h.estado_nuevo ? undefined : h.accion,
        comentario: opcional(h.descripcion),
      })),
  }
}

export function traducirComentario(fila: Pick<FilaComentario, 'id' | 'seccion_id' | 'autor_id' | 'texto' | 'creado_en'>): ComentarioDocumento {
  return {
    id: fila.id,
    seccionId: fila.seccion_id ?? '',
    autorId: fila.autor_id,
    fecha: formatearFecha(fila.creado_en),
    texto: fila.texto,
  }
}

export function traducirDocumento(
  fila: FilaDocumento,
  proyectos: FilaProyecto[],
  versiones: FilaVersion[],
  vinculos: FilaVinculo[],
  historial: FilaHistorial[],
  comentarios: FilaComentario[],
): Documento {
  const porFecha = (a: { creado_en: string }, b: { creado_en: string }) => a.creado_en.localeCompare(b.creado_en)

  return {
    id: fila.id,
    nombre: fila.nombre,
    tipo: fila.tipo,
    proyectoId: fila.proyecto_id,
    procesoId: opcional(fila.proceso_id),
    empresaId: proyectos.find((p) => p.id === fila.proyecto_id)?.empresa_id,
    estado: fila.estado,
    version: fila.version,
    fechaCreacion: formatearFecha(fila.creado_en),
    fechaModificacion: formatearFecha(fila.actualizado_en),
    creadoPorId: fila.creado_por ?? '',
    revisadoPorId: opcional(fila.revisado_por),
    aprobadoPorId: opcional(fila.aprobado_por),
    fechaRevision: fila.fecha_revision ? formatearFecha(fila.fecha_revision) : undefined,
    fechaAprobacion: fila.fecha_aprobacion ? formatearFecha(fila.fecha_aprobacion) : undefined,
    vistoBuenoPorId: opcional(fila.visto_bueno_por),
    vistoBuenoEn: fila.visto_bueno_en ? formatearFecha(fila.visto_bueno_en) : undefined,
    vistoBuenoVersion: opcional(fila.visto_bueno_version),
    contenidoPendiente: fila.contenido_pendiente,
    codigo: opcional(fila.codigo),
    categoria: opcional(fila.categoria),
    plantilla: opcional(fila.plantilla),
    secciones: fila.secciones,
    referenciaNormativa: fila.referencia_normativa,
    motivoCambio: opcional(fila.motivo_cambio),
    bloqueado: fila.bloqueado,
    evidenciasVinculadas: vinculos.filter((v) => v.documento_id === fila.id).map((v) => v.evidencia_id),
    comentarios: comentarios
      .filter((c) => c.entidad_tipo === 'documento' && c.entidad_id === fila.id)
      .sort(porFecha)
      .map(traducirComentario),
    historialVersiones: versiones
      .filter((v) => v.documento_id === fila.id)
      .sort(porFecha)
      .map((v) => ({
        version: v.version,
        fecha: formatearFecha(v.creado_en),
        autorId: v.autor_id ?? '',
        comentario: v.comentario ?? '',
        motivo: opcional(v.motivo),
        secciones: v.secciones,
        estado: opcional(v.estado),
      })),
    historial: historial
      .filter((h) => h.entidad_tipo === 'documento' && h.entidad_id === fila.id)
      .sort(porFecha)
      .map((h) => ({
        id: String(h.id),
        fecha: formatearFecha(h.creado_en),
        autorId: h.autor_id ?? '',
        accion: h.accion,
        detalle: h.descripcion ?? '',
      })),
  }
}

export function traducirComentarioTarea(fila: Pick<FilaComentario, 'id' | 'autor_id' | 'texto' | 'creado_en'>): ComentarioTarea {
  return { id: fila.id, autorId: fila.autor_id, fecha: formatearFecha(fila.creado_en), texto: fila.texto }
}

export function traducirTarea(fila: FilaTarea, historial: FilaHistorial[], comentarios: FilaComentario[]): Tarea {
  const deEstaTarea = <T extends { entidad_tipo: string; entidad_id: string; creado_en: string }>(lista: T[]) =>
    lista
      .filter((item) => item.entidad_tipo === 'tarea' && item.entidad_id === fila.id)
      .sort((a, b) => a.creado_en.localeCompare(b.creado_en))

  return {
    id: fila.id,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    proyectoId: fila.proyecto_id,
    asignadoAId: fila.asignado_a,
    asignadoPorId: fila.asignado_por ?? '',
    estado: fila.estado,
    prioridad: fila.prioridad,
    fechaVencimiento: formatearFecha(fila.fecha_vencimiento),
    fechaCompletada: fila.fecha_completada ? formatearFecha(fila.fecha_completada) : undefined,
    dependencias: fila.dependencias,
    comentarios: deEstaTarea(comentarios).map(traducirComentarioTarea),
    historial: deEstaTarea(historial)
      .filter((h) => h.estado_nuevo)
      .map((h) => ({
        fecha: formatearFecha(h.creado_en),
        autorId: h.autor_id ?? '',
        de: h.estado_anterior ?? '',
        a: h.estado_nuevo ?? '',
      })),
  }
}

export function traducirIndicador(fila: FilaIndicador): IndicadorGestion {
  return {
    id: fila.id,
    ambito: fila.ambito,
    empresaId: opcional(fila.empresa_id),
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    formula: fila.formula,
    unidad: fila.unidad,
    frecuencia: fila.frecuencia,
    responsableId: fila.responsable_id,
    meta: fila.meta,
    periodo: fila.periodo,
    // Vacío = todavía no hay medición ("Sin datos suficientes"), no un cero.
    valor: fila.valor || undefined,
  }
}

export function traducirEntregable(fila: FilaEntregable): Entregable {
  return {
    id: fila.id,
    nombre: fila.nombre,
    proyectoId: fila.proyecto_id,
    tipo: fila.tipo,
    estado: fila.estado,
    fechaEntrega: fila.fecha_entrega ? formatearFecha(fila.fecha_entrega) : undefined,
    fechaAprobacion: fila.fecha_aprobacion ? formatearFecha(fila.fecha_aprobacion) : undefined,
    aprobadoPorId: opcional(fila.aprobado_por),
    documentoId: opcional(fila.documento_id),
  }
}

export function traducirLista(fila: FilaLista, preguntas: FilaPregunta[], proyectos: FilaProyecto[]): ListaVerificacion {
  return {
    id: fila.id,
    nombre: fila.nombre,
    empresaId: proyectos.find((p) => p.id === fila.proyecto_id)?.empresa_id ?? '',
    proyectoId: fila.proyecto_id,
    procesoId: opcional(fila.proceso_id),
    area: fila.area,
    responsableId: fila.responsable_id,
    fecha: formatearFecha(fila.fecha),
    edicionNorma: fila.edicion_norma,
    preguntas: preguntas
      .filter((p) => p.lista_id === fila.id)
      .sort((a, b) => a.orden - b.orden)
      .map((p) => ({
        id: p.id,
        pregunta: p.pregunta,
        estado: p.estado,
        referenciaRequisito: p.referencia_requisito,
        evidenciaId: opcional(p.evidencia_id),
        observaciones: p.observaciones,
        justificacionNoAplica: p.justificacion_no_aplica,
      })),
  }
}

export function traducirNoConformidad(fila: FilaNoConformidad, proyectos: FilaProyecto[], historial: FilaHistorial[]): NoConformidad {
  return {
    id: fila.id,
    folio: fila.folio,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    proyectoId: fila.proyecto_id,
    empresaId: proyectos.find((p) => p.id === fila.proyecto_id)?.empresa_id,
    procesoId: opcional(fila.proceso_id),
    evidenciaIds: fila.evidencia_ids,
    estado: fila.estado,
    tipo: fila.tipo,
    detectadaEn: fila.detectada_en,
    fechaDeteccion: formatearFecha(fila.fecha_deteccion),
    responsableId: fila.responsable_id,
    responsableAccionId: opcional(fila.responsable_accion_id),
    fechaLimite: fila.fecha_limite ? formatearFecha(fila.fecha_limite) : undefined,
    acciones: lineasDeAccion(fila.accion_correctiva),
    correccionInmediata: fila.correccion_inmediata,
    analisisCausa: fila.analisis_causa,
    accionCorrectiva: fila.accion_correctiva,
    eficacia: fila.eficacia,
    verificacionEficacia: fila.verificacion_eficacia,
    fechaCierre: fila.fecha_cierre ? formatearFecha(fila.fecha_cierre) : undefined,
    observaciones: fila.observaciones,
    historial: historial
      .filter((h) => h.entidad_tipo === 'no_conformidad' && h.entidad_id === fila.id)
      .sort((a, b) => a.creado_en.localeCompare(b.creado_en))
      .map((h) => ({
        id: String(h.id),
        fecha: formatearFecha(h.creado_en),
        autorId: h.autor_id ?? '',
        accion: h.accion,
        detalle: h.descripcion ?? (h.estado_nuevo ? `${h.estado_anterior} → ${h.estado_nuevo}` : ''),
      })),
  }
}

function proyectosDelUsuario(perfil: FilaPerfil, filas: FilasSesion): string[] {
  const { proyectos, miembros } = filas
  switch (perfil.rol) {
    case 'admin_prociso':
      return proyectos.map((p) => p.id)
    case 'admin_consultoria':
      return proyectos.filter((p) => p.consultoria_id === perfil.consultoria_id).map((p) => p.id)
    case 'consultor':
      return miembros.filter((m) => m.usuario_id === perfil.id).map((m) => m.proyecto_id)
    case 'usuario_cliente':
      return proyectos.filter((p) => p.empresa_id === perfil.empresa_id).map((p) => p.id)
  }
}

function traducirUsuario(perfil: FilaPerfil, filas: FilasSesion): Usuario {
  return {
    id: perfil.id,
    nombre: perfil.nombre,
    email: perfil.email,
    rol: mapearRol(perfil.rol),
    consultoriaId: opcional(perfil.consultoria_id),
    empresaId: opcional(perfil.empresa_id),
    proyectosAsignados: proyectosDelUsuario(perfil, filas),
    activo: perfil.activo,
    cargo: perfil.cargo ?? '',
    passwordTemp: perfil.password_temporal,
  }
}

export function traducirNotificacion(fila: FilaNotificacion): Notificacion {
  return {
    id: fila.clave,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    tipo: fila.tipo,
    leida: fila.leida,
    fecha: formatearFecha(fila.fecha),
    pagina: opcional(fila.pagina),
    proyectoId: opcional(fila.proyecto_id),
  }
}

export function traducirCriterio(fila: FilaCriterio): CriterioEvaluacion {
  return {
    id: fila.id,
    clausula: fila.clausula,
    titulo: fila.titulo,
    intencion: fila.intencion,
    evidenciaEsperada: fila.evidencia_esperada,
    preguntas: fila.preguntas,
    senalesDeHueco: fila.senales_de_hueco,
    puedeNoAplicar: fila.puede_no_aplicar,
    condicionNoAplica: opcional(fila.condicion_no_aplica),
    orden: fila.orden,
  }
}

export function traducirResultadoAnalisis(fila: Omit<FilaResultadoAnalisis, 'analisis_id' | 'orden'>): ResultadoAnalisisIA {
  return { criterioId: fila.criterio_id, estado: fila.estado, hallazgos: opcional(fila.hallazgos), sugerencias: opcional(fila.sugerencias) }
}

export function traducirAnalisis(fila: FilaAnalisis, resultados: FilaResultadoAnalisis[]): AnalisisIA {
  return {
    id: fila.id,
    proyectoId: fila.proyecto_id,
    fuenteTipo: fila.fuente_tipo,
    documentoId: opcional(fila.documento_id),
    evidenciaId: opcional(fila.evidencia_id),
    criterioIds: fila.criterio_ids,
    solicitadoPorId: fila.solicitado_por,
    estado: fila.estado,
    resumen: opcional(fila.resumen),
    errorDetalle: opcional(fila.error_detalle),
    proveedor: opcional(fila.proveedor),
    modelo: opcional(fila.modelo),
    fecha: formatearFecha(fila.creado_en),
    resultados: resultados
      .filter((r) => r.analisis_id === fila.id)
      .sort((a, b) => a.orden - b.orden)
      .map(traducirResultadoAnalisis),
  }
}

export function traducirComentarioGlobal(fila: FilaComentario): ComentarioGlobal {
  return {
    id: fila.id,
    entidadTipo: fila.entidad_tipo as ComentarioGlobal['entidadTipo'],
    entidadId: fila.entidad_id,
    proyectoId: fila.proyecto_id,
    seccionId: opcional(fila.seccion_id),
    autorId: fila.autor_id,
    fecha: formatearFecha(fila.creado_en),
    texto: fila.texto,
  }
}

// La actividad (auditoría) es el historial real: el RLS ya dejó solo lo visible.
export function traducirHistorial(filas: FilaHistorial[]): EntradaHistorial[] {
  return [...filas]
    .sort((a, b) => b.creado_en.localeCompare(a.creado_en))
    .map((h) => ({
      id: String(h.id),
      fecha: formatearFecha(h.creado_en),
      autorId: h.autor_id ?? '',
      accion: h.accion,
      descripcion: h.descripcion ?? (h.estado_nuevo ? `${h.estado_anterior} → ${h.estado_nuevo}` : ''),
      entidadId: h.entidad_id,
      proyectoId: opcional(h.proyecto_id),
      entidadTipo: h.entidad_tipo as EntradaHistorial['entidadTipo'],
    }))
}

// ─── Combinación: todo sale de la BD ────────────────────────────────────────

export function combinarDatosSesion(filas: FilasSesion): DatosSesion {

  const todasLasEvidencias = filas.evidencias.map((fila) => traducirEvidencia(fila, filas.proyectos, filas.perfiles, filas.historial))
  const evidencias = todasLasEvidencias.filter((e) => !e.eliminadaEn)
  const evidenciasEliminadas = todasLasEvidencias.filter((e) => !!e.eliminadaEn)
  const documentos = filas.documentos.map((fila) =>
    traducirDocumento(fila, filas.proyectos, filas.versiones, filas.vinculos, filas.historial, filas.comentarios),
  )
  const tareas = filas.tareas.map((fila) => traducirTarea(fila, filas.historial, filas.comentarios))

  return {
    consultorias: filas.consultorias.map(traducirConsultoria),
    empresas: filas.empresas.map((fila) => traducirEmpresa(fila, filas.proyectos)),
    usuarios: filas.perfiles.map((perfil) => traducirUsuario(perfil, filas)),
    proyectos: filas.proyectos.map((fila) => traducirProyecto(fila, filas.fases, filas.miembros)),
    procesos: filas.procesos.map((fila) => traducirProceso(fila, filas.actividades, evidencias, documentos)),
    evidencias,
    evidenciasEliminadas,
    documentos,
    tareas,
    entregables: filas.entregables.map(traducirEntregable),
    indicadores: filas.indicadores.map(traducirIndicador),
    noConformidades: filas.noConformidades.map((fila) => traducirNoConformidad(fila, filas.proyectos, filas.historial)),
    listasVerificacion: filas.listas.map((fila) => traducirLista(fila, filas.preguntas, filas.proyectos)),
    criterios: [...filas.criterios].sort((a, b) => a.orden - b.orden).map(traducirCriterio),
    // Del más nuevo al más viejo.
    analisisIA: [...filas.analisis]
      .sort((a, b) => b.creado_en.localeCompare(a.creado_en))
      .map((fila) => traducirAnalisis(fila, filas.analisisResultados)),
    comentariosGlobales: [...filas.comentarios]
      .sort((a, b) => b.creado_en.localeCompare(a.creado_en))
      .map(traducirComentarioGlobal),
    notificaciones: filas.notificaciones.map(traducirNotificacion),
    historial: traducirHistorial(filas.historial),
  }
}
