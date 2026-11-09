// Genera documentos + documento_versiones del seed a partir de src/data/demo.ts.
// Uso: npx -y tsx@4.20.6 generar_seed_documentos.mts <ruta a demo.ts>
import { pathToFileURL } from 'node:url'

const { DOCUMENTOS } = await import(pathToFileURL(process.argv[2]).href)

const CONSULTORIA = '11111111-0000-0000-0000-000000000001'
// Idempotente: demo.ts ya trae UUID (lo reescribió puente_ids.mjs); solo convierte los 'doc-00N' viejos.
const idDocumento = (id: string) =>
  id.startsWith('doc-') ? `66666666-0000-0000-0000-${id.replace('doc-', '').padStart(12, '0')}` : id
const texto = (v?: string | null) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const fecha = (v?: string) => {
  if (!v) return 'now()'
  const [d, m, a] = v.split('/')
  return `'${a}-${m}-${d} 12:00:00-06'`
}
const json = (v: unknown) => `'${JSON.stringify(v ?? []).replace(/'/g, "''")}'::jsonb`

const documentos = DOCUMENTOS.map((d: any) => `  (${[
  `'${idDocumento(d.id)}'`, `'${CONSULTORIA}'`, `'${d.proyectoId}'`, texto(d.procesoId),
  texto(d.nombre), texto(d.tipo), texto(d.estado), texto(d.version), texto(d.codigo), texto(d.categoria),
  json(d.secciones), texto(d.referenciaNormativa ?? 'ISO 9001:2026'), d.contenidoPendiente ? 'true' : 'false',
  d.estado === 'Aprobado' || d.estado === 'Obsoleto' ? 'true' : 'false',
  texto(d.creadoPorId), texto(d.revisadoPorId), texto(d.aprobadoPorId),
  fecha(d.fechaCreacion), fecha(d.fechaModificacion),
].join(', ')})`)

const versiones = DOCUMENTOS.flatMap((d: any) =>
  (d.historialVersiones ?? []).map((v: any) => `  (${[
    `'${CONSULTORIA}'`, `'${d.proyectoId}'`, `'${idDocumento(d.id)}'`, texto(v.version), texto(v.autorId),
    texto(v.comentario), texto(v.motivo), json(v.secciones), texto(v.estado), fecha(v.fecha),
  ].join(', ')})`),
)

console.log(`-- Generado desde src/data/demo.ts (DOCUMENTOS). doc-00N → 6666…00N.
insert into public.documentos (id, consultoria_id, proyecto_id, proceso_id, nombre, tipo, estado, version, codigo, categoria,
                               secciones, referencia_normativa, contenido_pendiente, bloqueado,
                               creado_por, revisado_por, aprobado_por, creado_en, actualizado_en) values
${documentos.join(',\n')};

insert into public.documento_versiones (consultoria_id, proyecto_id, documento_id, version, autor_id, comentario, motivo, secciones, estado, creado_en) values
${versiones.join(',\n')};`)
