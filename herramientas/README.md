# Herramientas

Scripts de apoyo para generar datos del proyecto. **No forman parte de la app**: no se
despliegan ni los importa nada de `src/`.

## Preparación

Solo el generador de criterios necesita una dependencia (`exceljs`), por eso esta carpeta
tiene su propio `package.json` y no se mezcla con el de la app:

```bash
cd herramientas
npm ci
```

Los generadores `.mts` no necesitan instalación: corren con `npx -y tsx@4.20.6`.

## Qué hace cada una

| Herramienta | Para qué | Entrada | Salida |
|---|---|---|---|
| `generar_migracion_criterios.mjs` | Genera la migración de **datos** de `criterios_evaluacion` a partir del Excel de criterios | `<matriz.xlsx> <salida.sql> [edicion]` | un `.sql` de migración |
| `generar_seed_procesos.mts` | Bloque `INSERT` de `procesos` del seed | `<demo.ts>` | SQL por stdout |
| `generar_seed_evidencias.mts` | Ídem, `evidencias` | `<demo.ts>` | SQL por stdout |
| `generar_seed_documentos.mts` | Ídem, `documentos` y sus versiones | `<demo.ts>` | SQL por stdout |
| `generar_seed_tareas.mts` | Ídem, `tareas` (con fechas relativas a `current_date`) | `<demo.ts>` | SQL por stdout |
| `generar_seed_no_conformidades.mts` | Ídem, `no_conformidades` | `<demo.ts>` | SQL por stdout |
| `generar_seed_entregables.mts` | Ídem, `entregables` | `<demo.ts>` | SQL por stdout |
| `cargar_archivos_demo.mjs` | Sube un archivo real a las evidencias 1–4 del seed (O15). **Correr después de cada `db reset`**; `--video ruta.mp4` para la evidencia 3 | Supabase LOCAL (`status -o env`) | Storage + columnas `archivo_*` |
| `probar_concurrencia_topes.mjs` | Prueba con DOS conexiones a la vez que los topes diarios (soporte, transcripciones, video) no se pasan; limpia lo que crea (AUD10-M5/M6) | BD LOCAL por `docker exec` (usa a Roberto del seed) | consola; sale con 1 si un tope se excede |
| `puente_ids.mjs` | Reescribió los IDs de demo (`proc-001`…) a los UUID del seed | `<carpeta>` | reescribe archivos **in situ** |

Ejemplos, desde la raíz del repo:

```bash
# Un bloque del seed (el SQL sale por pantalla; redirigilo si lo querés en un archivo)
npx -y tsx@4.20.6 herramientas/generar_seed_procesos.mts herramientas/demo.ts

# La migración de criterios (el Excel vive fuera del repo)
node herramientas/generar_migracion_criterios.mjs <ruta>/matriz_criterios_iso_9001_2015_revisada.xlsx \
  supabase/migrations/<timestamp>_criterios_evaluacion_datos.sql
```

## Cosas que hay que saber

- **`supabase/seed.sql` es la fuente de verdad.** Los generadores solo producen los bloques
  `INSERT` que se pegaron ahí; el seed tiene además partes escritas a mano (por ejemplo, el
  `update` que asigna el tipo a los procesos). Si regenerás un bloque, compará con el seed y
  pegá a mano: no lo sobrescribas entero.
- **Los generadores `generar_seed_*` leen `herramientas/demo.ts`.** Vivía en `src/data/`, pero
  ninguna pantalla lo usa: se movió acá (AUD08-B2) para que `src/` no lo importe por error
  (`src/higiene.test.ts` lo vigila). **Si se elimina `demo.ts`, estos generadores dejan de
  funcionar.** Importa los tipos de `../src/types`.
- **`puente_ids.mjs` reescribe archivos.** Se corrió una sola vez y ya está aplicado: es
  idempotente (sobre el `demo.ts` actual no cambia nada). No lo corras sobre el repo sin tener
  el árbol limpio en git.
- **El Excel de criterios está fuera del repo** (`D:\PROCISO\matriz_criterios_iso_9001_2015_revisada.xlsx`).
  Es la única fuente de los criterios: si cambia, se genera una migración **nueva** con otro
  timestamp (hace upsert por `(edicion, clausula)`); nunca se edita la ya aplicada.
- **`npm audit` marca 2 avisos moderados** (`exceljs` → `uuid`). Es una herramienta local que
  solo lee tu propio Excel y no se despliega; no se corrigió con `--force` porque bajaría
  `exceljs` a una versión incompatible.

## Cómo se verificó que siguen funcionando

El 2026-11-09, ya movidas al repo: el generador de criterios reprodujo **idéntica** la migración
`20261108050100` (62 criterios, 332 líneas, mismo hash del Excel; solo cambia la línea de
encabezado con la ruta). Los seis generadores del seed reprodujeron **todas** sus filas
textuales en `supabase/seed.sql`. Al verificarlo, tres de ellos (procesos, evidencias,
documentos) estaban rotos contra el `demo.ts` actual, porque intentaban convertir IDs que ya
eran UUID; ahora son idempotentes, igual que los otros tres.
