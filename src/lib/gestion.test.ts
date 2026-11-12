import { describe, expect, it } from 'vitest'
import { AVISO_SOLO_ADMIN, permisosGestion } from './gestion'
import type { Rol } from '../types'

// AUD07-M1: la BD solo deja crear/archivar empresas y crear proyectos a los administradores
// (políticas "admins crean empresas", "admins editan empresas" y "admins crean proyectos").
// La pantalla no puede ofrecerle esas acciones al Consultor y hacerlo llenar 20 campos para
// recibir un 403 al final.
describe('permisosGestion (espejo de las políticas de la BD)', () => {
  it.each<[Rol, boolean]>([
    ['Admin PROCISO', true],
    ['Admin Consultoría', true],
    ['Consultor', false],
    ['Usuario Cliente', false],
  ])('%s → crear/archivar empresas y crear proyectos: %s', (rol, permitido) => {
    expect(permisosGestion(rol)).toMatchObject({
      puedeCrearEmpresa: permitido,
      puedeArchivarEmpresa: permitido,
      puedeCrearProyecto: permitido,
    })
  })

  it('quien no puede recibe el motivo en una frase; quien puede, ninguno', () => {
    expect(permisosGestion('Consultor').motivo).toBe(AVISO_SOLO_ADMIN)
    expect(permisosGestion('Usuario Cliente').motivo).toBe(AVISO_SOLO_ADMIN)
    expect(permisosGestion('Admin Consultoría').motivo).toBeNull()
    expect(permisosGestion('Admin PROCISO').motivo).toBeNull()
  })

  it('el aviso explica quién sí puede', () => {
    expect(AVISO_SOLO_ADMIN).toMatch(/administrador/i)
  })

  it('un rol desconocido (p. ej. sin sesión) no puede nada', () => {
    expect(permisosGestion(undefined as unknown as Rol)).toMatchObject({
      puedeCrearEmpresa: false, puedeArchivarEmpresa: false, puedeCrearProyecto: false,
    })
  })
})
