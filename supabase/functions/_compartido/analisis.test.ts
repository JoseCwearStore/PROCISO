import { describe, expect, it, vi } from 'vitest'
import {
  armarMensajes,
  crearAnalizadorCompatibleOpenAI,
  ErrorIA,
  interpretarRespuesta,
  textoDeSecciones,
  type CriterioIA,
} from './analisis.ts'

const C521: CriterioIA = {
  id: 'c-521', clausula: '5.2.1', titulo: 'Establecimiento de la política de calidad',
  intencion: 'Comprobar que la política es apropiada e incluye los compromisos.',
  evidencia_esperada: ['Política aprobada'], preguntas: ['¿incluye el compromiso de mejora continua?'],
  senales_de_hueco: ['falta el compromiso de mejora continua'],
}
const C522: CriterioIA = { ...C521, id: 'c-522', clausula: '5.2.2', titulo: 'Comunicación de la política' }

describe('textoDeSecciones', () => {
  it('une títulos, contenido y tablas de un documento de la app', () => {
    const texto = textoDeSecciones([
      { titulo: 'Objetivo', contenido: 'Asegurar la calidad.', tipo: 'texto' },
      { titulo: 'Responsables', contenido: '', tipo: 'tabla', filas: [['Rol', 'Persona'], ['Director', 'Ana']] },
    ])

    expect(texto).toBe('## Objetivo\nAsegurar la calidad.\n\n## Responsables\nRol | Persona\nDirector | Ana')
  })
})

describe('armarMensajes', () => {
  it('pide JSON con un resultado por cláusula y pone el aviso de preevaluación', () => {
    const [sistema, usuario] = armarMensajes([C521], { texto: 'Nuestra política…', imagenes: [] }, 'Política de calidad')

    expect(sistema.role).toBe('system')
    expect(sistema.content).toContain('preevaluación')
    expect(sistema.content).toContain('JSON')
    expect(usuario.content).toEqual(expect.stringContaining('5.2.1'))
    expect(usuario.content).toEqual(expect.stringContaining('Nuestra política…'))
  })

  it('manda las imágenes como partes del mensaje (para modelos con visión)', () => {
    const [, usuario] = armarMensajes([C521], { texto: '', imagenes: [{ mime: 'image/png', base64: 'AAAA' }] }, 'Foto')

    expect(Array.isArray(usuario.content)).toBe(true)
    expect(usuario.content).toEqual(expect.arrayContaining([{ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }]))
  })

  it('recorta un texto enorme para no exceder el contexto del modelo', () => {
    const [, usuario] = armarMensajes([C521], { texto: 'x'.repeat(200_000), imagenes: [] }, 'Largo')

    expect(String(usuario.content).length).toBeLessThan(80_000)
    expect(String(usuario.content)).toContain('[texto recortado]')
  })
})

describe('interpretarRespuesta', () => {
  it('lee el JSON aunque venga con texto o bloque de código alrededor, y lo mapea a los criterios', () => {
    const respuesta = 'Aquí está:\n```json\n{"resumen":"Parcial.","resultados":[' +
      '{"clausula":"5.2.1","estado":"parcial","hallazgos":"Falta mejora continua.","sugerencias":"Agregarla."},' +
      '{"clausula":"5.2.2","estado":"Cubierto","hallazgos":"Se comunica."}]}\n```'

    expect(interpretarRespuesta(respuesta, [C521, C522])).toEqual({
      resumen: 'Parcial.',
      resultados: [
        { criterio_id: 'c-521', estado: 'Parcial', hallazgos: 'Falta mejora continua.', sugerencias: 'Agregarla.' },
        { criterio_id: 'c-522', estado: 'Cubierto', hallazgos: 'Se comunica.', sugerencias: null },
      ],
    })
  })

  it('no inventa: una cláusula sin resultado queda "No evaluable" y un estado desconocido también', () => {
    const respuesta = '{"resumen":"x","resultados":[{"clausula":"5.2.1","estado":"Excelente"}]}'

    expect(interpretarRespuesta(respuesta, [C521, C522]).resultados).toEqual([
      { criterio_id: 'c-521', estado: 'No evaluable', hallazgos: 'La IA devolvió un estado no reconocido: "Excelente".', sugerencias: null },
      { criterio_id: 'c-522', estado: 'No evaluable', hallazgos: 'La IA no devolvió resultado para esta cláusula.', sugerencias: null },
    ])
  })

  it('ignora cláusulas que no se pidieron', () => {
    const respuesta = '{"resumen":"x","resultados":[{"clausula":"9.9","estado":"Cubierto"},{"clausula":"5.2.1","estado":"Hueco"}]}'

    expect(interpretarRespuesta(respuesta, [C521]).resultados.map((r) => r.criterio_id)).toEqual(['c-521'])
  })

  it('si la respuesta no trae JSON, falla con un error explicable', () => {
    expect(() => interpretarRespuesta('No puedo ayudar con eso.', [C521])).toThrow(ErrorIA)
    expect(() => interpretarRespuesta('No puedo ayudar con eso.', [C521])).toThrow(/no devolvió JSON/)
  })
})

describe('crearAnalizadorCompatibleOpenAI', () => {
  const config = { baseUrl: 'https://ollama.com/v1/', apiKey: 'clave-de-prueba', modelo: 'gpt-oss:120b-cloud' }

  it('llama a /chat/completions con el modelo, la clave y los mensajes', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":1}' } }] }), { status: 200 }))
    const analizador = crearAnalizadorCompatibleOpenAI({ ...config, fetch })

    const texto = await analizador.completar([{ role: 'user', content: 'hola' }])

    expect(texto).toBe('{"ok":1}')
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://ollama.com/v1/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer clave-de-prueba')
    expect(JSON.parse(String(init.body))).toMatchObject({ model: 'gpt-oss:120b-cloud', messages: [{ role: 'user', content: 'hola' }] })
  })

  it('traduce los errores HTTP a mensajes accionables', async () => {
    const con = (status: number) => crearAnalizadorCompatibleOpenAI({ ...config, fetch: async () => new Response('x', { status }) })

    await expect(con(401).completar([])).rejects.toThrow(/clave.*inválida/i)
    await expect(con(404).completar([])).rejects.toThrow(/modelo.*no existe/i)
    await expect(con(429).completar([])).rejects.toThrow(/límite/i)
    await expect(con(500).completar([])).rejects.toThrow(/500/)
  })

  it('sin clave o sin modelo no llama a nadie: la IA no está configurada', () => {
    expect(() => crearAnalizadorCompatibleOpenAI({ ...config, apiKey: '', fetch: vi.fn() })).toThrow(/no está configurada/)
    expect(() => crearAnalizadorCompatibleOpenAI({ ...config, modelo: '', fetch: vi.fn() })).toThrow(/no está configurada/)
  })
})
