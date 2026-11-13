import { describe, expect, it } from 'vitest'
import { empresaAFormulario, opcionesConActual } from './empresaFormulario'
import type { Empresa } from '../types'

const COMPLETA: Empresa = {
  id: 'e1', consultoriaId: 'c1', nombre: 'Marketino S.A.', nombreComercial: 'Marketino', rfc: 'MAR010101', sector: 'Servicios',
  tamano: 'Mediana (51-250 empleados)', ciudad: 'Puebla', estado: 'Veracruz', direccion: 'Av. 1', contactoPrincipal: 'Carlos',
  cargoContacto: 'Gerente', emailContacto: 'c@m.test', telefonoContacto: '555', procesosprincipales: 'Ventas',
  alcanceInicial: 'Todo', normaInteres: 'ISO 9001:2015', consultorAsignadoId: 'u1', observaciones: 'Nota', activa: true,
  fechaAlta: '01/01/2026', proyectosIds: [], logoInicial: 'M', trabajadores: '80',
}

describe('empresaAFormulario (precarga del formulario de edición, O2)', () => {
  it('copia cada dato de la empresa al campo que el formulario edita', () => {
    expect(empresaAFormulario(COMPLETA)).toEqual({
      nombre: 'Marketino S.A.', nombreComercial: 'Marketino', rfc: 'MAR010101', sector: 'Servicios',
      tamano: 'Mediana (51-250 empleados)', ciudad: 'Puebla', estado: 'Veracruz', direccion: 'Av. 1',
      contactoPrincipal: 'Carlos', cargoContacto: 'Gerente', emailContacto: 'c@m.test', telefonoContacto: '555',
      procesosprincipales: 'Ventas', alcanceInicial: 'Todo', normaInteres: 'ISO 9001:2015', consultorAsignadoId: 'u1',
      observaciones: 'Nota', trabajadores: '80',
    })
  })

  it('los datos opcionales que faltan quedan como texto vacío (un input no admite undefined)', () => {
    const minima: Empresa = {
      id: 'e2', nombre: 'Mínima', rfc: '', sector: '', tamano: '', ciudad: '', estado: '', contactoPrincipal: '',
      cargoContacto: '', emailContacto: '', telefonoContacto: '', activa: true, fechaAlta: '', proyectosIds: [], logoInicial: 'M',
    }
    const f = empresaAFormulario(minima)
    expect(f.nombreComercial).toBe('')
    expect(f.direccion).toBe('')
    expect(f.procesosprincipales).toBe('')
    expect(f.alcanceInicial).toBe('')
    expect(f.consultorAsignadoId).toBe('')
    expect(f.observaciones).toBe('')
    expect(f.trabajadores).toBe('')
  })

  it('sin norma de interés usa la vigente', () => {
    expect(empresaAFormulario({ ...COMPLETA, normaInteres: undefined }).normaInteres).toBe('ISO 9001:2026')
  })
})

// Los datos que ya existen (cargados antes, o por el seed) pueden no estar en las listas fijas del formulario: sin
// esto el desplegable quedaría en blanco y no se podría guardar sin cambiar un dato que estaba bien.
describe('opcionesConActual', () => {
  const LISTA = ['Comercio', 'Servicios']

  it('con un valor de la lista no agrega nada', () => {
    expect(opcionesConActual(LISTA, 'Comercio')).toEqual(['Comercio', 'Servicios'])
  })
  it('con un valor que no está lo agrega al final, para que se vea seleccionado', () => {
    expect(opcionesConActual(LISTA, 'Servicios de marketing')).toEqual(['Comercio', 'Servicios', 'Servicios de marketing'])
  })
  it('sin valor (formulario nuevo) deja la lista como está', () => {
    expect(opcionesConActual(LISTA, '')).toEqual(['Comercio', 'Servicios'])
  })
  it('no modifica la lista original', () => {
    opcionesConActual(LISTA, 'Otro valor')
    expect(LISTA).toEqual(['Comercio', 'Servicios'])
  })
})
