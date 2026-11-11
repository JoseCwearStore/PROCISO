// AUD08-M2(c): servicios.ts no tenía tests. Acá vive el puente de `status` de las Edge Functions
// (de él depende distinguir 403 / 400 / error de servicio) y que cada adaptador llame a lo correcto.
import { describe, expect, it, vi } from 'vitest'

// supabase.ts exige variables de entorno y crea un cliente real: acá se reemplaza.
vi.mock('./supabase', () => ({ supabase: {}, llegoDesdeEnlaceDeRecuperacion: false }))

import type { SupabaseClient } from '@supabase/supabase-js'
import { adaptarClienteDatos, adaptarClienteEscritura } from './servicios'

const comoCliente = (falso: unknown) => falso as SupabaseClient

describe('adaptarClienteEscritura.functions.invoke (puente de status)', () => {
  it('con éxito devuelve los datos y error null', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: 1 }, error: null })
    const cliente = adaptarClienteEscritura(comoCliente({ functions: { invoke } }))
    const r = await cliente.functions.invoke('analizar-ia', { body: { a: 1 } })
    expect(r).toEqual({ data: { ok: 1 }, error: null })
    expect(invoke).toHaveBeenCalledWith('analizar-ia', { body: { a: 1 } })
  })

  it.each([401, 403, 400, 500])('saca el status %s de error.context (el Response de supabase-js)', async (status) => {
    const error = Object.assign(new Error('boom'), { context: { status } })
    const invoke = vi.fn().mockResolvedValue({ data: null, error })
    const cliente = adaptarClienteEscritura(comoCliente({ functions: { invoke } }))
    const r = await cliente.functions.invoke('generar-documento', { body: {} })
    expect(r).toEqual({ data: null, error: { message: 'boom', status } })
  })

  it('si el error no trae Response (p. ej. sin red), el status queda undefined', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: new Error('Failed to fetch') })
    const cliente = adaptarClienteEscritura(comoCliente({ functions: { invoke } }))
    const r = await cliente.functions.invoke('analizar-ia', { body: {} })
    expect(r.error?.status).toBeUndefined()
    expect(r.error?.message).toBe('Failed to fetch')
  })
})

describe('adaptarClienteEscritura: encadenado hacia supabase-js', () => {
  it('insert → select → single', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const from = vi.fn(() => ({ insert }))
    const cliente = adaptarClienteEscritura(comoCliente({ from }))

    await cliente.from('tareas').insert({ a: 1 }).select('id').single()

    expect(from).toHaveBeenCalledWith('tareas')
    expect(insert).toHaveBeenCalledWith({ a: 1 })
    expect(select).toHaveBeenCalledWith('id')
  })

  it('update → eq → select → single', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: null })
    const select = vi.fn(() => ({ single }))
    const eq = vi.fn(() => ({ select }))
    const update = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ update }))
    const cliente = adaptarClienteEscritura(comoCliente({ from }))

    await cliente.from('empresas').update({ activa: false }).eq('id', 'e1').select('id').single()

    expect(update).toHaveBeenCalledWith({ activa: false })
    expect(eq).toHaveBeenCalledWith('id', 'e1')
  })

  it('rpc pasa función y argumentos tal cual', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const cliente = adaptarClienteEscritura(comoCliente({ rpc }))
    await cliente.rpc('cambiar_estado_nc', { p_id: '1' })
    expect(rpc).toHaveBeenCalledWith('cambiar_estado_nc', { p_id: '1' })
  })

  it('storage: sube y borra en el bucket pedido', async () => {
    const upload = vi.fn().mockResolvedValue({ data: {}, error: null })
    const remove = vi.fn().mockResolvedValue({ data: [], error: null })
    const from = vi.fn(() => ({ upload, remove }))
    const cliente = adaptarClienteEscritura(comoCliente({ storage: { from } }))

    const archivo = new File(['x'], 'a.pdf')
    await cliente.storage.from('evidencias').upload('ruta/a.pdf', archivo, { contentType: 'application/pdf' })
    await cliente.storage.from('evidencias').remove(['ruta/a.pdf'])

    expect(from).toHaveBeenCalledWith('evidencias')
    expect(upload).toHaveBeenCalledWith('ruta/a.pdf', archivo, { contentType: 'application/pdf' })
    expect(remove).toHaveBeenCalledWith(['ruta/a.pdf'])
  })
})

describe('adaptarClienteDatos', () => {
  it('from(tabla).select(columnas) y rpc llegan al cliente real', () => {
    const select = vi.fn().mockReturnValue('consulta')
    const from = vi.fn(() => ({ select }))
    const rpc = vi.fn().mockReturnValue('llamada')
    const cliente = adaptarClienteDatos(comoCliente({ from, rpc }))

    expect(cliente.from('proyectos').select('id,nombre')).toBe('consulta')
    expect(cliente.rpc('mis_notificaciones')).toBe('llamada')
    expect(from).toHaveBeenCalledWith('proyectos')
    expect(select).toHaveBeenCalledWith('id,nombre')
  })
})
