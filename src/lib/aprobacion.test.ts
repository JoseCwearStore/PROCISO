import { describe, expect, it } from 'vitest'
import {
  filtrarBandeja, historialParaMostrar, mensajeAprobacion, mensajeSinDecision, puedeDarVistoBueno, puedeDecidir, reemplazadosAlAprobar,
  textosDeDecision, vistoBuenoVigente,
  type DocumentoAprobable,
} from './aprobacion'

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

// O21 y O25: la bandeja de Revisiones se puede mirar por estado (pendientes, en corrección, aprobados) y filtrar.
describe('filtrarBandeja (la lista de Revisiones, O21 y O25)', () => {
  type D = { id: string; estado: string; proyectoId: string; texto: string }
  const d = (id: string, estado: string, proyectoId = 'p-1', texto = id): D => ({ id, estado, proyectoId, texto })
  const DOCS = [
    d('a', 'Pendiente de revisión', 'p-1', 'Procedimiento de compras PRO-COM-001 Marketino Roberto'),
    d('b', 'En corrección', 'p-1', 'Política de calidad SGC-POL-001 Marketino Ana'),
    d('c', 'Aprobado', 'p-2', 'Manual del SGC MAN-001 JAZA María'),
    d('d', 'Pendiente de revisión', 'p-2', 'Instrucción de revisión IT-009 JAZA Roberto'),
    d('e', 'Borrador', 'p-1', 'Borrador cualquiera'),
  ]
  const sin = { texto: '', proyectoId: '' }
  const ids = (docs: D[]) => docs.map((x) => x.id)
  const textoDe = (x: D) => x.texto

  it('cada vista muestra solo los documentos de su estado', () => {
    expect(ids(filtrarBandeja(DOCS, 'pendientes', sin, textoDe))).toEqual(['a', 'd'])
    expect(ids(filtrarBandeja(DOCS, 'correccion', sin, textoDe))).toEqual(['b'])
    expect(ids(filtrarBandeja(DOCS, 'aprobados', sin, textoDe))).toEqual(['c'])
  })

  it('un borrador no aparece en ninguna vista (todavía no se envió a revisión)', () => {
    for (const vista of ['pendientes', 'correccion', 'aprobados'] as const) {
      expect(ids(filtrarBandeja(DOCS, vista, sin, textoDe)), vista).not.toContain('e')
    }
  })

  it('el filtro de proyecto deja solo los de ese proyecto', () => {
    expect(ids(filtrarBandeja(DOCS, 'pendientes', { texto: '', proyectoId: 'p-2' }, textoDe))).toEqual(['d'])
    expect(ids(filtrarBandeja(DOCS, 'pendientes', { texto: '', proyectoId: 'p-9' }, textoDe))).toEqual([])
  })

  it('la búsqueda de texto no distingue mayúsculas, acentos ni espacios alrededor', () => {
    expect(ids(filtrarBandeja(DOCS, 'pendientes', { texto: '  REVISION ', proyectoId: '' }, textoDe))).toEqual(['d'])
    expect(ids(filtrarBandeja(DOCS, 'pendientes', { texto: 'instruccion', proyectoId: '' }, textoDe))).toEqual(['d'])
    expect(ids(filtrarBandeja(DOCS, 'pendientes', { texto: 'pro-com', proyectoId: '' }, textoDe))).toEqual(['a'])
  })

  it('busca en todo lo que le dé textoDe (empresa, proyecto, elaborador…)', () => {
    expect(ids(filtrarBandeja(DOCS, 'pendientes', { texto: 'jaza', proyectoId: '' }, textoDe))).toEqual(['d'])
    expect(ids(filtrarBandeja(DOCS, 'pendientes', { texto: 'roberto', proyectoId: '' }, textoDe))).toEqual(['a', 'd'])
  })

  it('un texto en blanco no filtra', () => {
    expect(ids(filtrarBandeja(DOCS, 'pendientes', { texto: '   ', proyectoId: '' }, textoDe))).toEqual(['a', 'd'])
  })

  it('texto y proyecto se combinan (los dos tienen que cumplirse)', () => {
    expect(ids(filtrarBandeja(DOCS, 'pendientes', { texto: 'roberto', proyectoId: 'p-1' }, textoDe))).toEqual(['a'])
    expect(ids(filtrarBandeja(DOCS, 'pendientes', { texto: 'marketino', proyectoId: 'p-2' }, textoDe))).toEqual([])
  })

  it('conserva el orden recibido y no modifica la lista original', () => {
    const copia = [...DOCS]
    expect(ids(filtrarBandeja(DOCS, 'pendientes', sin, textoDe))).toEqual(['a', 'd'])
    expect(DOCS).toEqual(copia)
  })
})

describe('puedeDecidir (¿tiene una decisión pendiente? O21)', () => {
  it('solo un documento "Pendiente de revisión"', () => {
    expect(puedeDecidir({ estado: 'Pendiente de revisión' })).toBe(true)
  })

  it('uno en corrección, aprobado o en cualquier otro estado se puede mirar, pero no decidir', () => {
    for (const estado of ['Borrador', 'En elaboración', 'En corrección', 'Aprobado', 'Rechazado', 'Obsoleto'] as const) {
      expect(puedeDecidir({ estado }), estado).toBe(false)
    }
  })
})

describe('mensajeSinDecision (qué se le dice a quien abre un documento que ya no está pendiente, O21)', () => {
  it('en corrección: espera que el equipo lo corrija y lo reenvíe', () => {
    const m = mensajeSinDecision('En corrección')
    expect(m).toMatch(/en corrección/i)
    expect(m).toMatch(/corrij/i)
    expect(m).toMatch(/reenv/i)
  })

  it('aprobado: la versión está bloqueada y para cambiarla hay que crear una nueva', () => {
    const m = mensajeSinDecision('Aprobado')
    expect(m).toMatch(/aprobado/i)
    expect(m).toMatch(/bloquead/i)
    expect(m).toMatch(/versión nueva/i)
  })

  it('cualquier otro estado dice cuál es y que no hay decisión pendiente', () => {
    expect(mensajeSinDecision('Obsoleto')).toBe('Este documento está obsoleto: se puede leer, pero no hay una decisión pendiente.')
  })

  it('ninguno promete una decisión que el usuario pueda tomar ahí', () => {
    for (const estado of ['En corrección', 'Aprobado', 'Obsoleto', 'Borrador']) {
      expect(mensajeSinDecision(estado), estado).not.toMatch(/aprueba|rechaza|solicita/i)
    }
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

  it('al equipo se le explica el visto bueno (O23): deja constancia y no bloquea al cliente', () => {
    const t = textosDeDecision(false)
    expect(t.ayuda).toMatch(/visto bueno/i)
    expect(t.ayuda).toMatch(/no (decide|bloquea)/i)
  })

  it('al cliente no se le habla del visto bueno en el panel (lo ve como una línea aparte)', () => {
    expect(textosDeDecision(true).ayuda).not.toMatch(/visto bueno/i)
  })
})

// O23: el visto bueno es de UNA versión; al reenviar sale otra y deja de valer.
describe('vistoBuenoVigente', () => {
  const base: Parameters<typeof vistoBuenoVigente>[0] = { estado: 'Pendiente de revisión', version: '1.1', vistoBuenoVersion: '1.1' }

  it('vale cuando es de la versión actual y el documento sigue pendiente', () => {
    expect(vistoBuenoVigente(base)).toBe(true)
  })
  it('no vale si es de una versión anterior (se reenvió con una versión nueva)', () => {
    expect(vistoBuenoVigente({ ...base, vistoBuenoVersion: '1.0' })).toBe(false)
  })
  it('no vale si nunca se dio', () => {
    expect(vistoBuenoVigente({ ...base, vistoBuenoVersion: undefined })).toBe(false)
  })
  it('no vale si el documento ya no está pendiente (se decidió)', () => {
    expect(vistoBuenoVigente({ ...base, estado: 'En corrección' })).toBe(false)
    expect(vistoBuenoVigente({ ...base, estado: 'Aprobado' })).toBe(false)
  })
})

describe('puedeDarVistoBueno', () => {
  const pendiente: Parameters<typeof puedeDarVistoBueno>[1] = { estado: 'Pendiente de revisión', version: '1.1', vistoBuenoVersion: undefined }

  it('el equipo puede cuando hay decisión pendiente y aún no se dio', () => {
    expect(puedeDarVistoBueno(false, pendiente)).toBe(true)
  })
  it('el cliente nunca', () => {
    expect(puedeDarVistoBueno(true, pendiente)).toBe(false)
  })
  it('no si ya se dio para esta versión', () => {
    expect(puedeDarVistoBueno(false, { ...pendiente, vistoBuenoVersion: '1.1' })).toBe(false)
  })
  it('sí si el visto bueno guardado es de una versión anterior', () => {
    expect(puedeDarVistoBueno(false, { ...pendiente, vistoBuenoVersion: '1.0' })).toBe(true)
  })
  it('no si no hay decisión pendiente', () => {
    expect(puedeDarVistoBueno(false, { ...pendiente, estado: 'En corrección' })).toBe(false)
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
