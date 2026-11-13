import { describe, expect, it } from 'vitest'
import { buscarDocumentos, ordenarDocumentos, siguienteOrden, type Orden } from './listadoDocumentos'

describe('buscarDocumentos (O16: búsqueda por texto en el listado)', () => {
  const docs = [{ id: 'a', t: 'Procedimiento de compras SGC-PR-001' }, { id: 'b', t: 'Política de calidad' }, { id: 'c', t: 'Manual' }]
  const textoDe = (d: (typeof docs)[number]) => d.t

  it('sin texto devuelve todo, en el mismo orden', () => {
    expect(buscarDocumentos(docs, '', textoDe).map((d) => d.id)).toEqual(['a', 'b', 'c'])
    expect(buscarDocumentos(docs, '   ', textoDe).map((d) => d.id)).toEqual(['a', 'b', 'c'])
  })
  it('ignora mayúsculas, acentos y espacios alrededor', () => {
    expect(buscarDocumentos(docs, '  POLITICA ', textoDe).map((d) => d.id)).toEqual(['b'])
    expect(buscarDocumentos(docs, 'sgc-pr', textoDe).map((d) => d.id)).toEqual(['a'])
  })
  it('sin coincidencias devuelve una lista vacía', () => {
    expect(buscarDocumentos(docs, 'zzz', textoDe)).toEqual([])
  })
})

describe('ordenarDocumentos', () => {
  const docs = [{ id: 'a', v: '1.10' }, { id: 'b', v: '1.2' }, { id: 'c', v: '' }, { id: 'd', v: '1.9' }]
  const valorDe = (d: (typeof docs)[number]) => d.v
  const ids = (orden: Orden | null) => ordenarDocumentos(docs, orden, () => valorDe).map((d) => d.id)

  it('sin orden deja la lista como viene', () => {
    expect(ids(null)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('ascendente compara los números como números (1.9 antes que 1.10) y deja los vacíos al final', () => {
    expect(ids({ clave: 'v', direccion: 'asc' })).toEqual(['b', 'd', 'a', 'c'])
  })
  it('descendente invierte, pero los vacíos siguen al final', () => {
    expect(ids({ clave: 'v', direccion: 'desc' })).toEqual(['a', 'd', 'b', 'c'])
  })
  it('es estable: lo que empata conserva su orden y no se modifica la lista original', () => {
    const iguales = [{ id: 'x', v: 'a' }, { id: 'y', v: 'a' }, { id: 'z', v: 'a' }]
    const r = ordenarDocumentos(iguales, { clave: 'v', direccion: 'desc' }, () => (d) => d.v)
    expect(r.map((d) => d.id)).toEqual(['x', 'y', 'z'])
    ordenarDocumentos(docs, { clave: 'v', direccion: 'asc' }, () => valorDe)
    expect(docs.map((d) => d.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('lo que solo difiere en mayúsculas o acentos empata y conserva su orden', () => {
    const n = [{ id: '1', v: 'Casa' }, { id: '2', v: 'casa' }, { id: '3', v: 'cása' }]
    expect(ordenarDocumentos(n, { clave: 'v', direccion: 'asc' }, () => (d) => d.v).map((d) => d.id)).toEqual(['1', '2', '3'])
  })
  it('ordena sin distinguir acentos ni mayúsculas', () => {
    const n = [{ id: '1', v: 'Árbol' }, { id: '2', v: 'abeja' }, { id: '3', v: 'Zorro' }]
    expect(ordenarDocumentos(n, { clave: 'v', direccion: 'asc' }, () => (d) => d.v).map((d) => d.id)).toEqual(['2', '1', '3'])
  })
})

describe('siguienteOrden (clic en el encabezado de una columna)', () => {
  it('primer clic: ascendente; segundo: descendente; tercero: sin orden', () => {
    const uno = siguienteOrden(null, 'nombre')
    expect(uno).toEqual({ clave: 'nombre', direccion: 'asc' })
    const dos = siguienteOrden(uno, 'nombre')
    expect(dos).toEqual({ clave: 'nombre', direccion: 'desc' })
    expect(siguienteOrden(dos, 'nombre')).toBeNull()
  })
  it('un clic en otra columna empieza en ascendente', () => {
    expect(siguienteOrden({ clave: 'nombre', direccion: 'desc' }, 'fecha')).toEqual({ clave: 'fecha', direccion: 'asc' })
  })
})
