// Genera los INSERT de tareas (+ su historial y comentarios) del seed a partir de src/data/demo.ts.
// Uso: npx -y tsx@4.20.6 generar_seed_tareas.mts <ruta a demo.ts>
//
// Fechas RELATIVAS: el demo "vive" alrededor del 10/09/2024 (2 tareas vencidas el 15 y 31/08,
// la próxima fecha límite pendiente es el 15/09). Cada fecha se traduce a current_date ± N días
// respecto de ese ancla, así el tablero se ve igual el día que se haga la demo.
// "Vencida" NO se guarda: se calcula (estado no final + fecha pasada).
import { pathToFileURL } from 'node:url'

const { TAREAS } = await import(pathToFileURL(process.argv[2]).href)

const CONSULTORIA = '11111111-0000-0000-0000-000000000001'
const ANCLA = Date.UTC(2024, 8, 10) // 10/09/2024
const ESTADOS = ['Pendiente', 'En proceso', 'En revisión', 'Requiere corrección', 'Completada']

// Funciona antes o después de puente_ids.mjs: si demo.ts ya tiene el UUID, lo deja igual.
const idTarea = (id: string) =>
  id.startsWith('tar-') ? `77777777-0000-0000-0000-${id.replace('tar-', '').padStart(12, '0')}` : id
const texto = (v?: string | null) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const dias = (v: string) => {
  const [d, m, a] = v.split('/').map(Number)
  return Math.round((Date.UTC(a, m - 1, d) - ANCLA) / 86_400_000)
}
const fecha = (v?: string) => (v ? `current_date + ${dias(v)}` : 'null')
// Lo que ya pasó (historial, comentarios) nunca queda en el futuro. Los minutos desempatan
// eventos del mismo día respetando el orden del demo (si no, el sort por creado_en los mezcla).
let orden = 0
const momento = (v: string) => `now() - interval '${Math.max(-dias(v), 0)} days' - interval '${500 - ++orden} minutes'`

const tareas: string[] = []
const historial: string[] = []
const comentarios: string[] = []

for (const t of TAREAS) {
  // Una tarea "Vencida" del demo sigue abierta: vuelve a su estado de trabajo.
  const estado = t.estado === 'Vencida' ? 'Pendiente' : t.estado
  if (!ESTADOS.includes(estado)) throw new Error(`${t.id}: estado desconocido ${t.estado}`)
  const id = idTarea(t.id)
  const deps = `array[${t.dependencias.map((d: string) => `'${idTarea(d)}'`).join(', ')}]::uuid[]`

  tareas.push(`  (${[
    `'${id}'`, `'${CONSULTORIA}'`, `'${t.proyectoId}'`, texto(t.titulo), texto(t.descripcion),
    `'${t.asignadoAId}'`, `'${t.asignadoPorId}'`, `'${estado}'`, `'${t.prioridad}'`,
    fecha(t.fechaVencimiento), fecha(t.fechaCompletada), deps,
  ].join(', ')})`)

  for (const h of t.historial) {
    if (!ESTADOS.includes(h.de) || !ESTADOS.includes(h.a)) throw new Error(`${t.id}: historial con estado no válido`)
    historial.push(`  ('${CONSULTORIA}', '${t.proyectoId}', 'tarea', '${id}', '${h.autorId}', 'Cambio de estado', null, '${h.de}', '${h.a}', ${momento(h.fecha)})`)
  }
  for (const c of t.comentarios) {
    comentarios.push(`  ('${CONSULTORIA}', '${t.proyectoId}', 'tarea', '${id}', '${c.autorId}', ${texto(c.texto)}, ${momento(c.fecha)})`)
  }
}

console.log(`-- Generado desde src/data/demo.ts (TAREAS) con herramientas/generar_seed_tareas.mts. tar-00N → 7777…00N.
-- Fechas relativas a current_date (ancla del demo: 10/09/2024).
insert into public.tareas (id, consultoria_id, proyecto_id, titulo, descripcion, asignado_a, asignado_por, estado, prioridad, fecha_vencimiento, fecha_completada, dependencias) values
${tareas.join(',\n')};

insert into public.historial (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, accion, descripcion, estado_anterior, estado_nuevo, creado_en) values
${historial.join(',\n')};

insert into public.comentarios (consultoria_id, proyecto_id, entidad_tipo, entidad_id, autor_id, texto, creado_en) values
${comentarios.join(',\n')};`)
