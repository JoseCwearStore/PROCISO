import { describe, expect, it } from 'vitest'
import { errorDeFechasProyecto } from './fechasProyecto'

// O35: el formulario de "Nuevo proyecto" dejaba crear uno que terminaba antes de empezar.
describe('errorDeFechasProyecto', () => {
  it('con la fecha fin posterior al inicio no hay error', () => {
    expect(errorDeFechasProyecto('2026-12-01', '2027-06-30')).toBeNull()
  })
  it('una fecha fin igual a la de inicio vale', () => {
    expect(errorDeFechasProyecto('2026-12-01', '2026-12-01')).toBeNull()
  })
  it('con la fecha fin anterior al inicio dice que no puede ser anterior', () => {
    expect(errorDeFechasProyecto('2026-12-01', '2026-11-01')).toBe('La fecha fin no puede ser anterior a la de inicio')
  })
  it('con una sola fecha (o ninguna) no hay nada que comparar: ya se avisa que falta', () => {
    expect(errorDeFechasProyecto('', '2026-11-01')).toBeNull()
    expect(errorDeFechasProyecto('2026-12-01', '')).toBeNull()
    expect(errorDeFechasProyecto('', '')).toBeNull()
  })
  it('compara por día y no por texto: 2026-9-5 vs 2026-10-1 (sin ceros) se ordena bien', () => {
    expect(errorDeFechasProyecto('2026-10-01', '2026-09-05')).not.toBeNull()
    expect(errorDeFechasProyecto('2026-09-05', '2026-10-01')).toBeNull()
  })
})
