// AUD08-B1 / AUD08-B2: que el código muerto no vuelva a entrar a src/.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname)

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivos(join(dir, e.name)) : [join(dir, e.name)],
  )
}

describe('higiene de src/', () => {
  it('los datos de demo viven en herramientas/, no en src/ (AUD08-B2)', () => {
    expect(existsSync(join(SRC, 'data', 'demo.ts'))).toBe(false)
    expect(existsSync(resolve(SRC, '..', 'herramientas', 'demo.ts'))).toBe(true)
  })

  it('ningún archivo de la app importa los datos de demo', () => {
    const infractores = archivos(SRC)
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('higiene.test.ts'))
      .filter((f) => /from\s+['"][^'"]*\/demo['"]/.test(readFileSync(f, 'utf8')))
    expect(infractores).toEqual([])
  })

  it('no queda la pantalla Tareas.tsx sin uso (la ruta es TableroTareas) (AUD08-B1)', () => {
    expect(existsSync(join(SRC, 'pages', 'Tareas.tsx'))).toBe(false)
  })
})
