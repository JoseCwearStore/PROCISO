import type { SupabaseClient } from '@supabase/supabase-js'
import { crearServicioAuth, type ClienteAuth, type PerfilBD } from './auth'
import { cargarFilasSesion, type ClienteDatos } from './datos'
import { crearServicioEscritura, type ClienteEscritura } from './escrituras'
import { crearServicioArchivos, type ClienteArchivos } from './archivos'
import { supabase } from './supabase'
import type { Rol } from '../types'

export { llegoDesdeEnlaceDeRecuperacion } from './supabase'

// Adaptador: traduce el cliente real al puerto ClienteAuth. Es explícito a
// propósito; comparar SupabaseClient contra el puerto por estructura hace que
// TypeScript se pierda en los tipos recursivos del parser de select (TS2589).
function adaptarClienteAuth(cliente: SupabaseClient): ClienteAuth {
  return {
    auth: {
      signInWithPassword: (credenciales) => cliente.auth.signInWithPassword(credenciales),
      signOut: () => cliente.auth.signOut(),
      getSession: () => cliente.auth.getSession(),
      resetPasswordForEmail: (email, opciones) => cliente.auth.resetPasswordForEmail(email, opciones),
      updateUser: (datos) => cliente.auth.updateUser(datos),
    },
    rpc: (funcion) => cliente.rpc(funcion),
    from: (tabla) => ({
      select: (columnas) => ({
        eq: (columna, valor) => ({
          maybeSingle: () => cliente.from(tabla).select(columnas).eq(columna, valor).maybeSingle<PerfilBD>(),
        }),
      }),
    }),
  }
}

export function adaptarClienteDatos(cliente: SupabaseClient): ClienteDatos {
  return {
    from: (tabla) => ({
      select: (columnas) => cliente.from(tabla).select(columnas),
    }),
    rpc: (funcion) => cliente.rpc(funcion),
  }
}

export function adaptarClienteEscritura(cliente: SupabaseClient): ClienteEscritura {
  return {
    from: (tabla) => ({
      insert: (fila) => ({
        select: (columnas) => ({ single: () => cliente.from(tabla).insert(fila).select(columnas).single() }),
      }),
      update: (cambios) => ({
        eq: (columna, valor) => ({
          select: (columnas) => ({
            single: () => cliente.from(tabla).update(cambios).eq(columna, valor).select(columnas).single(),
          }),
        }),
      }),
    }),
    rpc: (funcion, args) => cliente.rpc(funcion, args),
    functions: {
      // supabase-js entrega el Response en error.context: de ahí sale el status.
      invoke: async (nombre, opciones) => {
        const { data, error } = await cliente.functions.invoke(nombre, opciones)
        if (!error) return { data, error: null }
        const status = (error as { context?: { status?: number } }).context?.status
        return { data: null, error: { message: error.message, status } }
      },
    },
    storage: {
      from: (bucket) => ({
        upload: (ruta, archivo, opciones) => cliente.storage.from(bucket).upload(ruta, archivo, opciones),
        remove: (rutas) => cliente.storage.from(bucket).remove(rutas),
      }),
    },
  }
}

function adaptarClienteArchivos(cliente: SupabaseClient): ClienteArchivos {
  return {
    storage: {
      from: (bucket) => ({
        createSignedUrls: (rutas, segundos) => cliente.storage.from(bucket).createSignedUrls(rutas, segundos),
      }),
    },
  }
}

// Punto de composición: acá los servicios reciben el cliente real de Supabase.
export const servicioEscritura = crearServicioEscritura(adaptarClienteEscritura(supabase))
export const servicioArchivos = crearServicioArchivos(adaptarClienteArchivos(supabase))
export const servicioAuth = crearServicioAuth(adaptarClienteAuth(supabase))
export const cargarFilasDeSesion = (rol: Rol) => cargarFilasSesion(adaptarClienteDatos(supabase), rol)
