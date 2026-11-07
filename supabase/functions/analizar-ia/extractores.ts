// Extractores: convierten cada tipo de fuente al formato común FuenteIA.
// Si una fuente no se puede analizar, lanzan ErrorIA con un motivo ACCIONABLE
// (queda guardado en analisis_ia.error_detalle para poder actuar).
//
// Para sumar video o audio: un extractor de transcripción más, sin tocar lo demás.

import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1'
import { ErrorIA, textoDeSecciones, type FuenteIA } from '../_compartido/analisis.ts'

const MAX_IMAGEN_BYTES = 5 * 1024 * 1024

function aBase64(bytes: Uint8Array): string {
  let binario = ''
  const trozo = 0x8000
  for (let i = 0; i < bytes.length; i += trozo) binario += String.fromCharCode(...bytes.subarray(i, i + trozo))
  return btoa(binario)
}

export function extraerDocumento(secciones: unknown): FuenteIA {
  const texto = textoDeSecciones(Array.isArray(secciones) ? secciones : [])
  if (!texto.replace(/##[^\n]*\n?/g, '').trim()) {
    throw new ErrorIA('El documento no tiene contenido para analizar (sus secciones están vacías).')
  }
  return { texto, imagenes: [] }
}

export async function extraerArchivo(bytes: Uint8Array, mime: string, aceptaImagenes: boolean): Promise<FuenteIA> {
  if (mime === 'application/pdf') {
    const pdf = await getDocumentProxy(bytes)
    const { text } = await extractText(pdf, { mergePages: true })
    const texto = String(text ?? '').trim()
    if (texto.length < 20) {
      throw new ErrorIA('El PDF no tiene texto que se pueda leer (probablemente es un escaneo). Hace falta OCR o subirlo como imagen.')
    }
    return { texto, imagenes: [] }
  }

  if (mime.startsWith('image/')) {
    if (!aceptaImagenes) {
      throw new ErrorIA('El modelo configurado no acepta imágenes. Configurá un modelo con visión e IA_VISION=true.')
    }
    if (bytes.length > MAX_IMAGEN_BYTES) throw new ErrorIA('La imagen supera 5 MB; reducila antes de analizarla.')
    return { texto: '', imagenes: [{ mime, base64: aBase64(bytes) }] }
  }

  if (mime.startsWith('video/') || mime.startsWith('audio/')) {
    throw new ErrorIA('El análisis de video y audio todavía no está disponible (requiere transcripción).')
  }

  if (mime.startsWith('text/')) return { texto: new TextDecoder().decode(bytes), imagenes: [] }

  throw new ErrorIA(`No se pueden analizar archivos de tipo "${mime}". Por ahora: documentos de la app, PDF con texto, imágenes y texto plano.`)
}
