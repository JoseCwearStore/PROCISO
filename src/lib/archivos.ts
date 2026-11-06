import type { Evidencia } from '../types'

// Las URLs firmadas dan acceso temporal a UN archivo del bucket privado.
export const DURACION_URL_SEGUNDOS = 60 * 60

export interface ClienteArchivos {
  storage: {
    from(bucket: 'evidencias'): {
      createSignedUrls(
        rutas: string[],
        segundos: number,
      ): PromiseLike<{
        data: { path: string | null; signedUrl: string | null; error: string | null }[] | null
        error: { message: string } | null
      }>
    }
  }
}

export function crearServicioArchivos(cliente: ClienteArchivos) {
  return {
    // Un solo pedido para todas. Si algo falla, las evidencias se muestran sin
    // vista previa: un problema con los archivos no debe impedir usar la app.
    async firmarEvidencias(evidencias: Evidencia[]): Promise<Evidencia[]> {
      const rutas = evidencias.flatMap((e) => (e.archivoRuta ? [e.archivoRuta] : []))
      if (rutas.length === 0) return evidencias

      const { data, error } = await cliente.storage.from('evidencias').createSignedUrls(rutas, DURACION_URL_SEGUNDOS)
      if (error || !data) return evidencias

      const urlPorRuta = new Map(data.flatMap((f) => (f.path && f.signedUrl ? [[f.path, f.signedUrl] as const] : [])))
      return evidencias.map((e) => (e.archivoRuta && urlPorRuta.has(e.archivoRuta) ? { ...e, archivoUrl: urlPorRuta.get(e.archivoRuta) } : e))
    },
  }
}
