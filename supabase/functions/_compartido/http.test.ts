import { describe, expect, it } from 'vitest'
import { ErrorIA } from './analisis.ts'
import { crearCors, esUuid, estadoDe, mensajeDeBD, motivoSaneado, responderCon } from './http.ts'

describe('estadoDe (código de la BD → estado HTTP)', () => {
  it.each([
    ['42501', 403], // sin permiso
    ['22023', 400], // regla de negocio (parámetro inválido)
    ['22P02', 400], // texto que no es un uuid / valor mal formado
    ['23503', 400], // clave foránea
    ['23514', 400], // check
    ['23502', 400], // not null
    ['IA429', 429], // tope diario de pedidos a la IA (L4)
    ['XX000', 500],
    [undefined, 500],
  ])('%s → %i', (code, esperado) => {
    expect(estadoDe(code)).toBe(esperado)
  })
})

describe('mensajeDeBD (qué se le muestra a quien llama)', () => {
  it('deja pasar el mensaje de nuestras reglas (permiso, regla de negocio, tope)', () => {
    expect(mensajeDeBD({ code: '42501', message: 'No tenés permiso para invitar' })).toBe('No tenés permiso para invitar')
    expect(mensajeDeBD({ code: '22023', message: 'Ese email ya existe' })).toBe('Ese email ya existe')
    expect(mensajeDeBD({ code: 'IA429', message: 'Llegaste al tope diario' })).toBe('Llegaste al tope diario')
  })

  it('un rechazo del RLS o de los permisos de tabla (42501 de Postgres) NO muestra el nombre de la tabla', () => {
    const rls = mensajeDeBD({ code: '42501', message: 'new row violates row-level security policy for table "analisis_ia"' })
    const tabla = mensajeDeBD({ code: '42501', message: 'permission denied for table generaciones_ia' })

    expect(rls).not.toContain('analisis_ia')
    expect(tabla).not.toContain('generaciones_ia')
    expect(rls).toMatch(/permiso/i)
  })

  it('no filtra el texto interno de Postgres en los errores de formato ni en los inesperados', () => {
    const interno = 'invalid input syntax for type uuid: "xyz"'
    expect(mensajeDeBD({ code: '22P02', message: interno })).not.toContain('uuid')
    expect(mensajeDeBD({ code: '23502', message: 'null value in column "criterio_ids"' })).not.toContain('criterio_ids')
    expect(mensajeDeBD({ code: 'XX000', message: 'relation "x" does not exist' })).not.toContain('relation')
    expect(mensajeDeBD({ code: undefined, message: undefined })).toBeTruthy()
  })
})

describe('esUuid', () => {
  it('acepta uuids y rechaza todo lo demás', () => {
    expect(esUuid('22222222-0000-0000-0000-000000000001')).toBe(true)
    expect(esUuid('xyz')).toBe(false)
    expect(esUuid('')).toBe(false)
    expect(esUuid(null)).toBe(false)
    expect(esUuid(42)).toBe(false)
    expect(esUuid('22222222-0000-0000-0000-00000000000g')).toBe(false)
  })
})

describe('motivoSaneado (lo que se guarda en error_detalle y lee el cliente)', () => {
  it('deja el mensaje de un ErrorIA (ya es accionable y sin detalle técnico)', () => {
    expect(motivoSaneado(new ErrorIA('El PDF no tiene texto.'))).toBe('El PDF no tiene texto.')
  })

  it('NO guarda el mensaje de un error inesperado: puede traer URLs, claves o detalles internos', () => {
    const motivo = motivoSaneado(new Error('fetch failed https://ollama.com/v1 key=sk-secreta'))
    expect(motivo).not.toContain('ollama')
    expect(motivo).not.toContain('sk-secreta')
    expect(motivo).toMatch(/inesperado/i)
  })

  it('un valor que no es un Error tampoco se filtra', () => {
    expect(motivoSaneado('texto crudo con secreto')).not.toContain('secreto')
  })
})

describe('crearCors / responderCon', () => {
  it('sin origen configurado deja * (desarrollo local)', () => {
    expect(crearCors(undefined)['Access-Control-Allow-Origin']).toBe('*')
  })

  it('con origen configurado lo restringe a ese dominio', () => {
    expect(crearCors('https://app.prociso.mx')['Access-Control-Allow-Origin']).toBe('https://app.prociso.mx')
  })

  it('responde JSON con el estado y los encabezados de CORS', async () => {
    const r = responderCon(crearCors('https://app.prociso.mx'))(418, { error: 'x' })
    expect(r.status).toBe(418)
    expect(r.headers.get('Content-Type')).toBe('application/json')
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://app.prociso.mx')
    expect(await r.json()).toEqual({ error: 'x' })
  })
})
