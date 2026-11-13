import { describe, expect, it } from 'vitest'
import { historialParaMostrar, mensajeAprobacion, reemplazadosAlAprobar, textosDeDecision, type DocumentoAprobable } from './aprobacion'

let n = 0
const doc = (cambios: Partial<DocumentoAprobable> = {}): DocumentoAprobable => ({
  id: `d-${++n}`, nombre: 'Procedimiento de compras', version: '1.0', proyectoId: 'p-1', codigo: 'PRO-COM-001',
  tipo: 'Procedimiento', estado: 'Aprobado', ...cambios,
})

describe('reemplazadosAlAprobar (espejo de decidir_documento: qué pasa a Obsoleto al aprobar)', () => {
  const nuevo = doc({ id: 'nuevo', version: '2.0', estado: 'Pendiente de revisión' })

  it('la versión aprobada anterior con el mismo código, en el mismo proyecto, se reemplaza', () => {
    const anterior = doc({ id: 'ant', version: '1.0' })
    expect(reemplazadosAlAprobar(nuevo, [nuevo, anterior]).map((d) => d.id)).toEqual(['ant'])
  })

  it('el propio documento no se reemplaza a sí mismo', () => {
    const yoAprobado = doc({ id: 'nuevo', estado: 'Aprobado' })
    expect(reemplazadosAlAprobar(nuevo, [yoAprobado])).toEqual([])
  })

  it('solo se reemplaza lo que está Aprobado', () => {
    for (const estado of ['Borrador', 'En elaboración', 'Pendiente de revisión', 'En corrección', 'Rechazado', 'Obsoleto'] as const) {
      expect(reemplazadosAlAprobar(nuevo, [doc({ estado })]), estado).toEqual([])
    }
  })

  it('un documento de otro proyecto no se toca', () => {
    expect(reemplazadosAlAprobar(nuevo, [doc({ proyectoId: 'p-2' })])).toEqual([])
  })

  it('con otro código no se reemplaza, aunque sea del mismo proceso y tipo', () => {
    const otro = doc({ codigo: 'PRO-COM-002', procesoId: 'proc-1' })
    expect(reemplazadosAlAprobar({ ...nuevo, procesoId: 'proc-1' }, [otro])).toEqual([])
  })

  it('el código se compara exacto, igual que la BD (no distingue mayúsculas solo el índice de unicidad)', () => {
    expect(reemplazadosAlAprobar(nuevo, [doc({ codigo: 'pro-com-001' })])).toEqual([])
  })

  describe('sin código: solo por proceso y tipo, y solo si el otro tampoco tiene código', () => {
    const sinCodigo = doc({ id: 'nuevo2', codigo: undefined, procesoId: 'proc-1', tipo: 'Procedimiento', estado: 'Pendiente de revisión' })

    it('mismo proceso y tipo, ambos sin código: se reemplaza', () => {
      const otro = doc({ id: 'viejo', codigo: undefined, procesoId: 'proc-1', tipo: 'Procedimiento' })
      expect(reemplazadosAlAprobar(sinCodigo, [otro]).map((d) => d.id)).toEqual(['viejo'])
    })

    it('mismo proceso pero otro tipo: no', () => {
      expect(reemplazadosAlAprobar(sinCodigo, [doc({ codigo: undefined, procesoId: 'proc-1', tipo: 'Manual' })])).toEqual([])
    })

    it('otro proceso: no', () => {
      expect(reemplazadosAlAprobar(sinCodigo, [doc({ codigo: undefined, procesoId: 'proc-2' })])).toEqual([])
    })

    it('sin proceso no se reemplaza nada por tipo', () => {
      const sinProceso = { ...sinCodigo, procesoId: undefined }
      expect(reemplazadosAlAprobar(sinProceso, [doc({ codigo: undefined, procesoId: undefined })])).toEqual([])
    })

    it('el otro SÍ tiene código: no se reemplaza (la pantalla antes lo hacía por error)', () => {
      expect(reemplazadosAlAprobar(sinCodigo, [doc({ codigo: 'PRO-COM-001', procesoId: 'proc-1', tipo: 'Procedimiento' })])).toEqual([])
    })
  })
})

describe('mensajeAprobacion (lo que dice el diálogo antes de aprobar)', () => {
  const d = doc({ nombre: 'Política de calidad', version: '2.0', codigo: 'SGC-POL-001' })

  it('dice qué se aprueba, su versión y que queda bloqueado', () => {
    const m = mensajeAprobacion(d, [])
    expect(m).toContain('Política de calidad')
    expect(m).toContain('versión 2.0')
    expect(m).toMatch(/bloquead/i)
    expect(m).toMatch(/versión nueva/i)
  })

  it('sin documentos que reemplazar no menciona la obsolescencia', () => {
    expect(mensajeAprobacion(d, [])).not.toMatch(/obsolet/i)
  })

  it('si reemplaza algo, lo lista por código y versión', () => {
    const m = mensajeAprobacion(d, [doc({ codigo: 'SGC-POL-001', version: '1.0' }), doc({ codigo: 'SGC-POL-001', version: '1.5' })])
    expect(m).toMatch(/obsolet/i)
    expect(m).toContain('SGC-POL-001 versión 1.0')
    expect(m).toContain('SGC-POL-001 versión 1.5')
    expect(m).toContain('SGC-POL-001 versión 1.0, SGC-POL-001 versión 1.5.')
  })

  it('un documento sin código se nombra por su título', () => {
    const m = mensajeAprobacion(d, [doc({ codigo: undefined, nombre: 'Manual viejo', version: '0.9' })])
    expect(m).toContain('Manual viejo versión 0.9')
  })
})

// O22: la ayuda del panel de decisión tiene que hablar de lo que ESA persona puede hacer.
describe('textosDeDecision (el panel de la derecha de Revisiones, O22)', () => {
  it('el cliente aprueba o pide correcciones; no se le habla de rechazo porque no tiene ese botón', () => {
    const t = textosDeDecision(true)
    expect(t.titulo).toBe('Aprobación del documento')
    expect(t.ayuda).toMatch(/apruebas el documento o solicitas correcciones/i)
    expect(t.ayuda).not.toMatch(/rechaz/i)
    expect(t.ayuda).toMatch(/anclad/i)
  })

  it('el equipo revisa y puede pedir corrección o rechazar; la aprobación es del cliente', () => {
    const t = textosDeDecision(false)
    expect(t.titulo).toBe('Decisión de revisión')
    expect(t.ayuda).toMatch(/la aprobación final la da el cliente/i)
    expect(t.ayuda).toMatch(/correcci[oó]n o rechazo/i)
    expect(t.ayuda).toMatch(/anclad/i)
  })
})

// O24: el aviso "Sin eventos registrados" nunca salía: `lista.map(...) || aviso` no cae al aviso con una lista vacía.
describe('historialParaMostrar (el historial de un documento en Revisiones, O24)', () => {
  const ev = (id: string) => ({ id, fecha: '09/11/2026', autorId: 'u-1', accion: `acción ${id}`, detalle: '' })

  it('muestra primero lo más nuevo (el orden en que se guardó, al revés)', () => {
    expect(historialParaMostrar([ev('1'), ev('2'), ev('3')]).map((e) => e.id)).toEqual(['3', '2', '1'])
  })

  it('no modifica el historial original', () => {
    const original = [ev('1'), ev('2')]
    historialParaMostrar(original)
    expect(original.map((e) => e.id)).toEqual(['1', '2'])
  })

  it('sin historial (ausente o vacío) devuelve una lista vacía, para poder avisar que no hay eventos', () => {
    expect(historialParaMostrar(undefined)).toEqual([])
    expect(historialParaMostrar([])).toEqual([])
  })
})
