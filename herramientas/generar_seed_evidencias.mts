// Genera el INSERT de evidencias del seed a partir de src/data/demo.ts.
// Uso: npx -y tsx@4.20.6 generar_seed_evidencias.mts <ruta a demo.ts>
import { pathToFileURL } from 'node:url'

const { EVIDENCIAS } = await import(pathToFileURL(process.argv[2]).href)

const CONSULTORIA = '11111111-0000-0000-0000-000000000001'
// Quién la subió: el usuario cliente de la empresa del proyecto.
const SUBIDO_POR: Record<string, string> = {
  '33333333-0000-0000-0000-000000000001': 'aaaaaaaa-0000-0000-0000-000000000005', // Carlos · Marketino
  '33333333-0000-0000-0000-000000000002': 'aaaaaaaa-0000-0000-0000-000000000006', // Lucía · JAZA
}
// Idempotente: demo.ts ya trae UUID (lo reescribió puente_ids.mjs); solo convierte los 'evid-00N' viejos.
const idEvidencia = (id: string) =>
  id.startsWith('evid-') ? `44444444-0000-0000-0000-${id.replace('evid-', '').padStart(12, '0')}` : id
const texto = (v?: string | null) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const fecha = (v?: string) => {
  if (!v) return 'now()'
  const [d, m, a] = v.split('/')
  return `'${a}-${m}-${d} 12:00:00-06'`
}

const filas = EVIDENCIAS.map((e: any) => {
  const subidoPor = SUBIDO_POR[e.proyectoId]
  if (!subidoPor) throw new Error(`${e.id}: proyecto sin usuario cliente conocido`)
  return `  (${[
    `'${idEvidencia(e.id)}'`, `'${CONSULTORIA}'`, `'${e.proyectoId}'`, texto(e.procesoId), `'${subidoPor}'`,
    texto(e.nombre), texto(e.tipo), texto(e.estado), texto(e.descripcion), texto(e.archivoNombre), fecha(e.fechaCarga),
  ].join(', ')})`
})

console.log(`-- Generado desde src/data/demo.ts (EVIDENCIAS). evid-00N → 4444…00N.
insert into public.evidencias (id, consultoria_id, proyecto_id, proceso_id, subido_por, nombre, tipo, estado, descripcion, archivo_nombre, creado_en) values
${filas.join(',\n')};`)
