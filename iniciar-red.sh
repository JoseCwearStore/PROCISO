#!/usr/bin/env bash
# iniciar-red.sh
# Levanta PROCISO accesible desde otros dispositivos de la red local (macOS y Linux).
# Detecta la IP sola. Si la IP o el puerto cambian, actualiza la config y reinicia Supabase.
#
# Uso:
#   ./iniciar-red.sh
#   ./iniciar-red.sh --ip 192.168.1.50
#   ./iniciar-red.sh --puerto 8444
#   ./iniciar-red.sh --sin-funciones
#   ./iniciar-red.sh --restaurar      # vuelve a localhost y reinicia Supabase
#
# Requiere: node 22, pnpm 10.34.3, Docker encendido y la CLI de Supabase via npx.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUERTO_POR_DEFECTO=8443
FUNCIONES_PID=""

# ---------------------------------------------------------------------------
# Salida
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  C_OK=$'\033[32m'; C_AV=$'\033[33m'; C_ERR=$'\033[31m'
  C_INFO=$'\033[36m'; C_GRIS=$'\033[90m'; C_OFF=$'\033[0m'
else
  C_OK=; C_AV=; C_ERR=; C_INFO=; C_GRIS=; C_OFF=
fi
info()  { printf '%s%s%s\n' "$C_INFO" "$*" "$C_OFF"; }
ok()    { printf '  %s[OK]%s %s\n' "$C_OK" "$C_OFF" "$*"; }
aviso() { printf '  %s[!]%s %s\n' "$C_AV" "$C_OFF" "$*"; }
error() { printf '  %s[X]%s %s\n' "$C_ERR" "$C_OFF" "$*"; }
gris()  { printf '%s%s%s\n' "$C_GRIS" "$*" "$C_OFF"; }

uso() {
  cat <<'TXT'
Uso: ./iniciar-red.sh [opciones]

  --ip <ip>          fuerza la IP de la red local (si la deteccion falla)
  --puerto <n>       puerto de la app (por defecto 8443)
  --sin-funciones    no levanta las Edge Functions de IA
  --restaurar        vuelve site_url a localhost:8443 y reinicia Supabase
  -h, --help         muestra esta ayuda
TXT
}

# ---------------------------------------------------------------------------
# Deteccion de IP
# ---------------------------------------------------------------------------
detectar_ip() {
  local so ip iface i
  so="$(uname -s)"
  if [ "$so" = "Darwin" ]; then
    iface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
    for i in ${iface:-} en0 en1 en2; do
      ip="$(ipconfig getifaddr "$i" 2>/dev/null || true)"
      if [ -n "$ip" ]; then printf '%s\n' "$ip"; return 0; fi
    done
  else
    ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (n=1;n<=NF;n++) if ($n=="src") {print $(n+1); exit}}')"
    if [ -z "$ip" ]; then
      ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
    fi
    if [ -n "$ip" ]; then printf '%s\n' "$ip"; return 0; fi
  fi
  return 1
}

ip_es_local() {
  local ip="$1"
  if [ "$(uname -s)" = "Darwin" ]; then
    ifconfig 2>/dev/null | grep -q "inet $ip "
  else
    ip -o -4 addr show 2>/dev/null | grep -q "inet $ip/"
  fi
}

# ---------------------------------------------------------------------------
# Supabase
# ---------------------------------------------------------------------------
leer_project_id() {
  awk -F'"' '/^[[:space:]]*project_id[[:space:]]*=/{print $2; exit}' \
    "$RAIZ/supabase/config.toml" 2>/dev/null || true
}

supabase_corriendo() {
  local pid="$1"
  docker ps --filter "name=supabase_db_$pid" --format '{{.Names}}' 2>/dev/null \
    | grep -q "supabase_db_$pid" || return 1
  docker ps --filter "name=supabase_kong_$pid" --format '{{.Names}}' 2>/dev/null \
    | grep -q "supabase_kong_$pid"
}

arrancar_supabase() {
  if ! npx -y supabase@2.122.1 start; then
    error 'Supabase no pudo arrancar. Revisa los mensajes de arriba.'
    aviso 'Causas tipicas: Docker apagado, puertos 54321-54324 ocupados o .env.local corrupto.'
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Archivos de configuracion
# ---------------------------------------------------------------------------
escribir_env_local() {
  local ip="$1" ruta="$RAIZ/.env.local" url tmp
  url="http://${ip}:54321"
  if [ ! -f "$ruta" ]; then
    cp "$RAIZ/.env.example" "$ruta"
  fi
  tmp="$(mktemp "${ruta}.XXXXXX")"
  awk -v url="$url" '
    { if (!hecho && $0 ~ /^VITE_SUPABASE_URL=/) { print "VITE_SUPABASE_URL=" url; hecho = 1; next } print }
    END { if (!hecho) print "VITE_SUPABASE_URL=" url }
  ' "$ruta" > "$tmp"
  mv "$tmp" "$ruta"
}

# 0 si la clave ya esta cargada. [ \t] y no \s: \s incluye el salto de linea.
tiene_api_key() {
  grep -Eq '^IA_API_KEY=[[:space:]]*[^[:space:]]' "$RAIZ/supabase/functions/.env" 2>/dev/null
}

tiene_publishable_key() {
  grep -Eq '^VITE_SUPABASE_PUBLISHABLE_KEY=[[:space:]]*[^[:space:]]' "$RAIZ/.env.local" 2>/dev/null
}

asegurar_key() {
  local ruta="$RAIZ/.env.local" json key tmp
  tiene_publishable_key && return 0
  json="$(npx -y supabase@2.122.1 status -o json 2>/dev/null || true)"
  key="$(printf '%s' "$json" | sed -n 's/.*"PUBLISHABLE_KEY"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  if [ -z "$key" ]; then
    sleep 5
    json="$(npx -y supabase@2.122.1 status -o json 2>/dev/null || true)"
    key="$(printf '%s' "$json" | sed -n 's/.*"PUBLISHABLE_KEY"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  fi
  if [ -z "$key" ]; then
    error 'No pude leer la publishable key desde Supabase.'
    aviso 'Probalo a mano: npx -y supabase@2.122.1 status'
    exit 1
  fi
  tmp="$(mktemp "${ruta}.XXXXXX")"
  awk -v k="$key" '
    { if (!hecho && $0 ~ /^VITE_SUPABASE_PUBLISHABLE_KEY=/) { print "VITE_SUPABASE_PUBLISHABLE_KEY=" k; hecho = 1; next } print }
    END { if (!hecho) print "VITE_SUPABASE_PUBLISHABLE_KEY=" k }
  ' "$ruta" > "$tmp"
  mv "$tmp" "$ruta"
}

# Devuelve 0 si cambio el archivo, 1 si ya estaba igual.
escribir_config() {
  local site="$1" ruta="$RAIZ/supabase/config.toml" actual tmp
  actual="$(sed -n 's/^[[:space:]]*site_url[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' "$ruta" | head -1)"
  if [ "$actual" = "$site" ]; then
    return 1
  fi
  tmp="$(mktemp "${ruta}.XXXXXX")"
  awk -v site="$site" '
    { if (!hecho && $0 ~ /^[[:space:]]*site_url[[:space:]]*=/) { sub(/"[^"]*"/, "\"" site "\""); hecho = 1 } print }
  ' "$ruta" > "$tmp"
  mv "$tmp" "$ruta"

  if ! grep -q 'http://localhost:8443' "$ruta"; then
    tmp="$(mktemp "${ruta}.XXXXXX")"
    awk '
      { if (!hecho && $0 ~ /additional_redirect_urls[[:space:]]*=[[:space:]]*\[/) { sub(/\[/, "[\"http://localhost:8443\", "); hecho = 1 } print }
    ' "$ruta" > "$tmp"
    mv "$tmp" "$ruta"
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Puerto y firewall
# ---------------------------------------------------------------------------
puerto_en_uso() {
  local puerto="$1"
  if command -v lsof >/dev/null 2>&1; then
    [ -n "$(lsof -nP -tiTCP:"$puerto" -sTCP:LISTEN 2>/dev/null || true)" ]
  elif command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk -v p=":$puerto" '$4 ~ p {encontrado = 1} END {exit !encontrado}'
  else
    return 1
  fi
}

pid_del_puerto() {
  local puerto="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -tiTCP:"$puerto" -sTCP:LISTEN 2>/dev/null | head -1 || true
  fi
}

leer_puerto_api() {
  awk '/^\[api\]/{a=1;next} /^\[/{a=0} a && /^[[:space:]]*port[[:space:]]*=/{gsub(/[^0-9]/,"");print;exit}' \
    "$RAIZ/supabase/config.toml"
}

# El primer analisis de PDF compila pdf.js en un worker frio y puede caer por WORKER_LIMIT.
# Se le pide a analizar-ia que lo cargue ya (no toca la BD ni gasta cupo de IA).
precalentar_funciones() {
  local json key puerto i
  json="$(npx -y supabase@2.122.1 status -o json 2>/dev/null || true)"
  key="$(printf '%s' "$json" | sed -n 's/.*"ANON_KEY"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
  if [ -z "$key" ]; then
    aviso 'No pude leer la ANON_KEY: me salto el precalentamiento de la IA.'
    return 0
  fi
  puerto="$(leer_puerto_api)"
  puerto="${puerto:-54321}"
  printf '  Precalentando funciones de IA (la primera vez puede tardar ~1 min)'
  for i in $(seq 1 30); do
    if curl -fsS -m 60 -o /dev/null -X POST "http://127.0.0.1:${puerto}/functions/v1/analizar-ia" \
      -H "Authorization: Bearer $key" -H 'x-prociso-precalentar: 1' \
      -H 'Content-Type: application/json' -d '{}' 2>/dev/null; then
      printf '\n'
      ok 'Funciones de IA precalentadas'
      return 0
    fi
    printf '.'
    sleep 4
  done
  printf '\n'
  aviso 'No pude precalentar las funciones de IA: si el primer analisis falla, reintentalo.'
}

hint_firewall() {
  local puerto="$1"
  case "$(uname -s)" in
    Darwin)
      aviso "Si el celular no conecta: Ajustes del Sistema > Red > Firewall, y permiti las conexiones entrantes de node."
      aviso "El celular necesita el puerto $puerto (app) y el 54321 (API)."
      ;;
    Linux)
      aviso "Si el celular no conecta: sudo ufw allow $puerto/tcp && sudo ufw allow 54321/tcp"
      ;;
  esac
}

limpiar() {
  if [ -n "${FUNCIONES_PID:-}" ]; then
    pkill -P "$FUNCIONES_PID" 2>/dev/null || true
    kill "$FUNCIONES_PID" 2>/dev/null || true
  fi
}

# ---------------------------------------------------------------------------
# Flujo principal
# ---------------------------------------------------------------------------
main() {
  local ip="" puerto="$PUERTO_POR_DEFECTO" sin_funciones=0 restaurar=0
  local project_id app_url api_url existe cambio

  while [ $# -gt 0 ]; do
    case "$1" in
      --ip)              ip="${2:-}"; shift 2 ;;
      --ip=*)            ip="${1#*=}"; shift ;;
      --puerto)          puerto="${2:-}"; shift 2 ;;
      --puerto=*)        puerto="${1#*=}"; shift ;;
      --sin-funciones)   sin_funciones=1; shift ;;
      --restaurar)       restaurar=1; shift ;;
      -h|--help)         uso; exit 0 ;;
      *)                 error "Opcion desconocida: $1"; uso; exit 1 ;;
    esac
  done

  case "$puerto" in
    ''|*[!0-9]*) error "Puerto invalido: $puerto"; exit 1 ;;
  esac

  cd "$RAIZ"
  trap limpiar EXIT INT TERM

  info '== PROCISO: arranque en red local =='

  project_id="$(leer_project_id)"
  project_id="${project_id:-prociso}"

  if [ "$restaurar" -eq 1 ]; then
    info 'Restaurando site_url a localhost...'
    if escribir_config 'http://localhost:8443'; then
      npx -y supabase@2.122.1 stop >/dev/null 2>&1 || true
      arrancar_supabase >/dev/null
    fi
    ok 'Listo. La app vuelve a usar localhost:8443'
    exit 0
  fi

  # 1. Requisitos
  local cmd
  for cmd in node pnpm docker; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      error "Falta '$cmd'. Instalalo y volve a intentar."
      if [ "$cmd" = "pnpm" ]; then aviso 'npm install -g pnpm@10.34.3'; fi
      exit 1
    fi
  done
  if ! docker info >/dev/null 2>&1; then
    if [ "$(uname -s)" = "Darwin" ] && [ -d "/Applications/Docker.app" ]; then
      aviso 'Docker Desktop esta cerrado. Abriendolo (puede tardar ~1 min)...'
      open -a Docker
      i=0
      listo=0
      while [ "$i" -lt 60 ]; do
        sleep 2
        if docker info >/dev/null 2>&1; then listo=1; break; fi
        i=$((i + 1))
        printf '.'
      done
      printf '\n'
      if [ "$listo" -eq 0 ]; then
        error 'Docker no arranco.'
        aviso 'Abri Docker Desktop a mano, espera a que diga "Engine running" y volve a intentar.'
        exit 1
      fi
      ok 'Docker Desktop arranco'
    else
      error 'Docker no esta corriendo.'
      if [ "$(uname -s)" = "Darwin" ]; then
        aviso 'Abri Docker Desktop y espera a que termine de iniciar.'
      else
        aviso 'sudo systemctl start docker'
      fi
      exit 1
    fi
  fi
  ok 'Node, pnpm y Docker disponibles'

  # 2. IP
  if [ -z "$ip" ]; then
    if ! ip="$(detectar_ip)"; then
      error 'No pude detectar la IP de la red local.'
      aviso 'Probalo con: ./iniciar-red.sh --ip 192.168.1.50'
      exit 1
    fi
  fi
  if ! printf '%s' "$ip" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'; then
    error "IP invalida: $ip"
    exit 1
  fi
  if ! ip_es_local "$ip"; then
    aviso "La IP $ip no esta configurada en esta maquina: no vas a poder entrar desde otro dispositivo."
  fi
  ok "IP de red detectada: $ip"

  app_url="http://${ip}:${puerto}"
  api_url="http://${ip}:54321"

  # 3. Dependencias
  if [ ! -d "$RAIZ/node_modules" ]; then
    info 'Instalando dependencias (primera vez)...'
    if ! pnpm install --frozen-lockfile; then
      error 'Fallo pnpm install.'
      exit 1
    fi
  fi

  # 4. Puerto de la app libre (strictPort: si esta ocupado, Vite no arranca)
  if puerto_en_uso "$puerto"; then
    local pid
    pid="$(pid_del_puerto "$puerto")"
    error "El puerto $puerto ya esta en uso${pid:+ por el PID $pid}."
    aviso "Si es una instancia vieja de PROCISO: kill ${pid:-<pid>}"
    aviso "No cambies de puerto sin cerrar la otra: cambiar el puerto obliga a reiniciar Supabase."
    exit 1
  fi

  # 5. Config
  escribir_env_local "$ip"
  if ! asegurar_key; then
    exit 1
  fi

  cambio=0
  if escribir_config "$app_url"; then
    cambio=1
  fi

  if ! supabase_corriendo "$project_id"; then
    info 'Levantando Supabase local (puede tardar la primera vez)...'
    arrancar_supabase
  elif [ "$cambio" -eq 1 ]; then
    info 'La configuracion de red cambio: reiniciando Supabase para aplicar los redirects de auth...'
    npx -y supabase@2.122.1 stop >/dev/null 2>&1 || true
    arrancar_supabase >/dev/null
  else
    ok 'Supabase ya estaba corriendo con esta IP'
  fi

  ok ".env.local apunta a $api_url"

  # 6. Firewall
  hint_firewall "$puerto"

  # 7. Funciones de IA (opcional)
  if [ "$sin_funciones" -eq 0 ]; then
    if [ ! -f "$RAIZ/supabase/functions/.env" ]; then
      cp "$RAIZ/supabase/functions/.env.example" "$RAIZ/supabase/functions/.env"
    fi
    if tiene_api_key; then
      local log
      log="${TMPDIR:-/tmp}/prociso-funciones.log"
      info 'Abriendo funciones de IA en segundo plano...'
      nohup npx -y supabase@2.122.1 functions serve --env-file supabase/functions/.env >"$log" 2>&1 &
      FUNCIONES_PID=$!
      ok "Funciones IA: PID $FUNCIONES_PID (log: $log)"
      gris "  Se cierran solas al cortar la app con Ctrl+C."
      precalentar_funciones
    else
      aviso 'Sin IA_API_KEY en supabase/functions/.env: los botones de IA van a fallar (la app anda igual).'
    fi
  fi

  # 8. Resumen
  info ''
  info '==============================  PROCISO EN RED  =============================='
  printf '  %sApp:        %s%s\n' "$C_OK" "$app_url" "$C_OFF"
  gris "  Studio:     http://${ip}:54323"
  gris "  Correo:     http://${ip}:54324"
  gris "  API:        $api_url"
  printf '\n'
  gris '  Usuarios:   ana@cowin.test / Prociso2026!'
  gris '              admin@prociso.test / Prociso2026!'
  printf '\n'
  aviso 'La grabacion de audio no funciona desde el celular (HTTP no es contexto seguro).'
  aviso 'No uses esta configuracion en Wi-Fi publico: expone Postgres, Studio y Mailpit.'
  info '============================================================================='
  info ''

  export FIGMA_DEV_SERVER_HOST='0.0.0.0'
  export PORT="$puerto"
  pnpm dev
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
