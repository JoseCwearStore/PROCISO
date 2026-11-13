import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// E10: el HTML traía `lang="<!-- figma:lang -->"`, un marcador que el plugin de Figma Make reemplaza por "en": Chrome le
// ofrecía traducir la página a quien la abre, aunque toda la app está en español. Con el idioma escrito a mano no hay
// marcador que reemplazar. (Los otros marcadores figma:* son anclas del plugin y se quedan.)
describe('index.html', () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8')

  it('declara el idioma español en la etiqueta html', () => {
    expect(html).toMatch(/<html[^>]*\slang="es"/)
  })

})
