import type { Documento } from '../types'
import { PENDIENTE } from './plantillas'

// Modelo NEUTRO de un documento para exportarlo: lo comparten Word y PDF, así que ninguno
// conoce la estructura interna de la app y los dos salen del mismo contenido. Es lógica
// pura (sin librerías ni DOM): se prueba sola.

export interface BloqueTexto {
  tipo: 'texto'
  titulo: string
  parrafos: string[]
}

// La primera fila de una tabla de la app es su encabezado (ver plantillas.ts). Una tabla
// agregada a mano con esa fila vacía no tiene encabezado: `columnas` queda vacío.
export interface BloqueTabla {
  tipo: 'tabla'
  titulo: string
  columnas: string[]
  filas: string[][]
}

export type Bloque = BloqueTexto | BloqueTabla

export interface ModeloDocumento {
  titulo: string
  codigo: string
  version: string
  estado: string
  tipo: string
  organizacion: string
  proyecto: string
  referenciaNormativa: string
  fecha: string
  bloques: Bloque[]
  avisos: string[]
}

export interface ContextoExportacion {
  organizacion?: string
  proyecto?: string
}

const AVISO_PRELIMINAR = 'Documento preliminar. Requiere revisión y aprobación de los responsables autorizados antes de su uso oficial.'

// El archivo ya abre con una tabla de metadatos (código, versión, organización…), así que la
// sección "Encabezado y control…" de las plantillas repetiría lo mismo. En la app sigue
// existiendo: solo se omite al exportar.
const esEncabezadoRepetido = (titulo: string) => /^encabezado y control/i.test(titulo.trim())

function seccionesExportables(documento: Documento) {
  return (documento.secciones ?? []).filter((seccion) => !esEncabezadoRepetido(seccion.titulo))
}

function bloquesDe(documento: Documento): Bloque[] {
  return seccionesExportables(documento).map((seccion): Bloque => {
    if (seccion.tipo === 'tabla') {
      const [primera = [], ...resto] = seccion.filas ?? []
      const conEncabezado = primera.some((celda) => celda.trim())
      return { tipo: 'tabla', titulo: seccion.titulo, columnas: conEncabezado ? primera : [], filas: conEncabezado ? resto : seccion.filas?.slice(1) ?? [] }
    }
    const parrafos = seccion.contenido.split(/\r?\n/).map((linea) => linea.trim()).filter(Boolean)
    return { tipo: 'texto', titulo: seccion.titulo, parrafos: parrafos.length ? parrafos : [PENDIENTE] }
  })
}

export function armarModelo(documento: Documento, contexto: ContextoExportacion): ModeloDocumento {
  const bloques = bloquesDe(documento)
  const pendientes = seccionesExportables(documento).filter((s) => s.tipo === 'texto' && s.contenido.includes(PENDIENTE)).length

  const avisos: string[] = []
  if (documento.estado !== 'Aprobado') avisos.push(AVISO_PRELIMINAR)
  if (pendientes) {
    avisos.push(`Contiene ${pendientes} ${pendientes === 1 ? 'sección' : 'secciones'} con información pendiente de confirmar.`)
  }

  return {
    titulo: documento.nombre,
    codigo: documento.codigo ?? '',
    version: documento.version,
    estado: documento.estado,
    tipo: documento.tipo,
    organizacion: contexto.organizacion ?? '',
    proyecto: contexto.proyecto ?? '',
    referenciaNormativa: documento.referenciaNormativa ?? '',
    fecha: documento.fechaModificacion,
    bloques,
    avisos,
  }
}

// SGC-POL-001_v0.1_politica-de-calidad-marketino.pdf: sin acentos ni símbolos, que los
// sistemas de archivos y los correos no siempre toleran.
export function nombreArchivo(modelo: ModeloDocumento, extension: 'docx' | 'pdf'): string {
  const titulo = modelo.titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return [modelo.codigo, `v${modelo.version}`, titulo || 'documento'].filter(Boolean).join('_') + `.${extension}`
}
