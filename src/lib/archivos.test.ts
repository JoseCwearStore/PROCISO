import { describe, expect, it, vi } from 'vitest'
import type { Evidencia } from '../types'
import { DURACION_URL_SEGUNDOS, crearServicioArchivos, type ClienteArchivos } from './archivos'

const conRuta = (id: string, ruta?: string) => ({ id, archivoRuta: ruta }) as Evidencia

function crearClienteDoble(respuesta: Awaited<ReturnType<ReturnType<ClienteArchivos['storage']['from']>['createSignedUrls']>>) {
  const createSignedUrls = vi.fn(async (_rutas: string[], _segundos: number) => respuesta)
  const cliente: ClienteArchivos = { storage: { from: () => ({ createSignedUrls }) } }
  return { cliente, createSignedUrls }
}

describe('firmarEvidencias', () => {
  it('pide todas las URLs firmadas en un solo pedido y las asigna a cada evidencia', async () => {
    const { cliente, createSignedUrls } = crearClienteDoble({
      data: [
        { path: 'c/e/p/1.jpg', signedUrl: 'https://firmada/1', error: null },
        { path: 'c/e/p/2.pdf', signedUrl: 'https://firmada/2', error: null },
      ],
      error: null,
    })
    const archivos = crearServicioArchivos(cliente)

    const resultado = await archivos.firmarEvidencias([conRuta('1', 'c/e/p/1.jpg'), conRuta('sin'), conRuta('2', 'c/e/p/2.pdf')])

    expect(createSignedUrls).toHaveBeenCalledOnce()
    expect(createSignedUrls).toHaveBeenCalledWith(['c/e/p/1.jpg', 'c/e/p/2.pdf'], DURACION_URL_SEGUNDOS)
    expect(resultado.map((e) => e.archivoUrl)).toEqual(['https://firmada/1', undefined, 'https://firmada/2'])
  })

  it('no hace ningún pedido si ninguna evidencia tiene archivo', async () => {
    const { cliente, createSignedUrls } = crearClienteDoble({ data: [], error: null })
    const archivos = crearServicioArchivos(cliente)

    const evidencias = [conRuta('sin')]
    expect(await archivos.firmarEvidencias(evidencias)).toBe(evidencias)
    expect(createSignedUrls).not.toHaveBeenCalled()
  })

  it('si falla la firma, devuelve las evidencias sin URL en vez de romper la carga', async () => {
    const { cliente } = crearClienteDoble({ data: null, error: { message: 'Failed to fetch' } })
    const archivos = crearServicioArchivos(cliente)

    const resultado = await archivos.firmarEvidencias([conRuta('1', 'c/e/p/1.jpg')])

    expect(resultado[0].archivoUrl).toBeUndefined()
  })

  it('deja sin URL los archivos que el RLS no permite firmar', async () => {
    const { cliente } = crearClienteDoble({
      data: [{ path: 'c/e/p/1.jpg', signedUrl: null, error: 'Either the object does not exist or you do not have access to it' }],
      error: null,
    })
    const archivos = crearServicioArchivos(cliente)

    const resultado = await archivos.firmarEvidencias([conRuta('1', 'c/e/p/1.jpg')])

    expect(resultado[0].archivoUrl).toBeUndefined()
  })
})
