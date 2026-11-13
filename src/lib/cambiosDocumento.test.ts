import { describe, expect, it } from 'vitest'
import { AVISO_CAMBIOS_SIN_GUARDAR, firmaDeContenido, hayCambiosSinGuardar } from './cambiosDocumento'
import type { SeccionDocumento } from '../types'

// O17: la preevaluación con IA analiza la última versión GUARDADA. El editor escribe directo al estado y no sabía qué
// estaba guardado, así que no podía avisar. La "firma" resume el contenido que la IA analiza (las secciones).
const TEXTO: SeccionDocumento = { id: 's1', titulo: 'Objetivo', tipo: 'texto', contenido: 'Establecer criterios.' }
const TABLA: SeccionDocumento = { id: 's2', titulo: 'Criterios', tipo: 'tabla', contenido: '', filas: [['Criterio', 'Peso'], ['Precio', '30']] }

describe('firmaDeContenido', () => {
  it('el mismo contenido da la misma firma', () => {
    expect(firmaDeContenido([TEXTO, TABLA])).toBe(firmaDeContenido([{ ...TEXTO }, { ...TABLA, filas: [['Criterio', 'Peso'], ['Precio', '30']] }]))
  })

  it.each<[string, SeccionDocumento[]]>([
    ['cambia el texto de una sección', [{ ...TEXTO, contenido: 'Otro texto.' }, TABLA]],
    ['cambia el título de una sección', [{ ...TEXTO, titulo: 'Propósito' }, TABLA]],
    ['cambia una celda de una tabla', [TEXTO, { ...TABLA, filas: [['Criterio', 'Peso'], ['Precio', '40']] }]],
    ['se agrega una fila a una tabla', [TEXTO, { ...TABLA, filas: [...(TABLA.filas ?? []), ['Calidad', '20']] }]],
    ['se agrega una sección', [TEXTO, TABLA, { id: 's3', titulo: 'Nueva', tipo: 'texto', contenido: '' }]],
    ['se borra una sección', [TEXTO]],
    ['se cambia el orden de las secciones', [TABLA, TEXTO]],
    ['una sección cambia de tipo', [{ ...TEXTO, tipo: 'tabla' as const }, TABLA]],
  ])('cambia la firma cuando %s', (_caso, secciones) => {
    expect(firmaDeContenido(secciones)).not.toBe(firmaDeContenido([TEXTO, TABLA]))
  })

  it('el id interno de una sección no cuenta: lo que la IA analiza es el contenido', () => {
    expect(firmaDeContenido([{ ...TEXTO, id: 'otro-id' }, TABLA])).toBe(firmaDeContenido([TEXTO, TABLA]))
  })

  it('un texto vacío no es lo mismo que una tabla sin filas ni que "sin secciones"', () => {
    expect(firmaDeContenido([])).not.toBe(firmaDeContenido([{ id: 's1', titulo: '', tipo: 'texto', contenido: '' }]))
    expect(firmaDeContenido([{ id: 's1', titulo: '', tipo: 'tabla', contenido: '' }]))
      .not.toBe(firmaDeContenido([{ id: 's1', titulo: '', tipo: 'tabla', contenido: '', filas: [] }]))
  })

  it('sin secciones (documento viejo) no revienta', () => {
    expect(firmaDeContenido(undefined)).toBe(firmaDeContenido([]))
  })
})

describe('hayCambiosSinGuardar', () => {
  const guardada = firmaDeContenido([TEXTO])

  it('con el mismo contenido que se guardó, no hay cambios', () => {
    expect(hayCambiosSinGuardar(guardada, firmaDeContenido([TEXTO]))).toBe(false)
  })

  it('con contenido distinto al guardado, sí', () => {
    expect(hayCambiosSinGuardar(guardada, firmaDeContenido([{ ...TEXTO, contenido: 'editado' }]))).toBe(true)
  })

  it('si no se sabe qué se guardó, no se inventa una alarma', () => {
    expect(hayCambiosSinGuardar(undefined, firmaDeContenido([TEXTO]))).toBe(false)
  })

  it('volver a escribir lo mismo que estaba guardado quita el aviso', () => {
    const editado = firmaDeContenido([{ ...TEXTO, contenido: 'editado' }])
    expect(hayCambiosSinGuardar(guardada, editado)).toBe(true)
    expect(hayCambiosSinGuardar(guardada, firmaDeContenido([{ ...TEXTO, contenido: TEXTO.contenido }]))).toBe(false)
  })
})

describe('AVISO_CAMBIOS_SIN_GUARDAR', () => {
  it('dice que hay cambios sin guardar, que la IA analiza lo guardado y qué hacer', () => {
    expect(AVISO_CAMBIOS_SIN_GUARDAR).toMatch(/sin guardar/i)
    expect(AVISO_CAMBIOS_SIN_GUARDAR).toMatch(/última versión guardada/i)
    expect(AVISO_CAMBIOS_SIN_GUARDAR).toMatch(/guarda el borrador/i)
  })
})
