// Genera el INSERT de no conformidades del seed a partir de src/data/demo.ts.
// Uso: npx -y tsx@4.20.6 generar_seed_no_conformidades.mts <ruta a demo.ts>
//
// · Fechas RELATIVAS a current_date con el mismo ancla que tareas (10/09/2024).
// · El folio NO va: lo pone el trigger (NC-001 por proyecto, en orden de inserción).
// · Idempotente respecto de puente_ids.mjs: si demo.ts ya tiene UUID, lo deja igual.
// · Se inserta como postgres (sin RPC): el demo ya trae cada NC en su estado.
import { pathToFileURL } from 'node:url'

const { NO_CONFORMIDADES } = await import(pathToFileURL(process.argv[2]).href)

const CONSULTORIA = '11111111-0000-0000-0000-000000000001'
const ANCLA = Date.UTC(2024, 8, 10)
// Quién registró: el consultor asignado a cada proyecto (nunca alguien de afuera).
const REGISTRADA_POR: Record<string, string> = {
  '33333333-0000-0000-0000-000000000001': 'aaaaaaaa-0000-0000-0000-000000000003', // Roberto · Marketino
  '33333333-0000-0000-0000-000000000002': 'aaaaaaaa-0000-0000-0000-000000000004', // María · JAZA
}

const idNC = (id: string) =>
  id.startsWith('nc-') ? `88888888-0000-0000-0000-${id.replace('nc-', '').padStart(12, '0')}` : id
const texto = (v?: string | null) => `'${String(v ?? '').replace(/'/g, "''")}'`
const fecha = (v?: string) => {
  if (!v) return 'null'
  const [d, m, a] = v.split('/').map(Number)
  return `current_date + ${Math.round((Date.UTC(a, m - 1, d) - ANCLA) / 86_400_000)}`
}
// "Observación para revisar: …" del demo es, en realidad, una hipótesis de causa.
const causa = (n: any) => (n.observaciones ?? '').replace(/^Observación para revisar:\s*/, '')

const filas = NO_CONFORMIDADES.map((n: any) => {
  const enTratamiento = n.estado !== 'Abierta'
  const registradaPor = REGISTRADA_POR[n.proyectoId]
  if (!registradaPor) throw new Error(`${n.id}: proyecto sin consultor conocido`)
  return `  (${[
    `'${idNC(n.id)}'`, `'${CONSULTORIA}'`, `'${n.proyectoId}'`, texto(n.titulo), texto(n.descripcion), texto(n.tipo),
    texto(n.detectadaEn), fecha(n.fechaDeteccion), `'${n.responsableId}'`, texto(n.estado),
    // Una NC que ya pasó de Abierta tiene que tener causa y acción (la misma regla que la RPC).
    texto(enTratamiento ? causa(n) : ''), texto(n.acciones.join('\n')), texto(n.observaciones), `'${registradaPor}'`,
  ].join(', ')})`
})

console.log(`-- Generado desde src/data/demo.ts (NO_CONFORMIDADES) con herramientas/generar_seed_no_conformidades.mts.
-- nc-00N → 8888…00N. El folio lo pone el trigger (NC-001 por proyecto).
insert into public.no_conformidades (id, consultoria_id, proyecto_id, titulo, descripcion, tipo, detectada_en, fecha_deteccion, responsable_id, estado, analisis_causa, accion_correctiva, observaciones, registrada_por) values
${filas.join(',\n')};`)
