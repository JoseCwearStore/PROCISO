// Genera la migración de DATOS de criterios_evaluacion a partir del Excel del usuario.
//
// Uso (desde la carpeta herramientas/ del repo, tras `npm ci`):
//   node generar_migracion_criterios.mjs <matriz.xlsx> <salida.sql> [edicion]
// Ejemplo (el Excel vive fuera del repo; ver el README de esta carpeta):
//   node generar_migracion_criterios.mjs <ruta>/matriz_criterios_iso_9001_2015_revisada.xlsx \
//     ../supabase/migrations/<timestamp>_criterios_evaluacion_datos.sql
//
// El Excel es la ÚNICA fuente de los criterios. Si cambia, se genera una migración
// NUEVA (con otro timestamp): hace upsert por (edicion, clausula) —actualiza las
// existentes, agrega las nuevas— y borra las que ya no están en el Excel.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import ExcelJS from 'exceljs'

const [entrada, salida, edicion = 'ISO 9001:2026'] = process.argv.slice(2)
if (!entrada || !salida) {
  console.error('Uso: node generar_migracion_criterios.mjs <matriz.xlsx> <salida.sql> [edicion]')
  process.exit(1)
}

const texto = (v) => {
  if (v == null) return ''
  if (typeof v === 'object' && 'richText' in v) return v.richText.map((r) => r.text).join('')
  return String(v)
}
const limpiar = (s) => texto(s).replace(/\s+/g, ' ').trim()
const lista = (s) => limpiar(s).split(';').map((x) => x.trim().replace(/\.$/, '')).filter(Boolean)
const sql = (s) => `'${s.replace(/'/g, "''")}'`
const arreglo = (xs) => (xs.length ? `array[${xs.map(sql).join(', ')}]` : `'{}'::text[]`)

const libro = new ExcelJS.Workbook()
await libro.xlsx.readFile(entrada)
const hoja = libro.getWorksheet('Criterios')
if (!hoja) throw new Error('No existe la hoja "Criterios"')

const encabezado = (hoja.getRow(1).values ?? []).slice(1).map(limpiar)
const col = (nombre) => {
  const i = encabezado.indexOf(nombre)
  if (i < 0) throw new Error(`Falta la columna "${nombre}"`)
  return i + 1
}
const C = {
  clausula: col('clausula'), titulo: col('titulo'), intencion: col('intencion'),
  evidencia: col('evidencia_esperada'), preguntas: col('preguntas'), senales: col('senales_de_hueco'),
  noAplica: encabezado.includes('puede_no_aplicar') ? col('puede_no_aplicar') : null,
}

const filas = []
const errores = []
hoja.eachRow((fila, n) => {
  if (n === 1) return
  const clausula = limpiar(fila.getCell(C.clausula).value)
  if (!clausula) return
  const noAplica = C.noAplica ? limpiar(fila.getCell(C.noAplica).value) : ''
  const r = {
    clausula,
    titulo: limpiar(fila.getCell(C.titulo).value),
    intencion: limpiar(fila.getCell(C.intencion).value),
    evidencia: lista(fila.getCell(C.evidencia).value),
    preguntas: lista(fila.getCell(C.preguntas).value),
    senales: lista(fila.getCell(C.senales).value),
    puedeNoAplicar: /^s[ií]/i.test(noAplica),
    // "Sí, si la organización no diseña… (justificar)" → "si la organización no diseña… (justificar)"
    condicion: /^s[ií]/i.test(noAplica) ? noAplica.replace(/^s[ií]\s*,?\s*/i, '') : null,
  }
  if (!/^(4|5|6|7|8|9|10)(\.\d+){1,3}$/.test(r.clausula)) errores.push(`fila ${n}: cláusula inválida "${r.clausula}"`)
  if (!r.titulo || !r.intencion) errores.push(`fila ${n} (${r.clausula}): falta título o intención`)
  if (!r.preguntas.length) errores.push(`fila ${n} (${r.clausula}): sin preguntas`)
  filas.push(r)
})
const repetidas = filas.map((f) => f.clausula).filter((c, i, a) => a.indexOf(c) !== i)
if (repetidas.length) errores.push(`cláusulas repetidas: ${[...new Set(repetidas)].join(', ')}`)
if (errores.length) {
  console.error('La planilla tiene errores; no se generó nada:\n - ' + errores.join('\n - '))
  process.exit(2)
}

const hash = createHash('sha1').update(readFileSync(entrada)).digest('hex')
const valores = filas.map((f, i) =>
  `  (${sql(edicion)}, ${sql(f.clausula)}, ${sql(f.titulo)}, ${sql(f.intencion)},\n` +
  `   ${arreglo(f.evidencia)},\n   ${arreglo(f.preguntas)},\n   ${arreglo(f.senales)},\n` +
  `   ${f.puedeNoAplicar}, ${f.condicion ? sql(f.condicion) : 'null'}, ${i + 1})`)

const contenido = `-- GENERADO por herramientas/generar_migracion_criterios.mjs — NO editar a mano.
-- Fuente: ${basename(entrada)} (sha1 ${hash})
-- ${filas.length} criterios · edición ${edicion}
-- Para cambiar un criterio: editar el Excel y generar una migración NUEVA.

insert into public.criterios_evaluacion
  (edicion, clausula, titulo, intencion, evidencia_esperada, preguntas, senales_de_hueco, puede_no_aplicar, condicion_no_aplica, orden)
values
${valores.join(',\n')}
on conflict (edicion, clausula) do update set
  titulo              = excluded.titulo,
  intencion           = excluded.intencion,
  evidencia_esperada  = excluded.evidencia_esperada,
  preguntas           = excluded.preguntas,
  senales_de_hueco    = excluded.senales_de_hueco,
  puede_no_aplicar    = excluded.puede_no_aplicar,
  condicion_no_aplica = excluded.condicion_no_aplica,
  orden               = excluded.orden;

-- Lo que ya no está en el Excel se elimina (si algo lo referencia, la migración falla y avisa).
delete from public.criterios_evaluacion
where edicion = ${sql(edicion)}
  and clausula not in (${filas.map((f) => sql(f.clausula)).join(', ')});
`
writeFileSync(salida, contenido)
console.log(`listo: ${filas.length} criterios (${filas.filter((f) => f.puedeNoAplicar).length} pueden no aplicar) → ${salida}`)
