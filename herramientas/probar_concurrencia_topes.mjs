// Prueba de concurrencia de los topes diarios (AUD10-M5 y M6).
//
// pgTAP corre en una sola conexión y no puede probar qué pasa cuando DOS pedidos llegan a la vez. Esto sí: deja a un
// usuario a un pedido del tope y manda dos pedidos simultáneos desde dos conexiones. Con el bloqueo, EXACTAMENTE uno pasa
// y el otro recibe el error del tope; sin el bloqueo pasan los dos y el tope se excede.
//
//   node herramientas/probar_concurrencia_topes.mjs
//
// Usa la BD LOCAL por `docker exec` (contenedor supabase_db_prociso) y a Roberto Vázquez del seed. Deja las filas de prueba
// con ids propios y las borra al terminar (también si algo falla); al final comprueba que los conteos vuelven a los de
// antes. Si el seed cambió (otro usuario, otra evidencia), ajustá las constantes de abajo.

import { spawn, spawnSync } from 'node:child_process'

const ROBERTO = 'aaaaaaaa-0000-0000-0000-000000000003'
const CONSULTORIA = '11111111-0000-0000-0000-000000000001'
const PROYECTO = '33333333-0000-0000-0000-000000000001'
const EVIDENCIA_VIDEO = '44444444-0000-0000-0000-000000000003'
const ID_PRUEBA = (n) => `c0c0c0c0-0000-0000-0000-${String(n).padStart(12, '0')}`

const psqlArgs = ['exec', '-i', 'supabase_db_prociso', 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1']

function sql(texto) {
  const r = spawnSync('docker', psqlArgs, { input: texto, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`SQL falló: ${r.stderr.trim()}\n${texto.slice(0, 200)}`)
  return r.stdout.trim()
}

// Una conexión que abre una transacción, ejecuta la sentencia y se queda SOSTENIENDO el bloqueo `espera` segundos antes
// de confirmar: así la segunda conexión llega mientras la primera todavía no terminó, que es justo el caso a probar.
function sesion(sentencia, { comoUsuario = null, espera = 2 } = {}) {
  const preludio = comoUsuario
    ? `select set_config('request.jwt.claims', '{"sub":"${comoUsuario}","role":"authenticated"}', true);\nset local role authenticated;\n`
    : ''
  const guion = `\\set VERBOSITY verbose\nbegin;\n${preludio}${sentencia};\nselect pg_sleep(${espera});\ncommit;\n`
  return new Promise((resolver) => {
    const p = spawn('docker', psqlArgs)
    let salida = ''
    let error = ''
    p.stdout.on('data', (d) => (salida += d))
    p.stderr.on('data', (d) => (error += d))
    p.on('close', (codigo) => resolver({ ok: codigo === 0, error: error.trim(), salida: salida.trim() }))
    p.stdin.end(guion)
  })
}

async function escenario(nombre, { preparar, sentencia, comoUsuario, contar, limpiar, codigoEsperado, tope }) {
  console.log(`\n── ${nombre}`)
  const antes = Number(sql(contar))
  try {
    preparar()
    const previo = Number(sql(contar))
    console.log(`   Uso previo: ${previo} de ${tope} (a un pedido del tope)`)
    const [a, b] = await Promise.all([sesion(sentencia(1), { comoUsuario }), sesion(sentencia(2), { comoUsuario })])
    const pasaron = [a, b].filter((r) => r.ok).length
    const rechazados = [a, b].filter((r) => !r.ok)
    const despues = Number(sql(contar))
    console.log(`   Pasaron: ${pasaron} · rechazados: ${rechazados.length} · uso final: ${despues} (tope ${tope})`)
    for (const r of rechazados) console.log(`   Rechazo: ${r.error.split('\n')[0]}`)
    const bien = pasaron === 1 && rechazados.length === 1 && rechazados[0].error.includes(codigoEsperado) && despues === tope
    console.log(bien ? '   ✔ OK: el tope se respetó' : '   ✘ FALLA: el tope se excedió o el rechazo no fue el esperado')
    return bien
  } finally {
    limpiar()
    const final = Number(sql(contar))
    if (final !== antes) console.log(`   ⚠ El conteo no volvió al inicial: ${antes} → ${final}`)
  }
}

const criterio = sql('select id from public.criterios_evaluacion order by id limit 1')
const resultados = []

resultados.push(await escenario('Soporte: 10 reportes por día por usuario', {
  tope: 10,
  codigoEsperado: 'LM429',
  contar: `select count(*) from public.soporte_reportes where usuario_id = '${ROBERTO}' and creado_en > now() - interval '24 hours'`,
  preparar: () => {
    const hoy = Number(sql(`select count(*) from public.soporte_reportes where usuario_id = '${ROBERTO}' and creado_en > now() - interval '24 hours'`))
    for (let i = 1; i <= 9 - hoy; i++) {
      sql(`insert into public.soporte_reportes (id, usuario_id, tipo, asunto, mensaje) values ('${ID_PRUEBA(i)}', '${ROBERTO}', 'Soporte', 'prueba de concurrencia', 'x')`)
    }
  },
  sentencia: (n) => `insert into public.soporte_reportes (id, usuario_id, tipo, asunto, mensaje) values ('${ID_PRUEBA(100 + n)}', '${ROBERTO}', 'Soporte', 'prueba de concurrencia', 'x')`,
  limpiar: () => sql(`delete from public.soporte_reportes where id::text like 'c0c0c0c0-%'`),
}))

resultados.push(await escenario('Transcripciones: 20 pedidos por día por usuario', {
  tope: 20,
  codigoEsperado: 'IA429',
  contar: `select count(*) from private.pedidos_transcripcion where usuario_id = '${ROBERTO}' and creado_en > now() - interval '24 hours'`,
  preparar: () => sql(`insert into private.pedidos_transcripcion (usuario_id) select '${ROBERTO}' from generate_series(1, 19)`),
  comoUsuario: ROBERTO,
  sentencia: () => `select * from public.autorizar_transcripcion('${EVIDENCIA_VIDEO}')`,
  limpiar: () => sql(`delete from private.pedidos_transcripcion where usuario_id = '${ROBERTO}'`),
}))

resultados.push(await escenario('Video: 5 análisis por día por usuario (el más caro)', {
  tope: 5,
  codigoEsperado: 'IA429',
  contar: `select count(*) from public.analisis_ia where solicitado_por = '${ROBERTO}' and modo = 'video' and not sin_consumo and creado_en > now() - interval '24 hours'`,
  preparar: () => {
    for (let i = 1; i <= 4; i++) {
      sql(`insert into public.analisis_ia (id, consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids, solicitado_por, modo, estado)
           values ('${ID_PRUEBA(i)}', '${CONSULTORIA}', '${PROYECTO}', 'evidencia', '${EVIDENCIA_VIDEO}', array['${criterio}']::uuid[], '${ROBERTO}', 'video', 'Error')`)
    }
  },
  sentencia: (n) => `insert into public.analisis_ia (id, consultoria_id, proyecto_id, fuente_tipo, evidencia_id, criterio_ids, solicitado_por, modo, estado)
                     values ('${ID_PRUEBA(100 + n)}', '${CONSULTORIA}', '${PROYECTO}', 'evidencia', '${EVIDENCIA_VIDEO}', array['${criterio}']::uuid[], '${ROBERTO}', 'video', 'Error')`,
  limpiar: () => sql(`delete from public.analisis_ia where id::text like 'c0c0c0c0-%'`),
}))

const ANA = 'aaaaaaaa-0000-0000-0000-000000000002'
resultados.push(await escenario('Invitaciones: 20 por día por administrador', {
  tope: 20,
  codigoEsperado: 'IV429',
  contar: `select count(*) from private.pedidos_invitacion where admin_id = '${ANA}' and creado_en > now() - interval '24 hours'`,
  preparar: () => sql(`insert into private.pedidos_invitacion (admin_id) select '${ANA}' from generate_series(1, 19)`),
  comoUsuario: ANA,
  sentencia: (n) => `select public.autorizar_invitacion('concurrencia${n}@prueba.test', 'consultor', '${CONSULTORIA}', null)`,
  limpiar: () => sql(`delete from private.pedidos_invitacion where admin_id = '${ANA}'`),
}))

console.log(resultados.every(Boolean) ? '\nTodos los topes se respetan con pedidos simultáneos.' : '\nHAY TOPES QUE SE EXCEDEN.')
process.exit(resultados.every(Boolean) ? 0 : 1)
