import { describe, expect, it } from 'vitest'
import { ErrorIA } from './analisis.ts'
import { armarMensajesGeneracion, interpretarGeneracion, validarPedido, type CampoIA } from './generacion.ts'

const CAMPO: CampoIA = { id: 'declaracion', instruccion: 'Redacta la declaración de la política de calidad.', ejemplo: 'En Muebles del Bajío diseñamos…' }
const PEDIDO = {
  plantilla: 'Política de calidad',
  organizacion: 'Marketino',
  respuestas: [{ pregunta: '¿Qué productos ofrece?', respuesta: 'Campañas de marketing' }],
  campos: [CAMPO],
}

describe('validarPedido', () => {
  it('acepta un pedido bien formado y limpia los espacios', () => {
    const v = validarPedido({ ...PEDIDO, organizacion: '  Marketino  ', respuestas: [{ pregunta: ' ¿Q? ', respuesta: ' R ' }] })
    expect(v.organizacion).toBe('Marketino')
    expect(v.respuestas).toEqual([{ pregunta: '¿Q?', respuesta: 'R' }])
    expect(v.campos).toEqual([CAMPO])
  })

  it('descarta las respuestas en blanco', () => {
    const v = validarPedido({ ...PEDIDO, respuestas: [{ pregunta: 'a', respuesta: '   ' }, { pregunta: 'b', respuesta: 'x' }] })
    expect(v.respuestas).toEqual([{ pregunta: 'b', respuesta: 'x' }])
  })

  it.each([
    ['no es un objeto', null],
    ['sin plantilla', { ...PEDIDO, plantilla: '' }],
    ['sin campos', { ...PEDIDO, campos: [] }],
    ['con demasiados campos', { ...PEDIDO, campos: Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, instruccion: 'x' })) }],
    ['con un campo sin instrucción', { ...PEDIDO, campos: [{ id: 'a', instruccion: '' }] }],
    ['con ids de campo repetidos', { ...PEDIDO, campos: [CAMPO, CAMPO] }],
    ['con una instrucción enorme', { ...PEDIDO, campos: [{ id: 'a', instruccion: 'x'.repeat(1501) }] }],
    ['con un ejemplo enorme', { ...PEDIDO, campos: [{ id: 'a', instruccion: 'x', ejemplo: 'x'.repeat(3001) }] }],
    ['con respuestas que no son una lista', { ...PEDIDO, respuestas: 'hola' }],
    ['con demasiadas respuestas', { ...PEDIDO, respuestas: Array.from({ length: 21 }, () => ({ pregunta: 'p', respuesta: 'r' })) }],
    ['con una respuesta enorme', { ...PEDIDO, respuestas: [{ pregunta: 'p', respuesta: 'x'.repeat(2001) }] }],
  ])('rechaza un pedido %s', (_caso, pedido) => {
    expect(() => validarPedido(pedido)).toThrow(ErrorIA)
  })
})

describe('armarMensajesGeneracion', () => {
  const mensajes = armarMensajesGeneracion(validarPedido(PEDIDO))
  const usuario = String(mensajes[1].content)

  it('arma un mensaje de sistema y uno de usuario', () => {
    expect(mensajes.map((m) => m.role)).toEqual(['system', 'user'])
  })

  it('el sistema prohíbe inventar datos y pide solo JSON', () => {
    const sistema = String(mensajes[0].content)
    expect(sistema).toContain('No inventes')
    expect(sistema).toContain('[por confirmar]')
    expect(sistema).toContain('SOLO con JSON')
    expect(sistema).toContain('NO copies')
  })

  it('el usuario lleva la organización, las respuestas y los campos pedidos', () => {
    expect(usuario).toContain('Marketino')
    expect(usuario).toContain('¿Qué productos ofrece?')
    expect(usuario).toContain('Campañas de marketing')
    expect(usuario).toContain('declaracion')
    expect(usuario).toContain('Redacta la declaración de la política de calidad.')
    expect(usuario).toContain('En Muebles del Bajío diseñamos…')
  })

  it('sin respuestas lo dice, para que el modelo no las invente', () => {
    const sin = String(armarMensajesGeneracion(validarPedido({ ...PEDIDO, respuestas: [] }))[1].content)
    expect(sin).toContain('no respondió')
  })

  it('incluye los procesos del proyecto cuando vienen', () => {
    const con = String(armarMensajesGeneracion(validarPedido({ ...PEDIDO, procesos: ['Compras', 'Producción'] }))[1].content)
    expect(con).toContain('Compras')
    expect(con).toContain('Producción')
  })
})

describe('interpretarGeneracion', () => {
  const OTRO: CampoIA = { id: 'matriz', instruccion: 'x' }

  it('lee el JSON aunque venga envuelto en un bloque de código', () => {
    const r = interpretarGeneracion('```json\n{"campos": {"declaracion": "Texto A"}}\n```', [CAMPO])
    expect(r).toEqual({ declaracion: 'Texto A' })
  })

  it('acepta el objeto plano, sin la clave "campos"', () => {
    expect(interpretarGeneracion('{"declaracion": "Texto A"}', [CAMPO])).toEqual({ declaracion: 'Texto A' })
  })

  it('une una lista de textos en líneas', () => {
    const r = interpretarGeneracion('{"campos": {"declaracion": ["Uno", "Dos"]}}', [CAMPO])
    expect(r.declaracion).toBe('Uno\nDos')
  })

  it('ignora lo que no se pidió y lo que viene en blanco', () => {
    const r = interpretarGeneracion('{"campos": {"declaracion": "Texto", "matriz": "  ", "extra": "no pedido"}}', [CAMPO, OTRO])
    expect(r).toEqual({ declaracion: 'Texto' })
  })

  it('recorta un texto desmedido', () => {
    const r = interpretarGeneracion(JSON.stringify({ campos: { declaracion: 'x'.repeat(9000) } }), [CAMPO])
    expect(r.declaracion.length).toBeLessThanOrEqual(6000)
  })

  it('falla con un motivo claro si no es JSON', () => {
    expect(() => interpretarGeneracion('Lo siento, no puedo.', [CAMPO])).toThrow(/JSON válido/)
  })

  it('falla si no devuelve ninguno de los campos pedidos', () => {
    expect(() => interpretarGeneracion('{"campos": {"otro": "x"}}', [CAMPO])).toThrow(/ninguno de los campos/)
  })
})
