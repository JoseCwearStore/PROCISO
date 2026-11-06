import type {
  ActividadProceso,
  Consultoria,
  Documento,
  Empresa,
  Entregable,
  EntradaHistorial,
  Evidencia,
  Fase,
  NoConformidad,
  Notificacion,
  Proceso,
  Proyecto,
  Tarea,
  Usuario,
} from '../types'
import { mapearRol, type RolBD } from './auth'

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

export interface FilasSesion {
  consultorias: FilaConsultoria[]
  empresas: FilaEmpresa[]
  perfiles: FilaPerfil[]
  proyectos: FilaProyecto[]
  fases: FilaFase[]
  miembros: FilaMiembro[]
  procesos: FilaProceso[]
  actividades: FilaActividad[]
}

// Datos que todavía viven en src/data/demo.ts (se van migrando de a uno).
export interface DatosDemo {
  evidencias: Evidencia[]
  documentos: Documento[]
  tareas: Tarea[]
  entregables: Entregable[]
  noConformidades: NoConformidad[]
  notificaciones: Notificacion[]
  historial: EntradaHistorial[]
}

export interface DatosSesion extends DatosDemo {
  consultorias: Consultoria[]
  empresas: Empresa[]
  usuarios: Usuario[]
  proyectos: Proyecto[]
  procesos: Proceso[]
}

// ─── Lectura ────────────────────────────────────────────────────────────────

export interface ClienteDatos {
  from(tabla: string): {
    select(columnas: string): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
  }
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
} as const satisfies Record<keyof FilasSesion, readonly [string, string]>

// El RLS decide qué filas devuelve cada tabla: acá no se filtra nada a mano.
export async function cargarFilasSesion(cliente: ClienteDatos): Promise<{ ok: true; filas: FilasSesion } | { ok: false }> {
  const claves = Object.keys(CONSULTAS) as (keyof FilasSesion)[]
  const respuestas = await Promise.all(
    claves.map((clave) => {
      const [tabla, columnas] = CONSULTAS[clave]
      return cliente.from(tabla).select(columnas)
    }),
  )

  if (respuestas.some((respuesta) => respuesta.error || !respuesta.data)) return { ok: false }

  const filas = Object.fromEntries(claves.map((clave, i) => [clave, respuestas[i].data])) as unknown as FilasSesion
  return { ok: true, filas }
}

// ─── Traducción BD → tipos de la interfaz ───────────────────────────────────

// '2026-09-01' o '2026-09-01T12:00:00+00:00' → '01/09/2026'
export function formatearFecha(valor: string | null): string {
  if (!valor) return ''
  const [anio, mes, dia] = valor.slice(0, 10).split('-')
  return `${dia}/${mes}/${anio}`
}

export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/)
  const letras = palabras.length > 1 ? palabras[0][0] + palabras[1][0] : palabras[0].slice(0, 2)
  return letras.toUpperCase()
}

const opcional = <T>(valor: T | null): T | undefined => valor ?? undefined

function traducirConsultoria(fila: FilaConsultoria): Consultoria {
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
    avance: fila.avance,
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

// ─── Combinación: lo real de la BD + lo que todavía es demo ─────────────────

export function combinarDatosSesion(filas: FilasSesion, demo: DatosDemo): DatosSesion {
  const proyectosVisibles = new Set(filas.proyectos.map((p) => p.id))
  const empresasVisibles = new Set(filas.empresas.map((e) => e.id))
  const delProyectoVisible = <T extends { proyectoId: string }>(lista: T[]) =>
    lista.filter((item) => proyectosVisibles.has(item.proyectoId))

  const evidencias = delProyectoVisible(demo.evidencias)
  const documentos = delProyectoVisible(demo.documentos)
  const tareas = delProyectoVisible(demo.tareas)

  const visiblesPorTipo: Record<EntradaHistorial['entidadTipo'], Set<string>> = {
    proyecto: proyectosVisibles,
    empresa: empresasVisibles,
    tarea: new Set(tareas.map((t) => t.id)),
    documento: new Set(documentos.map((d) => d.id)),
    evidencia: new Set(evidencias.map((e) => e.id)),
  }

  return {
    consultorias: filas.consultorias.map(traducirConsultoria),
    empresas: filas.empresas.map((fila) => traducirEmpresa(fila, filas.proyectos)),
    usuarios: filas.perfiles.map((perfil) => traducirUsuario(perfil, filas)),
    proyectos: filas.proyectos.map((fila) => traducirProyecto(fila, filas.fases, filas.miembros)),
    procesos: filas.procesos.map((fila) => traducirProceso(fila, filas.actividades, evidencias, documentos)),
    evidencias,
    documentos,
    tareas,
    entregables: delProyectoVisible(demo.entregables),
    noConformidades: delProyectoVisible(demo.noConformidades),
    notificaciones: demo.notificaciones.filter((n) => !n.proyectoId || proyectosVisibles.has(n.proyectoId)),
    historial: demo.historial.filter((h) => visiblesPorTipo[h.entidadTipo].has(h.entidadId)),
  }
}
