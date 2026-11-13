import { describe, expect, it } from 'vitest'
import { codigoEnUso, recalcularCodigo, sugerirCodigo } from './codigosDocumento'

describe('codigoEnUso', () => {
  it('detecta un código ya usado en el proyecto', () => {
    expect(codigoEnUso('SGC-OBJ-001', ['SGC-POL-001', 'SGC-OBJ-001'])).toBe(true)
    expect(codigoEnUso('SGC-OBJ-002', ['SGC-POL-001', 'SGC-OBJ-001'])).toBe(false)
  })

  it('no distingue mayúsculas ni espacios alrededor (igual que el índice de la BD)', () => {
    expect(codigoEnUso('  sgc-obj-001 ', ['SGC-OBJ-001'])).toBe(true)
    expect(codigoEnUso('SGC-OBJ-001', ['  sgc-obj-001'])).toBe(true)
  })

  it('un código vacío o en blanco nunca está "en uso", y los documentos sin código no cuentan', () => {
    expect(codigoEnUso('', [null, undefined, ''])).toBe(false)
    expect(codigoEnUso('   ', ['   ', ''])).toBe(false)
    expect(codigoEnUso('X-1', [null, undefined, ''])).toBe(false)
  })

  it('no confunde un código con otro que lo contiene', () => {
    expect(codigoEnUso('SGC-OBJ-001', ['SGC-OBJ-0011', 'XSGC-OBJ-001'])).toBe(false)
  })
})

describe('sugerirCodigo (el siguiente código libre, E9)', () => {
  it('si el código base está libre, lo sugiere tal cual', () => {
    expect(sugerirCodigo('SGC-OBJ-001', [])).toBe('SGC-OBJ-001')
    expect(sugerirCodigo('SGC-OBJ-001', ['SGC-POL-001'])).toBe('SGC-OBJ-001')
  })

  it('si está ocupado, sube el número final conservando los ceros', () => {
    expect(sugerirCodigo('SGC-OBJ-001', ['SGC-OBJ-001'])).toBe('SGC-OBJ-002')
  })

  it('elige el primero libre después del base, uno por uno', () => {
    expect(sugerirCodigo('SGC-OBJ-001', ['SGC-OBJ-001', 'SGC-OBJ-002'])).toBe('SGC-OBJ-003')
    expect(sugerirCodigo('SGC-OBJ-001', ['SGC-OBJ-001', 'SGC-OBJ-003'])).toBe('SGC-OBJ-002')
  })

  it('salta los que ya están ocupados', () => {
    expect(sugerirCodigo('SGC-OBJ-001', ['SGC-OBJ-001', 'SGC-OBJ-002', 'SGC-OBJ-003'])).toBe('SGC-OBJ-004')
  })

  it('cuenta los ocupados aunque cambien las mayúsculas o haya espacios', () => {
    expect(sugerirCodigo('SGC-OBJ-001', ['sgc-obj-001 ', ' SGC-OBJ-002'])).toBe('SGC-OBJ-003')
  })

  it('el número puede crecer de ancho (9 → 10, 099 → 100)', () => {
    expect(sugerirCodigo('FO-9', ['FO-9'])).toBe('FO-10')
    expect(sugerirCodigo('X-099', ['X-099'])).toBe('X-100')
  })

  it('un código sin número final recibe -2, -3...', () => {
    expect(sugerirCodigo('MANUAL', ['MANUAL'])).toBe('MANUAL-2')
    expect(sugerirCodigo('MANUAL', ['MANUAL', 'MANUAL-2'])).toBe('MANUAL-3')
  })

  it('los demás códigos del proyecto no interfieren, ni los documentos sin código', () => {
    expect(sugerirCodigo('SGC-OBJ-001', [null, undefined, '', 'SGC-OBJ-001', 'SGC-OBJ-005'])).toBe('SGC-OBJ-002')
  })

  it('ignora los espacios alrededor del código base', () => {
    expect(sugerirCodigo('  SGC-OBJ-001 ', [])).toBe('SGC-OBJ-001')
    expect(sugerirCodigo('SGC-OBJ-001  ', ['SGC-OBJ-001'])).toBe('SGC-OBJ-002')
  })

  it('un código base vacío no se inventa', () => {
    expect(sugerirCodigo('', ['A-1'])).toBe('')
  })
})

describe('recalcularCodigo (qué queda escrito al cambiar de plantilla o de proyecto)', () => {
  const EXISTENTES_P1 = ['SGC-OBJ-001']
  const EXISTENTES_P2: string[] = []

  it('con el campo vacío propone el código de la plantilla nueva', () => {
    expect(recalcularCodigo('', 'SGC-PR-001', [], 'SGC-POL-001', [])).toBe('SGC-POL-001')
  })

  it('si lo escrito era la sugerencia anterior, se reemplaza por la nueva', () => {
    expect(recalcularCodigo('SGC-OBJ-002', 'SGC-OBJ-001', EXISTENTES_P1, 'SGC-POL-001', EXISTENTES_P1)).toBe('SGC-POL-001')
  })

  it('al cambiar de proyecto, la sugerencia se recalcula con los códigos del proyecto nuevo', () => {
    expect(recalcularCodigo('SGC-OBJ-002', 'SGC-OBJ-001', EXISTENTES_P1, 'SGC-OBJ-001', EXISTENTES_P2)).toBe('SGC-OBJ-001')
    expect(recalcularCodigo('SGC-OBJ-001', 'SGC-OBJ-001', EXISTENTES_P2, 'SGC-OBJ-001', EXISTENTES_P1)).toBe('SGC-OBJ-002')
  })

  it('un código escrito por la persona no se pisa', () => {
    expect(recalcularCodigo('PRO-COM-07', 'SGC-OBJ-001', EXISTENTES_P1, 'SGC-POL-001', EXISTENTES_P2)).toBe('PRO-COM-07')
  })

  it('un campo en blanco cuenta como vacío', () => {
    expect(recalcularCodigo('   ', 'SGC-OBJ-001', [], 'SGC-POL-001', [])).toBe('SGC-POL-001')
  })
})
