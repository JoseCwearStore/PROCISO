// Reemplaza los IDs de demo ('usr-001', 'proy-001'...) por los UUID del seed,
// solo cuando aparecen exactos entre comillas simples.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const MAPA = {
  'cons-001': '11111111-0000-0000-0000-000000000001',
  'emp-001': '22222222-0000-0000-0000-000000000001',
  'emp-002': '22222222-0000-0000-0000-000000000002',
  'proy-001': '33333333-0000-0000-0000-000000000001',
  'proy-002': '33333333-0000-0000-0000-000000000002',
  'proy-003': '33333333-0000-0000-0000-000000000004',
  'usr-admin': 'aaaaaaaa-0000-0000-0000-000000000001',
  'usr-001': 'aaaaaaaa-0000-0000-0000-000000000002',
  'usr-002': 'aaaaaaaa-0000-0000-0000-000000000003',
  'usr-003': 'aaaaaaaa-0000-0000-0000-000000000004',
  'usr-004': 'aaaaaaaa-0000-0000-0000-000000000005',
  'usr-005': 'aaaaaaaa-0000-0000-0000-000000000006',
  'usr-006': 'aaaaaaaa-0000-0000-0000-000000000009',
}
// Entregables: ent-001..ent-014 → bbbb…001..014 (ver generar_seed_entregables.mts).
for (let i = 1; i <= 14; i++) {
  MAPA[`ent-${String(i).padStart(3, '0')}`] = `bbbbbbbb-0000-0000-0000-${String(i).padStart(12, '0')}`
}
// No conformidades: nc-001..nc-003 → 8888…001..003 (ver generar_seed_no_conformidades.mts).
for (let i = 1; i <= 3; i++) {
  MAPA[`nc-${String(i).padStart(3, '0')}`] = `88888888-0000-0000-0000-${String(i).padStart(12, '0')}`
}
// Tareas: tar-001..tar-020 → 7777…001..020 (ver generar_seed_tareas.mts).
for (let i = 1; i <= 20; i++) {
  MAPA[`tar-${String(i).padStart(3, '0')}`] = `77777777-0000-0000-0000-${String(i).padStart(12, '0')}`
}

const raiz = process.argv[2]
const patron = new RegExp(`'(${Object.keys(MAPA).join('|')})'`, 'g')
let total = 0

function recorrer(dir) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) recorrer(ruta)
    else if (/\.(ts|tsx)$/.test(nombre)) {
      const antes = readFileSync(ruta, 'utf8')
      let n = 0
      const despues = antes.replace(patron, (_, id) => (n++, `'${MAPA[id]}'`))
      if (n > 0) {
        writeFileSync(ruta, despues)
        console.log(`${String(n).padStart(4)}  ${ruta}`)
        total += n
      }
    }
  }
}

recorrer(raiz)
console.log(`${String(total).padStart(4)}  TOTAL`)
