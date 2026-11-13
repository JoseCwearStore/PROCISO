import { describe, expect, it } from 'vitest'
import { avisoDelPaso, faltantesVisibles } from './avisoLevantamiento'

describe('avisoDelPaso (qué se guarda al validar un paso)', () => {
  it('sin faltantes no hay aviso', () => {
    expect(avisoDelPaso(2, [])).toBeNull()
  })

  it('con faltantes recuerda el paso y la lista', () => {
    expect(avisoDelPaso(2, ['Materiales', 'Equipos'])).toEqual({ paso: 2, faltantes: ['Materiales', 'Equipos'] })
  })
})

describe('faltantesVisibles (el aviso rojo solo se ve en el paso donde se produjo, E6)', () => {
  const aviso = avisoDelPaso(1, ['Entradas', 'Salidas'])

  it('en el paso del aviso muestra los faltantes', () => {
    expect(faltantesVisibles(aviso, 1)).toEqual(['Entradas', 'Salidas'])
  })

  it('al pasar al paso siguiente no se ve', () => {
    expect(faltantesVisibles(aviso, 2)).toEqual([])
  })

  it('al volver a un paso anterior tampoco se ve', () => {
    expect(faltantesVisibles(aviso, 0)).toEqual([])
  })

  it('el paso 0 es un paso válido (no se confunde con "sin aviso")', () => {
    expect(faltantesVisibles(avisoDelPaso(0, ['Nombre']), 0)).toEqual(['Nombre'])
  })

  it('sin aviso no hay nada que mostrar', () => {
    expect(faltantesVisibles(null, 0)).toEqual([])
  })
})
