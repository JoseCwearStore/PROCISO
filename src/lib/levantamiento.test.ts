import { describe, expect, it } from 'vitest'
import {
  BORRADOR_VACIO,
  borradorAProceso,
  primerPasoIncompleto,
  procesoABorrador,
  puedeRetomarse,
  seccionCompleta,
  type Borrador,
} from './levantamiento'
import type { ActividadProceso, Proceso } from '../types'

const ACTIVIDAD: ActividadProceso = {
  id: 'act-1', tipo: 'Actividad', responsableId: 'u-2', descripcion: 'Recibir el pedido', entradas: 'Pedido',
  recursos: 'Sistema', controles: 'Revisión', resultado: 'Pedido registrado', orden: 1,
}

// Un levantamiento llenado de punta a punta.
const COMPLETO: Borrador = {
  ...BORRADOR_VACIO,
  id: 'proc-1', empresaId: 'emp-1', proyectoId: 'proy-1', nombre: 'Atención al cliente', tipo: 'Apoyo',
  objetivo: 'Resolver quejas', alcance: 'Todas las sucursales', responsableId: 'u-1', puestoResponsable: 'Jefa de servicio',
  personalInvolucrado: 'Equipo de mostrador',
  entradas: 'Queja\nSolicitud', salidas: 'Respuesta', tieneProveedores: true, proveedores: 'Proveedor A', clientes: 'Compradores',
  recursosMateriales: 'Formatos', equipos: 'Computadora', usaSistemas: true, sistemas: 'CRM',
  controles: 'Revisión semanal', registros: 'Bitácora', indicadores: 'Tiempo de respuesta',
  riesgos: 'Queja repetida', problemas: 'Retrasos', observaciones: 'Ninguna', mejoras: 'Automatizar',
  noAplica: {}, actividades: [ACTIVIDAD],
}

const aProceso = (b: Borrador): Proceso =>
  borradorAProceso(b, { id: b.id, estado: 'En levantamiento', evidenciasIds: [], fechaLevantamiento: '12/11/2026' })

describe('borradorAProceso (lo que se guarda)', () => {
  it('parte los campos de lista por renglón, sin espacios ni renglones vacíos', () => {
    const p = aProceso({ ...COMPLETO, entradas: ' Queja \n\n Solicitud \n  ' })
    expect(p.entradas).toEqual(['Queja', 'Solicitud'])
  })

  it('lleva el estado, el id, las evidencias y la fecha que se le indican', () => {
    const p = borradorAProceso(COMPLETO, { id: 'otro', estado: 'Documentado', evidenciasIds: ['ev-1'], fechaLevantamiento: '01/01/2027' })
    expect(p).toMatchObject({ id: 'otro', estado: 'Documentado', evidenciasIds: ['ev-1'], fechaLevantamiento: '01/01/2027' })
  })

  it('el tipo vacío se guarda sin tipo', () => {
    expect(aProceso({ ...COMPLETO, tipo: '' }).tipo).toBeUndefined()
  })
})

describe('procesoABorrador (retomar un levantamiento a medias, E7)', () => {
  it('ida y vuelta: lo guardado vuelve igual al asistente', () => {
    expect(procesoABorrador(aProceso(COMPLETO), 'emp-1')).toEqual(COMPLETO)
  })

  it('une los campos de lista con un renglón por elemento', () => {
    const b = procesoABorrador({ ...aProceso(COMPLETO), entradas: ['Queja', 'Solicitud'] }, 'emp-1')
    expect(b.entradas).toBe('Queja\nSolicitud')
  })

  it('un proceso guardado con casi nada (borrador) vuelve con textos vacíos, no con undefined', () => {
    const casiNada: Proceso = {
      id: 'proc-2', nombre: 'Compras', proyectoId: 'proy-1', responsableId: '', estado: 'En levantamiento',
      descripcion: '', evidenciasIds: [], documentosIds: [], entradas: [], salidas: [],
    }
    const b = procesoABorrador(casiNada, 'emp-1')
    expect(b).toEqual({ ...BORRADOR_VACIO, id: 'proc-2', empresaId: 'emp-1', proyectoId: 'proy-1', nombre: 'Compras' })
    for (const [campo, valor] of Object.entries(b)) expect(valor, campo).not.toBeUndefined()
  })

  it('recuerda la empresa y el proyecto', () => {
    const b = procesoABorrador(aProceso(COMPLETO), 'emp-9')
    expect(b.empresaId).toBe('emp-9')
    expect(b.proyectoId).toBe('proy-1')
  })

  it('el tipo ausente vuelve como cadena vacía', () => {
    expect(procesoABorrador({ ...aProceso(COMPLETO), tipo: undefined }, 'emp-1').tipo).toBe('')
  })

  it('conserva las justificaciones de "no aplica" y las actividades', () => {
    const b = procesoABorrador(aProceso({ ...COMPLETO, noAplica: { riesgos: 'No hay riesgos' }, actividades: [ACTIVIDAD] }), 'emp-1')
    expect(b.noAplica).toEqual({ riesgos: 'No hay riesgos' })
    expect(b.actividades).toEqual([ACTIVIDAD])
  })

  describe('"¿tiene proveedores?" y "¿usa sistemas?" no se guardan: se deducen', () => {
    it('proveedores vacíos con el paso 2 ya contestado: no tiene proveedores', () => {
      const b = procesoABorrador(aProceso({ ...COMPLETO, tieneProveedores: false, proveedores: '' }), 'emp-1')
      expect(b.tieneProveedores).toBe(false)
    })

    it('proveedores vacíos con el paso 2 sin contestar: queda el valor inicial (sí tiene)', () => {
      const b = procesoABorrador(aProceso({ ...COMPLETO, entradas: '', salidas: '', clientes: '', proveedores: '' }), 'emp-1')
      expect(b.tieneProveedores).toBe(true)
    })

    it('el paso 2 cuenta como contestado solo con entradas, salidas Y clientes: si falta uno, sigue "sí tiene"', () => {
      for (const falta of ['entradas', 'salidas', 'clientes'] as const) {
        const b = procesoABorrador(aProceso({ ...COMPLETO, tieneProveedores: false, proveedores: '', [falta]: '' }), 'emp-1')
        expect(b.tieneProveedores, falta).toBe(true)
      }
    })

    it('el paso 3 cuenta como contestado solo con materiales Y equipos: si falta uno, sigue "sí usa"', () => {
      for (const falta of ['recursosMateriales', 'equipos'] as const) {
        const b = procesoABorrador(aProceso({ ...COMPLETO, usaSistemas: false, sistemas: '', [falta]: '' }), 'emp-1')
        expect(b.usaSistemas, falta).toBe(true)
      }
    })

    it('con proveedores: tiene proveedores', () => {
      expect(procesoABorrador(aProceso(COMPLETO), 'emp-1').tieneProveedores).toBe(true)
    })

    it('sistemas vacíos con materiales y equipos ya contestados: no usa sistemas', () => {
      const b = procesoABorrador(aProceso({ ...COMPLETO, usaSistemas: false, sistemas: '' }), 'emp-1')
      expect(b.usaSistemas).toBe(false)
    })

    it('sistemas vacíos con el paso 3 sin contestar: queda el valor inicial (sí usa)', () => {
      const b = procesoABorrador(aProceso({ ...COMPLETO, recursosMateriales: '', equipos: '', sistemas: '' }), 'emp-1')
      expect(b.usaSistemas).toBe(true)
    })

    it('con sistemas: usa sistemas', () => {
      expect(procesoABorrador(aProceso(COMPLETO), 'emp-1').usaSistemas).toBe(true)
    })
  })
})

describe('puedeRetomarse (qué procesos se pueden continuar desde el asistente, E7)', () => {
  it('solo un levantamiento "En levantamiento"', () => {
    expect(puedeRetomarse({ estado: 'En levantamiento' })).toBe(true)
  })

  it('uno ya documentado o revisado no se reabre (guardar lo devolvería a borrador)', () => {
    expect(puedeRetomarse({ estado: 'Documentado' })).toBe(false)
    expect(puedeRetomarse({ estado: 'Revisado' })).toBe(false)
  })
})

describe('seccionCompleta (misma regla que tenía el asistente)', () => {
  it('cada paso se completa con lo suyo', () => {
    expect(seccionCompleta(0, COMPLETO)).toBe(true)
    expect(seccionCompleta(0, { ...COMPLETO, nombre: '  ' })).toBe(false)
    expect(seccionCompleta(1, { ...COMPLETO, clientes: '' })).toBe(false)
    expect(seccionCompleta(1, { ...COMPLETO, tieneProveedores: false, proveedores: '' })).toBe(true)
    expect(seccionCompleta(2, { ...COMPLETO, equipos: '' })).toBe(false)
    expect(seccionCompleta(3, { ...COMPLETO, registros: '' })).toBe(false)
    expect(seccionCompleta(4, { ...COMPLETO, indicadores: '' })).toBe(false)
    expect(seccionCompleta(5, { ...COMPLETO, problemas: '' })).toBe(false)
    expect(seccionCompleta(6, BORRADOR_VACIO)).toBe(true)
    expect(seccionCompleta(7, { ...COMPLETO, actividades: [] })).toBe(false)
  })

  it('el paso de recursos pide sistemas solo si usa sistemas', () => {
    expect(seccionCompleta(2, { ...COMPLETO, usaSistemas: false, sistemas: '' })).toBe(true)
    expect(seccionCompleta(2, { ...COMPLETO, usaSistemas: true, sistemas: '' })).toBe(false)
    expect(seccionCompleta(2, { ...COMPLETO, usaSistemas: true, sistemas: 'CRM' })).toBe(true)
  })

  it('"no aplica" completa SOLO el paso de su sección (recursos, controles, indicadores)', () => {
    const vacio = { ...COMPLETO, recursosMateriales: '', equipos: '', controles: '', registros: '', indicadores: '' }
    const pasoDe = { recursos: 2, controles: 3, indicadores: 4 } as const
    for (const [seccion, paso] of Object.entries(pasoDe)) {
      const conNoAplica = { ...vacio, noAplica: { [seccion]: 'No aplica porque…' } }
      expect(seccionCompleta(paso, conNoAplica), `${seccion} completa su paso`).toBe(true)
      for (const [otra, otroPaso] of Object.entries(pasoDe)) {
        if (otroPaso !== paso) expect(seccionCompleta(otroPaso, conNoAplica), `${seccion} no completa ${otra}`).toBe(false)
      }
    }
  })

  it('"no aplica" con justificación completa el paso; sin justificación no', () => {
    const vacioRiesgos = { ...COMPLETO, riesgos: '', problemas: '' }
    expect(seccionCompleta(5, { ...vacioRiesgos, noAplica: { riesgos: 'No hay' } })).toBe(true)
    expect(seccionCompleta(5, { ...vacioRiesgos, noAplica: { riesgos: '  ' } })).toBe(false)
  })

  it('la revisión final exige todos los pasos anteriores', () => {
    expect(seccionCompleta(8, COMPLETO)).toBe(true)
    expect(seccionCompleta(8, { ...COMPLETO, actividades: [] })).toBe(false)
  })
})

describe('primerPasoIncompleto (en qué paso se abre un levantamiento retomado)', () => {
  it('vacío: el primero', () => {
    expect(primerPasoIncompleto(BORRADOR_VACIO)).toBe(0)
  })

  it('con la identificación lista: el paso 2 (índice 1)', () => {
    expect(primerPasoIncompleto({ ...BORRADOR_VACIO, nombre: 'N', objetivo: 'O', alcance: 'A', responsableId: 'u', puestoResponsable: 'P', personalInvolucrado: 'X' })).toBe(1)
  })

  it('salta el paso de observaciones (siempre completo) y se detiene en la secuencia', () => {
    expect(primerPasoIncompleto({ ...COMPLETO, actividades: [] })).toBe(7)
  })

  it('con todo completo: la revisión final', () => {
    expect(primerPasoIncompleto(COMPLETO)).toBe(8)
  })

  it('un paso incompleto en medio gana sobre los completos de después', () => {
    expect(primerPasoIncompleto({ ...COMPLETO, controles: '' })).toBe(3)
  })
})
