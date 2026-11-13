import type { EstadoResultadoIA, ResultadoAnalisisIA } from '../types'

// O37: de un criterio en Hueco o Parcial de la preevaluación con IA se llega al formulario de nueva no
// conformidad PRECARGADO. No se crea nada solo: la IA preevalúa (no dictamina) y el contenido analizado
// puede venir de la empresa evaluada, así que una persona del equipo revisa y confirma.

// Marca en los parámetros de navegación: distingue esta entrada de la de "abrir una NC" (que usa `id`).
export const NC_DESDE_IA = 'ncDesdeIA'

export interface FuentePrecarga {
  tipo: 'documento' | 'evidencia'
  id: string
  proyectoId: string
  nombre: string
}

// Lo que viaja por NavParams (solo texto) y lee la pantalla de No conformidades.
export type PrecargaNC = {
  proyectoId: string
  titulo: string
  descripcion: string
  detectadaEn: string
  evidenciaId?: string
}

export function puedeCrearNCDesdeResultado(estado: EstadoResultadoIA, esEquipo: boolean): boolean {
  return esEquipo && (estado === 'Hueco' || estado === 'Parcial')
}

export function ncDesdeResultadoIA(
  fuente: FuentePrecarga,
  criterio: { clausula: string; titulo: string },
  resultado: Pick<ResultadoAnalisisIA, 'estado' | 'hallazgos' | 'sugerencias'> & { criterioId?: string },
): PrecargaNC & { [NC_DESDE_IA]: string } {
  const etiquetaFuente = fuente.tipo === 'documento' ? 'documento' : 'evidencia'
  const lineas = [
    `Origen: preevaluación generada con IA (no es un dictamen), pendiente de revisión humana contra el original.`,
    `Criterio ${criterio.clausula} · ${criterio.titulo}: ${resultado.estado}.`,
    `Fuente analizada: ${etiquetaFuente} «${fuente.nombre}».`,
  ]
  if (resultado.hallazgos?.trim()) lineas.push(`Hallazgo de la IA: ${resultado.hallazgos.trim()}`)
  if (resultado.sugerencias?.trim()) lineas.push(`Sugerencia de la IA: ${resultado.sugerencias.trim()}`)
  return {
    [NC_DESDE_IA]: '1',
    proyectoId: fuente.proyectoId,
    titulo: `${criterio.clausula} · ${criterio.titulo} (${resultado.estado})`,
    descripcion: lineas.join('\n'),
    detectadaEn: `Preevaluación con IA · ${etiquetaFuente} «${fuente.nombre}»`,
    ...(fuente.tipo === 'evidencia' ? { evidenciaId: fuente.id } : {}),
  }
}

export function precargaDesdeParams(params: Record<string, string | undefined>): (PrecargaNC & { [NC_DESDE_IA]: string }) | null {
  if (params[NC_DESDE_IA] !== '1' || !params.proyectoId) return null
  return {
    [NC_DESDE_IA]: '1',
    proyectoId: params.proyectoId,
    titulo: params.titulo ?? '',
    descripcion: params.descripcion ?? '',
    detectadaEn: params.detectadaEn ?? '',
    ...(params.evidenciaId ? { evidenciaId: params.evidenciaId } : {}),
  }
}
