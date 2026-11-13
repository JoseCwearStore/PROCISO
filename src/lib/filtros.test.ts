import { describe, expect, it } from 'vitest'
import { hayFiltrosActivos } from './filtros'

// O12: Evidencias, sin resultados, no ofrecía "Limpiar filtros" (Empresas y Procesos sí). El botón solo tiene
// sentido si hay algún filtro puesto: sin filtros, "no hay resultados" es que todavía no hay nada que mostrar.
describe('hayFiltrosActivos', () => {
  it('con todos los filtros vacíos no hay filtros activos', () => {
    expect(hayFiltrosActivos({ busqueda: '', tipo: '', estado: '', proyecto: '' })).toBe(false)
    expect(hayFiltrosActivos({})).toBe(false)
  })

  it('con cualquiera de ellos puesto, sí', () => {
    expect(hayFiltrosActivos({ busqueda: 'audio', tipo: '', estado: '', proyecto: '' })).toBe(true)
    expect(hayFiltrosActivos({ busqueda: '', tipo: 'Video', estado: '', proyecto: '' })).toBe(true)
    expect(hayFiltrosActivos({ busqueda: '', tipo: '', estado: 'Cargada', proyecto: '' })).toBe(true)
    expect(hayFiltrosActivos({ busqueda: '', tipo: '', estado: '', proyecto: 'p-1' })).toBe(true)
  })

  it('un texto de búsqueda en blanco también filtra (la pantalla compara con includes), así que cuenta', () => {
    expect(hayFiltrosActivos({ busqueda: '   ', tipo: '' })).toBe(true)
  })

  it('con varios a la vez, sí', () => {
    expect(hayFiltrosActivos({ busqueda: 'x', tipo: 'Foto', estado: 'Revisada', proyecto: 'p' })).toBe(true)
  })
})
