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
    expect(etiquetas).toContain('Razón social')
  })

  it('los límites del plan se presentan como referencia, no como algo que el sistema hace cumplir (D5)', () => {
    const limites = datosDeConsultoria(C, []).filter((x) => x.etiqueta.includes('(referencia)'))
    expect(limites.map((x) => x.etiqueta)).toEqual(['Límite de usuarios del plan (referencia)', 'Almacenamiento del plan (referencia)'])
    expect(limites.map((x) => x.valor)).toEqual(['20', '50 GB'])
  })
})
