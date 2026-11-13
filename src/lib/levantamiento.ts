// Levantamiento guiado de procesos: el borrador del asistente y su conversión de ida y vuelta con el Proceso que
// se guarda en la BD. Sirve para guardar (borrador → proceso) y para RETOMAR un levantamiento a medias
// (proceso → borrador, E7).

import type { ActividadProceso, EstadoProceso, Proceso, TipoProceso } from '../types'

export interface Borrador {
  id: string
  empresaId: string
  proyectoId: string
  nombre: string
  tipo: '' | TipoProceso // opcional: clasifica el proceso en el Mapa de procesos
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

export const BORRADOR_VACIO: Borrador = {
  id: '',
  empresaId: '',
  proyectoId: '',
  nombre: '',
  tipo: '',
  objetivo: '',
  alcance: '',
  responsableId: '',
  puestoResponsable: '',
  personalInvolucrado: '',
  entradas: '',
  salidas: '',
  tieneProveedores: true,
  proveedores: '',
  clientes: '',
  recursosMateriales: '',
  equipos: '',
  usaSistemas: true,
  sistemas: '',
  controles: '',
  registros: '',
  indicadores: '',
  riesgos: '',
  problemas: '',
  observaciones: '',
  mejoras: '',
  noAplica: {},
  actividades: [],
}

// Un renglón por elemento, sin espacios y sin renglones vacíos.
function lista(valor: string): string[] {
  return valor
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function borradorAProceso(
  borrador: Borrador,
  datos: { id: string; estado: EstadoProceso; evidenciasIds: string[]; fechaLevantamiento: string },
): Proceso {
  return {
    id: datos.id,
    nombre: borrador.nombre,
    proyectoId: borrador.proyectoId,
    responsableId: borrador.responsableId,
    estado: datos.estado,
    tipo: borrador.tipo || undefined,
    descripcion: borrador.objetivo,
    fechaLevantamiento: datos.fechaLevantamiento,
    evidenciasIds: datos.evidenciasIds,
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
}

// Solo se retoma un levantamiento que sigue "En levantamiento": uno ya documentado no se reabre desde el asistente
// (volver a guardarlo lo devolvería a borrador).
export const puedeRetomarse = (proceso: Pick<Proceso, 'estado'>): boolean => proceso.estado === 'En levantamiento'

const texto = (items?: string[]): string => (items ?? []).join('\n')

// El inverso de borradorAProceso: lo guardado vuelve al asistente para seguir donde se dejó (E7). La BD no guarda
// "¿tiene proveedores?" ni "¿usa sistemas?": se deducen. Sin proveedores pero con el resto de su paso contestado,
// es que no tiene; si el paso quedó a medias se deja el valor inicial (sí), que es el que más pide.
export function procesoABorrador(proceso: Proceso, empresaId: string): Borrador {
  const paso2Contestado = proceso.entradas.length > 0 && proceso.salidas.length > 0 && (proceso.clientes ?? []).length > 0
  const paso3Contestado = (proceso.recursosMateriales ?? []).length > 0 && (proceso.equipos ?? []).length > 0
  return {
    id: proceso.id,
    empresaId,
    proyectoId: proceso.proyectoId,
    nombre: proceso.nombre,
    tipo: proceso.tipo ?? '',
    objetivo: proceso.objetivo ?? '',
    alcance: proceso.alcance ?? '',
    responsableId: proceso.responsableId,
    puestoResponsable: proceso.puestoResponsable ?? '',
    personalInvolucrado: proceso.personalInvolucrado ?? '',
    entradas: texto(proceso.entradas),
    salidas: texto(proceso.salidas),
    tieneProveedores: (proceso.proveedores ?? []).length > 0 || !paso2Contestado,
    proveedores: texto(proceso.proveedores),
    clientes: texto(proceso.clientes),
    recursosMateriales: texto(proceso.recursosMateriales),
    equipos: texto(proceso.equipos),
    usaSistemas: (proceso.sistemas ?? []).length > 0 || !paso3Contestado,
    sistemas: texto(proceso.sistemas),
    controles: texto(proceso.controles),
    registros: texto(proceso.registros),
    indicadores: texto(proceso.indicadores),
    riesgos: texto(proceso.riesgos),
    problemas: texto(proceso.problemas),
    observaciones: proceso.observaciones ?? '',
    mejoras: proceso.mejoras ?? '',
    noAplica: proceso.noAplica ?? {},
    actividades: proceso.actividades ?? [],
  }
}

export function seccionCompleta(index: number, data: Borrador): boolean {
  const conJustificacion = (key: string) =>
    Object.prototype.hasOwnProperty.call(data.noAplica, key) && !!data.noAplica[key].trim()
  if (index === 0)
    return [data.nombre, data.objetivo, data.alcance, data.responsableId, data.puestoResponsable, data.personalInvolucrado]
      .every((value) => value.trim())
  if (index === 1)
    return !!data.entradas.trim() && !!data.salidas.trim() && !!data.clientes.trim() && (!data.tieneProveedores || !!data.proveedores.trim())
  if (index === 2)
    return conJustificacion('recursos') || (!!data.recursosMateriales.trim() && !!data.equipos.trim() && (!data.usaSistemas || !!data.sistemas.trim()))
  if (index === 3) return conJustificacion('controles') || (!!data.controles.trim() && !!data.registros.trim())
  if (index === 4) return conJustificacion('indicadores') || !!data.indicadores.trim()
  if (index === 5) return conJustificacion('riesgos') || (!!data.riesgos.trim() && !!data.problemas.trim())
  if (index === 6) return true
  if (index === 7) return data.actividades.length > 0
  return [0, 1, 2, 3, 4, 5, 6, 7].every((paso) => seccionCompleta(paso, data))
}

// El paso en que se abre un levantamiento retomado: el primero que falta (o la revisión final si no falta ninguno).
const PASO_REVISION_FINAL = 8

export function primerPasoIncompleto(data: Borrador): number {
  for (let paso = 0; paso < PASO_REVISION_FINAL; paso++) {
    if (!seccionCompleta(paso, data)) return paso
  }
  return PASO_REVISION_FINAL
}
