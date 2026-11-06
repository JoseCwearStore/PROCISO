import type { Empresa, EstadoEvidencia, EstadoProyecto, Evidencia, Proceso, Proyecto, TipoEvidencia } from '../types'
import {
  traducirEmpresa,
  traducirEvidencia,
  traducirProyecto,
  type FilaEmpresa,
  type FilaEvidencia,
  type FilaProyecto,
} from './datos'

// Escritura pesimista: primero se guarda en la BD y la pantalla se actualiza con
// lo que la BD devolvió. Si el RLS lo rechaza, la pantalla no cambia.

export type ErrorEscritura = 'sin_permiso' | 'sin_consultoria' | 'archivo_grande' | 'tipo_no_permitido' | 'servicio'
export type ResultadoEscritura<T> = { ok: true; valor: T } | { ok: false; error: ErrorEscritura }

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
  rpc(funcion: 'guardar_proceso' | 'revisar_evidencia', args: Record<string, unknown>): PromiseLike<{ error: ErrorBD | null }>
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

// 42501: el RLS rechazó el INSERT. PGRST116: el UPDATE no encontró la fila, porque
// el RLS no le deja ver esa fila a este usuario. Para quien usa la app, lo mismo.
function traducirError(error: ErrorBD): ErrorEscritura {
  return error.code === '42501' || error.code === 'PGRST116' ? 'sin_permiso' : 'servicio'
}

const nulo = (texto: string) => (texto.trim() === '' ? null : texto.trim())

export function crearServicioEscritura(cliente: ClienteEscritura) {
  async function insertar<T>(tabla: string, fila: Record<string, unknown>): Promise<ResultadoEscritura<T>> {
    const { data, error } = await cliente.from(tabla).insert(fila).select('*').single()
    return error ? { ok: false, error: traducirError(error) } : { ok: true, valor: data as T }
  }

  async function actualizar(tabla: string, id: string, cambios: Record<string, unknown>): Promise<ResultadoEscritura<void>> {
    const { error } = await cliente.from(tabla).update(cambios).eq('id', id).select('id').single()
    return error ? { ok: false, error: traducirError(error) } : { ok: true, valor: undefined }
  }

  return {
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

    async crearProyecto(consultoriaId: string | null, datos: NuevoProyecto): Promise<ResultadoEscritura<Proyecto>> {
      if (!consultoriaId) return { ok: false, error: 'sin_consultoria' }

      const resultado = await insertar<FilaProyecto>('proyectos', {
        consultoria_id: consultoriaId,
        empresa_id: datos.empresaId,
        consultor_id: nulo(datos.consultorId),
        nombre: datos.nombre.trim(),
        objetivo: nulo(datos.objetivo),
        alcance: nulo(datos.alcance),
        edicion_norma: datos.edicionNorma,
        fecha_inicio: nulo(datos.fechaInicio),
        fecha_fin_estimada: nulo(datos.fechaFinEstimada),
      })
      if (!resultado.ok) return resultado

      const proyecto = resultado.valor
      // Sin esto, el consultor asignado no vería su propio proyecto (el RLS mira proyecto_miembros).
      // Si falla, el proyecto igual existe y el admin puede asignarlo después.
      if (proyecto.consultor_id) {
        await insertar('proyecto_miembros', {
          proyecto_id: proyecto.id,
          usuario_id: proyecto.consultor_id,
          consultoria_id: consultoriaId,
        })
      }
      return { ok: true, valor: traducirProyecto(proyecto, [], []) }
    },

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
      return error ? { ok: false, error: traducirError(error) } : { ok: true, valor: undefined }
    },

    // Estado + historial en una transacción (la función de la BD lo garantiza).
    async revisarEvidencia(id: string, estado: EstadoEvidencia, comentario?: string): Promise<ResultadoEscritura<void>> {
      const { error } = await cliente.rpc('revisar_evidencia', {
        p_id: id,
        p_estado: estado,
        p_comentario: comentario?.trim() || null,
      })
      return error ? { ok: false, error: traducirError(error) } : { ok: true, valor: undefined }
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

    cambiarEstadoProyecto(id: string, estado: EstadoProyecto): Promise<ResultadoEscritura<void>> {
      return actualizar('proyectos', id, { estado })
    },
  }
}

export type ServicioEscritura = ReturnType<typeof crearServicioEscritura>

export const MENSAJES_ERROR_ESCRITURA: Record<ErrorEscritura, string> = {
  sin_permiso: 'No tienes permiso para realizar esta acción.',
  sin_consultoria: 'Tu usuario no pertenece a una consultoría.',
  archivo_grande: 'El archivo supera el límite de 25 MB.',
  tipo_no_permitido: 'Ese tipo de archivo no está permitido. Usa imagen, video, audio, PDF, Word o Excel.',
  servicio: 'No pudimos guardar los cambios. Intenta de nuevo en unos momentos.',
}
