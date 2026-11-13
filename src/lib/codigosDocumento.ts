// Códigos documentales (E9). La BD no deja repetir (proyecto, código, versión), sin importar mayúsculas ni espacios
// (índice documentos_codigo_version_unico). Esto sirve para NO sugerir un código ocupado y para avisar antes de
// generar un borrador (que puede gastar un pedido de IA) con uno que la BD va a rechazar.

export type Codigos = ReadonlyArray<string | null | undefined>

const normalizar = (codigo: string): string => codigo.trim().toLowerCase()

function ocupados(existentes: Codigos): Set<string> {
  const set = new Set<string>()
  for (const c of existentes) {
    if (c) set.add(normalizar(c))
  }
  return set
}

export function codigoEnUso(codigo: string, existentes: Codigos): boolean {
  const n = normalizar(codigo)
  return n !== '' && ocupados(existentes).has(n)
}

// El código base de la plantilla si está libre; si no, el siguiente número libre ("SGC-OBJ-001" → "SGC-OBJ-002",
// conservando los ceros). Sin número final se agrega "-2", "-3"...
export function sugerirCodigo(codigoBase: string, existentes: Codigos): string {
  const base = codigoBase.trim()
  if (!base) return ''
  const usados = ocupados(existentes)
  if (!usados.has(normalizar(base))) return base

  const conNumero = /^(.*?)(\d+)$/.exec(base)
  const prefijo = conNumero ? conNumero[1] : `${base}-`
  const ancho = conNumero ? conNumero[2].length : 0
  let n = conNumero ? Number(conNumero[2]) + 1 : 2
  for (;;) {
    const candidato = `${prefijo}${String(n).padStart(ancho, '0')}`
    if (!usados.has(normalizar(candidato))) return candidato
    n++
  }
}

// Al cambiar de plantilla o de proyecto: si lo escrito está vacío o era la sugerencia de antes, se propone la nueva;
// un código que la persona escribió a mano no se pisa.
export function recalcularCodigo(
  actual: string,
  baseAnterior: string,
  existentesAnteriores: Codigos,
  baseNueva: string,
  existentesNuevos: Codigos,
): string {
  const eraSugerido = !actual.trim() || actual === sugerirCodigo(baseAnterior, existentesAnteriores)
  return eraSugerido ? sugerirCodigo(baseNueva, existentesNuevos) : actual
}
