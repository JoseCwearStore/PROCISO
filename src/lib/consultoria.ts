// Datos reales de una consultoría para la pantalla de Configuración (AUD07-M3, L5c, D7).
// Antes la pantalla mostraba datos de OTRA consultoría escritos a mano; ahora salen de la BD.

import type { Consultoria, Usuario } from '../types'

export interface DatoConsultoria {
  etiqueta: string
  valor: string
}

export function datosDeConsultoria(consultoria: Consultoria, usuarios: Usuario[]): DatoConsultoria[] {
  const activos = usuarios.filter((u) => u.consultoriaId === consultoria.id && u.activo).length
  const datos: [string, string | undefined][] = [
    ['Razón social', consultoria.nombre],
    ['RFC', consultoria.rfc],
    ['Estado', consultoria.activa === false ? 'Suspendida' : 'Activa'],
    ['Plan', consultoria.plan],
    ['Contacto', consultoria.contacto],
    ['Correo de contacto', consultoria.email],
    ['Usuarios activos', String(activos)],
    ['Alta en el sistema', consultoria.fechaAlta],
    ['Renovación', consultoria.renovacion],
    // El límite de usuarios SÍ se hace cumplir al invitar (AUD10-M7); el almacenamiento sigue siendo solo referencia (D5).
    ['Límite de usuarios del plan', consultoria.limiteUsuarios === undefined ? undefined : String(consultoria.limiteUsuarios)],
    ['Almacenamiento del plan (referencia)', consultoria.almacenamientoGb === undefined ? undefined : `${consultoria.almacenamientoGb} GB`],
  ]
  // Lo que no tiene valor se omite: ni guiones ni datos inventados.
  return datos.filter((d): d is [string, string] => !!d[1]).map(([etiqueta, valor]) => ({ etiqueta, valor }))
}
