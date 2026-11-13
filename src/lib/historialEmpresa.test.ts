import { describe, expect, it } from 'vitest'
import { historialDeEmpresa } from './historialEmpresa'
import type { EntradaHistorial } from '../types'

const EMPRESA = 'emp-1'
const P1 = 'proy-1'
const P2 = 'proy-2'
const OTRA_EMPRESA = 'emp-2'
const P_AJENO = 'proy-9'

let n = 0
const evento = (cambios: Partial<EntradaHistorial>): EntradaHistorial => ({
  id: String(++n), fecha: '12/11/2026', autorId: 'u-1', accion: 'Algo', descripcion: '',
  entidadId: 'x', entidadTipo: 'tarea', ...cambios,
})

describe('historialDeEmpresa (pestaña Historial de la ficha de una empresa, E2)', () => {
  const proyectos = [P1, P2]

  it('incluye los eventos de tareas, documentos y evidencias de los proyectos de la empresa (por proyectoId)', () => {
    const t = evento({ entidadTipo: 'tarea', entidadId: 'tarea-1', proyectoId: P1 })
    const d = evento({ entidadTipo: 'documento', entidadId: 'doc-1', proyectoId: P2 })
    const e = evento({ entidadTipo: 'evidencia', entidadId: 'ev-1', proyectoId: P1 })
    expect(historialDeEmpresa([t, d, e], EMPRESA, proyectos)).toEqual([t, d, e])
  })

  it('no incluye los eventos de proyectos de otras empresas', () => {
    const ajeno = evento({ entidadTipo: 'tarea', entidadId: 'tarea-9', proyectoId: P_AJENO })
    const propio = evento({ entidadTipo: 'tarea', entidadId: 'tarea-1', proyectoId: P1 })
    expect(historialDeEmpresa([ajeno, propio], EMPRESA, proyectos)).toEqual([propio])
  })

  it('incluye los eventos de la empresa misma (entidad empresa)', () => {
    const mio = evento({ entidadTipo: 'empresa', entidadId: EMPRESA })
    const ajeno = evento({ entidadTipo: 'empresa', entidadId: OTRA_EMPRESA })
    expect(historialDeEmpresa([mio, ajeno], EMPRESA, proyectos)).toEqual([mio])
  })

  it('incluye los eventos sobre un proyecto de la empresa aunque no traigan proyectoId', () => {
    const e = evento({ entidadTipo: 'proyecto', entidadId: P1 })
    expect(historialDeEmpresa([e], EMPRESA, proyectos)).toEqual([e])
  })

  it('un evento sobre el proyecto de OTRA empresa (sin proyectoId) no es de esta', () => {
    const ajeno = evento({ entidadTipo: 'proyecto', entidadId: P_AJENO })
    expect(historialDeEmpresa([ajeno], EMPRESA, proyectos)).toEqual([])
  })

  it('el tipo cuenta también para proyectos: solo un evento de tipo proyecto se reconoce por su entidadId', () => {
    const raro = evento({ entidadTipo: 'tarea', entidadId: P1 })
    expect(historialDeEmpresa([raro], EMPRESA, proyectos)).toEqual([])
  })

  it('un evento sin proyecto y de otra entidad no es de la empresa', () => {
    const suelto = evento({ entidadTipo: 'usuario', entidadId: 'u-7' })
    expect(historialDeEmpresa([suelto], EMPRESA, proyectos)).toEqual([])
  })

  it('una empresa sin proyectos no se queda con los eventos sin proyecto', () => {
    const suelto = evento({ entidadTipo: 'tarea', entidadId: 'tarea-3' })
    expect(historialDeEmpresa([suelto], EMPRESA, [])).toEqual([])
  })

  it('el tipo cuenta: un id de tarea igual al de la empresa no hace que la tarea sea de la empresa', () => {
    const raro = evento({ entidadTipo: 'tarea', entidadId: EMPRESA })
    expect(historialDeEmpresa([raro], EMPRESA, proyectos)).toEqual([])
  })

  it('conserva el orden recibido (el más nuevo primero)', () => {
    const a = evento({ entidadTipo: 'tarea', entidadId: 'a', proyectoId: P1, accion: 'nuevo' })
    const b = evento({ entidadTipo: 'tarea', entidadId: 'b', proyectoId: P1, accion: 'viejo' })
    expect(historialDeEmpresa([a, b], EMPRESA, proyectos).map((h) => h.accion)).toEqual(['nuevo', 'viejo'])
  })
})
