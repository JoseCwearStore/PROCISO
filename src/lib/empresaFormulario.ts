import type { NuevaEmpresa } from './escrituras'
import type { Empresa } from '../types'

// Los datos de una empresa ya creada, en la forma del formulario de empresa (el mismo del alta): sirve para precargar
// la edición (O2). Un dato que falta queda como texto vacío porque un input controlado no admite `undefined`.
export function empresaAFormulario(empresa: Empresa): NuevaEmpresa {
  return {
    nombre: empresa.nombre,
    nombreComercial: empresa.nombreComercial ?? '',
    rfc: empresa.rfc,
    sector: empresa.sector,
    tamano: empresa.tamano,
    ciudad: empresa.ciudad,
    estado: empresa.estado,
    direccion: empresa.direccion ?? '',
    contactoPrincipal: empresa.contactoPrincipal,
    cargoContacto: empresa.cargoContacto,
    emailContacto: empresa.emailContacto,
    telefonoContacto: empresa.telefonoContacto,
    procesosprincipales: empresa.procesosprincipales ?? '',
    alcanceInicial: empresa.alcanceInicial ?? '',
    normaInteres: empresa.normaInteres ?? 'ISO 9001:2026',
    consultorAsignadoId: empresa.consultorAsignadoId ?? '',
    observaciones: empresa.observaciones ?? '',
    trabajadores: empresa.trabajadores ?? '',
  }
}

// La lista de un desplegable más el valor guardado si no está en ella (ver el test).
export function opcionesConActual(opciones: readonly string[], actual: string): string[] {
  return actual && !opciones.includes(actual) ? [...opciones, actual] : [...opciones]
}
