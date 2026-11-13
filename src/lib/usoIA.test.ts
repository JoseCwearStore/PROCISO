import { describe, expect, it } from 'vitest'
import { adaptarUsoIA, crearServicioUsoIA, estadoUsoIA, estadoUsoVideo, formatearEspera, leyendaTopeIA, leyendaTopeVideo, type UsoIA, type UsoVideo } from './usoIA'

const AHORA = new Date('2026-11-11T12:00:00.000Z')
const enMinutos = (min: number) => new Date(AHORA.getTime() + min * 60_000).toISOString()

const uso = (cambios: Partial<UsoIA> = {}): UsoIA => ({
  usuarioUsados: 10, usuarioTope: 30, usuarioLiberaEn: enMinutos(190),
  consultoriaUsados: 40, consultoriaTope: 150, consultoriaLiberaEn: enMinutos(45),
  ...cambios,
})

describe('adaptarUsoIA (fila de mi_uso_ia → UsoIA)', () => {
  it('traduce las columnas', () => {
    expect(adaptarUsoIA({
      usuario_usados: 12, usuario_tope: 30, usuario_libera_en: '2026-11-11T15:00:00+00:00',
      consultoria_usados: 40, consultoria_tope: 150, consultoria_libera_en: null,
    })).toEqual({
      usuarioUsados: 12, usuarioTope: 30, usuarioLiberaEn: '2026-11-11T15:00:00+00:00',
      consultoriaUsados: 40, consultoriaTope: 150, consultoriaLiberaEn: null,
    })
  })

  it.each([
    ['null', null],
    ['no es un objeto', 'x'],
    ['faltan columnas', { usuario_usados: 1 }],
    ['un número es texto', { usuario_usados: '1', usuario_tope: 30, consultoria_usados: 1, consultoria_tope: 150 }],
  ])('devuelve null si la fila es inválida (%s)', (_caso, fila) => {
    expect(adaptarUsoIA(fila)).toBeNull()
  })
})

// O14: el consumo del tope de VIDEO (5 por usuario / 15 por consultoría al día) viaja en las mismas filas de mi_uso_ia.
describe('adaptarUsoIA: consumo de video (O14)', () => {
  const FILA = {
    usuario_usados: 12, usuario_tope: 30, usuario_libera_en: null,
    consultoria_usados: 40, consultoria_tope: 150, consultoria_libera_en: null,
  }

  it('traduce las columnas de video', () => {
    const r = adaptarUsoIA({ ...FILA, video_usuario_usados: 2, video_usuario_tope: 5, video_consultoria_usados: 7, video_consultoria_tope: 15 })
    expect(r?.video).toEqual({ usuarioUsados: 2, usuarioTope: 5, consultoriaUsados: 7, consultoriaTope: 15 })
  })

  it('una fila sin columnas de video (o con alguna rota) sigue funcionando, sin video', () => {
    expect(adaptarUsoIA(FILA)?.video).toBeUndefined()
    expect(adaptarUsoIA({ ...FILA, video_usuario_usados: 2, video_usuario_tope: 5 })?.video).toBeUndefined()
    expect(adaptarUsoIA({ ...FILA, video_usuario_usados: '2', video_usuario_tope: 5, video_consultoria_usados: 7, video_consultoria_tope: 15 })?.video).toBeUndefined()
  })

  it.each(['video_usuario_usados', 'video_usuario_tope', 'video_consultoria_usados', 'video_consultoria_tope'])(
    'si falta o está roto solo %s, no se inventa el consumo de video', (campo) => {
      const completa = { ...FILA, video_usuario_usados: 2, video_usuario_tope: 5, video_consultoria_usados: 7, video_consultoria_tope: 15 }
      expect(adaptarUsoIA({ ...completa, [campo]: undefined })?.video, `${campo} ausente`).toBeUndefined()
      expect(adaptarUsoIA({ ...completa, [campo]: '3' })?.video, `${campo} como texto`).toBeUndefined()
      expect(adaptarUsoIA({ ...completa, [campo]: null })?.video, `${campo} nulo`).toBeUndefined()
    },
  )

  it('lo de video no cambia el consumo general', () => {
    const r = adaptarUsoIA({ ...FILA, video_usuario_usados: 2, video_usuario_tope: 5, video_consultoria_usados: 7, video_consultoria_tope: 15 })
    expect(r).toMatchObject({ usuarioUsados: 12, usuarioTope: 30, consultoriaUsados: 40, consultoriaTope: 150 })
  })
})

describe('estadoUsoVideo (¿se puede pedir otro análisis de video?)', () => {
  const video = (cambios: Partial<UsoVideo> = {}): UsoVideo => ({ usuarioUsados: 2, usuarioTope: 5, consultoriaUsados: 7, consultoriaTope: 15, ...cambios })

  it('con cupo no avisa nada', () => {
    expect(estadoUsoVideo(video())).toEqual({ agotado: false, mensaje: null })
  })

  it('sin datos de video (la BD no los mandó) no bloquea ni inventa mensajes', () => {
    expect(estadoUsoVideo(undefined)).toEqual({ agotado: false, mensaje: null })
  })

  it('el último cupo del usuario todavía se puede usar (4 de 5)', () => {
    expect(estadoUsoVideo(video({ usuarioUsados: 4 })).agotado).toBe(false)
  })

  it('con 5 de 5 el usuario está agotado, con el mismo mensaje que da la BD', () => {
    expect(estadoUsoVideo(video({ usuarioUsados: 5 }))).toEqual({
      agotado: true, mensaje: 'Alcanzaste el tope diario de análisis de video (5 por usuario). Inténtalo mañana.',
    })
  })

  it('pasarse de lo contado (carrera) sigue siendo agotado', () => {
    expect(estadoUsoVideo(video({ usuarioUsados: 6 })).agotado).toBe(true)
  })

  it('con 15 de 15 la consultoría está agotada, aunque el usuario no haya pedido nada', () => {
    expect(estadoUsoVideo(video({ usuarioUsados: 0, consultoriaUsados: 15 }))).toEqual({
      agotado: true, mensaje: 'Tu consultoría alcanzó el tope diario de análisis de video (15). Inténtalo mañana.',
    })
  })

  it('si ambos están agotados manda el del usuario', () => {
    expect(estadoUsoVideo(video({ usuarioUsados: 5, consultoriaUsados: 15 })).mensaje).toMatch(/por usuario/)
  })

  it('un tope de 0 (video apagado) cuenta como agotado, no como cupo infinito', () => {
    expect(estadoUsoVideo(video({ usuarioUsados: 0, usuarioTope: 0 })).agotado).toBe(true)
  })
})

describe('leyendaTopeVideo', () => {
  it('con datos, dice los topes de video de la BD', () => {
    expect(leyendaTopeVideo({ usuarioUsados: 0, usuarioTope: 5, consultoriaUsados: 0, consultoriaTope: 15 }))
      .toBe('Análisis de video: 5 por usuario y 15 por consultoría al día.')
  })

  it('sin datos no inventa números', () => {
    expect(leyendaTopeVideo(undefined)).toBeNull()
  })
})

describe('formatearEspera', () => {
  it.each([
    [0, 'menos de 1 min'],
    [59_000, 'menos de 1 min'],
    [60_000, '1 min'],
    [5 * 60_000, '5 min'],
    [65 * 60_000, '1 h 5 min'],
    [120 * 60_000, '2 h'],
    [-1000, 'menos de 1 min'],
  ])('%i ms → %s', (ms, texto) => {
    expect(formatearEspera(ms)).toBe(texto)
  })
})

describe('estadoUsoIA', () => {
  it('con consumo bajo es normal y no molesta con un mensaje', () => {
    expect(estadoUsoIA(uso(), AHORA)).toMatchObject({ nivel: 'normal', agotado: false, limitante: null, restantes: 20, mensaje: null })
  })

  it('avisa al llegar al 80 % del tope del usuario (24 de 30), no antes', () => {
    expect(estadoUsoIA(uso({ usuarioUsados: 23 }), AHORA).nivel).toBe('normal')
    const e = estadoUsoIA(uso({ usuarioUsados: 24 }), AHORA)
    expect(e).toMatchObject({ nivel: 'aviso', agotado: false, restantes: 6 })
    expect(e.mensaje).toMatch(/te quedan 6 pedidos/i)
  })

  it('avisa también por el 80 % de la consultoría (120 de 150) y cuenta lo que queda de ella', () => {
    expect(estadoUsoIA(uso({ consultoriaUsados: 119 }), AHORA).nivel).toBe('normal')
    const e = estadoUsoIA(uso({ consultoriaUsados: 140 }), AHORA)
    expect(e).toMatchObject({ nivel: 'aviso', restantes: 10 })
    expect(e.mensaje).toMatch(/consultoría/i)
  })

  it('con 1 pedido restante habla en singular', () => {
    expect(estadoUsoIA(uso({ usuarioUsados: 29 }), AHORA).mensaje).toMatch(/te queda 1 pedido\b/i)
  })

  it('agotado por el tope del usuario: dice el tope y cuándo se libera un cupo', () => {
    const e = estadoUsoIA(uso({ usuarioUsados: 30 }), AHORA)
    expect(e).toMatchObject({ nivel: 'agotado', agotado: true, limitante: 'usuario', restantes: 0 })
    expect(e.mensaje).toMatch(/30 por usuario/)
    expect(e.mensaje).toMatch(/3 h 10 min/)
  })

  it('agotado por el tope de la consultoría (aunque el usuario casi no haya pedido)', () => {
    const e = estadoUsoIA(uso({ usuarioUsados: 2, consultoriaUsados: 150 }), AHORA)
    expect(e).toMatchObject({ nivel: 'agotado', agotado: true, limitante: 'consultoria', restantes: 0 })
    expect(e.mensaje).toMatch(/consultoría/i)
    expect(e.mensaje).toMatch(/150/)
    expect(e.mensaje).toMatch(/45 min/)
  })

  it('si ambos están agotados manda el del usuario', () => {
    expect(estadoUsoIA(uso({ usuarioUsados: 30, consultoriaUsados: 150 }), AHORA).limitante).toBe('usuario')
  })

  it('si falta la fecha de liberación el mensaje no inventa una hora', () => {
    const e = estadoUsoIA(uso({ usuarioUsados: 30, usuarioLiberaEn: null }), AHORA)
    expect(e.agotado).toBe(true)
    expect(e.mensaje).not.toMatch(/\d+ min|\d+ h/)
  })

  it('una liberación ya vencida dice "menos de 1 min"', () => {
    expect(estadoUsoIA(uso({ usuarioUsados: 30, usuarioLiberaEn: enMinutos(-5) }), AHORA).mensaje).toMatch(/menos de 1 min/)
  })

  it('pasarse de lo contado (carrera) sigue siendo agotado, nunca restantes negativos', () => {
    expect(estadoUsoIA(uso({ usuarioUsados: 33 }), AHORA)).toMatchObject({ agotado: true, restantes: 0 })
  })
})

describe('leyendaTopeIA (la leyenda fija que ve el equipo)', () => {
  it('con datos, dice los topes reales de la BD', () => {
    expect(leyendaTopeIA(uso())).toBe('Tope diario de IA: 30 pedidos por usuario y 150 por consultoría (últimas 24 horas).')
  })

  it('sin datos (todavía no cargó o falló) no inventa números', () => {
    const t = leyendaTopeIA(null)
    expect(t).toMatch(/tope diario/i)
    expect(t).not.toMatch(/\d/)
  })
})

describe('crearServicioUsoIA', () => {
  it('lee mi_uso_ia y devuelve el uso', async () => {
    const llamadas: string[] = []
    const servicio = crearServicioUsoIA({
      rpc: async (f) => {
        llamadas.push(f)
        return { data: [{ usuario_usados: 3, usuario_tope: 30, usuario_libera_en: null, consultoria_usados: 9, consultoria_tope: 150, consultoria_libera_en: null }], error: null }
      },
    })

    expect(await servicio.leer()).toMatchObject({ usuarioUsados: 3, consultoriaUsados: 9 })
    expect(llamadas).toEqual(['mi_uso_ia'])
  })

  it.each([
    ['la BD devuelve un error (p. ej. un cliente)', { data: null, error: { message: 'x' } }],
    ['la BD devuelve un error aunque venga una fila (no se confía en los datos)', {
      data: [{ usuario_usados: 3, usuario_tope: 30, usuario_libera_en: null, consultoria_usados: 9, consultoria_tope: 150, consultoria_libera_en: null }],
      error: { message: 'x' },
    }],
    ['no hay filas', { data: [], error: null }],
    ['la fila es inválida', { data: [{ foo: 1 }], error: null }],
  ])('devuelve null si %s (la pantalla sigue con la leyenda)', async (_caso, respuesta) => {
    expect(await crearServicioUsoIA({ rpc: async () => respuesta }).leer()).toBeNull()
  })

  it('si la llamada revienta (sin red) devuelve null en vez de romper la pantalla', async () => {
    expect(await crearServicioUsoIA({ rpc: async () => { throw new Error('Failed to fetch') } }).leer()).toBeNull()
  })
})
