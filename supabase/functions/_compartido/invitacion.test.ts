import { describe, expect, it } from 'vitest'
import { ErrorIA } from './analisis.ts'
import { validarInvitacion } from './invitacion.ts'

const UUID = '22222222-0000-0000-0000-000000000001'
const BASE = { nombre: ' Ana Pérez ', email: ' ANA@Empresa.mx ', cargo: 'Gerente', rol: 'usuario_cliente', consultoriaId: UUID, empresaId: UUID }

describe('validarInvitacion (AUD04-B2: 400 claro en vez de 500 con detalle interno)', () => {
  it('acepta una invitación bien formada y limpia los espacios', () => {
    const v = validarInvitacion(BASE)
    expect(v).toMatchObject({ nombre: 'Ana Pérez', email: 'ANA@Empresa.mx', cargo: 'Gerente', rol: 'usuario_cliente', consultoriaId: UUID, empresaId: UUID })
  })

  it('acepta consultoriaId y empresaId nulos o ausentes y cargo/redirectTo opcionales', () => {
    const v = validarInvitacion({ nombre: 'Ana', email: 'a@b.mx', rol: 'consultor', consultoriaId: null })
    expect(v.consultoriaId).toBeNull()
    expect(v.empresaId).toBeNull()
    expect(v.cargo).toBe('')
    expect(v.redirectTo).toBeUndefined()
  })

  it.each([
    ['no es un objeto', null],
    ['nombre numérico', { ...BASE, nombre: 42 }],
    ['nombre vacío', { ...BASE, nombre: '   ' }],
    ['nombre larguísimo', { ...BASE, nombre: 'x'.repeat(121) }],
    ['email numérico', { ...BASE, email: 7 }],
    ['email sin arroba', { ...BASE, email: 'sin-arroba' }],
    ['email larguísimo', { ...BASE, email: `${'a'.repeat(250)}@b.mx` }],
    ['rol inventado', { ...BASE, rol: 'superadmin' }],
    ['rol admin_prociso (no se invita por acá)', { ...BASE, rol: 'admin_prociso' }],
    ['consultoriaId que no es uuid', { ...BASE, consultoriaId: 'xyz' }],
    ['empresaId que no es uuid', { ...BASE, empresaId: 'xyz' }],
    ['cargo que no es texto', { ...BASE, cargo: 5 }],
    ['cargo larguísimo', { ...BASE, cargo: 'x'.repeat(121) }],
    ['redirectTo que no es texto', { ...BASE, redirectTo: 5 }],
    ['redirectTo larguísimo', { ...BASE, redirectTo: `https://a.mx/${'x'.repeat(600)}` }],
  ])('rechaza una invitación con %s', (_caso, entrada) => {
    // Tiene que ser un ErrorIA (→ 400 con mensaje claro), no un TypeError por accidente (→ 500).
    expect(() => validarInvitacion(entrada)).toThrow(ErrorIA)
  })
})
