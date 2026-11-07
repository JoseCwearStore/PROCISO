// Lógica PURA del análisis con IA (sin APIs de Deno): la usan las Edge Functions
// y la prueban los tests de Vitest.
//
// Arquitectura: puerto + adaptadores.
//   · El PUERTO es AnalizadorIA: "completá esta conversación".
//   · Cada ADAPTADOR habla con un proveedor. Este archivo trae el compatible con
//     OpenAI, que sirve para Ollama (cloud o local), OpenAI, OpenRouter, Groq…
//     Cambiar de proveedor = cambiar IA_BASE_URL, IA_MODELO e IA_API_KEY.
//   · Agregar Claude u otro = un adaptador nuevo con la misma interfaz.

export class ErrorIA extends Error {}

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface CriterioIA {
  id: string
  clausula: string
  titulo: string
  intencion: string
  evidencia_esperada: string[]
  preguntas: string[]
  senales_de_hueco: string[]
}

export interface ImagenIA {
  mime: string
  base64: string
}

// Lo que sale de un extractor, sea cual sea la fuente (documento, PDF, imagen…).
export interface FuenteIA {
  texto: string
  imagenes: ImagenIA[]
}

type Parte = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
export interface MensajeIA {
  role: 'system' | 'user' | 'assistant'
  content: string | Parte[]
}

export type EstadoResultado = 'Cubierto' | 'Parcial' | 'Hueco' | 'No evaluable' | 'No aplica'
export interface ResultadoCriterio {
  criterio_id: string
  estado: EstadoResultado
  hallazgos: string | null
  sugerencias: string | null
}

// El PUERTO.
export interface AnalizadorIA {
  completar(mensajes: MensajeIA[]): Promise<string>
}

// ─── Extractor de documentos de la app ─────────────────────────────────────

export function textoDeSecciones(
  secciones: { titulo?: string; contenido?: string; tipo?: string; filas?: string[][] }[],
): string {
  return secciones
    .map((s) => {
      const cuerpo = s.tipo === 'tabla' && s.filas?.length
        ? s.filas.map((fila) => fila.join(' | ')).join('\n')
        : (s.contenido ?? '').trim()
      return `## ${s.titulo ?? 'Sección'}\n${cuerpo}`.trim()
    })
    .join('\n\n')
}

// ─── Armado del pedido ──────────────────────────────────────────────────────

// Un modelo chico tiene contexto chico: se recorta el texto y se avisa.
const MAX_TEXTO = 60_000

const SISTEMA = `Eres un asistente de preevaluación documental para sistemas de gestión de la calidad (ISO 9001).
Tu trabajo es comparar la información de la fuente con cada criterio y señalar huecos.
Reglas:
- Esto es una preevaluación: NO emites dictámenes de conformidad ni certificaciones; un humano revisa todo.
- Usa SOLO la información de la fuente. Si no alcanza para juzgar, el estado es "No evaluable". No inventes.
- Estados posibles por criterio: "Cubierto", "Parcial", "Hueco", "No evaluable", "No aplica".
- Escribe en español, en frases breves y concretas, citando lo que viste en la fuente.
- Responde SOLO con JSON, sin texto adicional, con esta forma:
{"resumen": "...", "resultados": [{"clausula": "5.2.1", "estado": "Parcial", "hallazgos": "...", "sugerencias": "..."}]}`

function describirCriterio(c: CriterioIA): string {
  const lista = (titulo: string, xs: string[]) => (xs.length ? `${titulo}:\n${xs.map((x) => `  - ${x}`).join('\n')}` : '')
  return [
    `### ${c.clausula} · ${c.titulo}`,
    `Intención: ${c.intencion}`,
    lista('Evidencia esperada', c.evidencia_esperada),
    lista('Preguntas de verificación', c.preguntas),
    lista('Señales de hueco', c.senales_de_hueco),
  ].filter(Boolean).join('\n')
}

export function armarMensajes(criterios: CriterioIA[], fuente: FuenteIA, nombreFuente: string): MensajeIA[] {
  const texto = fuente.texto.length > MAX_TEXTO ? `${fuente.texto.slice(0, MAX_TEXTO)}\n[texto recortado]` : fuente.texto
  const pedido = [
    `Criterios a evaluar (${criterios.length}):`,
    criterios.map(describirCriterio).join('\n\n'),
    `Fuente: "${nombreFuente}"`,
    texto ? `Contenido de la fuente:\n"""\n${texto}\n"""` : 'La fuente es una o más imágenes adjuntas.',
  ].join('\n\n')

  const usuario: MensajeIA = fuente.imagenes.length
    ? {
        role: 'user',
        content: [
          { type: 'text', text: pedido },
          ...fuente.imagenes.map((img): Parte => ({ type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.base64}` } })),
        ],
      }
    : { role: 'user', content: pedido }

  return [{ role: 'system', content: SISTEMA }, usuario]
}

// ─── Interpretación de la respuesta ────────────────────────────────────────

const ESTADOS: Record<string, EstadoResultado> = {
  cubierto: 'Cubierto', parcial: 'Parcial', hueco: 'Hueco', 'no evaluable': 'No evaluable', 'no aplica': 'No aplica',
}
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
const opcional = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function interpretarRespuesta(
  respuesta: string,
  criterios: CriterioIA[],
): { resumen: string | null; resultados: ResultadoCriterio[] } {
  // Los modelos suelen envolver el JSON en texto o en un bloque ```json.
  const inicio = respuesta.indexOf('{')
  const fin = respuesta.lastIndexOf('}')
  let datos: { resumen?: unknown; resultados?: unknown }
  try {
    if (inicio < 0 || fin <= inicio) throw new Error()
    datos = JSON.parse(respuesta.slice(inicio, fin + 1))
  } catch {
    throw new ErrorIA(`La IA no devolvió JSON válido. Respuesta: "${respuesta.slice(0, 200)}"`)
  }

  const porClausula = new Map<string, Record<string, unknown>>()
  for (const r of Array.isArray(datos.resultados) ? datos.resultados : []) {
    if (r && typeof r === 'object' && typeof (r as { clausula?: unknown }).clausula === 'string') {
      porClausula.set(String((r as { clausula: string }).clausula).trim(), r as Record<string, unknown>)
    }
  }

  // Un resultado por criterio PEDIDO, en el orden pedido; lo que falte, "No evaluable".
  const resultados = criterios.map((c): ResultadoCriterio => {
    const r = porClausula.get(c.clausula)
    if (!r) return { criterio_id: c.id, estado: 'No evaluable', hallazgos: 'La IA no devolvió resultado para esta cláusula.', sugerencias: null }
    const estado = ESTADOS[normalizar(String(r.estado ?? ''))]
    if (!estado) {
      return { criterio_id: c.id, estado: 'No evaluable', hallazgos: `La IA devolvió un estado no reconocido: "${String(r.estado ?? '')}".`, sugerencias: null }
    }
    return { criterio_id: c.id, estado, hallazgos: opcional(r.hallazgos), sugerencias: opcional(r.sugerencias) }
  })

  return { resumen: opcional(datos.resumen), resultados }
}

// ─── Adaptador compatible con OpenAI ───────────────────────────────────────

export function crearAnalizadorCompatibleOpenAI(config: {
  baseUrl: string
  apiKey: string
  modelo: string
  fetch?: typeof fetch
}): AnalizadorIA {
  if (!config.baseUrl || !config.apiKey || !config.modelo) {
    throw new ErrorIA('La IA no está configurada: faltan IA_BASE_URL, IA_API_KEY o IA_MODELO en el entorno de la función.')
  }
  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const llamar = config.fetch ?? fetch

  return {
    async completar(mensajes) {
      const respuesta = await llamar(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: config.modelo, messages: mensajes, temperature: 0.1 }),
      })
      if (!respuesta.ok) {
        const detalle = (await respuesta.text().catch(() => '')).slice(0, 200)
        if (respuesta.status === 401 || respuesta.status === 403) throw new ErrorIA('La clave de la IA es inválida o no tiene permiso (revisá IA_API_KEY).')
        if (respuesta.status === 404) throw new ErrorIA(`El modelo "${config.modelo}" no existe en el proveedor (revisá IA_MODELO e IA_BASE_URL).`)
        if (respuesta.status === 429) throw new ErrorIA('Se alcanzó el límite de uso del proveedor de IA. Probá más tarde o revisá tu plan.')
        throw new ErrorIA(`El proveedor de IA respondió ${respuesta.status}: ${detalle}`)
      }
      const cuerpo = await respuesta.json() as { choices?: { message?: { content?: string } }[] }
      const texto = cuerpo.choices?.[0]?.message?.content
      if (!texto) throw new ErrorIA('El proveedor de IA respondió sin contenido.')
      return texto
    },
  }
}
