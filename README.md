# PROCISO

Plataforma web de apoyo para consultorías **ISO 9001:2026**. Las empresas responden preguntas guiadas y suben evidencias; la IA genera **borradores** y hace **preevaluaciones** de documentos y evidencias; un **consultor humano** revisa y valida. No certifica nada: es un proyecto escolar con fines académicos.

Es multi-tenant (PROCISO → Consultorías → Empresas) y cada consultoría ve solo lo suyo, garantizado por RLS en la base.

**Stack:** React 19 + Vite + Tailwind CSS 4 (frontend) · Supabase local (Auth, Postgres 17, Storage y Edge Functions con Deno) · Vitest y pgTAP (pruebas).

> **Estado de verificación (léelo):** se desarrolló y probó en **Windows 11**. Este README **todavía no se ha seguido desde una instalación limpia**: si un paso falla, es un error del README y conviene reportarlo. Los pasos con `(sin verificar)` no se comprobaron. El trabajo `base-de-datos` del CI nunca corrió en GitHub.

---

## 1. Qué necesitas instalar

| Programa | Versión | Para qué | Cómo comprobarlo |
|---|---|---|---|
| **Git** | cualquiera reciente | descargar el repo | `git --version` |
| **Node.js** | **22** (probado con 22.23.4) | frontend y herramientas | `node --version` |
| **pnpm** | **10.34.3** | instalar dependencias | `pnpm --version` |
| **Docker Desktop** | reciente (probado con motor 29.7.2), **encendido** | Supabase local corre en contenedores | `docker --version` y `docker ps` |
| **Supabase CLI** | **2.122.1 exacta** (no se instala: se usa con `npx`) | base de datos local y funciones | ver abajo |

**Importante — versión de la CLI de Supabase:** usa siempre `npx -y supabase@2.122.1 ...`. La 3.x **rompe el contenedor de la base** (por eso el CI también la fija en 2.122.1). No uses una `supabase` global distinta.

Instalar pnpm (si no lo tienes):

```bash
npm install -g pnpm@10.34.3
```

Si usas [mise](https://mise.jdx.dev), el archivo `.mise.toml` ya fija Node 22 y pnpm 10.34.3: basta con `mise install`.

Puertos que deben estar libres: **54321** (API), **54322** (base de datos), **54323** (Studio), **54324** (correo de prueba) y **5173** (la app).

## 2. Descargar e instalar dependencias

```bash
git clone https://github.com/JoseCwearStore/PROCISO.git
cd PROCISO
pnpm install --frozen-lockfile
```

## 3. Levantar la base de datos local

Con Docker Desktop encendido:

```bash
npx -y supabase@2.122.1 start
```

La primera vez descarga las imágenes de Docker, así que puede tardar. Al terminar muestra las URLs y las claves locales. Aplica las **52 migraciones** de `supabase/migrations/`.

Si más adelante no ves los usuarios de prueba (sección 7), recrea la base con la semilla `(sin verificar si el primer start ya la carga)`:

```bash
npx -y supabase@2.122.1 db reset --local
```

> `db reset` **borra todos los datos locales** y vuelve a cargar `supabase/seed.sql`. Úsalo solo en tu máquina.

## 4. Variables de entorno

Los archivos `.env*` **no se suben al repo** y **este repositorio no incluye ninguna clave**: cada persona pone las suyas.

### 4.1 Frontend

Copia `.env.example` a `.env.local` y completa la clave:

```bash
cp .env.example .env.local
```

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `http://127.0.0.1:54321` (ya viene en el ejemplo) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | la clave **publishable** (o `anon`) que imprime `npx -y supabase@2.122.1 status` `(el nombre exacto de la clave depende de la versión: sin verificar)` |

### 4.2 Funciones de IA (Edge Functions)

Copia `supabase/functions/.env.example` a `supabase/functions/.env`:

```bash
cp supabase/functions/.env.example supabase/functions/.env
```

| Variable | Qué es |
|---|---|
| `IA_PROVEEDOR` | `openai-compatible` (viene así) |
| `IA_BASE_URL` | `https://api.groq.com/openai/v1` |
| `IA_MODELO` | modelo de texto e imágenes. Viene `qwen/qwen3.8-27b` (Groq, **Preview**) |
| `IA_VISION` | `true` solo si el modelo acepta imágenes. Con `openai/gpt-oss-120b` debe ser `false` (no acepta imágenes) |
| `IA_API_KEY` | **tu** clave de [Groq](https://console.groq.com) |
| `IA_STT_BASE_URL`, `IA_STT_MODELO` | transcripción de audio (viene `whisper-large-v3-turbo` en Groq) |
| `IA_STT_API_KEY` | **tu** clave de Groq (puede ser la misma) |
| `IA_VIDEO_MODELO` | viene `gemini-3.6-flash` (Google) |
| `IA_VIDEO_API_KEY` | **tu** clave de [Google AI Studio](https://aistudio.google.com) para analizar video |
| `IA_MAX_CARACTERES` | opcional: tope de caracteres a analizar |

Las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase a las funciones; no las pongas tú.

Sin claves de IA, lo esperable es que solo fallen los botones de IA (análisis, borradores, transcripción y video) `(sin verificar)`.

Para que las funciones tomen el archivo, sírvelas así (deja la terminal abierta):

```bash
npx -y supabase@2.122.1 functions serve --env-file supabase/functions/.env
```

Cada vez que cambies el `.env`, **reinicia** ese comando: las funciones lo leen al arrancar.

## 5. Arrancar la app

```bash
pnpm dev
```

Abre <http://localhost:5173>.

## 6. Verificar que todo está bien

```bash
pnpm verify      # tipos (tsc) + pruebas Vitest
pnpm test:db     # pruebas pgTAP de la base (necesita Supabase local encendido)
```

## 7. Usuarios de prueba

Los crea `supabase/seed.sql`. **Todos usan la misma contraseña de prueba: `Prociso2026!`** (solo para uso local).

| Correo | Rol |
|---|---|
| `admin@prociso.test` | Admin PROCISO |
| `ana@cowin.test` | Admin Consultoría (COWIN) |
| `roberto@cowin.test` | Consultor (COWIN) |
| `carlos@marketino.test` | Cliente (Marketino) |

Hay más usuarios para probar el aislamiento entre consultorías (`lucia@jaza.test`, `laura@consultoria2.test`, `pedro@norte.test`, `maria@cowin.test`, `jorge@cowin.test`); su rol está en `supabase/seed.sql`.

El correo de prueba (invitaciones, recuperar contraseña) llega a la bandeja local de Supabase: <http://127.0.0.1:54324>.

## 8. Reglas de uso de la IA

- **Videos:** máximo **10 minutos** y **200 MB**; se **recomiendan hasta 5 minutos**. Entre 5 y 10 aparece un aviso de que puede fallar por tiempo de espera. Los de más de 10 se bloquean antes de gastar cupo.
- **Topes diarios:** 30 pedidos de IA por usuario y 150 por consultoría; aparte, 5 análisis de video por usuario y 15 por consultoría (cada intento fallido cuenta).
- **Imágenes:** exigen un modelo con visión (`IA_VISION=true`).
- Todo resultado de IA es una **preevaluación**: requiere revisión humana y no es un dictamen.
- Audio y video salen de la plataforma hacia un proveedor externo para transcribirse o analizarse.

## 9. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `supabase start` falla o la base no arranca | ¿Docker Desktop está encendido (`docker ps`)? ¿Usaste la CLI **2.122.1** y no la 3.x? ¿Los puertos 54321–54324 están libres? |
| La app dice «Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY» | Falta crear `.env.local` (sección 4.1) y reiniciar `pnpm dev`. |
| No puedes iniciar sesión con un usuario de prueba | La semilla no se cargó: `npx -y supabase@2.122.1 db reset --local`. |
| Un botón de IA falla con «no acepta imágenes» | `IA_VISION` debe ser `true` **y** el modelo debe tener visión (`qwen/qwen3.8-27b`, no `gpt-oss-120b`). |
| Un botón de IA falla con «clave» o «401» | Falta o es inválida la clave en `supabase/functions/.env`; reinicia `functions serve`. |

## 10. Estructura

```
src/                  aplicación React (páginas, componentes, lib con la lógica)
supabase/migrations/  esquema, RLS y reglas de negocio (52 migraciones)
supabase/functions/   Edge Functions: analizar-ia, generar-documento, transcribir-evidencia, invitar-usuario
supabase/tests/       pruebas pgTAP
supabase/seed.sql     datos de demostración y usuarios de prueba
herramientas/         scripts de apoyo (no forman parte de la app; ver su README)
```
