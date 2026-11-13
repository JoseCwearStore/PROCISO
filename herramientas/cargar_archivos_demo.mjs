// Sube un archivo real a las evidencias de demostración del seed (O15).
//
// El seed solo puede insertar filas: el Storage no se llena por SQL. Después de un `db reset` hay que correr esto para que
// las evidencias 1, 2, 3 y 4 se puedan abrir, descargar y (el video) reproducir. La 5 (audio) queda "Pendiente de carga" a
// propósito: es la que se usa para probar la carga y la transcripción.
//
//   node herramientas/cargar_archivos_demo.mjs [--video ruta/al/video.mp4]
//
// Usa la clave de servicio de la BD LOCAL (`supabase status -o env`); no sirve contra un proyecto en la nube. Es seguro
// repetirlo: sube con `upsert` y vuelve a escribir los mismos datos.
//
// Los archivos se generan acá (un PDF y un PNG mínimos). El video no se puede generar sin ffmpeg: se pasa con --video, o
// se omite (la evidencia 3 queda sin archivo y el script lo avisa).

import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { deflateSync, crc32 } from 'node:zlib'

const POR_ID = {
  '44444444-0000-0000-0000-000000000001': { ext: 'pdf', mime: 'application/pdf', nombre: 'evaluacion_proveedores_v2.pdf', texto: 'Formato de evaluacion de proveedores' },
  '44444444-0000-0000-0000-000000000002': { ext: 'png', mime: 'image/png', nombre: 'foto_almacen_mar2024.png' },
  '44444444-0000-0000-0000-000000000003': { ext: 'mp4', mime: 'video/mp4', nombre: 'recorrido_planta_abr2024.mp4', video: true },
  '44444444-0000-0000-0000-000000000004': { ext: 'pdf', mime: 'application/pdf', nombre: 'formato_recepcion_actual.pdf', texto: 'Formato de recepcion de mercancia' },
}

// ─── Entorno local ───────────────────────────────────────────────────────────
function entornoLocal() {
  const r = spawnSync('npx', ['-y', 'supabase@2.122.1', 'status', '-o', 'env'], { encoding: 'utf8', shell: true })
  const env = {}
  for (const linea of r.stdout.split('\n')) {
    const m = linea.match(/^([A-Z_]+)="?(.*?)"?\s*$/)
    if (m) env[m[1]] = m[2]
  }
  if (!env.API_URL || !env.SERVICE_ROLE_KEY) throw new Error('No pude leer API_URL / SERVICE_ROLE_KEY de `supabase status`: ¿está arriba la BD local?')
  return env
}

// ─── Archivos de ejemplo ─────────────────────────────────────────────────────
function pdfMinimo(titulo) {
  const texto = titulo.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, '')
  const contenido = `BT /F1 20 Tf 60 740 Td (${texto}) Tj 0 -30 Td /F1 11 Tf (Archivo de demostracion de PROCISO. No es un documento real.) Tj ET`
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const posiciones = []
  objetos.forEach((o, i) => { posiciones.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = pdf.length
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  for (const p of posiciones) pdf += `${String(p).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

function pngDeEjemplo(ancho = 320, alto = 200) {
  const filas = []
  for (let y = 0; y < alto; y++) {
    const fila = Buffer.alloc(1 + ancho * 3)
    for (let x = 0; x < ancho; x++) {
      fila[1 + x * 3] = 40 + Math.floor((x / ancho) * 120)
      fila[2 + x * 3] = 90 + Math.floor((y / alto) * 100)
      fila[3 + x * 3] = 150
    }
    filas.push(fila)
  }
  const trozo = (tipo, datos) => {
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
    const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length)
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cuerpo) >>> 0)
    return Buffer.concat([largo, cuerpo, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr), trozo('IDAT', deflateSync(Buffer.concat(filas))), trozo('IEND', Buffer.alloc(0)),
  ])
}

// ─── Corrida ─────────────────────────────────────────────────────────────────
const argVideo = process.argv.indexOf('--video')
const rutaVideo = argVideo > -1 ? process.argv[argVideo + 1] : null

const { API_URL, SERVICE_ROLE_KEY } = entornoLocal()
const cabeceras = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }

async function json(url, opciones) {
  const r = await fetch(url, { ...opciones, headers: { ...cabeceras, ...(opciones?.headers ?? {}) } })
  if (!r.ok) throw new Error(`${opciones?.method ?? 'GET'} ${url} → ${r.status} ${await r.text()}`)
  return r.status === 204 ? null : r.json().catch(() => null)
}

const ids = Object.keys(POR_ID).map((id) => `"${id}"`).join(',')
const evidencias = await json(`${API_URL}/rest/v1/evidencias?select=id,consultoria_id,proyecto_id&id=in.(${ids})`)
const proyectos = await json(`${API_URL}/rest/v1/proyectos?select=id,empresa_id`)
const empresaDe = new Map(proyectos.map((p) => [p.id, p.empresa_id]))

if (evidencias.length === 0) throw new Error('No encontré las evidencias del seed: ¿se corrió el seed?')

for (const ev of evidencias) {
  const def = POR_ID[ev.id]
  let cuerpo
  if (def.video) {
    if (!rutaVideo || !existsSync(rutaVideo)) { console.log(`- ${def.nombre}: sin archivo (pasá un video con --video ruta.mp4)`); continue }
    cuerpo = readFileSync(rutaVideo)
  } else {
    cuerpo = def.ext === 'png' ? pngDeEjemplo() : pdfMinimo(def.texto)
  }
  const ruta = `${ev.consultoria_id}/${empresaDe.get(ev.proyecto_id)}/${ev.proyecto_id}/${ev.id}.${def.ext}`
  await json(`${API_URL}/storage/v1/object/evidencias/${ruta}`, {
    method: 'POST', body: cuerpo, headers: { 'Content-Type': def.mime, 'x-upsert': 'true' },
  })
  await json(`${API_URL}/rest/v1/evidencias?id=eq.${ev.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ archivo_ruta: ruta, archivo_nombre: def.nombre, archivo_mime: def.mime, archivo_tamano: cuerpo.length }),
  })
  console.log(`✔ ${def.nombre} (${cuerpo.length} bytes) → ${ruta}`)
}
