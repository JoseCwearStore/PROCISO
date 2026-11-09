// Genera el INSERT de entregables del seed a partir de src/data/demo.ts.
// Uso: npx -y tsx@4.20.6 generar_seed_entregables.mts <ruta a demo.ts>
//
// · Fechas RELATIVAS a current_date con el mismo ancla que tareas y NC (10/09/2024).
// · Idempotente respecto de puente_ids.mjs (si demo.ts ya tiene UUID, lo deja igual).
// · Se inserta como postgres: el demo ya trae cada entregable en su estado, con el
//   cliente como aprobador (la misma regla que exige decidir_entregable).
import { pathToFileURL } from 'node:url'

const { ENTREGABLES } = await import(pathToFileURL(process.argv[2]).href)

const CONSULTORIA = '11111111-0000-0000-0000-000000000001'
const ANCLA = Date.UTC(2024, 8, 10)
// Quién lo registró: el consultor de cada proyecto (nunca alguien de afuera).
const CREADO_POR: Record<string, string> = {
  '33333333-0000-0000-0000-000000000001': 'aaaaaaaa-0000-0000-0000-000000000003', // Roberto · Marketino
  '33333333-0000-0000-0000-000000000002': 'aaaaaaaa-0000-0000-0000-000000000004', // María · JAZA
  '33333333-0000-0000-0000-000000000004': 'aaaaaaaa-0000-0000-0000-000000000003', // Roberto · Marketino 2025
}

const idEntregable = (id: string) =>
  id.startsWith('ent-') ? `bbbbbbbb-0000-0000-0000-${id.replace('ent-', '').padStart(12, '0')}` : id
const texto = (v?: string | null) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const fecha = (v?: string) => {
  if (!v) return 'null'
  const [d, m, a] = v.split('/').map(Number)
  return `current_date + ${Math.round((Date.UTC(a, m - 1, d) - ANCLA) / 86_400_000)}`
}

const filas = ENTREGABLES.map((e: any) => {
  const creadoPor = CREADO_POR[e.proyectoId]
  if (!creadoPor) throw new Error(`${e.id}: proyecto sin consultor conocido`)
  if (e.estado === 'Aprobado' && !e.aprobadoPorId) throw new Error(`${e.id}: aprobado sin aprobador`)
  return `  (${[
    `'${idEntregable(e.id)}'`, `'${CONSULTORIA}'`, `'${e.proyectoId}'`, texto(e.nombre), texto(e.tipo), texto(e.estado),
    fecha(e.fechaEntrega), fecha(e.fechaAprobacion), texto(e.aprobadoPorId), texto(e.documentoId), `'${creadoPor}'`,
  ].join(', ')})`
})

console.log(`-- Generado desde src/data/demo.ts (ENTREGABLES) con herramientas/generar_seed_entregables.mts.
-- ent-00N → bbbb…00N. Fechas relativas a current_date (ancla del demo: 10/09/2024).
insert into public.entregables (id, consultoria_id, proyecto_id, nombre, tipo, estado, fecha_entrega, fecha_aprobacion, aprobado_por, documento_id, creado_por) values
${filas.join(',\n')};`)
