import type { CriterioEvaluacion, Documento } from '../types'

// Cláusulas que conviene revisar según el tipo de documento (sugerencia editable:
// el consultor agrega o quita). Para una evidencia no se adivina: elige el consultor.
const SUGERENCIAS: Record<Documento['tipo'], string[]> = {
  'Política': ['5.2.1', '5.2.2'],
  'Manual': ['4.3', '4.4', '7.5.1'],
  'Procedimiento': ['7.5.2', '7.5.3', '8.1'],
  'Instrucción de trabajo': ['7.5.2', '8.5.1'],
  'Ficha de proceso': ['4.4', '8.1'],
  'Formato': ['7.5.2', '7.5.3'],
  'Lista de verificación': ['9.2.1', '9.2.2'],
  'Matriz': ['4.2', '6.1'],
  'Plan': ['6.2.2', '6.3'],
  'Registro': ['7.5.3'],
  'Alcance': ['4.3'],
  'Objetivos': ['6.2.1', '6.2.2'],
  'Mapa de procesos': ['4.4'],
}

export function clausulasSugeridas(tipo: Documento['tipo'] | null): string[] {
  return tipo ? [...(SUGERENCIAS[tipo] ?? [])] : []
}

// Las sugeridas como ids del catálogo, en el orden del catálogo. Si el Excel ya
// no tiene alguna, se ignora en silencio (la sugerencia es solo una ayuda).
export function criteriosSugeridos(tipo: Documento['tipo'] | null, catalogo: CriterioEvaluacion[]): string[] {
  const clausulas = new Set(clausulasSugeridas(tipo))
  return [...catalogo].sort((a, b) => a.orden - b.orden).filter((c) => clausulas.has(c.clausula)).map((c) => c.id)
}
