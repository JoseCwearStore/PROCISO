import type { SeccionDocumento } from '../types'
import type { Plantilla } from './plantillas'

// Generación de borradores con IA: QUÉ le pide cada plantilla a la IA y CÓMO se aplica lo
// que devuelve. Es lógica pura (sin red ni BD): la Edge Function generar-documento es
// genérica y solo recibe el pedido que arma `armarPedidoIA`.
//
// La IA redacta únicamente lo que no sale de los datos: la declaración de la política y
// del alcance y la matriz y el plan de los objetivos. Todo lo demás se llena desde el
// Levantamiento y el cuestionario (src/lib/plantillas.ts). Si la IA falla, el borrador sale
// igual con esas respuestas: nada de aquí es imprescindible para generar.

export interface CampoGeneracion {
  id: string
  instruccion: string
  ejemplo?: string
}

export interface PedidoGeneracionIA {
  consultoriaId: string | null
  proyectoId: string
  plantillaId: string
  plantilla: string
  organizacion?: string
  respuestas: { pregunta: string; respuesta: string }[]
  procesos: string[]
  campos: CampoGeneracion[]
}

// Ejemplos de estilo: tomados del expediente de ejemplo del usuario (empresa ficticia,
// "Muebles del Bajío"), abreviados. La función le indica a la IA que NO copie sus datos.
const EJEMPLO_POLITICA = `En Muebles del Bajío diseñamos y fabricamos mobiliario de madera que responde a las necesidades y especificaciones acordadas con nuestros clientes. Nos comprometemos a:
• Entender y cumplir los requisitos del cliente, así como los requisitos legales, reglamentarios y otros requisitos aplicables.
• Mantener procesos controlados desde la revisión del pedido hasta la entrega y la atención posventa.
• Desarrollar las competencias de nuestro personal y promover una cultura de calidad, responsabilidad y conducta ética.
• Gestionar los riesgos que puedan afectar la conformidad de nuestros productos y aprovechar oportunidades de mejora.
• Mejorar continuamente la eficacia del Sistema de Gestión de la Calidad mediante objetivos medibles y seguimiento de resultados.
Esta política proporciona un marco de referencia para establecer y revisar los objetivos de calidad, se comunica al personal y se mantiene disponible para las partes interesadas pertinentes.`

const EJEMPLO_ALCANCE = `El Sistema de Gestión de la Calidad de Muebles del Bajío, S.A. de C.V. comprende la recepción y revisión de requisitos del cliente, compras y control de proveedores, fabricación, acabado, inspección, liberación, almacenamiento, entrega y atención posventa de muebles de madera, realizados en la planta ubicada en León, Guanajuato, México, para clientes empresariales y particulares.`

const EJEMPLO_MATRIZ = `Incrementar la entrega puntual de pedidos. | Pedidos entregados en fecha ÷ pedidos entregados × 100 | ≥ 95 % | Jefatura de logística | Mensual
Reducir los productos no conformes detectados en inspección final. | Unidades no conformes ÷ unidades inspeccionadas × 100 | ≤ 2.0 % | Jefatura de Calidad | Mensual
Elevar la satisfacción de los clientes. | Promedio de encuesta de satisfacción en escala 1–5 | ≥ 4.5 / 5 | Ventas y Posventa | Trimestral`

const EJEMPLO_PLAN = `Confirmar fechas factibles al aceptar pedidos y revisar semanalmente el programa. | ERP u hoja de control, planeación y transporte | Logística | 31/12/2026 | Programa de entregas y acuses
Aplicar inspecciones en proceso y análisis de defectos recurrentes. | Instrumentos, criterios de aceptación y capacitación | Calidad / Producción | 31/03/2027 | Registros de inspección y reportes
Aplicar encuesta posterior a la entrega y cerrar quejas. | Encuesta, CRM y tiempo de seguimiento | Ventas / Posventa | 31/03/2027 | Encuestas y registro de quejas`

const CAMPOS: Record<string, CampoGeneracion[]> = {
  politica: [
    {
      id: 'declaracion',
      instruccion:
        'Redacta la declaración de la política de calidad: un párrafo inicial que diga a qué se dedica la organización y a quién sirve, seguido de 4 o 5 compromisos en viñetas (cumplir requisitos, procesos controlados, competencias del personal, riesgos y oportunidades, mejora continua) y un cierre sobre su comunicación. Usa solo lo que respondió la organización.',
      ejemplo: EJEMPLO_POLITICA,
    },
  ],
  alcance: [
    {
      id: 'declaracion',
      instruccion:
        'Redacta la declaración del alcance en un solo párrafo: "El Sistema de Gestión de la Calidad de [organización] comprende [procesos, productos y servicios], realizados en [ubicaciones], para [clientes]". Usa solo lo que respondió la organización y los procesos del proyecto.',
      ejemplo: EJEMPLO_ALCANCE,
    },
  ],
  objetivos: [
    {
      id: 'matriz',
      instruccion:
        'Propón de 3 a 4 objetivos de calidad medibles, alineados con lo que contestó la organización. Una línea por objetivo, con 5 columnas separadas por " | " en este orden: Objetivo | Indicador / fórmula | Meta | Responsable | Frecuencia. Sin encabezado ni numeración. Las metas son propuestas a validar con datos reales.',
      ejemplo: EJEMPLO_MATRIZ,
    },
    {
      id: 'plan',
      instruccion:
        'Para esos mismos objetivos y en el mismo orden, escribe el plan: una línea por objetivo, con 5 columnas separadas por " | " en este orden: Actividad / acción | Recursos | Responsable | Fecha compromiso | Evidencia. Sin encabezado ni numeración.',
      ejemplo: EJEMPLO_PLAN,
    },
  ],
}

export function camposIA(plantillaId: string): CampoGeneracion[] {
  return (CAMPOS[plantillaId] ?? []).map((c) => ({ ...c }))
}

export function armarPedidoIA(
  plantilla: Plantilla,
  datos: {
    consultoriaId: string | null
    proyectoId: string
    organizacion?: string
    respuestas: Record<string, string>
    procesos: string[]
  },
): PedidoGeneracionIA | null {
  const campos = camposIA(plantilla.id)
  if (!campos.length) return null
  return {
    consultoriaId: datos.consultoriaId,
    proyectoId: datos.proyectoId,
    plantillaId: plantilla.id,
    plantilla: plantilla.nombre,
    ...(datos.organizacion ? { organizacion: datos.organizacion } : {}),
    respuestas: (plantilla.preguntas ?? [])
      .map((p) => ({ pregunta: p.texto, respuesta: (datos.respuestas[p.id] ?? '').trim() }))
      .filter((r) => r.respuesta),
    procesos: datos.procesos,
    campos,
  }
}

// ─── Lectura de filas ───────────────────────────────────────────────────────

// El pedido COMPLETO: los campos propios de la plantilla (política, alcance, objetivos) más
// los huecos a completar (ver completarIA.ts), con contexto extra (proceso levantado o el
// propio documento). Devuelve null si no hay nada que pedir. Los topes coinciden con los de
// la Edge Function (12 campos, 40 respuestas).
export const MAX_CAMPOS_PEDIDO = 12
export const MAX_RESPUESTAS_PEDIDO = 40

export function armarPedidoCompleto(
  plantilla: { id: string; nombre: string; preguntas?: { id: string; texto: string }[] },
  datos: {
    consultoriaId: string | null
    proyectoId: string
    organizacion?: string
    respuestas: Record<string, string>
    procesos: string[]
  },
  extra: { campos?: CampoGeneracion[]; contexto?: { pregunta: string; respuesta: string }[]; registro?: string } = {},
): PedidoGeneracionIA | null {
  const campos = [...camposIA(plantilla.id), ...(extra.campos ?? [])].slice(0, MAX_CAMPOS_PEDIDO)
  if (!campos.length) return null
  const guiadas = (plantilla.preguntas ?? [])
    .map((p) => ({ pregunta: p.texto, respuesta: (datos.respuestas[p.id] ?? '').trim() }))
    .filter((r) => r.respuesta)
  return {
    consultoriaId: datos.consultoriaId,
    proyectoId: datos.proyectoId,
    // Lo que se registra en generaciones_ia.plantilla (1 a 40 caracteres).
    plantillaId: (extra.registro ?? plantilla.id).slice(0, 40),
    plantilla: plantilla.nombre,
    ...(datos.organizacion ? { organizacion: datos.organizacion } : {}),
    respuestas: [...guiadas, ...(extra.contexto ?? [])].filter((r) => r.respuesta.trim()).slice(0, MAX_RESPUESTAS_PEDIDO),
    procesos: datos.procesos,
    campos,
  }
}

const MAX_FILAS = 8

// "a | b | c" por línea → filas de `columnas.length` celdas. Tolera viñetas y numeración,
// el encabezado repetido y las líneas sin estructura de tabla (las descarta).
export function parsearFilas(texto: string, columnas: string[]): string[][] {
  const filas: string[][] = []
  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
    if (!limpia.includes('|')) continue
    const celdas = limpia.split('|').map((c) => c.trim())
    if (celdas[0].toLowerCase() === columnas[0].toLowerCase()) continue
    if (celdas.every((c) => !c)) continue
    filas.push(Array.from({ length: columnas.length }, (_, i) => celdas[i] ?? ''))
    if (filas.length === MAX_FILAS) break
  }
  return filas
}

// ─── Aplicación de lo que devuelve la IA ────────────────────────────────────

type Destino = { seccion: string } & ({ tipo: 'texto' } | { tipo: 'filas'; conId: boolean })

const DESTINOS: Record<string, Record<string, Destino>> = {
  politica: { declaracion: { seccion: 'Declaración de la política de calidad', tipo: 'texto' } },
  alcance: { declaracion: { seccion: 'Declaración del alcance', tipo: 'texto' } },
  objetivos: {
    matriz: { seccion: 'Matriz de objetivos', tipo: 'filas', conId: true },
    plan: { seccion: 'Plan para alcanzar los objetivos', tipo: 'filas', conId: true },
  },
}

// Las secciones que redactan los campos propios de la plantilla (no se piden otra vez como hueco).
export function seccionesRedactadas(plantillaId: string): string[] {
  return Object.values(DESTINOS[plantillaId] ?? {}).map((d) => d.seccion)
}

const idObjetivo = (i: number) => `OC-${String(i + 1).padStart(2, '0')}`

// Devuelve secciones NUEVAS: lo que la IA no devolvió (o no se pudo leer) queda como estaba.
export function aplicarTextos(plantilla: Plantilla, secciones: SeccionDocumento[], textos: Record<string, string>): SeccionDocumento[] {
  const destinos = DESTINOS[plantilla.id] ?? {}
  return secciones.map((seccion) => {
    const entrada = Object.entries(destinos).find(([, d]) => d.seccion === seccion.titulo)
    if (!entrada) return seccion
    const [campo, destino] = entrada
    const texto = textos[campo]?.trim()
    if (!texto) return seccion

    if (destino.tipo === 'texto') return { ...seccion, contenido: texto }

    const encabezado = seccion.filas?.[0]
    if (!encabezado) return seccion
    // La primera columna es el ID del objetivo (lo pone la app, no la IA).
    const columnas = destino.conId ? encabezado.slice(1) : encabezado
    const filas = parsearFilas(texto, columnas)
    if (!filas.length) return seccion
    return { ...seccion, filas: [encabezado, ...filas.map((fila, i) => (destino.conId ? [idObjetivo(i), ...fila] : fila))] }
  })
}
