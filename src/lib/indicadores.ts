// "Valor observado" de un indicador (O36). Espejo del CHECK `indicadores_valor_numerico` de la BD: la BD decide, esto solo
// avisa antes de enviar el formulario. Vacío = sin datos suficientes; si no, un número con punto o coma decimal.

const NUMERO = /^-?\d+([.,]\d+)?$/

export const AVISO_VALOR_NO_NUMERICO = 'El valor observado debe ser un número (con punto o coma para los decimales) o quedar vacío'

export function errorDeValorObservado(valor: string): string | null {
  const limpio = valor.trim()
  return limpio === '' || NUMERO.test(limpio) ? null : AVISO_VALOR_NO_NUMERICO
}
