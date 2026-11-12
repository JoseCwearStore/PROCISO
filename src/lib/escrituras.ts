import type {
  AnalisisIA,
  ComentarioDocumento,
  ResultadoAnalisisIA,
  Consultoria,
  Rol,
  ComentarioGlobal,
  ComentarioTarea,
  Documento,
  Empresa,
  Entregable,
  EstadoEntregable,
  EstadoEvidencia,
  EstadoNC,
  EstadoProyecto,
  EstadoTarea,
  Evidencia,
  IndicadorGestion,
  ListaVerificacion,
  NoConformidad,
  PrioridadTarea,
  Proceso,
  Proyecto,
  Tarea,
  TipoEvidencia,
} from '../types'
import {
  traducirComentario,
  traducirComentarioGlobal,
  traducirComentarioTarea,
  traducirConsultoria,
  traducirResultadoAnalisis,
  traducirEmpresa,
  traducirEntregable,
  traducirEvidencia,
  traducirIndicador,
  traducirNoConformidad,
  traducirProyecto,
  traducirTarea,
  type FilaComentario,
  type FilaConsultoria,
  type FilaEmpresa,
  type FilaEntregable,
  type FilaEvidencia,
  type FilaIndicador,
  type FilaNoConformidad,
  type FilaProyecto,
  type FilaTarea,
} from './datos'
import { fechaISO } from './tareas'
import { rolDeBD } from './auth'
import type { PedidoGeneracionIA } from './generacion'

// Escritura pesimista: primero se guarda en la BD y la pantalla se actualiza con
// lo que la BD devolvió. Si el RLS lo rechaza, la pantalla no cambia.

export type ErrorEscritura =
  | 'sin_permiso'
  | 'sin_consultoria'
  | 'datos_invalidos'
  | 'archivo_grande'
  | 'tipo_no_permitido'
  | 'documento_en_revision'
  | 'version_ya_enviada'
  | 'version_desactualizada'
  | 'limite_ia'
  | 'limite_transcripciones'
  | 'limite_reportes'
  // Mensajes que la BD escribe a propósito en las operaciones del equipo de un proyecto (L5d).
  | 'empresa_archivada'
  | 'ya_es_miembro'
  | 'ya_es_responsable'
  | 'miembro_responsable'
  | 'miembro_tareas_abiertas'
  | 'servicio'

// Status HTTP de las Edge Functions de IA → error de la app. 429 = tope diario de pedidos.
const errorDeFuncionIA = (status?: number): ErrorEscritura =>
  status === 403 ? 'sin_permiso' : status === 400 ? 'datos_invalidos' : status === 429 ? 'limite_ia' : 'servicio'
// `detalle`: el texto que la propia BD escribió para el usuario cuando una regla de negocio rechazó la
// operación (código 22023). Si está, la pantalla lo muestra en lugar del mensaje genérico (AUD06-B1).
export interface FallaEscritura {
  error: ErrorEscritura
  detalle?: string
}
export type ResultadoEscritura<T> = { ok: true; valor: T } | ({ ok: false } & FallaEscritura)

interface ErrorBD {
  code?: string
  message: string
}

type RespuestaFila = PromiseLike<{ data: unknown; error: ErrorBD | null }>

export interface ClienteEscritura {
  from(tabla: string): {
    insert(fila: Record<string, unknown>): { select(columnas: string): { single(): RespuestaFila } }
    update(cambios: Record<string, unknown>): {
      eq(columna: 'id', valor: string): { select(columnas: string): { single(): RespuestaFila } }
    }
  }
  rpc(
    funcion:
      | 'guardar_proceso'
      | 'revisar_evidencia'
      | 'guardar_documento'
      | 'decidir_documento'
      | 'retirar_documento_de_revision'
      | 'cambiar_estado_tarea'
      | 'guardar_tratamiento_nc'
      | 'cambiar_estado_nc'
      | 'guardar_lista'
      | 'decidir_entregable'
      | 'marcar_notificaciones_leidas'
      | 'cambiar_estado_consultoria'
      | 'administrar_usuario'
      | 'crear_proyecto'
      | 'agregar_miembro_proyecto'
      | 'quitar_miembro_proyecto'
      | 'cambiar_consultor_proyecto',
    args: Record<string, unknown>,
  ): PromiseLike<{ data?: unknown; error: ErrorBD | null }>
  // Edge Functions. El error trae el status HTTP de la respuesta de la función.
  functions: {
    invoke(
      nombre: 'invitar-usuario' | 'analizar-ia' | 'generar-documento',
      opciones: { body: Record<string, unknown> },
    ): PromiseLike<{ data: unknown; error: { message: string; status?: number } | null }>
  }
  storage: {
    from(bucket: 'evidencias'): {
      upload(ruta: string, archivo: File, opciones: { contentType: string }): PromiseLike<{ error: ErrorStorage | null }>
      remove(rutas: string[]): PromiseLike<{ error: unknown }>
    }
  }
}

interface ErrorStorage {
  message: string
  statusCode?: string
}

export interface NuevaConsultoria {
  nombre: string
  rfc: string
  contacto: string
  email: string
  plan: string
  limiteUsuarios: number
  almacenamientoGb: number
}

// Los únicos roles que se cambian desde la app (consultor ↔ admin de consultoría).
export const ROLES_DEL_EQUIPO: Rol[] = ['Consultor', 'Admin Consultoría']
// Los que se invitan: el equipo y los clientes (nunca un Admin PROCISO).
export const ROLES_INVITABLES: Rol[] = [...ROLES_DEL_EQUIPO, 'Usuario Cliente']

export interface PedidoAnalisisIA {
  consultoriaId: string | null
  proyectoId: string
  fuenteTipo: 'documento' | 'evidencia'
  documentoId?: string
  evidenciaId?: string
  criterioIds: string[]
}

// Resultado de pedirle a la IA que redacte partes de un borrador. Una IA que falla NO es una
// falla de escritura: vuelve como "Error" con su motivo y la pantalla usa el plan B.
export type ResultadoGeneracionIA =
  | { estado: 'Completado'; textos: Record<string, string>; proveedor?: string; modelo?: string }
  | { estado: 'Error'; error: string }

// Lo que devuelve la Edge Function generar-documento.
interface RespuestaGeneracionIA {
  id: string
  estado: 'Completado' | 'Error'
  textos?: Record<string, string>
  error?: string | null
  proveedor?: string | null
  modelo?: string | null
}

// Lo que devuelve la Edge Function analizar-ia.
interface RespuestaAnalisisIA {
  id: string
  estado: AnalisisIA['estado']
  resumen?: string | null
  error?: string | null
  proveedor?: string | null
  modelo?: string | null
  resultados?: { criterio_id: string; estado: ResultadoAnalisisIA['estado']; hallazgos: string | null; sugerencias: string | null }[]
}

export interface NuevaInvitacion {
  nombre: string
  email: string
  cargo: string
  rol: Rol
  consultoriaId: string | null
  empresaId: string | null
}

export interface NuevaEvidencia {
  id: string // UUID generado en el navegador: es también el nombre del archivo
  consultoriaId: string | null
  empresaId: string
  proyectoId: string
  procesoId: string
  actividadId: string
  nombre: string
  descripcion: string
  categoria: string
  autor: string
}

function tipoDeArchivo(mime: string): TipoEvidencia {
  if (mime.startsWith('image/')) return 'Foto'
  if (mime.startsWith('video/')) return 'Video'
  if (mime.startsWith('audio/')) return 'Audio'
  return 'Documento'
}

// Solo letras y números: el nombre original del usuario nunca entra en la ruta.
function extension(nombre: string): string {
  const coincidencia = /\.([a-z0-9]{1,10})$/i.exec(nombre)
  return coincidencia ? `.${coincidencia[1].toLowerCase()}` : ''
}

function traducirErrorStorage(error: ErrorStorage): ErrorEscritura {
  if (error.statusCode === '413') return 'archivo_grande'
  if (error.statusCode === '415') return 'tipo_no_permitido'
  if (error.statusCode === '403' || /row-level security/i.test(error.message)) return 'sin_permiso'
  return 'servicio'
}

export interface NuevaEmpresa {
  nombre: string
  nombreComercial: string
  rfc: string
  sector: string
  tamano: string
  ciudad: string
  estado: string
  direccion: string
  contactoPrincipal: string
  cargoContacto: string
  emailContacto: string
  telefonoContacto: string
  procesosprincipales: string
  alcanceInicial: string
  normaInteres: NonNullable<Empresa['normaInteres']>
  consultorAsignadoId: string
  observaciones: string
  trabajadores: string
}

export interface NuevoProyecto {
  nombre: string
  empresaId: string
  consultorId: string
  edicionNorma: Proyecto['edicionNorma']
  objetivo: string
  alcance: string
  fechaInicio: string // yyyy-mm-dd (input type="date")
  fechaFinEstimada: string
}

export interface NuevaTarea {
  id: string // UUID generado en el navegador
  proyectoId: string
  titulo: string
  descripcion: string
  asignadoAId: string
  prioridad: PrioridadTarea
  fechaVencimiento: string // ISO (input date) o dd/mm/aaaa
  dependencias?: string[]
}

// Lo único que la BD deja editar directo (permisos por columna). El estado NO:
// va por cambiarEstadoTarea, que deja historial.
export type CambiosTarea = Partial<Pick<Tarea, 'titulo' | 'descripcion' | 'asignadoAId' | 'prioridad' | 'fechaVencimiento' | 'dependencias'>>

const COLUMNAS_TAREA: Record<keyof CambiosTarea, string> = {
  titulo: 'titulo',
  descripcion: 'descripcion',
  asignadoAId: 'asignado_a',
  prioridad: 'prioridad',
  fechaVencimiento: 'fecha_vencimiento',
  dependencias: 'dependencias',
}

// Datos del REGISTRO de una NC (lo único que la BD deja escribir directo, y solo
// al equipo). Folio, estado, eficacia y tratamiento van por sus RPC.
export interface DatosNC {
  proyectoId: string
  titulo: string
  descripcion: string
  tipo: NoConformidad['tipo']
  detectadaEn: string
  fechaDeteccion: string // ISO (input date) o dd/mm/aaaa
  procesoId: string
  evidenciaIds: string[]
  responsableId: string
  responsableAccionId: string
  fechaLimite: string
  observaciones: string
}

export interface NuevoEntregable {
  proyectoId: string
  nombre: string
  tipo: string
  fechaEntrega: string // ISO (input date) o dd/mm/aaaa; vacío = sin fecha
  documentoId: string // vacío = sin documento
}

export interface TratamientoNC {
  correccion: string
  causa: string
  accion: string
}

const fechaONulo = (fecha: string) => (fecha.trim() ? fechaISO(fecha) : null)

function filaRegistroNC(datos: DatosNC) {
  return {
    titulo: datos.titulo.trim(),
    descripcion: datos.descripcion.trim(),
    tipo: datos.tipo,
    detectada_en: datos.detectadaEn.trim(),
    fecha_deteccion: fechaISO(datos.fechaDeteccion),
    proceso_id: datos.procesoId || null,
    evidencia_ids: datos.evidenciaIds,
    responsable_id: datos.responsableId,
    responsable_accion_id: datos.responsableAccionId || null,
    fecha_limite: fechaONulo(datos.fechaLimite),
    observaciones: datos.observaciones.trim(),
  }
}

// 22023: el servidor rechazó la operación por una regla de negocio (estado, datos faltantes).
// 42501: el RLS rechazó el INSERT. PGRST116: el UPDATE no encontró la fila, porque
// el RLS no le deja ver esa fila a este usuario. Para quien usa la app, lo mismo.
// 23514 (CHECK) y 23503 (FK): la BD rechazó los datos (p. ej. "No aplica" sin
// justificar, o una evidencia de otro proyecto).
function traducirError(error: ErrorBD): ErrorEscritura {
  // Mensajes que la BD escribe a propósito para el usuario (L2): se distinguen por su texto.
  if (error.code === '22023' && /cambió desde que lo abriste/i.test(error.message)) return 'version_desactualizada'
  if (error.code === '42501' && /está en revisión/i.test(error.message)) return 'documento_en_revision'
  if (error.code === '42501' && /ya se envió a revisión/i.test(error.message)) return 'version_ya_enviada'
  // Equipo del proyecto (L5d): cada regla de la BD tiene su mensaje.
  if (error.code === '22023' && /empresa está archivada/i.test(error.message)) return 'empresa_archivada'
  if (error.code === '22023' && /ya es parte del equipo/i.test(error.message)) return 'ya_es_miembro'
  if (error.code === '22023' && /ya es el consultor responsable/i.test(error.message)) return 'ya_es_responsable'
  if (error.code === '22023' && /es el consultor responsable: cámbialo/i.test(error.message)) return 'miembro_responsable'
  if (error.code === '22023' && /tiene tareas abiertas/i.test(error.message)) return 'miembro_tareas_abiertas'
  if (error.code === '22023' || error.code === '23514' || error.code === '23503') return 'datos_invalidos'
  return error.code === '42501' || error.code === 'PGRST116' ? 'sin_permiso' : 'servicio'
}

// Las reglas de negocio de la BD (raise … errcode '22023') son frases pensadas para el usuario. Por
// seguridad no se muestra nada que parezca texto interno de Postgres (tablas, columnas, restricciones).
const TEXTO_TECNICO = /\b(relation|column|constraint|syntax|violates|schema|operator|uuid|null value|permission denied|input value)\b|"[a-z_]+"/i
const MAX_DETALLE = 240

export function falla(error: ErrorBD): { ok: false } & FallaEscritura {
  const codigo = traducirError(error)
  const esReglaDeNegocio = codigo === 'datos_invalidos' && error.code === '22023'
  if (esReglaDeNegocio && error.message.length <= MAX_DETALLE && !TEXTO_TECNICO.test(error.message)) {
    return { ok: false, error: codigo, detalle: error.message }
  }
  return { ok: false, error: codigo }
}

export const mensajeDeError = (falla: FallaEscritura): string => falla.detalle ?? MENSAJES_ERROR_ESCRITURA[falla.error]

const nulo = (texto: string) => (texto.trim() === '' ? null : texto.trim())

export function crearServicioEscritura(cliente: ClienteEscritura) {
  async function insertar<T>(tabla: string, fila: Record<string, unknown>): Promise<ResultadoEscritura<T>> {
    const { data, error } = await cliente.from(tabla).insert(fila).select('*').single()
    return error ? falla(error) : { ok: true, valor: data as T }
  }

  async function actualizar(tabla: string, id: string, cambios: Record<string, unknown>): Promise<ResultadoEscritura<void>> {
    const { error } = await cliente.from(tabla).update(cambios).eq('id', id).select('id').single()
    return error ? falla(error) : { ok: true, valor: undefined }
  }

  async function llamar(funcion: Parameters<ClienteEscritura['rpc']>[0], args: Record<string, unknown>): Promise<ResultadoEscritura<void>> {
    const { error } = await cliente.rpc(funcion, args)
    return error ? falla(error) : { ok: true, valor: undefined }
  }

  return {
    // ─── Administración ─────────────────────────────────────────────────────
    // Solo el Admin PROCISO crea consultorías (lo decide el RLS).
    async crearConsultoria(datos: NuevaConsultoria): Promise<ResultadoEscritura<Consultoria>> {
      if (!datos.nombre.trim()) return { ok: false, error: 'datos_invalidos' }
      const resultado = await insertar<FilaConsultoria>('consultorias', {
        nombre: datos.nombre.trim(),
        rfc: nulo(datos.rfc),
        contacto: nulo(datos.contacto),
        email: nulo(datos.email),
        plan: datos.plan,
        limite_usuarios: datos.limiteUsuarios,
        almacenamiento_gb: datos.almacenamientoGb,
      })
      return resultado.ok ? { ok: true, valor: traducirConsultoria(resultado.valor) } : resultado
    },

    // Suspender bloquea a toda su gente; la RPC deja historial.
    cambiarEstadoConsultoria: (id: string, activa: boolean) =>
      llamar('cambiar_estado_consultoria', { p_id: id, p_activa: activa }),

    // Redacción con IA (Edge Function generar-documento). Solo registra el pedido y devuelve
    // textos: el documento lo guarda la pantalla con guardarDocumento, y el consultor lo revisa.
    async generarTextosConIA(pedido: PedidoGeneracionIA): Promise<ResultadoEscritura<ResultadoGeneracionIA>> {
      if (!pedido.campos.length) return { ok: false, error: 'datos_invalidos' }
      const { data, error } = await cliente.functions.invoke('generar-documento', { body: { ...pedido } })
      if (error) return { ok: false, error: errorDeFuncionIA(error.status) }
      const r = data as RespuestaGeneracionIA
      if (r.estado !== 'Completado') return { ok: true, valor: { estado: 'Error', error: r.error ?? 'La IA no pudo generar el borrador.' } }
      if (!r.textos || !Object.keys(r.textos).length) return { ok: true, valor: { estado: 'Error', error: 'La IA no devolvió texto.' } }
      return {
        ok: true,
        valor: { estado: 'Completado', textos: r.textos, ...(r.proveedor ? { proveedor: r.proveedor } : {}), ...(r.modelo ? { modelo: r.modelo } : {}) },
      }
    },

    // Preevaluación con IA (Edge Function analizar-ia). Un análisis que FALLÓ
    // (modelo sin visión, PDF escaneado, clave inválida…) vuelve como análisis en
    // estado Error con su motivo: es un resultado para mostrar, no una falla de escritura.
    async analizarConIA(pedido: PedidoAnalisisIA, solicitadoPorId: string, fecha: string): Promise<ResultadoEscritura<AnalisisIA>> {
      if (!pedido.criterioIds.length) return { ok: false, error: 'datos_invalidos' }
      const { data, error } = await cliente.functions.invoke('analizar-ia', { body: { ...pedido } })
      if (error) return { ok: false, error: errorDeFuncionIA(error.status) }
      const r = data as RespuestaAnalisisIA
      return {
        ok: true,
        valor: {
          id: r.id,
          proyectoId: pedido.proyectoId,
          fuenteTipo: pedido.fuenteTipo,
          documentoId: pedido.documentoId ?? undefined,
          evidenciaId: pedido.evidenciaId ?? undefined,
          criterioIds: pedido.criterioIds,
          solicitadoPorId,
          estado: r.estado,
          resumen: r.resumen ?? undefined,
          errorDetalle: r.error ?? undefined,
          proveedor: r.proveedor ?? undefined,
          modelo: r.modelo ?? undefined,
          fecha,
          resultados: (r.resultados ?? []).map(traducirResultadoAnalisis),
        },
      }
    },

    // Invitación por correo (Edge Function invitar-usuario). Las reglas las
    // decide la BD (autorizar_invitacion); acá solo se descarta lo imposible.
    async invitarUsuario(datos: NuevaInvitacion, redirectTo: string): Promise<ResultadoEscritura<{ id: string; email: string }>> {
      if (!ROLES_INVITABLES.includes(datos.rol)) return { ok: false, error: 'datos_invalidos' }
      const { data, error } = await cliente.functions.invoke('invitar-usuario', {
        body: {
          nombre: datos.nombre,
          email: datos.email,
          cargo: datos.cargo,
          rol: rolDeBD(datos.rol),
          consultoriaId: datos.consultoriaId,
          empresaId: datos.empresaId,
          redirectTo,
        },
      })
      if (error) {
        return { ok: false, error: error.status === 403 ? 'sin_permiso' : error.status === 400 ? 'datos_invalidos' : 'servicio' }
      }
      return { ok: true, valor: data as { id: string; email: string } }
    },

    // Rol (solo dentro del equipo) y/o acceso. null = no cambiar ese dato.
    async administrarUsuario(id: string, cambios: { rol?: Rol; activo?: boolean }): Promise<ResultadoEscritura<void>> {
      if (cambios.rol && !ROLES_DEL_EQUIPO.includes(cambios.rol)) return { ok: false, error: 'datos_invalidos' }
      return llamar('administrar_usuario', {
        p_id: id,
        p_rol: cambios.rol ? rolDeBD(cambios.rol) : null,
        p_activo: cambios.activo ?? null,
      })
    },

    // Comentario sobre cualquier entidad del proyecto. El autor lo pone la BD
    // (default auth.uid()); el trigger validar_comentario exige que la entidad
    // exista, sea de ese tipo y de ese proyecto.
    async comentar(
      consultoriaId: string | null,
      ref: Pick<ComentarioGlobal, 'entidadTipo' | 'entidadId' | 'proyectoId'>,
      texto: string,
    ): Promise<ResultadoEscritura<ComentarioGlobal>> {
      if (!texto.trim()) return { ok: false, error: 'datos_invalidos' }
      if (!consultoriaId) return { ok: false, error: 'sin_consultoria' }
      const resultado = await insertar<FilaComentario>('comentarios', {
        consultoria_id: consultoriaId,
        proyecto_id: ref.proyectoId,
        entidad_tipo: ref.entidadTipo,
        entidad_id: ref.entidadId,
        texto: texto.trim(),
      })
      return resultado.ok ? { ok: true, valor: traducirComentarioGlobal(resultado.valor) } : resultado
    },

    // Una sola llamada para una o todas; la BD pone el usuario y no duplica.
    async marcarNotificacionesLeidas(claves: string[]): Promise<ResultadoEscritura<void>> {
      if (claves.length === 0) return { ok: true, valor: undefined }
      const { error } = await cliente.rpc('marcar_notificaciones_leidas', { p_claves: claves })
      return error ? falla(error) : { ok: true, valor: undefined }
    },

    async crearEmpresa(consultoriaId: string | null, datos: NuevaEmpresa): Promise<ResultadoEscritura<Empresa>> {
      if (!consultoriaId) return { ok: false, error: 'sin_consultoria' }

      const resultado = await insertar<FilaEmpresa>('empresas', {
        consultoria_id: consultoriaId,
        nombre: datos.nombre.trim(),
        nombre_comercial: nulo(datos.nombreComercial),
        rfc: nulo(datos.rfc),
        sector: nulo(datos.sector),
        tamano: nulo(datos.tamano),
        trabajadores: nulo(datos.trabajadores),
        ciudad: nulo(datos.ciudad),
        entidad_federativa: nulo(datos.estado),
        direccion: nulo(datos.direccion),
        contacto_principal: nulo(datos.contactoPrincipal),
        cargo_contacto: nulo(datos.cargoContacto),
        email_contacto: nulo(datos.emailContacto),
        telefono_contacto: nulo(datos.telefonoContacto),
        procesos_principales: nulo(datos.procesosprincipales),
        alcance_inicial: nulo(datos.alcanceInicial),
        norma_interes: datos.normaInteres,
        consultor_asignado_id: nulo(datos.consultorAsignadoId),
        observaciones: nulo(datos.observaciones),
      })
      return resultado.ok ? { ok: true, valor: traducirEmpresa(resultado.valor, []) } : resultado
    },

    archivarEmpresa(id: string): Promise<ResultadoEscritura<void>> {
      return actualizar('empresas', id, { activa: false })
    },

    // L5d (AUD05-M2): el proyecto y su consultor responsable se crean en UNA operación atómica de la BD
    // (crear_proyecto). Antes eran dos escrituras y la segunda se descartaba: si fallaba, el consultor
    // asignado no veía su propio proyecto. La consultoría la decide la BD, no el navegador.
    async crearProyecto(consultoriaId: string | null, datos: NuevoProyecto): Promise<ResultadoEscritura<Proyecto>> {
      if (!consultoriaId) return { ok: false, error: 'sin_consultoria' }

      const { data, error } = await cliente.rpc('crear_proyecto', {
        p_empresa_id: datos.empresaId,
        p_consultor_id: nulo(datos.consultorId),
        p_nombre: datos.nombre.trim(),
        p_objetivo: nulo(datos.objetivo),
        p_alcance: nulo(datos.alcance),
        p_edicion_norma: datos.edicionNorma,
        p_fecha_inicio: nulo(datos.fechaInicio),
        p_fecha_fin_estimada: nulo(datos.fechaFinEstimada),
      })
      if (error) return falla(error)
      return { ok: true, valor: traducirProyecto(data as FilaProyecto, [], []) }
    },

    // Equipo del proyecto (solo el Admin de la consultoría; lo decide la BD).
    agregarMiembroProyecto: (proyectoId: string, usuarioId: string) =>
      llamar('agregar_miembro_proyecto', { p_proyecto_id: proyectoId, p_usuario_id: usuarioId }),
    quitarMiembroProyecto: (proyectoId: string, usuarioId: string) =>
      llamar('quitar_miembro_proyecto', { p_proyecto_id: proyectoId, p_usuario_id: usuarioId }),
    cambiarConsultorProyecto: (proyectoId: string, consultorId: string) =>
      llamar('cambiar_consultor_proyecto', { p_proyecto_id: proyectoId, p_consultor_id: consultorId }),

    // Proceso y actividades viajan juntos: la función de la BD los guarda en una transacción.
    async guardarProceso(proceso: Proceso): Promise<ResultadoEscritura<void>> {
      const lista = (valor?: string[]) => valor ?? []
      const { error } = await cliente.rpc('guardar_proceso', {
        p_proceso: {
          id: proceso.id,
          proyecto_id: proceso.proyectoId,
          responsable_id: proceso.responsableId,
          nombre: proceso.nombre,
          descripcion: proceso.descripcion,
          estado: proceso.estado,
          tipo: proceso.tipo ?? null,
          objetivo: proceso.objetivo,
          alcance: proceso.alcance,
          puesto_responsable: proceso.puestoResponsable,
          personal_involucrado: proceso.personalInvolucrado,
          entradas: lista(proceso.entradas),
          salidas: lista(proceso.salidas),
          proveedores: lista(proceso.proveedores),
          clientes: lista(proceso.clientes),
          recursos_materiales: lista(proceso.recursosMateriales),
          equipos: lista(proceso.equipos),
          sistemas: lista(proceso.sistemas),
          controles: lista(proceso.controles),
          registros: lista(proceso.registros),
          indicadores: lista(proceso.indicadores),
          riesgos: lista(proceso.riesgos),
          problemas: lista(proceso.problemas),
          observaciones: proceso.observaciones,
          mejoras: proceso.mejoras,
          no_aplica: proceso.noAplica ?? {},
        },
        p_actividades: (proceso.actividades ?? []).map((a) => ({
          id: a.id,
          tipo: a.tipo,
          responsable_id: a.responsableId,
          descripcion: a.descripcion,
          entradas: a.entradas,
          recursos: a.recursos,
          controles: a.controles,
          resultado: a.resultado,
          orden: a.orden,
        })),
      })
      return error ? falla(error) : { ok: true, valor: undefined }
    },

    // Estado + historial en una transacción (la función de la BD lo garantiza).
    async revisarEvidencia(id: string, estado: EstadoEvidencia, comentario?: string): Promise<ResultadoEscritura<void>> {
      const { error } = await cliente.rpc('revisar_evidencia', {
        p_id: id,
        p_estado: estado,
        p_comentario: comentario?.trim() || null,
      })
      return error ? falla(error) : { ok: true, valor: undefined }
    },

    // Dos sistemas (Storage y la tabla), sin transacción común: si el registro
    // falla después de subir, se borra el archivo para no dejarlo huérfano.
    async subirEvidencia(datos: NuevaEvidencia, archivo: File): Promise<ResultadoEscritura<Evidencia>> {
      if (!datos.consultoriaId) return { ok: false, error: 'sin_consultoria' }

      const ruta = `${datos.consultoriaId}/${datos.empresaId}/${datos.proyectoId}/${datos.id}${extension(archivo.name)}`
      const bucket = cliente.storage.from('evidencias')

      const subida = await bucket.upload(ruta, archivo, { contentType: archivo.type })
      if (subida.error) return { ok: false, error: traducirErrorStorage(subida.error) }

      const registro = await insertar<FilaEvidencia>('evidencias', {
        id: datos.id,
        consultoria_id: datos.consultoriaId,
        proyecto_id: datos.proyectoId,
        proceso_id: nulo(datos.procesoId),
        actividad_id: nulo(datos.actividadId),
        nombre: datos.nombre.trim(),
        tipo: tipoDeArchivo(archivo.type),
        estado: 'Cargada',
        descripcion: nulo(datos.descripcion),
        categoria: nulo(datos.categoria),
        archivo_ruta: ruta,
        archivo_nombre: archivo.name,
        archivo_mime: archivo.type,
        archivo_tamano: archivo.size,
      })
      if (!registro.ok) {
        await bucket.remove([ruta])
        return registro
      }

      const evidencia = traducirEvidencia(registro.valor, [], [], [])
      return { ok: true, valor: { ...evidencia, autor: datos.autor, empresaId: datos.empresaId } }
    },

    // Documento + evidencias vinculadas + instantánea de versión + evento, en una
    // transacción. El servidor rechaza aprobar desde acá o tocar un aprobado.
    async guardarDocumento(
      documento: Documento,
      opciones: {
        version?: { version: string; comentario: string; motivo?: string }
        evento?: { accion: string; detalle: string }
      } = {},
    ): Promise<ResultadoEscritura<void>> {
      const { error } = await cliente.rpc('guardar_documento', {
        p_documento: {
          id: documento.id,
          proyecto_id: documento.proyectoId,
          proceso_id: documento.procesoId,
          nombre: documento.nombre,
          tipo: documento.tipo,
          estado: documento.estado,
          version: documento.version,
          codigo: documento.codigo,
          categoria: documento.categoria,
          plantilla: documento.plantilla,
          secciones: documento.secciones ?? [],
          referencia_normativa: documento.referenciaNormativa,
          motivo_cambio: documento.motivoCambio,
          contenido_pendiente: documento.contenidoPendiente ?? false,
          evidencias: documento.evidenciasVinculadas ?? [],
        },
        p_version: opciones.version ?? null,
        p_evento: opciones.evento ?? null,
      })
      return error ? falla(error) : { ok: true, valor: undefined }
    },

    // Revisión: el servidor decide quién puede qué (el cliente aprueba, el equipo
    // rechaza) y deja obsoleta la versión aprobada anterior en la misma transacción.
    // `version` es la que el revisor VIO: si el documento cambió mientras tanto, el servidor
    // rechaza la decisión (AUD06-M1) y hay que volver a cargarlo.
    async decidirDocumento(
      id: string,
      estado: 'Aprobado' | 'En corrección' | 'Rechazado',
      version: string,
      seccionId?: string,
      comentario?: string,
    ): Promise<ResultadoEscritura<void>> {
      const { error } = await cliente.rpc('decidir_documento', {
        p_id: id,
        p_estado: estado,
        p_seccion_id: seccionId?.trim() || null,
        p_comentario: comentario?.trim() || null,
        p_version: version,
      })
      return error ? falla(error) : { ok: true, valor: undefined }
    },

    // La salida explícita de la revisión (solo el equipo): el contenido en revisión está congelado.
    retirarDocumento(id: string, motivo?: string): Promise<ResultadoEscritura<void>> {
      return llamar('retirar_documento_de_revision', { p_id: id, p_motivo: motivo?.trim() || null })
    },

    async comentarDocumento(
      consultoriaId: string | null,
      documento: Documento,
      seccionId: string,
      texto: string,
    ): Promise<ResultadoEscritura<ComentarioDocumento>> {
      if (!texto.trim() || !seccionId) return { ok: false, error: 'datos_invalidos' }
      if (!consultoriaId) return { ok: false, error: 'sin_consultoria' }
      const resultado = await insertar<FilaComentario>('comentarios', {
        consultoria_id: consultoriaId,
        proyecto_id: documento.proyectoId,
        entidad_tipo: 'documento',
        entidad_id: documento.id,
        seccion_id: seccionId,
        texto: texto.trim(),
      })
      return resultado.ok ? { ok: true, valor: traducirComentario(resultado.valor) } : resultado
    },

    cambiarEstadoProyecto(id: string, estado: EstadoProyecto): Promise<ResultadoEscritura<void>> {
      return actualizar('proyectos', id, { estado })
    },

    // ─── Tareas ─────────────────────────────────────────────────────────────
    // No se mandan estado ni asignado_por: no tienen GRANT. Nace Pendiente y
    // asignada por quien la crea (default auth.uid() en la BD).
    async crearTarea(consultoriaId: string | null, nueva: NuevaTarea): Promise<ResultadoEscritura<Tarea>> {
      if (!consultoriaId) return { ok: false, error: 'sin_consultoria' }
      const resultado = await insertar<FilaTarea>('tareas', {
        id: nueva.id,
        consultoria_id: consultoriaId,
        proyecto_id: nueva.proyectoId,
        titulo: nueva.titulo.trim(),
        descripcion: nueva.descripcion.trim(),
        asignado_a: nueva.asignadoAId,
        prioridad: nueva.prioridad,
        fecha_vencimiento: fechaISO(nueva.fechaVencimiento),
        dependencias: nueva.dependencias ?? [],
      })
      return resultado.ok ? { ok: true, valor: traducirTarea(resultado.valor, [], []) } : resultado
    },

    editarTarea(id: string, cambios: CambiosTarea): Promise<ResultadoEscritura<void>> {
      const fila: Record<string, unknown> = {}
      for (const [campo, valor] of Object.entries(cambios) as [keyof CambiosTarea, unknown][]) {
        if (valor === undefined) continue
        const columna = COLUMNAS_TAREA[campo]
        if (campo === 'fechaVencimiento') fila[columna] = fechaISO(valor as string)
        else fila[columna] = typeof valor === 'string' ? valor.trim() : valor
      }
      return actualizar('tareas', id, fila)
    },

    // El servidor decide quién puede qué (el asignado avanza; el equipo cierra o
    // devuelve) y deja el historial y el comentario en la misma transacción.
    async cambiarEstadoTarea(id: string, estado: EstadoTarea, comentario?: string): Promise<ResultadoEscritura<void>> {
      const { error } = await cliente.rpc('cambiar_estado_tarea', {
        p_id: id,
        p_estado: estado,
        p_comentario: comentario?.trim() || null,
      })
      return error ? falla(error) : { ok: true, valor: undefined }
    },

    async comentarTarea(
      consultoriaId: string | null,
      tarea: Pick<Tarea, 'id' | 'proyectoId'>,
      texto: string,
    ): Promise<ResultadoEscritura<ComentarioTarea>> {
      if (!texto.trim()) return { ok: false, error: 'datos_invalidos' }
      if (!consultoriaId) return { ok: false, error: 'sin_consultoria' }
      const resultado = await insertar<FilaComentario>('comentarios', {
        consultoria_id: consultoriaId,
        proyecto_id: tarea.proyectoId,
        entidad_tipo: 'tarea',
        entidad_id: tarea.id,
        texto: texto.trim(),
      })
      return resultado.ok ? { ok: true, valor: traducirComentarioTarea(resultado.valor) } : resultado
    },

    // ─── No conformidades ───────────────────────────────────────────────────
    async registrarNoConformidad(
      consultoriaId: string | null,
      id: string,
      datos: DatosNC,
    ): Promise<ResultadoEscritura<NoConformidad>> {
      if (!consultoriaId) return { ok: false, error: 'sin_consultoria' }
      const resultado = await insertar<FilaNoConformidad>('no_conformidades', {
        id,
        consultoria_id: consultoriaId,
        proyecto_id: datos.proyectoId,
        ...filaRegistroNC(datos),
      })
      return resultado.ok ? { ok: true, valor: traducirNoConformidad(resultado.valor, [], []) } : resultado
    },

    editarNoConformidad(id: string, datos: DatosNC): Promise<ResultadoEscritura<void>> {
      return actualizar('no_conformidades', id, filaRegistroNC(datos))
    },

    // Equipo o cliente, mientras no esté verificada (lo decide el servidor).
    async guardarTratamientoNC(id: string, tratamiento: TratamientoNC): Promise<ResultadoEscritura<void>> {
      const { error } = await cliente.rpc('guardar_tratamiento_nc', {
        p_id: id,
        p_correccion: tratamiento.correccion.trim(),
        p_causa: tratamiento.causa.trim(),
        p_accion: tratamiento.accion.trim(),
      })
      return error ? falla(error) : { ok: true, valor: undefined }
    },

    // ─── Indicadores ────────────────────────────────────────────────────────
    // Sin flujo de estados: el RLS decide quién (internos: solo el admin; SGC: quien
    // trabaja con la empresa). Al editar no se manda la consultoría (no se muda).
    async guardarIndicador(
      consultoriaId: string | null,
      indicador: IndicadorGestion,
      nuevo: boolean,
    ): Promise<ResultadoEscritura<IndicadorGestion>> {
      const fila = {
        ambito: indicador.ambito,
        // Un indicador interno nunca lleva empresa (la BD lo exige con un CHECK).
        empresa_id: indicador.ambito === 'SGC' ? indicador.empresaId || null : null,
        nombre: indicador.nombre.trim(),
        descripcion: indicador.descripcion.trim(),
        formula: indicador.formula.trim(),
        unidad: indicador.unidad.trim(),
        frecuencia: indicador.frecuencia,
        responsable_id: indicador.responsableId,
        meta: indicador.meta.trim(),
        periodo: indicador.periodo.trim(),
        valor: (indicador.valor ?? '').trim(),
      }
      if (nuevo) {
        if (!consultoriaId) return { ok: false, error: 'sin_consultoria' }
        const resultado = await insertar<FilaIndicador>('indicadores', { id: indicador.id, consultoria_id: consultoriaId, ...fila })
        return resultado.ok ? { ok: true, valor: traducirIndicador(resultado.valor) } : resultado
      }
      const resultado = await actualizar('indicadores', indicador.id, fila)
      return resultado.ok
        ? { ok: true, valor: traducirIndicador({ id: indicador.id, ...fila }) }
        : resultado
    },

    // ─── Entregables ────────────────────────────────────────────────────────
    // Solo los datos del registro: el estado lo cambia decidirEntregable.
    async registrarEntregable(
      consultoriaId: string | null,
      id: string,
      datos: NuevoEntregable,
    ): Promise<ResultadoEscritura<Entregable>> {
      if (!consultoriaId) return { ok: false, error: 'sin_consultoria' }
      const resultado = await insertar<FilaEntregable>('entregables', {
        id,
        consultoria_id: consultoriaId,
        proyecto_id: datos.proyectoId,
        nombre: datos.nombre.trim(),
        tipo: datos.tipo.trim(),
        fecha_entrega: fechaONulo(datos.fechaEntrega),
        documento_id: datos.documentoId || null,
      })
      return resultado.ok ? { ok: true, valor: traducirEntregable(resultado.valor) } : resultado
    },

    // El equipo entrega; el cliente aprueba o rechaza (con motivo). Lo decide el servidor.
    async decidirEntregable(id: string, estado: Exclude<EstadoEntregable, 'Pendiente'>, comentario?: string): Promise<ResultadoEscritura<void>> {
      const { error } = await cliente.rpc('decidir_entregable', {
        p_id: id,
        p_estado: estado,
        p_comentario: comentario?.trim() || null,
      })
      return error ? falla(error) : { ok: true, valor: undefined }
    },

    // ─── Listas de verificación ─────────────────────────────────────────────
    // Lista + preguntas + tareas de seguimiento de los hallazgos en UNA transacción.
    // Devuelve las tareas que el servidor creó (una por hallazgo nuevo).
    async guardarLista(lista: ListaVerificacion): Promise<ResultadoEscritura<Tarea[]>> {
      const { data, error } = await cliente.rpc('guardar_lista', {
        p_lista: {
          id: lista.id,
          proyecto_id: lista.proyectoId,
          proceso_id: lista.procesoId || null,
          nombre: lista.nombre.trim(),
          area: (lista.area ?? '').trim(),
          responsable_id: lista.responsableId,
          fecha: fechaISO(lista.fecha),
          edicion_norma: lista.edicionNorma,
        },
        p_preguntas: lista.preguntas.map((p, i) => ({
          id: p.id,
          orden: i + 1,
          pregunta: p.pregunta.trim(),
          estado: p.estado,
          referencia_requisito: (p.referenciaRequisito ?? '').trim(),
          evidencia_id: p.evidenciaId || null,
          observaciones: (p.observaciones ?? '').trim(),
          justificacion_no_aplica: (p.justificacionNoAplica ?? '').trim(),
        })),
      })
      if (error) return falla(error)
      const creadas = (Array.isArray(data) ? data : []) as FilaTarea[]
      return { ok: true, valor: creadas.map((fila) => traducirTarea(fila, [], [])) }
    },

    async cambiarEstadoNC(id: string, estado: EstadoNC, verificacion?: string): Promise<ResultadoEscritura<void>> {
      const { error } = await cliente.rpc('cambiar_estado_nc', {
        p_id: id,
        p_estado: estado,
        p_verificacion: verificacion?.trim() || null,
      })
      return error ? falla(error) : { ok: true, valor: undefined }
    },
  }
}

export type ServicioEscritura = ReturnType<typeof crearServicioEscritura>

export const MENSAJES_ERROR_ESCRITURA: Record<ErrorEscritura, string> = {
  sin_permiso: 'No tienes permiso para realizar esta acción.',
  sin_consultoria: 'Tu usuario no pertenece a una consultoría.',
  datos_invalidos: 'La operación no es válida en el estado actual. Revisa la información e intenta de nuevo.',
  archivo_grande: 'El archivo supera el límite de 25 MB.',
  documento_en_revision: 'El documento está en revisión y no se puede modificar. Retíralo de la revisión para editarlo.',
  version_ya_enviada: 'Esa versión ya se envió a revisión. Crea una versión nueva para reenviar.',
  version_desactualizada: 'El documento cambió desde que lo abriste. Recarga la página para ver la versión actual.',
  tipo_no_permitido: 'Ese tipo de archivo no está permitido. Usa imagen, video, audio, PDF, Word o Excel.',
  limite_ia: 'Se alcanzó el tope diario de pedidos a la IA. Inténtalo mañana o continúa sin IA.',
  limite_transcripciones: 'Alcanzaste el tope diario de transcripciones. Inténtalo mañana.',
  limite_reportes: 'Alcanzaste el máximo de reportes de soporte por día. Inténtalo mañana.',
  empresa_archivada: 'La empresa está archivada: no se le pueden crear proyectos.',
  ya_es_miembro: 'Esa persona ya es parte del equipo del proyecto.',
  ya_es_responsable: 'Esa persona ya es el consultor responsable del proyecto.',
  miembro_responsable: 'Es el consultor responsable: cámbialo antes de quitarlo del equipo.',
  miembro_tareas_abiertas: 'Tiene tareas abiertas en este proyecto: reasígnalas antes de quitarlo.',
  servicio: 'No pudimos guardar los cambios. Intenta de nuevo en unos momentos.',
}
