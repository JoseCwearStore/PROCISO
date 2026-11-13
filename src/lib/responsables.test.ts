import { describe, expect, it } from 'vitest'
import { responsablesDeProyectos } from './responsables'

// O1: el filtro "Todos los responsables" del Inicio ofrecía a todos los consultores y administradores, aunque no
// fueran responsables de ningún proyecto (elegirlos solo dejaba la pantalla vacía). Ahora ofrece a quienes SÍ lo son.
describe('responsablesDeProyectos (las opciones del filtro de responsables)', () => {
  const u = (id: string, nombre: string) => ({ id, nombre })
  const USUARIOS = [
    u('ana', 'Ana García'), u('roberto', 'Roberto Vázquez'), u('maria', 'María Torres'), u('jorge', 'Jorge Hernández'), u('carlos', 'Carlos Mendoza'),
  ]
  const p = (consultorId: string) => ({ consultorId })

  it('ofrece solo a quienes son responsables de algún proyecto', () => {
    const r = responsablesDeProyectos([p('roberto'), p('maria')], USUARIOS)
    expect(r.map((x) => x.id)).toEqual(['maria', 'roberto'])
  })

  it('quien no es responsable de nada (Jorge, o la Admin sin proyectos) no aparece', () => {
    const ids = responsablesDeProyectos([p('roberto')], USUARIOS).map((x) => x.id)
    expect(ids).not.toContain('jorge')
    expect(ids).not.toContain('ana')
  })

  it('un administrador que SÍ es responsable de un proyecto aparece (no se excluye por su rol)', () => {
    expect(responsablesDeProyectos([p('ana'), p('roberto')], USUARIOS).map((x) => x.id)).toEqual(['ana', 'roberto'])
  })

  it('no repite a quien es responsable de varios proyectos', () => {
    expect(responsablesDeProyectos([p('roberto'), p('roberto'), p('roberto')], USUARIOS)).toHaveLength(1)
  })

  it('va ordenado por nombre', () => {
    expect(responsablesDeProyectos([p('roberto'), p('maria'), p('ana')], USUARIOS).map((x) => x.nombre))
      .toEqual(['Ana García', 'María Torres', 'Roberto Vázquez'])
  })

  it('ignora proyectos sin responsable o con uno que no está entre los usuarios visibles', () => {
    expect(responsablesDeProyectos([p(''), p('fantasma'), p('roberto')], USUARIOS).map((x) => x.id)).toEqual(['roberto'])
  })

  it('sin proyectos, sin opciones', () => {
    expect(responsablesDeProyectos([], USUARIOS)).toEqual([])
  })
})
