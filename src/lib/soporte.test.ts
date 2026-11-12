import { describe, expect, it, vi } from 'vitest'
import { MENSAJES_ERROR_ESCRITURA } from './escrituras'
import { adaptarReporte, crearServicioSoporte, type ClienteSoporte } from './soporte'

const FILA = {
  id: 'r-1', consultoria_id: 'c-1', usuario_id: 'u-1', tipo: 'Error', asunto: 'No carga', mensaje: 'Pasos…',
  estado: 'Abierto', atendido_por: null, atendido_en: null, creado_en: '2026-11-12T10:00:00+00:00',
}

interface Llamadas { insert: unknown[]; rpc: unknown[]; order: unknown[] }
function clienteDoble(respuestas: { select?: { data: unknown[] | null; error: { code?: string; message: string } | null }; insert?: { error: { code?: string; message: string } | null }; rpc?: { error: { code?: string; message: string } | null } } = {}) {
  const llamadas: Llamadas = { insert: [], rpc: [], order: [] }
  const cliente: ClienteSoporte = {
    from: (tabla) => {
      expect(tabla).toBe('soporte_reportes')
      return {
        select: () => ({ order: async (columna, opciones) => { llamadas.order.push([columna, opciones]); return respuestas.select ?? { data: [FILA], error: null } } }),
        insert: async (fila) => { llamadas.insert.push(fila); return respuestas.insert ?? { error: null } },
      }
    },
    rpc: async (funcion, args) => { llamadas.rpc.push([funcion, args]); return respuestas.rpc ?? { error: null } },
  }
  return { cliente, llamadas }
}

describe('adaptarReporte', () => {
  it('traduce la fila de la BD', () => {
    expect(adaptarReporte(FILA)).toEqual({
      id: 'r-1', consultoriaId: 'c-1', usuarioId: 'u-1', tipo: 'Error', asunto: 'No carga', mensaje: 'Pasos…',
      estado: 'Abierto', atendidoPorId: undefined, atendidoEn: undefined, creadoEn: '2026-11-12T10:00:00+00:00',
    })
  })

  it('un reporte atendido trae quién y cuándo; el del Admin PROCISO no trae consultoría', () => {
    expect(adaptarReporte({ ...FILA, consultoria_id: null, estado: 'Atendido', atendido_por: 'u-2', atendido_en: '2026-11-12T11:00:00+00:00' }))
      .toMatchObject({ consultoriaId: undefined, estado: 'Atendido', atendidoPorId: 'u-2', atendidoEn: '2026-11-12T11:00:00+00:00' })
  })

  it.each([
    ['no es un objeto', null],
    ['tipo desconocido', { ...FILA, tipo: 'Chisme' }],
    ['estado desconocido', { ...FILA, estado: 'Cerrado' }],
    ['falta el asunto', { ...FILA, asunto: undefined }],
  ])('devuelve null si la fila es inválida (%s)', (_caso, fila) => {
    expect(adaptarReporte(fila)).toBeNull()
  })
})

describe('listar', () => {
  it('pide los reportes del más nuevo al más viejo y los traduce', async () => {
    const { cliente, llamadas } = clienteDoble()
    const lista = await crearServicioSoporte(cliente).listar()

    expect(lista).toHaveLength(1)
    expect(lista?.[0].asunto).toBe('No carga')
    expect(llamadas.order).toEqual([['creado_en', { ascending: false }]])
  })

  it('descarta las filas inválidas en vez de romper', async () => {
    const { cliente } = clienteDoble({ select: { data: [FILA, { foo: 1 }], error: null } })
    expect(await crearServicioSoporte(cliente).listar()).toHaveLength(1)
  })

  it('devuelve null si la BD falla (la pantalla muestra el formulario igual)', async () => {
    expect(await crearServicioSoporte(clienteDoble({ select: { data: null, error: { message: 'x' } } }).cliente).listar()).toBeNull()
  })
})

describe('enviar', () => {
  it('manda solo tipo, asunto y mensaje (sin espacios sobrantes): usuario y consultoría los pone la BD', async () => {
    const { cliente, llamadas } = clienteDoble()
    const r = await crearServicioSoporte(cliente).enviar({ tipo: 'Error', asunto: '  No carga  ', mensaje: ' Pasos para reproducirlo ' })

    expect(r).toEqual({ ok: true, valor: undefined })
    expect(llamadas.insert).toEqual([{ tipo: 'Error', asunto: 'No carga', mensaje: 'Pasos para reproducirlo' }])
  })

  it.each([
    ['asunto vacío', { tipo: 'Soporte' as const, asunto: '   ', mensaje: 'x' }],
    ['mensaje vacío', { tipo: 'Soporte' as const, asunto: 'x', mensaje: '' }],
    ['asunto de 121 caracteres', { tipo: 'Soporte' as const, asunto: 'a'.repeat(121), mensaje: 'x' }],
    ['mensaje de 2001 caracteres', { tipo: 'Soporte' as const, asunto: 'x', mensaje: 'a'.repeat(2001) }],
  ])('rechaza %s sin llamar a la BD', async (_caso, pedido) => {
    const { cliente, llamadas } = clienteDoble()
    expect(await crearServicioSoporte(cliente).enviar(pedido)).toEqual({ ok: false, error: 'datos_invalidos' })
    expect(llamadas.insert).toEqual([])
  })

  it.each([
    ['LM429', 'limite_reportes'],
    ['42501', 'sin_permiso'],
    ['23514', 'datos_invalidos'],
    ['XX000', 'servicio'],
  ])('traduce el código %s de la BD a "%s"', async (code, esperado) => {
    const { cliente } = clienteDoble({ insert: { error: { code, message: 'x' } } })
    expect(await crearServicioSoporte(cliente).enviar({ tipo: 'Soporte', asunto: 'a', mensaje: 'b' })).toEqual({ ok: false, error: esperado })
  })

  it('el tope diario tiene un mensaje que explica qué pasó', () => {
    expect(MENSAJES_ERROR_ESCRITURA.limite_reportes).toMatch(/máximo de reportes/i)
  })
})

describe('atender', () => {
  it('llama a atender_reporte con el id', async () => {
    const { cliente, llamadas } = clienteDoble()
    expect(await crearServicioSoporte(cliente).atender('r-1')).toEqual({ ok: true, valor: undefined })
    expect(llamadas.rpc).toEqual([['atender_reporte', { p_id: 'r-1' }]])
  })

  it.each([
    ['42501', 'sin_permiso'],
    ['22023', 'datos_invalidos'],
    ['XX000', 'servicio'],
  ])('traduce el código %s a "%s"', async (code, esperado) => {
    const { cliente } = clienteDoble({ rpc: { error: { code, message: 'x' } } })
    expect(await crearServicioSoporte(cliente).atender('r-1')).toEqual({ ok: false, error: esperado })
  })

  it('si la llamada revienta (sin red) devuelve "servicio" en vez de romper', async () => {
    const cliente: ClienteSoporte = { ...clienteDoble().cliente, rpc: vi.fn(async () => { throw new Error('Failed to fetch') }) }
    expect(await crearServicioSoporte(cliente).atender('r-1')).toEqual({ ok: false, error: 'servicio' })
  })
})
