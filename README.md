# PROCISO

Plataforma web de apoyo para consultorías **ISO 9001:2026**. Las empresas responden preguntas guiadas y suben evidencias; la IA genera **borradores** y hace **preevaluaciones** de documentos y evidencias; un **consultor humano** revisa y valida. No certifica nada: es un proyecto escolar con fines académicos.

Es multi-tenant (PROCISO → Consultorías → Empresas) y cada consultoría ve solo lo suyo, garantizado por RLS en la base.

**Stack:** React 19 + Vite + Tailwind CSS 4 (frontend) · Supabase local (Auth, Postgres 17, Storage y Edge Functions con Deno) · Vitest y pgTAP (pruebas).

> **Estado de verificación**
>
> - **Windows 11:** instalación limpia verificada de punta a punta (52 migraciones, 9 usuarios de prueba, login, 1306 pruebas y 870 pruebas pgTAP).
> - **Linux:** el script `iniciar-red.sh` está probado en bash 5 (Debian) para detección de IP, puerto ocupado, reescritura de config y detección de la clave de IA. El arranque real de Supabase con Docker se verificó solo en Windows.
> - **macOS:** el script es compatible con bash 3.2+, pero **no se ejecutó en un Mac real**. Si algo falla ahí, es un bug del script y conviene reportarlo.

---

## Índice

1. [Instalación rápida](#1-instalación-rápida)
2. [Programas, versiones y orden](#2-programas-versiones-y-orden)
3. [Descargar e instalar dependencias](#3-descargar-e-instalar-dependencias)
4. [Arrancar PROCISO](#4-arrancar-prociso)
5. [Instalación manual (sin script)](#5-instalación-manual-sin-script)
6. [Variables de entorno](#6-variables-de-entorno)
7. [Verificar que todo está bien](#7-verificar-que-todo-está-bien)
8. [Usuarios de prueba](#8-usuarios-de-prueba)
9. [Problemas frecuentes](#9-problemas-frecuentes)
10. [Limitaciones conocidas](#10-limitaciones-conocidas)
11. [Seguridad en red local](#11-seguridad-en-red-local)
12. [Estructura](#12-estructura)

---

## 1. Instalación rápida

Elegí tu sistema. Son **los mismos 6 pasos** en todos: Git → Node → pnpm → Docker → clonar → script.

### Windows (PowerShell)

```powershell
winget install Git.Git
winget install Docker.DockerDesktop
```

Después instalá **Node.js 22** desde <https://nodejs.org> (o, si usás [mise](https://mise.jdx.dev), `mise install` en la carpeta del proyecto) y reiniciá la sesión para que Docker y los comandos queden en el PATH.

```powershell
npm install -g pnpm@10.34.3
git clone https://github.com/JoseCwearStore/PROCISO.git
cd PROCISO
pnpm install --frozen-lockfile
.\iniciar-red.ps1
```

Si PowerShell bloquea el script:

```powershell
powershell -ExecutionPolicy Bypass -File .\iniciar-red.ps1
```

### macOS

```bash
brew install git node@22 pnpm
brew install --cask docker          # Docker Desktop; abrilo y esperá a que arranque
echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
git clone https://github.com/JoseCwearStore/PROCISO.git
cd PROCISO
pnpm install --frozen-lockfile
chmod +x iniciar-red.sh
./iniciar-red.sh
```

> Si tu Mac es Intel, la ruta de Homebrew es `/usr/local/opt/node@22/bin`.
> También podés usar `mise install` y evitar el manejo del PATH.

### Linux (Debian/Ubuntu)

```bash
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Docker Engine + plugin compose v2 (seguí la guía oficial de tu distro)
# https://docs.docker.com/engine/install/
sudo usermod -aG docker "$USER"     # cerrá sesión y volvé a entrar

npm install -g pnpm@10.34.3
git clone https://github.com/JoseCwearStore/PROCISO.git
cd PROCISO
pnpm install --frozen-lockfile
chmod +x iniciar-red.sh
./iniciar-red.sh
```

---

## 2. Programas, versiones y orden

| # | Programa | Versión probada | Para qué | Cómo comprobarlo |
|---|---|---|---|---|
| 1 | **Git** | cualquiera reciente | descargar el repo | `git --version` |
| 2 | **Node.js** | **22** (22.23.4) | frontend y herramientas | `node --version` |
| 3 | **pnpm** | **10.34.3** | instalar dependencias | `pnpm --version` |
| 4 | **Docker** | motor **29.7.2** (Desktop en Win/Mac), **encendido** | Supabase local corre en contenedores | `docker --version` y `docker ps` |
| 5 | **Supabase CLI** | **2.122.1 exacta** | base de datos local y funciones | no se instala: se usa con `npx` |

**El orden importa:** pnpm necesita Node; el script necesita pnpm y Docker; Supabase necesita Docker encendido.

**Importante — versión de la CLI de Supabase:** usá siempre `npx -y supabase@2.122.1 ...`. La 3.x **rompe el contenedor de la base**. No instales una `supabase` global distinta.

Si usás [mise](https://mise.jdx.dev), el archivo `.mise.toml` ya fija Node 22 y pnpm 10.34.3: basta con `mise install`.

**Puertos que deben estar libres:**

| Puerto | Servicio |
|---|---|
| **8443** | la app (Vite) |
| **54321** | API de Supabase |
| **54322** | PostgreSQL |
| **54323** | Studio |
| **54324** | correo de prueba (Mailpit) |

---

## 3. Descargar e instalar dependencias

```bash
git clone https://github.com/JoseCwearStore/PROCISO.git
cd PROCISO
pnpm install --frozen-lockfile
```

El clon tarda un poco porque el repo usa **Git LFS** para imágenes y videos. Si ves archivos de imagen de pocos bytes o vacíos:

```bash
git lfs install
git lfs pull
```

---

## 4. Arrancar PROCISO

### 4.1 Solo en tu computadora

```bash
pnpm dev
```

Abre <http://localhost:8443>. Vite usa `strictPort`: si el 8443 está ocupado, **falla en vez de cambiar de puerto**. Es a propósito, para que la URL no cambie sin que te des cuenta.

### 4.2 Desde el celular u otra PC de la red local

Usá el script. Hace todo lo que a mano es fácil equivocar: detecta la IP, la escribe en la configuración, levanta Supabase y abre la app en `0.0.0.0`.

**Windows:**

```powershell
.\iniciar-red.ps1
```

**macOS / Linux:**

```bash
./iniciar-red.sh
```

Opciones (mismos nombres en ambos, cambiando `--` por `-` en PowerShell):

| Opción | Para qué |
|---|---|
| `--ip 192.168.1.50` | forzar la IP si la detección falla |
| `--puerto 8444` | otro puerto (ver aviso abajo) |
| `--sin-funciones` | no levantar las Edge Functions de IA |
| `--restaurar` | volver `site_url` a `localhost:8443` y reiniciar Supabase |

**Qué hace, en orden:**

1. Verifica Node, pnpm y que Docker esté corriendo.
2. Detecta la IP de la red local (ignora WSL, Docker y adaptadores virtuales).
3. Instala dependencias si falta `node_modules`.
4. Comprueba que el puerto de la app esté libre.
5. Escribe `VITE_SUPABASE_URL` en `.env.local` y completa la publishable key sola.
6. Ajusta `site_url` en `supabase/config.toml` y reinicia Supabase **solo si cambió la IP o el puerto**.
7. Abre las Edge Functions de IA si hay `IA_API_KEY`.
8. Arranca Vite en `0.0.0.0` y muestra las URLs.

> **No cambies de puerto para esquivar un "puerto en uso".** `site_url` de Supabase tiene que coincidir con el puerto de la app; cambiarlo obliga a reiniciar Supabase (~1 min) y desalinea los links de invitación. Cerrá la instancia vieja y listo.

### 4.3 Cómo apagar

`Ctrl+C` en la terminal de la app. Si además querés bajar la base:

```bash
npx -y supabase@2.122.1 stop
```

---

## 5. Instalación manual (sin script)

Útil para entender qué hace el script o si preferís no usarlo. En Windows, `cp` es `Copy-Item`.

```bash
# 1. Base de datos (Docker encendido; la primera vez descarga imágenes)
npx -y supabase@2.122.1 start

# 2. Variables del frontend
cp .env.example .env.local
npx -y supabase@2.122.1 status        # copiá PUBLISHABLE_KEY en .env.local
```

`pnpm dev` ya arranca con la configuración del repo. Para red local a mano tendrías que editar `.env.local`, `supabase/config.toml` y reiniciar Supabase: para eso está el script.

Si no ves los usuarios de prueba:

```bash
npx -y supabase@2.122.1 db reset --local
```

> `db reset` **borra todos los datos locales** y vuelve a cargar `supabase/seed.sql`. Usalo solo en tu máquina.

---

## 6. Variables de entorno

Los archivos `.env*` **no se suben al repo** y **este repositorio no incluye ninguna clave**: cada persona pone las suyas. Los `.env.example` sí están versionados y van **vacíos** a propósito: son la plantilla.

### 6.1 Frontend (`.env.local`)

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `http://127.0.0.1:54321` (local) o `http://<tu-ip>:54321` (red) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | la clave **publishable** que imprime `supabase status` |

El script completa las dos. A mano: copiá `.env.example` a `.env.local` y pegá la key.

> **Nunca pongas la `SECRET_KEY` acá.** Todo lo que empieza con `VITE_` termina en el navegador. La publishable está pensada para ser pública; la secret salta RLS y es solo para el servidor.

### 6.2 Funciones de IA (`supabase/functions/.env`)

| Variable | Qué es |
|---|---|
| `IA_PROVEEDOR` | `openai-compatible` (viene así) |
| `IA_BASE_URL` | `https://api.groq.com/openai/v1` |
| `IA_MODELO` | modelo de texto e imágenes (viene `qwen/qwen3.8-27b`, Groq Preview) |
| `IA_VISION` | `true` solo si el modelo acepta imágenes |
| `IA_API_KEY` | **tu** clave de [Groq](https://console.groq.com) |
| `IA_STT_BASE_URL`, `IA_STT_MODELO` | transcripción de audio (`whisper-large-v3-turbo`) |
| `IA_STT_API_KEY` | **tu** clave de Groq (puede ser la misma) |
| `IA_VIDEO_MODELO` | viene `gemini-3.6-flash` (Google) |
| `IA_VIDEO_API_KEY` | **tu** clave de [Google AI Studio](https://aistudio.google.com) |
| `IA_MAX_CARACTERES` | opcional: tope de caracteres a analizar |

Las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase; no las pongas.

Sin claves de IA, **solo fallan los botones de IA**; el resto de la app funciona igual.

Si cambiás ese `.env`, reiniciá las funciones: las leen al arrancar.

```bash
npx -y supabase@2.122.1 functions serve --env-file supabase/functions/.env
```

---

## 7. Verificar que todo está bien

```bash
pnpm verify      # tipos (tsc) + 1306 pruebas Vitest
pnpm test:db     # 52 archivos / 870 pruebas pgTAP (necesita Supabase encendido)
```

---

## 8. Usuarios de prueba

Los crea `supabase/seed.sql`. **Todos usan la misma contraseña: `Prociso2026!`** (solo local).

| Correo | Rol |
|---|---|
| `admin@prociso.test` | Admin PROCISO |
| `ana@cowin.test` | Admin Consultoría (COWIN) |
| `roberto@cowin.test` | Consultor (COWIN) |
| `carlos@marketino.test` | Cliente (Marketino) |

Hay más usuarios para probar el aislamiento entre consultorías (`lucia@jaza.test`, `laura@consultoria2.test`, `pedro@norte.test`, `maria@cowin.test`, `jorge@cowin.test`); su rol está en `supabase/seed.sql`.

El correo de prueba (invitaciones, recuperar contraseña) llega a la bandeja local: <http://127.0.0.1:54324>.

---

## 9. Problemas frecuentes

| Mensaje o síntoma | Causa | Solución |
|---|---|---|
| `El puerto 8443 ya esta en uso por node (PID …)` | otra instancia de Vite o un túnel | `Stop-Process -Id <PID> -Force` (Windows) o `kill <PID>` (Mac/Linux). No cambies de puerto |
| `La configuracion de red cambio: reiniciando Supabase` | cambió tu IP o el puerto | es normal: esperá ~1 min |
| `A new version of Supabase CLI is available: v3.1.0` | aviso de `npx` | ignoralo y seguí usando `@2.122.1` |
| `No such container: supabase_auth_…` | el stack está apagado | `npx -y supabase@2.122.1 start` |
| `supabase start` falla | Docker apagado, CLI 3.x o puertos ocupados | `docker ps`; usá `@2.122.1`; liberá 54321–54324 |
| `Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY` | no existe `.env.local` | corré el script, o copiá `.env.example` y completá la key |
| No puedo iniciar sesión con un usuario de prueba | la semilla no se cargó | `npx -y supabase@2.122.1 db reset --local` |
| Un botón de IA devuelve 401 o «clave» | falta o es inválida `IA_API_KEY` | cargala y reiniciá `functions serve` |
| Un botón de IA dice «no acepta imágenes» | `IA_VISION` y modelo incoherentes | `IA_VISION=true` con un modelo con visión |
| El celular no abre la app | firewall o red distinta | abrí **8443** y **54321**; ambos en la misma Wi-Fi |
| El celular abre pero no loguea | el celular no llega a la API | verificá que abra `http://<ip>:54321` |
| No se puede grabar audio desde el celular | HTTP no es contexto seguro | grabá desde la computadora; requiere HTTPS |
| `.env.local` con caracteres raros o error de parseo | el editor guardó **UTF-8 con BOM** | guardá UTF-8 **sin BOM** (VS Code: «UTF-8») |
| `./iniciar-red.sh: bad interpreter` | el archivo se guardó con CRLF | el repo lo fuerza a LF; si lo copiaste a mano, `sed -i 's/\r$//' iniciar-red.sh` |

---

## 10. Limitaciones conocidas

- **La grabación de audio no funciona desde otro dispositivo por HTTP.** `getUserMedia` exige un contexto seguro (HTTPS o `localhost`). Es una limitación del navegador, no de la app.
- **Sin claves de IA, los botones de IA fallan** (análisis, borradores, transcripción, video). El resto funciona.
- **La app no certifica nada.** Todo resultado de IA es una preevaluación que requiere revisión humana.
- **Videos:** máximo 10 minutos y 200 MB; se recomiendan hasta 5.
- **Topes diarios:** 30 pedidos de IA por usuario y 150 por consultoría; 5 análisis de video por usuario y 15 por consultoría.
- **Audio y video salen de la máquina** hacia un proveedor externo para transcribirse o analizarse.

---

## 11. Seguridad en red local

El script expone la app **y** los servicios de Supabase en tu LAN:

| Servicio | Puerto | ¿Tiene autenticación? |
|---|---|---|
| App (Vite) | 8443 | sí (login de la app) |
| API | 54321 | con clave publishable |
| Studio | 54323 | **no** |
| Mailpit | 54324 | **no** |
| PostgreSQL | 54322 | usuario/contraseña fijos de desarrollo |

Cualquiera en tu red puede abrir Studio y ver o modificar la base. **No uses este modo en Wi-Fi público.** En tu casa u oficina con red confiable, está bien. Para volver a localhost: `--restaurar`.

---

## 12. Estructura

```
src/                  aplicación React (páginas, componentes, lib con la lógica)
supabase/migrations/  esquema, RLS y reglas de negocio (52 migraciones)
supabase/functions/   Edge Functions: analizar-ia, generar-documento, transcribir-evidencia, invitar-usuario
supabase/tests/       pruebas pgTAP
supabase/seed.sql     datos de demostración y usuarios de prueba
herramientas/         scripts de apoyo (no forman parte de la app; ver su README)
iniciar-red.ps1       arranque en red local para Windows
iniciar-red.sh        arranque en red local para macOS y Linux
```
