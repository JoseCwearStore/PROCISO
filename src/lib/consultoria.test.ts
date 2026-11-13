import { describe, expect, it } from 'vitest'
import { datosDeConsultoria } from './consultoria'
import type { Consultoria, Usuario } from '../types'

const C: Consultoria = {
  id: 'c1', nombre: 'COWIN Consultores', rfc: 'COW180101AB1', plan: 'Profesional', activa: true,
  contacto: 'Ana García López', email: 'ana@cowin.test', fechaAlta: '09/11/2026', renovacion: '09/11/2027',
  limiteUsuarios: 20, almacenamientoGb: 50,
}
const usuario = (id: string, consultoriaId: string | undefined, activo: boolean) => ({ id, consultoriaId, activo }) as unknown as Usuario

// AUD07-M3 (L5c): Configuración mostraba datos de OTRA consultoría escritos a mano ("ConsultiCalidad
// S.C.", un RFC y el plan "Professional"). Ahora salen de la consultoría real de la BD.
describe('datosDeConsultoria', () => {
  it('muestra los datos reales de la consultoría', () => {
    const d = Object.fromEntries(datosDeConsultoria(C, []).map((x) => [x.etiqueta, x.valor]))
    expect(d).toMatchObject({
      'Razón social': 'COWIN Consultores', RFC: 'COW180101AB1', Estado: 'Activa', Plan: 'Profesional',
      Contacto: 'Ana García López', 'Correo de contacto': 'ana@cowin.test', 'Alta en el sistema': '09/11/2026',
    })
  })

  it('cuenta solo los usuarios ACTIVOS de ESA consultoría', () => {
    const usuarios = [usuario('1', 'c1', true), usuario('2', 'c1', true), usuario('3', 'c1', false), usuario('4', 'c2', true), usuario('5', undefined, true)]
    const d = Object.fromEntries(datosDeConsultoria(C, usuarios).map((x) => [x.etiqueta, x.valor]))
    expect(d['Usuarios activos']).toBe('2')
  })

  it('una consultoría suspendida lo dice', () => {
    const d = Object.fromEntries(datosDeConsultoria({ ...C, activa: false }, []).map((x) => [x.etiqueta, x.valor]))
    expect(d.Estado).toBe('Suspendida')
  })

  it('omite lo que no tiene valor en vez de mostrar guiones o inventar', () => {
    const etiquetas = datosDeConsultoria({ id: 'c9', nombre: 'Mínima', rfc: '', plan: '' }, []).map((x) => x.etiqueta)
    expect(etiquetas).not.toContain('RFC')
    expect(etiquetas).not.toContain('Plan')
    expect(etiquetas).not.toContain('Contacto')
    expect(etiquetas).not.toContain('Renovación')
    expect(etiquetas.some((e) => e.includes('(referencia)'))).toBe(false)
    expect(etiquetas).not.toContain('Límite de usuarios del plan')
    expect(etiquetas).toContain('Razón social')
  })

  // AUD10-M7: autorizar_invitacion ya rechaza invitar cuando los usuarios activos llegan al límite: ese dato dejó de ser
  // una referencia. El almacenamiento sí sigue siéndolo (el sistema no lo hace cumplir por consultoría, D5).
  it('el límite de usuarios se muestra como lo que es (se hace cumplir); el almacenamiento sigue como referencia', () => {
    const datos = datosDeConsultoria(C, [])
    expect(datos.find((x) => x.etiqueta === 'Límite de usuarios del plan')?.valor).toBe('20')
    expect(datos.some((x) => x.etiqueta === 'Límite de usuarios del plan (referencia)')).toBe(false)
    expect(datos.find((x) => x.etiqueta === 'Almacenamiento del plan (referencia)')?.valor).toBe('50 GB')
  })
})
