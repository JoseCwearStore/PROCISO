import { describe, expect, it } from 'vitest'
import { candidatosEquipo, candidatosResponsable, mensajeQuitarDelEquipo, miembrosDelEquipo } from './equipoProyecto'
import type { Proyecto, Usuario } from '../types'

const C1 = 'c1'
const usuario = (id: string, nombre: string, rol: Usuario['rol'], extra: Partial<Usuario> = {}) =>
  ({ id, nombre, rol, activo: true, consultoriaId: C1, ...extra }) as unknown as Usuario

const ANA = usuario('ana', 'Ana', 'Admin Consultoría')
const ROBERTO = usuario('roberto', 'Roberto', 'Consultor')
const MARIA = usuario('maria', 'María', 'Consultor')
const JORGE = usuario('jorge', 'Jorge', 'Consultor')
const SUSPENDIDO = usuario('susp', 'Zoe', 'Consultor', { activo: false })
const OTRA_CONSULTORIA = usuario('otra', 'Otro', 'Consultor', { consultoriaId: 'c2' })
const CLIENTE = usuario('carlos', 'Carlos', 'Usuario Cliente')
const TODOS = [ANA, ROBERTO, MARIA, JORGE, SUSPENDIDO, OTRA_CONSULTORIA, CLIENTE]

const proyecto = (consultorId: string, equipoIds: string[]) => ({ consultorId, equipoIds }) as Pick<Proyecto, 'consultorId' | 'equipoIds'>

// L5d (AUD05-M2, D8): lo que la pantalla de equipo le ofrece al Admin de la consultoría. Espejo de las
// reglas de la BD (solo consultores y admins activos de la MISMA consultoría); la BD decide.
describe('miembrosDelEquipo', () => {
  it('lista al responsable primero y luego a los demás por nombre', () => {
    const m = miembrosDelEquipo(proyecto('roberto', ['maria', 'roberto', 'jorge']), TODOS)
    expect(m.map((x) => x.usuario.id)).toEqual(['roberto', 'jorge', 'maria'])
    expect(m.map((x) => x.esResponsable)).toEqual([true, false, false])
  })

  it('un proyecto sin responsable no marca a nadie', () => {
    const m = miembrosDelEquipo(proyecto('', ['maria']), TODOS)
    expect(m).toHaveLength(1)
    expect(m[0].esResponsable).toBe(false)
  })

  it('ignora ids que no están entre los usuarios cargados', () => {
    expect(miembrosDelEquipo(proyecto('roberto', ['roberto', 'fantasma']), TODOS).map((x) => x.usuario.id)).toEqual(['roberto'])
  })
})

describe('candidatosEquipo (a quién se puede agregar)', () => {
  it('ofrece solo consultores y admins ACTIVOS de la consultoría que todavía no están en el equipo', () => {
    const c = candidatosEquipo(proyecto('roberto', ['roberto']), TODOS, C1)
    expect(c.map((u) => u.id)).toEqual(['ana', 'jorge', 'maria'])
  })

  it('no ofrece suspendidos, clientes ni gente de otra consultoría', () => {
    const ids = candidatosEquipo(proyecto('', []), TODOS, C1).map((u) => u.id)
    expect(ids).not.toContain('susp')
    expect(ids).not.toContain('carlos')
    expect(ids).not.toContain('otra')
  })

  it('con todos adentro no queda nadie para agregar', () => {
    expect(candidatosEquipo(proyecto('ana', ['ana', 'roberto', 'maria', 'jorge']), TODOS, C1)).toEqual([])
  })

  it('sin consultoría conocida no ofrece a nadie (ni siquiera a quien tampoco tiene consultoría)', () => {
    const SIN_CONSULTORIA = usuario('sin', 'Sin consultoría', 'Consultor', { consultoriaId: undefined })
    expect(candidatosEquipo(proyecto('', []), [...TODOS, SIN_CONSULTORIA], undefined)).toEqual([])
    expect(candidatosEquipo(proyecto('', []), [...TODOS, SIN_CONSULTORIA], null)).toEqual([])
    expect(candidatosResponsable(proyecto('', []), [...TODOS, SIN_CONSULTORIA], undefined)).toEqual([])
  })
})

describe('candidatosResponsable (quién puede pasar a ser el responsable)', () => {
  it('ofrece a los activos de la consultoría distintos del responsable actual (estén o no en el equipo)', () => {
    const c = candidatosResponsable(proyecto('roberto', ['roberto']), TODOS, C1)
    expect(c.map((u) => u.id)).toEqual(['ana', 'jorge', 'maria'])
  })

  it('sin responsable actual ofrece a todos los elegibles', () => {
    expect(candidatosResponsable(proyecto('', []), TODOS, C1).map((u) => u.id)).toEqual(['ana', 'jorge', 'maria', 'roberto'])
  })

  it('no ofrece suspendidos, clientes ni gente de otra consultoría', () => {
    const ids = candidatosResponsable(proyecto('', []), TODOS, C1).map((u) => u.id)
    expect(ids).not.toEqual(expect.arrayContaining(['susp']))
    expect(ids).not.toContain('carlos')
    expect(ids).not.toContain('otra')
  })
})

describe('mensajeQuitarDelEquipo (lo que avisa el diálogo, E5)', () => {
  // La BD (quitar_miembro_equipo, M4) rechaza quitar a quien tenga tareas abiertas O sea responsable de
  // procesos, actividades o no conformidades abiertas: el aviso tiene que nombrar las cuatro cosas.
  const texto = mensajeQuitarDelEquipo('Roberto Vázquez')

  it('empieza con el nombre y dice que dejará de ver el proyecto', () => {
    expect(texto.startsWith('Roberto Vázquez dejará de ver este proyecto.')).toBe(true)
  })

  it('menciona tareas, procesos, actividades y no conformidades', () => {
    expect(texto).toContain('tareas abiertas')
    expect(texto).toContain('procesos')
    expect(texto).toContain('actividades')
    expect(texto).toContain('no conformidades abiertas')
  })

  it('pide reasignarlos antes de quitarlo', () => {
    expect(texto).toContain('reasignar')
  })

  it('sin persona elegida habla de "Esta persona"', () => {
    expect(mensajeQuitarDelEquipo(undefined).startsWith('Esta persona dejará de ver este proyecto.')).toBe(true)
  })
})
