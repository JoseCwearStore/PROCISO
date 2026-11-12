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

// AUD07-M2 (L5a): el sistema SÍ guarda todo en Supabase. La interfaz no puede decir que es un
// prototipo sin servidor ni ofrecer controles que no hacen nada ("Requiere integración").
describe('textos de la interfaz (AUD07-M2)', () => {
  const fuentes = archivos(SRC).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
  const conTexto = (patron: RegExp) =>
    fuentes
      .filter((f) => patron.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/'))

  it.each([
    ['dice que es un prototipo', /prototipo/i],
    ['dice que los datos son ficticios', /datos ficticios/i],
    ['ofrece algo que "Requiere integración"', /requieren? integraci[oó]n/i],
    ['avisa un registro "en modo demostrativo"', /demostrativ/i],
    ['marca textos como DEMO', /DEMO ·/],
    ['inventa incidencias de integración', /inc-demo/],
  ])('ningún archivo de la app %s', (_caso, patron) => {
    expect(conTexto(patron)).toEqual([])
  })

  it('no existen los componentes de la maqueta (DemoBanner, PlaceholderPage)', () => {
    expect(existsSync(join(SRC, 'components', 'DemoBanner.tsx'))).toBe(false)
    expect(existsSync(join(SRC, 'pages', 'PlaceholderPage.tsx'))).toBe(false)
  })

  it('ninguna pantalla trae escrito el nombre de otra consultoría (ConsultiCalidad) ni un RFC de maqueta', () => {
    expect(conTexto(/ConsultiCalidad|CCA210401HX7/)).toEqual([])
  })

  it('Configuración no tiene controles inertes (sesión inactiva, doble factor, "guardada durante esta sesión")', () => {
    expect(conTexto(/Tiempo de sesión inactiva|Autenticación de dos factores|durante esta sesión/)).toEqual([])
  })

  it('la matriz de permisos no está escrita a mano en Usuarios (se deriva de permissions.ts)', () => {
    expect(readFileSync(join(SRC, 'pages', 'Usuarios.tsx'), 'utf8')).not.toMatch(/const PERMISOS|const MODULOS/)
  })

  it('el estado de la app ya no guarda si se cerró el banner', () => {
    expect(conTexto(/bannerDismissed|DISMISS_BANNER/)).toEqual([])
  })
})
