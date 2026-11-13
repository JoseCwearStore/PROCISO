import { describe, expect, it } from 'vitest'
import { opcionesDeResponsable } from './opcionesResponsable'

type U = Parameters<typeof opcionesDeResponsable>[2][number]
const u = (id: string, nombre: string, rol: U['rol'], empresaId?: string, activo = true): U =>
  ({ id, nombre, rol, empresaId, activo })

const proyecto = { empresaId: 'e1', equipoIds: ['r', 'a'] }
const usuarios = [
  u('r', 'Roberto', 'Consultor'),
  u('a', 'Ana', 'Admin Consultoría'),
  u('c', 'Carlos', 'Usuario Cliente', 'e1'),
  u('c2', 'Cliente de otra empresa', 'Usuario Cliente', 'e2'),
  u('c3', 'Cliente inactivo', 'Usuario Cliente', 'e1', false),
  u('x', 'Consultor fuera del equipo', 'Consultor'),
  u('k', 'Consultor con empresa pero fuera del equipo', 'Consultor', 'e1'),
]

describe('opcionesDeResponsable', () => {
  it('ofrece el equipo y los clientes activos de la empresa del proyecto', () => {
    const ids = opcionesDeResponsable(proyecto, '', usuarios).map((o) => o.id)
    expect(ids).toEqual(['r', 'a', 'c'])
  })

  it('etiqueta a los clientes con " · Cliente" y al equipo solo con el nombre', () => {
    const o = opcionesDeResponsable(proyecto, '', usuarios)
    expect(o.find((x) => x.id === 'c')?.etiqueta).toBe('Carlos · Cliente')
    expect(o.find((x) => x.id === 'r')?.etiqueta).toBe('Roberto')
  })

  it('no repite a un cliente que ya está en el equipo', () => {
    const p = { empresaId: 'e1', equipoIds: ['c', 'r'] }
    const ids = opcionesDeResponsable(p, '', usuarios).map((o) => o.id)
    expect(ids).toEqual(['c', 'r'])
  })

  it('incluye al responsable actual aunque no esté en la lista', () => {
    const ids = opcionesDeResponsable(proyecto, 'x', usuarios).map((o) => o.id)
    expect(ids).toContain('x')
    expect(ids.filter((i) => i === 'x')).toHaveLength(1)
  })

  it('incluye al responsable actual aunque esté inactivo o sea de otra empresa', () => {
    const ids = opcionesDeResponsable(proyecto, 'c3', usuarios).map((o) => o.id)
    expect(ids).toContain('c3')
  })

  it('ignora un responsable actual que no existe y un miembro del equipo desconocido', () => {
    const p = { empresaId: 'e1', equipoIds: ['r', 'fantasma'] }
    const ids = opcionesDeResponsable(p, 'zzz', usuarios).map((o) => o.id)
    expect(ids).toEqual(['r', 'c'])
  })

  it('sin proyecto no hay opciones salvo el responsable actual', () => {
    expect(opcionesDeResponsable(undefined, '', usuarios)).toEqual([])
    expect(opcionesDeResponsable(undefined, 'r', usuarios).map((o) => o.id)).toEqual(['r'])
  })
})
