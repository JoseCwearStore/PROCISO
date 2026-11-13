// Aprobar un documento (O20). Dos cosas que la pantalla de Revisiones necesita saber antes de decidir:
// qué documentos pasan a Obsoleto por la aprobación, y cómo se lo explica al usuario.

import type { Documento } from '../types'

export type DocumentoAprobable = Pick<Documento, 'id' | 'nombre' | 'version' | 'proyectoId' | 'codigo' | 'tipo' | 'estado'> & {
  procesoId?: string
}

// Espejo de decidir_documento (AUD02-M1): al aprobar se reemplaza lo APROBADO del mismo proyecto con el MISMO código
// (la versión anterior del mismo documento). Proceso y tipo se usan solo cuando NINGUNO de los dos tiene código.
// Quien decide es la BD; esto sirve para avisar antes y para reflejar el resultado en pantalla.
export function reemplazadosAlAprobar<T extends DocumentoAprobable>(documento: DocumentoAprobable, todos: T[]): T[] {
  return todos.filter((otro) => {
    if (otro.id === documento.id || otro.proyectoId !== documento.proyectoId || otro.estado !== 'Aprobado') return false
    if (documento.codigo) return otro.codigo === documento.codigo
    return !otro.codigo && !!documento.procesoId && otro.procesoId === documento.procesoId && otro.tipo === documento.tipo
  })
}

const nombreDe = (d: DocumentoAprobable) => `${d.codigo || d.nombre} versión ${d.version}`

// El texto del diálogo de confirmación: aprobar bloquea el documento y puede volver Obsoleto a otros.
export function mensajeAprobacion(documento: DocumentoAprobable, reemplazados: DocumentoAprobable[]): string {
  let mensaje = `Vas a aprobar «${documento.nombre}», versión ${documento.version}. Quedará bloqueada: para cambiarla habrá que crear una versión nueva.`
  if (reemplazados.length > 0) {
    mensaje += ` Al aprobarla, pasará a Obsoleto: ${reemplazados.map(nombreDe).join(', ')}.`
  }
  return mensaje
}

// El título y la ayuda del panel de decisión (O22): cada rol lee lo que ÉL puede hacer. El cliente aprueba o pide
// correcciones; no tiene el botón Rechazar, así que no se le habla de rechazo.
export function textosDeDecision(esCliente: boolean): { titulo: string; ayuda: string } {
  return esCliente
    ? {
        titulo: 'Aprobación del documento',
        ayuda: 'Como responsable de la empresa, apruebas el documento o solicitas correcciones. El comentario de la corrección debe quedar anclado a una sección.',
      }
    : {
        titulo: 'Decisión de revisión',
        ayuda: 'El equipo revisa; la aprobación final la da el cliente. Los comentarios de corrección o rechazo deben quedar anclados a una sección.',
      }
}

// El historial de un documento, lo más nuevo primero (O24). Siempre una lista: así la pantalla puede decidir con
// `.length` si avisa "Sin eventos registrados". Antes usaba `lista.map(...) || aviso`, que nunca llegaba al aviso
// porque una lista vacía también cuenta como verdadera.
export function historialParaMostrar<T>(historial: T[] | undefined): T[] {
  return [...(historial ?? [])].reverse()
}

// ─── La bandeja de Revisiones (O21 y O25) ────────────────────────────────────

// Las tres vistas son los tres contadores de arriba: antes solo se podían LEER; ahora cada uno abre su lista.
export type VistaBandeja = 'pendientes' | 'correccion' | 'aprobados'

const ESTADO_DE_VISTA: Record<VistaBandeja, Documento['estado']> = {
  pendientes: 'Pendiente de revisión',
  correccion: 'En corrección',
  aprobados: 'Aprobado',
}

export interface FiltrosBandeja {
  texto: string
  proyectoId: string
}

// Sin mayúsculas, sin acentos y sin espacios alrededor: "revision" encuentra "Revisión".
const normalizar = (texto: string): string => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

// Los documentos de una vista, con el filtro de proyecto y la búsqueda de texto. `textoDe` dice qué texto de cada
// documento se busca (nombre, código, empresa, proyecto, elaborador: lo sabe la pantalla). Conserva el orden.
export function filtrarBandeja<T extends { estado: string; proyectoId: string }>(
  documentos: T[],
  vista: VistaBandeja,
  filtros: FiltrosBandeja,
  textoDe: (documento: T) => string,
): T[] {
  const buscado = normalizar(filtros.texto)
  return documentos.filter((d) => {
    if (d.estado !== ESTADO_DE_VISTA[vista]) return false
    if (filtros.proyectoId && d.proyectoId !== filtros.proyectoId) return false
    // Un texto vacío está en todos los textos: sin búsqueda no se filtra nada.
    return normalizar(textoDe(d)).includes(buscado)
  })
}

// Un documento en corrección o aprobado se puede MIRAR desde la bandeja, pero ya no tiene una decisión pendiente:
// la BD (decidir_documento) solo decide sobre uno "Pendiente de revisión".
export const puedeDecidir = (documento: { estado: string }): boolean => documento.estado === ESTADO_DE_VISTA.pendientes

// Lo que ve quien abre desde la bandeja un documento que ya no está pendiente: se puede leer, no se decide.
export function mensajeSinDecision(estado: string): string {
  if (estado === 'En corrección') return 'Este documento está en corrección: espera que el equipo lo corrija y lo reenvíe a revisión.'
  if (estado === 'Aprobado') return 'Este documento está aprobado y su versión está bloqueada: para cambiarla hay que crear una versión nueva.'
  return `Este documento está ${estado.toLowerCase()}: se puede leer, pero no hay una decisión pendiente.`
}
