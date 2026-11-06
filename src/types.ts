// ─── Auth ─────────────────────────────────────────────────────────────────────
export type AuthScreen = 'checking' | 'login' | 'recovery' | 'recovery-sent' | 'change-password' | 'app'
export type LoginReason = 'expired' | 'blocked' | 'temp-password' | 'recovery' | undefined

// ─── Roles ────────────────────────────────────────────────────────────────────
export type Rol = 'Admin PROCISO' | 'Admin Consultoría' | 'Consultor' | 'Usuario Cliente'

// ─── Project states ───────────────────────────────────────────────────────────
export type EstadoProyecto =
  | 'Planificación'
  | 'Diagnóstico'
  | 'Recopilación de información'
  | 'Análisis de procesos'
  | 'Elaboración documental'
  | 'Revisión'
  | 'Correcciones'
  | 'Validación'
  | 'Finalizado'
  | 'Suspendido'

// ─── Task states ──────────────────────────────────────────────────────────────
export type EstadoTarea =
  | 'Pendiente'
  | 'En proceso'
  | 'En revisión'
  | 'Requiere corrección'
  | 'Completada'
// "Vencida" no es un estado: se calcula con estaVencida() (src/lib/tareas.ts).

// ─── Document states ──────────────────────────────────────────────────────────
export type EstadoDocumento =
  | 'Borrador'
  | 'En elaboración'
  | 'Pendiente de revisión'
  | 'En corrección'
  | 'Aprobado'
  | 'Rechazado'
  | 'Obsoleto'

// ─── Process states ───────────────────────────────────────────────────────────
export type EstadoProceso = 'Pendiente' | 'En levantamiento' | 'Documentado' | 'Revisado' | 'Aprobado'

// ─── Non-conformance states ───────────────────────────────────────────────────
export type EstadoNC = 'Abierta' | 'En análisis' | 'En corrección' | 'Verificada' | 'Cerrada'

// ─── Deliverable states ───────────────────────────────────────────────────────
export type EstadoEntregable = 'Pendiente' | 'En revisión' | 'Aprobado' | 'Rechazado'

// ─── Other enums ──────────────────────────────────────────────────────────────
export type PrioridadTarea = 'Alta' | 'Media' | 'Baja'
export type TipoEvidencia = 'Foto' | 'Video' | 'Audio' | 'Documento' | 'Formulario'
export type EstadoEvidencia = 'Pendiente' | 'Cargada' | 'Revisada' | 'Aceptada' | 'Requiere corrección'
export type TipoNC = 'Mayor' | 'Menor' | 'Observación'
export type TipoNotificacion = 'info' | 'success' | 'warning' | 'error'

// ─── Navigation ───────────────────────────────────────────────────────────────
export type PageId =
  | 'inicio'
  | 'empresas'
  | 'empresa-detalle'
  | 'proyectos'
  | 'proyecto-detalle'
  | 'levantamiento'
  | 'procesos'
  | 'evidencias'
  | 'documentacion'
  | 'revisiones'
  | 'tareas'
  | 'tablero-tareas'
  | 'listas-verificacion'
  | 'no-conformidades'
  | 'indicadores'
  | 'notificaciones'
  | 'usuarios'
  | 'configuracion'
  | 'ayuda'
  | 'unauthorized'

export interface NavParams {
  id?: string
  [key: string]: string | undefined
}

// ─── Domain models ────────────────────────────────────────────────────────────

export interface Consultoria {
  id: string
  nombre: string
  rfc: string
  plan: string
  activa?: boolean
  contacto?: string
  email?: string
  fechaAlta?: string
  renovacion?: string
  limiteUsuarios?: number
  almacenamientoGb?: number
}

export interface Usuario {
  id: string
  nombre: string
  email: string
  rol: Rol
  consultoriaId?: string
  empresaId?: string
  proyectosAsignados: string[]
  activo: boolean
  cargo: string
  passwordTemp?: boolean
}

export interface Empresa {
  id: string
  consultoriaId?: string
  nombre: string
  nombreComercial?: string
  rfc: string
  sector: string
  tamano: string
  ciudad: string
  estado: string
  direccion?: string
  contactoPrincipal: string
  cargoContacto: string
  emailContacto: string
  telefonoContacto: string
  procesosprincipales?: string
  alcanceInicial?: string
  normaInteres?: 'ISO 9001:2026' | 'ISO 9001:2015'
  consultorAsignadoId?: string
  observaciones?: string
  activa: boolean
  fechaAlta: string
  proyectosIds: string[]
  logoInicial: string
  trabajadores?: string
}

export interface Fase {
  id: string
  nombre: string
  estado: 'Completada' | 'En curso' | 'Pendiente'
  avance: number
  orden: number
}

export interface Proyecto {
  id: string
  nombre: string
  objetivo?: string
  alcance?: string
  empresaId: string
  consultorId: string
  equipoIds: string[]
  estado: EstadoProyecto
  avance: number
  edicionNorma: 'ISO 9001:2026' | 'ISO 9001:2015'
  fechaInicio: string
  fechaFinEstimada: string
  fechaFinReal?: string
  descripcion: string
  fases: Fase[]
  procesosIds: string[]
  entregablesIds: string[]
}

export interface Entregable {
  id: string
  nombre: string
  proyectoId: string
  tipo: string
  estado: EstadoEntregable
  fechaEntrega?: string
  fechaAprobacion?: string
  aprobadoPorId?: string
  documentoId?: string
}

export interface Proceso {
  id: string
  nombre: string
  proyectoId: string
  responsableId: string
  estado: EstadoProceso
  descripcion: string
  fechaLevantamiento?: string
  evidenciasIds: string[]
  documentosIds: string[]
  entradas: string[]
  salidas: string[]
  objetivo?: string
  alcance?: string
  puestoResponsable?: string
  personalInvolucrado?: string
  proveedores?: string[]
  clientes?: string[]
  recursosMateriales?: string[]
  equipos?: string[]
  sistemas?: string[]
  controles?: string[]
  registros?: string[]
  indicadores?: string[]
  riesgos?: string[]
  problemas?: string[]
  observaciones?: string
  mejoras?: string
  noAplica?: Record<string, string>
  actividades?: ActividadProceso[]
}

export type TipoActividad = 'Inicio' | 'Actividad' | 'Decisión' | 'Fin'

export interface ActividadProceso {
  id: string
  tipo: TipoActividad
  responsableId?: string
  descripcion: string
  entradas: string
  recursos: string
  controles: string
  resultado: string
  orden: number
}

export interface HistorialEvidencia {
  id: string
  fecha: string
  autor: string
  estadoAnterior?: EstadoEvidencia
  estadoNuevo: EstadoEvidencia
  comentario?: string
}

export interface Evidencia {
  id: string
  nombre: string
  tipo: TipoEvidencia
  procesoId?: string
  proyectoId: string
  estado: EstadoEvidencia
  fechaCarga?: string
  descripcion: string
  archivoNombre?: string
  empresaId?: string
  actividadId?: string
  categoria?: string
  autor?: string
  fecha?: string
  // Ruta en el bucket privado "evidencias". archivoUrl es una URL firmada que vence.
  archivoRuta?: string
  archivoUrl?: string
  archivoMime?: string
  historial?: HistorialEvidencia[]
}

export interface VersionDocumento {
  version: string
  fecha: string
  autorId: string
  comentario: string
  motivo?: string
  secciones?: SeccionDocumento[]
  estado?: EstadoDocumento
}

export type CategoriaDocumento = 'A' | 'B' | 'C'

export interface SeccionDocumento {
  id: string
  titulo: string
  contenido: string
  tipo: 'texto' | 'tabla'
  filas?: string[][]
}

export interface ComentarioDocumento {
  id: string
  seccionId: string
  autorId: string
  fecha: string
  texto: string
}

export interface EventoDocumento {
  id: string
  fecha: string
  autorId: string
  accion: string
  detalle: string
}

export interface Documento {
  id: string
  nombre: string
  tipo:
    | 'Procedimiento'
    | 'Manual'
    | 'Instrucción de trabajo'
    | 'Ficha de proceso'
    | 'Formato'
    | 'Lista de verificación'
    | 'Matriz'
    | 'Plan'
    | 'Registro'
    | 'Política'
  proyectoId: string
  procesoId?: string
  estado: EstadoDocumento
  version: string
  fechaCreacion: string
  fechaModificacion: string
  creadoPorId: string
  revisadoPorId?: string
  aprobadoPorId?: string
  historialVersiones: VersionDocumento[]
  contenidoPendiente?: boolean
  codigo?: string
  categoria?: CategoriaDocumento
  empresaId?: string
  plantilla?: string
  secciones?: SeccionDocumento[]
  evidenciasVinculadas?: string[]
  comentarios?: ComentarioDocumento[]
  historial?: EventoDocumento[]
  motivoCambio?: string
  fechaRevision?: string
  fechaAprobacion?: string
  bloqueado?: boolean
  referenciaNormativa?: 'ISO 9001:2026' | 'ISO 9001:2015'
}

export interface ComentarioTarea {
  id: string
  autorId: string
  fecha: string
  texto: string
}

export interface Tarea {
  id: string
  titulo: string
  descripcion: string
  proyectoId: string
  asignadoAId: string
  asignadoPorId: string
  estado: EstadoTarea
  prioridad: PrioridadTarea
  fechaVencimiento: string
  fechaCompletada?: string
  dependencias: string[]
  comentarios: ComentarioTarea[]
  historial: { fecha: string; autorId: string; de: string; a: string }[]
}

export interface EntradaHistorial {
  id: string
  fecha: string
  autorId: string
  accion: string
  descripcion: string
  entidadId: string
  // Los mismos tipos que acepta public.historial.
  entidadTipo:
    | 'consultoria'
    | 'empresa'
    | 'proyecto'
    | 'proceso'
    | 'evidencia'
    | 'documento'
    | 'usuario'
    | 'tarea'
    | 'no_conformidad'
    | 'entregable'
}

export interface NoConformidad {
  id: string
  folio: string // NC-001 por proyecto, lo pone el servidor
  titulo: string
  descripcion: string
  proyectoId: string
  estado: EstadoNC
  tipo: TipoNC
  detectadaEn: string
  fechaDeteccion: string
  responsableId: string
  acciones: string[]
  fechaCierre?: string
  observaciones?: string
  empresaId?: string
  procesoId?: string
  evidenciaIds?: string[]
  correccionInmediata?: string
  analisisCausa?: string
  accionCorrectiva?: string
  responsableAccionId?: string
  fechaLimite?: string
  verificacionEficacia?: string
  eficacia?: 'Pendiente' | 'Eficaz' | 'No eficaz'
  historial?: { id: string; fecha: string; autorId: string; accion: string; detalle: string }[]
}

export type EstadoVerificacion =
  | 'Cumple según la evidencia revisada'
  | 'No cumple según la evidencia revisada'
  | 'Parcialmente atendido'
  | 'No aplica'
  | 'Pendiente de verificar'

export interface PreguntaVerificacion {
  id: string
  pregunta: string
  estado: EstadoVerificacion
  evidenciaId?: string
  observaciones?: string
  justificacionNoAplica?: string
  referenciaRequisito?: string
}

export interface ListaVerificacion {
  id: string
  nombre: string
  empresaId: string
  proyectoId: string
  procesoId?: string
  area?: string
  responsableId: string
  fecha: string
  edicionNorma: 'ISO 9001:2026' | 'ISO 9001:2015'
  preguntas: PreguntaVerificacion[]
}

export interface IndicadorGestion {
  id: string
  ambito: 'PROCISO' | 'SGC'
  empresaId?: string
  proyectoId?: string
  nombre: string
  descripcion: string
  formula: string
  unidad: string
  frecuencia: string
  responsableId: string
  meta: string
  periodo: string
  valor?: string
}

// Cualquier fila de public.comentarios (la conversación transversal del proyecto).
export interface ComentarioGlobal {
  id: string
  entidadTipo: 'tarea' | 'proceso' | 'documento' | 'evidencia' | 'no_conformidad' | 'entregable'
  entidadId: string
  proyectoId: string
  seccionId?: string // solo las observaciones de revisión de documentos
  autorId: string
  fecha: string
  texto: string
}

export interface Notificacion {
  id: string
  titulo: string
  descripcion: string
  tipo: TipoNotificacion
  leida: boolean
  fecha: string
  pagina?: PageId
  proyectoId?: string
}

// ─── UI types ─────────────────────────────────────────────────────────────────

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export interface ModalState {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
}

