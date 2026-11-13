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
