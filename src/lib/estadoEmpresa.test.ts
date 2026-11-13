import { describe, expect, it } from 'vitest'
import { etiquetaEstadoEmpresa } from './estadoEmpresa'

describe('etiquetaEstadoEmpresa (lista y ficha de Empresas dicen lo mismo, E3)', () => {
  it('una empresa activa se llama "Activa"', () => {
    expect(etiquetaEstadoEmpresa(true)).toBe('Activa')
  })

  it('una empresa archivada se llama "Archivada", no "Obsoleto"', () => {
    expect(etiquetaEstadoEmpresa(false)).toBe('Archivada')
  })
})
