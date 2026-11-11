import { useEffect, useSyncExternalStore } from 'react'
import { servicioUsoIA } from '../lib/servicios'
import { estadoUsoIA, type EstadoUsoIA, type UsoIA } from '../lib/usoIA'

// Consumo del tope diario de IA, compartido entre las pantallas que usan la IA (el panel de
// preevaluación y el generador de documentos): un pedido en una actualiza el contador de la
// otra. Es solo información para el usuario; el que rechaza al pasarse es la BD.
//
// Cada lectura va marcada con el usuario: si cambia la sesión no se muestra el consumo del
// anterior mientras llega el nuevo.
interface Lectura {
  usuarioId: string
  uso: UsoIA | null
}

let lectura: Lectura | null = null
const oyentes = new Set<() => void>()

export async function refrescarUsoIA(usuarioId: string): Promise<void> {
  const uso = await servicioUsoIA.leer()
  lectura = { usuarioId, uso }
  oyentes.forEach((avisar) => avisar())
}

const suscribir = (oyente: () => void) => {
  oyentes.add(oyente)
  return () => void oyentes.delete(oyente)
}
const instantanea = () => lectura

export function useUsoIA(usuarioId: string | undefined, habilitado: boolean): { uso: UsoIA | null; estado: EstadoUsoIA | null } {
  const actual = useSyncExternalStore(suscribir, instantanea)

  useEffect(() => {
    if (habilitado && usuarioId) void refrescarUsoIA(usuarioId)
  }, [habilitado, usuarioId])

  const uso = habilitado && actual && actual.usuarioId === usuarioId ? actual.uso : null
  return { uso, estado: uso ? estadoUsoIA(uso, new Date()) : null }
}
