import type { ActividadProceso, Proceso, SeccionDocumento } from '../types'
import { PENDIENTE } from './plantillas'
import { parsearFilas, type CampoGeneracion } from './generacion'

// «Completar con IA»: la IA PROPONE texto para lo que un documento todavía tiene vacío
// («Información pendiente de confirmar»). Lo propuesto queda marcado como sugerido
// (SeccionDocumento.sugeridoIA) hasta que una persona lo edite o lo acepte, y mientras
// haya sugerencias sin revisar el documento no se puede enviar a revisión.
//
// Lógica PURA (sin React ni red): la usan la pantalla de Documentación al generar un
// borrador y el botón del editor. Reusa la Edge Function genérica generar-documento:
// cada sección con huecos es un "campo" con su instrucción, y el contenido del
// documento y del proceso viaja como respuestas (datos NO confiables para la IA).

// Nombres, fechas y firmas los pone una persona: la IA no los propone.
// «Preguntas guiadas» son las respuestas de la empresa: la IA no contesta por ella.
const SECCIONES_EXCLUIDAS = [/^preguntas guiadas$/i, /^aprobaci[oó]n$/i, /^firmas/i, /^historial de cambios/i, /^registro de ejecuci[oó]n$/i]
const COLUMNAS_EXCLUIDAS = [/^fecha$/i, /^elabor[oó]$/i, /^revis[oó]$/i, /^aprob[oó]$/i, /^firma/i, /^resultado$/i, /^observaciones$/i, /^persona que ejecuta$/i, /^equipo \/ lote \/ orden$/i]

// Marcador que la IA usa cuando no tiene el dato (ver el prompt de generar-documento).
const POR_CONFIRMAR = /\[\s*por confirmar\s*\]/i

export const MAX_SECCIONES_POR_PEDIDO = 10
const MAX_CONTEXTO = 1900
const MAX_FILAS_NUEVAS = 8

const clave = (fila: number, columna: number) => `${fila}:${columna}`
const recortar = (s: string, max = MAX_CONTEXTO) => (s.length > max ? `${s.slice(0, max - 1)}…` : s)
const vacia = (celda: string | undefined) => !celda?.trim() || celda.includes(PENDIENTE)

export function seccionExcluida(titulo: string): boolean {
  return SECCIONES_EXCLUIDAS.some((re) => re.test(titulo.trim()))
}

export function columnaExcluida(encabezado: string): boolean {
  return COLUMNAS_EXCLUIDAS.some((re) => re.test(encabezado.trim()))
}

// ─── Huecos ────────────────────────────────────────────────────────────────

export interface Hueco {
  seccionId: string
  titulo: string
  tipo: 'texto' | 'tabla'
  // Tabla: las celdas vacías del cuerpo que la IA puede proponer ("fila:columna"; la fila 0 es el encabezado).
  celdas?: string[]
  // Tabla sin ningún dato en el cuerpo: la IA puede proponer filas nuevas (hasta 8).
  tablaVacia?: boolean
}

export function huecosDe(secciones: SeccionDocumento[]): Hueco[] {
  const huecos: Hueco[] = []
  for (const s of secciones) {
    if (seccionExcluida(s.titulo)) continue
    if (s.tipo === 'texto') {
      if (vacia(s.contenido)) huecos.push({ seccionId: s.id, titulo: s.titulo, tipo: 'texto' })
      continue
    }
    const [encabezado, ...cuerpo] = s.filas ?? []
    if (!encabezado?.length) continue
    const columnasUtiles = encabezado.map((h, i) => (columnaExcluida(h) ? -1 : i)).filter((i) => i >= 0)
    if (!columnasUtiles.length) continue
    const tablaVacia = !cuerpo.length || cuerpo.every((fila) => fila.every(vacia))
    const celdas: string[] = []
    cuerpo.forEach((fila, f) => columnasUtiles.forEach((c) => { if (vacia(fila[c])) celdas.push(clave(f + 1, c)) }))
    if (tablaVacia || celdas.length) huecos.push({ seccionId: s.id, titulo: s.titulo, tipo: 'tabla', celdas, ...(tablaVacia ? { tablaVacia: true } : {}) })
  }
  return huecos
}

// Cuántos datos le faltan (para el botón): un texto cuenta 1; una tabla, sus celdas vacías (o 1 si está vacía).
export function cuantosHuecos(huecos: Hueco[]): number {
  return huecos.reduce((n, h) => n + (h.tipo === 'texto' || h.tablaVacia ? 1 : h.celdas?.length ?? 0), 0)
}

// ─── Pedido ────────────────────────────────────────────────────────────────

const idCampo = (i: number) => `s${i + 1}`

function tablaComoTexto(s: SeccionDocumento): string {
  return (s.filas ?? []).map((fila) => fila.map((c) => (vacia(c) ? '[vacío]' : c.replace(/\|/g, '/'))).join(' | ')).join('\n')
}

// Pautas comunes (el usuario pidió que la IA ayude "en casi todo lo posible"; lo propuesto lo revisa una persona).
const PAUTAS =
  ' Usa puestos o roles (p. ej. «Jefe de compras», «Dirección»), nunca nombres de personas.' +
  ' Si un dato no viene en la información pero es práctica común razonable (registro o evidencia de una actividad, medio de resguardo, tiempo de retención, código de registro, frecuencia, criterio de control), PROPÓN un valor típico.' +
  ' Usa [por confirmar] solo para lo que únicamente la empresa conoce (nombres propios de sus áreas, cifras reales).'

export function camposCompletar(secciones: SeccionDocumento[], huecos: Hueco[], guia?: string): CampoGeneracion[] {
  return huecos.slice(0, MAX_SECCIONES_POR_PEDIDO).map((h, i) => {
    const s = secciones.find((x) => x.id === h.seccionId)
    const extra = PAUTAS + (guia ? ` Contexto del documento: ${guia}` : '')
    if (h.tipo === 'texto') {
      return {
        id: idCampo(i),
        instruccion: `Redacta el contenido de la sección «${h.titulo}» del documento, coherente con el resto del documento y con los datos del proceso. Texto breve y concreto (1 a 3 párrafos o una lista corta).${extra}`,
      }
    }
    const encabezado = s?.filas?.[0] ?? []
    const libres = encabezado.filter((c) => !columnaExcluida(c))
    const bloqueadas = encabezado.filter((c) => columnaExcluida(c))
    const base = h.tablaVacia
      ? `La tabla «${h.titulo}» está vacía. Propón de 3 a ${MAX_FILAS_NUEVAS} filas útiles.`
      : `Completa las celdas [vacío] de la tabla «${h.titulo}» (su contenido actual viene en los datos). Devuelve TODAS sus filas de cuerpo, en el mismo orden, conservando sin cambios el texto de las celdas que ya tienen contenido.`
    return {
      id: idCampo(i),
      instruccion: recortar(
        `${base} Una línea por fila, ${encabezado.length} columnas separadas por " | " en este orden: ${encabezado.join(' | ')}. Sin encabezado ni numeración. ` +
          `Llena las columnas ${libres.map((c) => `«${c}»`).join(', ')}.` +
          (bloqueadas.length ? ` Deja VACÍAS las columnas ${bloqueadas.map((c) => `«${c}»`).join(', ')} (las llena una persona).` : '') +
          extra,
        1400,
      ),
    }
  })
}

// Los datos del proceso levantado, como pares pregunta/respuesta para la IA.
export function contextoDeProceso(proceso: Proceso | undefined, nombreUsuario?: (id?: string) => string): { pregunta: string; respuesta: string }[] {
  if (!proceso) return []
  const lista = (l?: string[]) => (l?.length ? l.join('; ') : '')
  const actividades = [...(proceso.actividades ?? [])].sort((a, b) => a.orden - b.orden)
  const actividad = (a: ActividadProceso) =>
    [`${a.orden}. ${a.descripcion}`, a.entradas && `entradas: ${a.entradas}`, a.recursos && `recursos: ${a.recursos}`, a.controles && `controles: ${a.controles}`,
      a.resultado && `resultado: ${a.resultado}`, nombreUsuario?.(a.responsableId) && `responsable: ${nombreUsuario?.(a.responsableId)}`]
      .filter(Boolean).join(' · ')
  const pares: [string, string][] = [
    ['Proceso (nombre y tipo)', [proceso.nombre, proceso.tipo].filter(Boolean).join(' · ')],
    ['Objetivo del proceso', proceso.objetivo || proceso.descripcion || ''],
    ['Alcance del proceso', proceso.alcance ?? ''],
    ['Puesto responsable', proceso.puestoResponsable ?? ''],
    ['Personal involucrado', proceso.personalInvolucrado ?? ''],
    ['Proveedores y entradas', [lista(proceso.proveedores), lista(proceso.entradas)].filter(Boolean).join(' / ')],
    ['Salidas y clientes', [lista(proceso.salidas), lista(proceso.clientes)].filter(Boolean).join(' / ')],
    ['Recursos (materiales, equipos y sistemas)', [lista(proceso.recursosMateriales), lista(proceso.equipos), lista(proceso.sistemas)].filter(Boolean).join(' / ')],
    ['Controles y registros', [lista(proceso.controles), lista(proceso.registros)].filter(Boolean).join(' / ')],
    ['Indicadores', lista(proceso.indicadores)],
    ['Riesgos y problemas', [lista(proceso.riesgos), lista(proceso.problemas)].filter(Boolean).join(' / ')],
    ['Secuencia de actividades', actividades.map(actividad).join('\n')],
  ]
  return pares.filter(([, r]) => r.trim()).map(([pregunta, respuesta]) => ({ pregunta, respuesta: recortar(respuesta) }))
}

// Los procesos del proyecto (para el mapa de procesos).
export function contextoDeProcesos(procesos: Proceso[]): { pregunta: string; respuesta: string }[] {
  return procesos.slice(0, 15).map((p) => ({
    pregunta: `Proceso «${p.nombre}»`,
    respuesta: recortar([p.tipo && `tipo: ${p.tipo}`, p.objetivo && `objetivo: ${p.objetivo}`, p.entradas.length && `entradas: ${p.entradas.join('; ')}`,
      p.salidas.length && `salidas: ${p.salidas.join('; ')}`, p.clientes?.length && `clientes: ${p.clientes.join('; ')}`].filter(Boolean).join(' · ') || p.nombre),
  }))
}

// El contenido actual del documento (lo que ya está escrito), para que lo propuesto sea coherente.
export function contextoDelDocumento(secciones: SeccionDocumento[]): { pregunta: string; respuesta: string }[] {
  return secciones
    .filter((s) => (s.tipo === 'texto' ? !vacia(s.contenido) : (s.filas?.length ?? 0) > 1))
    .slice(0, 16)
    .map((s) => ({ pregunta: `Sección «${s.titulo || 'Sin título'}» (contenido actual)`, respuesta: recortar(s.tipo === 'texto' ? s.contenido : tablaComoTexto(s)) }))
}

// ─── Aplicar lo que propuso la IA ──────────────────────────────────────────

export interface ResultadoCompletar {
  secciones: SeccionDocumento[]
  // Cuántos datos se propusieron (textos + celdas).
  propuestos: number
}

// Devuelve secciones NUEVAS. Solo escribe en los huecos; lo que la persona ya escribió no se toca.
// Lo que la IA dejó como [por confirmar] no se aplica: sigue pendiente.
export function aplicarCompletado(secciones: SeccionDocumento[], huecos: Hueco[], textos: Record<string, string>): ResultadoCompletar {
  let propuestos = 0
  const porSeccion = new Map(huecos.slice(0, MAX_SECCIONES_POR_PEDIDO).map((h, i) => [h.seccionId, { h, texto: textos[idCampo(i)]?.trim() ?? '' }]))
  const nuevas = secciones.map((s) => {
    const entrada = porSeccion.get(s.id)
    if (!entrada?.texto) return s
    const { h, texto } = entrada
    if (h.tipo === 'texto') {
      if (POR_CONFIRMAR.test(texto) && texto.replace(POR_CONFIRMAR, '').trim().length < 20) return s
      propuestos += 1
      return { ...s, contenido: texto, sugeridoIA: { ...s.sugeridoIA, contenido: true } }
    }
    const encabezado = s.filas?.[0]
    if (!encabezado) return s
    const filas = parsearFilas(texto, encabezado)
    if (!filas.length) return s
    const valido = (v: string | undefined) => !!v?.trim() && !POR_CONFIRMAR.test(v) && !/^\[?vac[ií]o\]?$/i.test(v.trim())
    const marcadas = new Set(s.sugeridoIA?.celdas ?? [])
    let enTabla = 0
    if (h.tablaVacia) {
      const cuerpo = filas.slice(0, MAX_FILAS_NUEVAS).map((fila, f) =>
        fila.map((v, c) => {
          if (columnaExcluida(encabezado[c]) || !valido(v)) return ''
          marcadas.add(clave(f + 1, c))
          enTabla += 1
          return v.trim()
        }),
      )
      if (!enTabla) return s
      propuestos += enTabla
      return { ...s, filas: [encabezado, ...cuerpo], sugeridoIA: { ...s.sugeridoIA, celdas: [...marcadas] } }
    }
    const copia = (s.filas ?? []).map((fila) => [...fila])
    for (const k of h.celdas ?? []) {
      const [f, c] = k.split(':').map(Number)
      const v = filas[f - 1]?.[c]
      if (!valido(v) || !copia[f]) continue
      copia[f][c] = v!.trim()
      marcadas.add(k)
      enTabla += 1
    }
    if (!enTabla) return s
    propuestos += enTabla
    return { ...s, filas: copia, sugeridoIA: { ...s.sugeridoIA, celdas: [...marcadas] } }
  })
  return { secciones: nuevas, propuestos }
}

// Marca como sugerido (por IA) el contenido de secciones que redactó la generación clásica (política, alcance, objetivos).
export function marcarSugeridas(antes: SeccionDocumento[], despues: SeccionDocumento[]): SeccionDocumento[] {
  return despues.map((s, i) => {
    const previa = antes[i]
    if (!previa || previa.id !== s.id) return s
    if (s.tipo === 'texto') return s.contenido !== previa.contenido ? { ...s, sugeridoIA: { ...s.sugeridoIA, contenido: true } } : s
    const celdas: string[] = []
    ;(s.filas ?? []).forEach((fila, f) => { if (f > 0) fila.forEach((v, c) => { if (v.trim() && v !== previa.filas?.[f]?.[c]) celdas.push(clave(f, c)) }) })
    return celdas.length ? { ...s, sugeridoIA: { ...s.sugeridoIA, celdas } } : s
  })
}

// ─── Revisión humana ───────────────────────────────────────────────────────

export function esCeldaSugerida(s: SeccionDocumento, fila: number, columna: number): boolean {
  return !!s.sugeridoIA?.celdas?.includes(clave(fila, columna))
}

function limpiar(s: SeccionDocumento, sugerido: SeccionDocumento['sugeridoIA']): SeccionDocumento {
  const vacioSugerido = !sugerido?.contenido && !sugerido?.celdas?.length
  if (vacioSugerido) {
    const { sugeridoIA: _omitido, ...resto } = s
    return resto
  }
  return { ...s, sugeridoIA: sugerido }
}

// Editar una celda o el texto cuenta como revisarlo: se quita su marca.
export function quitarMarcaCelda(s: SeccionDocumento, fila: number, columna: number): SeccionDocumento {
  if (!esCeldaSugerida(s, fila, columna)) return s
  return limpiar(s, { ...s.sugeridoIA, celdas: s.sugeridoIA?.celdas?.filter((k) => k !== clave(fila, columna)) })
}

export function quitarMarcaTexto(s: SeccionDocumento): SeccionDocumento {
  if (!s.sugeridoIA?.contenido) return s
  return limpiar(s, { ...s.sugeridoIA, contenido: false })
}

export function aceptarSeccion(s: SeccionDocumento): SeccionDocumento {
  return limpiar(s, undefined)
}

export function sugerenciasPendientes(secciones: SeccionDocumento[] | undefined): number {
  return (secciones ?? []).reduce((n, s) => n + (s.sugeridoIA?.contenido ? 1 : 0) + (s.sugeridoIA?.celdas?.length ?? 0), 0)
}
