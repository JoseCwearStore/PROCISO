import { describe, expect, it } from 'vitest'
import type { EstadoNC } from '../types'
import { accionesNC, tratamientoEditable } from './noConformidades'

const nc = (estado: EstadoNC) => ({ estado })

// Espejo de cambiar_estado_nc en la BD (solo para no mostrar botones que el servidor rechaza).
describe('accionesNC', () => {
  it('equipo y cliente avanzan el tratamiento: Abierta → En análisis → En corrección', () => {
    for (const esEquipo of [true, false]) {
      expect(accionesNC(nc('Abierta'), esEquipo)).toEqual([{ estado: 'En análisis', etiqueta: 'Iniciar análisis' }])
      expect(accionesNC(nc('En análisis'), esEquipo)).toEqual([{ estado: 'En corrección', etiqueta: 'Pasar a corrección' }])
    }
  })

  it('solo el equipo verifica: Eficaz → Verificada, No eficaz → vuelve a En análisis', () => {
    expect(accionesNC(nc('En corrección'), true)).toEqual([
      { estado: 'Verificada', etiqueta: 'Verificar: eficaz', requiereVerificacion: true },
      { estado: 'En análisis', etiqueta: 'Verificar: no eficaz', requiereVerificacion: true },
    ])
    expect(accionesNC(nc('En corrección'), false)).toEqual([])
  })

  it('solo el equipo cierra una NC verificada; una cerrada no se mueve más', () => {
    expect(accionesNC(nc('Verificada'), true)).toEqual([{ estado: 'Cerrada', etiqueta: 'Cerrar no conformidad' }])
    expect(accionesNC(nc('Verificada'), false)).toEqual([])
    expect(accionesNC(nc('Cerrada'), true)).toEqual([])
  })
})

describe('tratamientoEditable', () => {
  it('corrección, causa y acción se editan hasta que la NC se verifica', () => {
    expect(['Abierta', 'En análisis', 'En corrección'].map((e) => tratamientoEditable(nc(e as EstadoNC)))).toEqual([true, true, true])
    expect(['Verificada', 'Cerrada'].map((e) => tratamientoEditable(nc(e as EstadoNC)))).toEqual([false, false])
  })
})
