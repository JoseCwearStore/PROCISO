import type { Empresa, EstadoProyecto, Proyecto } from '../types'
import { traducirEmpresa, traducirProyecto, type FilaEmpresa, type FilaProyecto } from './datos'

// Escritura pesimista: primero se guarda en la BD y la pantalla se actualiza con
// lo que la BD devolvió. Si el RLS lo rechaza, la pantalla no cambia.

export type ErrorEscritura = 'sin_permiso' | 'sin_consultoria' | 'servicio'
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

    cambiarEstadoProyecto(id: string, estado: EstadoProyecto): Promise<ResultadoEscritura<void>> {
      return actualizar('proyectos', id, { estado })
    },
  }
}

export type ServicioEscritura = ReturnType<typeof crearServicioEscritura>

export const MENSAJES_ERROR_ESCRITURA: Record<ErrorEscritura, string> = {
  sin_permiso: 'No tienes permiso para realizar esta acción.',
  sin_consultoria: 'Tu usuario no pertenece a una consultoría.',
  servicio: 'No pudimos guardar los cambios. Intenta de nuevo en unos momentos.',
}
