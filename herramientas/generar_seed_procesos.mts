// Genera el INSERT de procesos del seed a partir de src/data/demo.ts, para que
// el seed quede idéntico al demo. Uso: npx -y tsx generar_seed_procesos.ts <ruta a demo.ts>
import { pathToFileURL } from 'node:url'

const ruta = process.argv[2]
const { PROCESOS } = await import(pathToFileURL(ruta).href)

const CONSULTORIA = '11111111-0000-0000-0000-000000000001'
// Idempotente: demo.ts ya trae UUID (lo reescribió puente_ids.mjs); solo convierte los 'proc-00N' viejos.
export const idProceso = (id: string) =>
  id.startsWith('proc-') ? `55555555-0000-0000-0000-${id.replace('proc-', '').padStart(12, '0')}` : id

const texto = (v?: string | null) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const lista = (v?: string[]) => (!v || v.length === 0 ? `'{}'` : `array[${v.map((x) => texto(x)).join(', ')}]::text[]`)
const fecha = (v?: string) => {
  if (!v) return 'null'
  const [d, m, a] = v.split('/')
  return `'${a}-${m}-${d}'`
}
const json = (v?: object) => (v && Object.keys(v).length ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'{}'::jsonb`)

const filas = PROCESOS.map((p: any) => {
  if (p.actividades?.length) throw new Error(`${p.id} tiene actividades: el generador no las soporta todavía`)
  return `  (${[
    `'${idProceso(p.id)}'`, `'${CONSULTORIA}'`, `'${p.proyectoId}'`, texto(p.responsableId),
    texto(p.nombre), texto(p.descripcion), texto(p.estado), fecha(p.fechaLevantamiento),
    texto(p.objetivo), texto(p.alcance), texto(p.puestoResponsable), texto(p.personalInvolucrado),
    lista(p.entradas), lista(p.salidas), lista(p.proveedores), lista(p.clientes), lista(p.recursosMateriales),
    lista(p.equipos), lista(p.sistemas), lista(p.controles), lista(p.registros), lista(p.indicadores),
    lista(p.riesgos), lista(p.problemas), texto(p.observaciones), texto(p.mejoras), json(p.noAplica),
  ].join(', ')})`
})

console.log(`-- Generado desde src/data/demo.ts (PROCESOS). proc-00N → 5555…00N.
insert into public.procesos (id, consultoria_id, proyecto_id, responsable_id, nombre, descripcion, estado, fecha_levantamiento,
                             objetivo, alcance, puesto_responsable, personal_involucrado,
                             entradas, salidas, proveedores, clientes, recursos_materiales, equipos, sistemas, controles,
                             registros, indicadores, riesgos, problemas, observaciones, mejoras, no_aplica) values
${filas.join(',\n')};`)
