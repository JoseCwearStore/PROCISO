# iniciar-red.ps1
# Levanta PROCISO accesible desde otros dispositivos de la red local.
# Detecta la IP sola. Si la IP cambia, actualiza la config y reinicia Supabase.
#
# Uso:
#   .\iniciar-red.ps1
#   .\iniciar-red.ps1 -Ip 192.168.1.50
#   .\iniciar-red.ps1 -Puerto 8444
#   .\iniciar-red.ps1 -SinFunciones
#   .\iniciar-red.ps1 -Restaurar      # vuelve a localhost y reinicia Supabase

[CmdletBinding()]
param(
  [string]$Ip,
  [int]$Puerto = 8443,
  [switch]$SinFunciones,
  [switch]$Restaurar
)

$ErrorActionPreference = 'Stop'
$Raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Raiz

function Info($texto) { Write-Host $texto -ForegroundColor Cyan }
function Ok($texto) { Write-Host "  [OK] $texto" -ForegroundColor Green }
function Aviso($texto) { Write-Host "  [!] $texto" -ForegroundColor Yellow }
function Error2($texto) { Write-Host "  [X] $texto" -ForegroundColor Red }

# PowerShell 5.1 escribe BOM con -Encoding UTF8 y el CLI de Supabase no lo tolera.
function Guardar-SinBom($ruta, $texto) {
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($ruta, $texto, $utf8)
}

function Obtener-IpLan {
  $excluir = 'Loopback|vEthernet|WSL|Docker|Bluetooth|VirtualBox|VMware|Hyper-V|TAP|VPN'
  $rutas = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
    Sort-Object RouteMetric
  foreach ($ruta in $rutas) {
    $adaptador = Get-NetAdapter -InterfaceIndex $ruta.InterfaceIndex -ErrorAction SilentlyContinue
    if (-not $adaptador -or $adaptador.Status -ne 'Up') { continue }
    if ($adaptador.Name -match $excluir -or $adaptador.InterfaceDescription -match $excluir) { continue }
    $direccion = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $ruta.InterfaceIndex -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } |
      Select-Object -First 1
    if ($direccion) { return $direccion.IPAddress }
  }
  $direccion = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)' } |
    Select-Object -First 1
  if ($direccion) { return $direccion.IPAddress }
  throw 'No pude detectar la IP de la red local. Proba con: .\iniciar-red.ps1 -Ip 192.168.1.50'
}

function Leer-ProjectId {
  $config = Get-Content (Join-Path $Raiz 'supabase\config.toml') -Raw
  $m = [regex]::Match($config, '(?m)^\s*project_id\s*=\s*"([^"]+)"')
  if ($m.Success) { return $m.Groups[1].Value }
  return 'prociso'
}

# Puerto de una seccion de supabase/config.toml ([api], [studio], [local_smtp]...).
# Asi el script respeta los puertos de cada maquina; si no lo encuentra, usa el estandar.
function Leer-Puerto([string[]]$secciones, [int]$defecto) {
  $config = Get-Content (Join-Path $Raiz 'supabase\config.toml') -Raw
  foreach ($seccion in $secciones) {
    $patron = '(?ms)^\[' + [regex]::Escape($seccion) + '\][ \t]*\r?$(.*?)(?=^\[|\z)'
    $bloque = [regex]::Match($config, $patron)
    if (-not $bloque.Success) { continue }
    $m = [regex]::Match($bloque.Groups[1].Value, '(?m)^[ \t]*port[ \t]*=[ \t]*(\d+)')
    if ($m.Success) { return [int]$m.Groups[1].Value }
  }
  return $defecto
}

function Docker-Corriendo {
  # cmd /c fusiona stderr en stdout. Con ErrorActionPreference=Stop, docker info
  # escribe en stderr y PowerShell lo convierte en error terminante ANTES de que
  # podamos dar un mensaje util (fue el error que veia el usuario).
  & cmd /c "docker info 2>&1" | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function Buscar-DockerDesktop {
  $candidatos = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'),
    (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe')
  )
  if (${env:ProgramFiles(x86)}) {
    $candidatos += (Join-Path ${env:ProgramFiles(x86)} 'Docker\Docker\Docker Desktop.exe')
  }
  foreach ($c in $candidatos) {
    if ($c -and (Test-Path $c)) { return $c }
  }
  # Instalacion por usuario: docker.exe vive en ...\DockerDesktop\resources\bin
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if ($docker) {
    $raiz = Split-Path (Split-Path (Split-Path $docker.Source -Parent) -Parent) -Parent
    $exe = Join-Path $raiz 'Docker Desktop.exe'
    if (Test-Path $exe) { return $exe }
  }
  # Ultimo recurso: el proceso, si ya esta corriendo
  $proc = Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($proc -and $proc.Path) { return $proc.Path }
  return $null
}

function Abrir-Docker {
  $exe = Buscar-DockerDesktop
  if (-not $exe) { return $false }
  Aviso "Docker Desktop esta cerrado. Abriendolo: $exe"
  Start-Process $exe | Out-Null
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    if (Docker-Corriendo) { return $true }
    if ($i % 5 -eq 4) { Write-Host '  .' -NoNewline }
  }
  Write-Host ''
  return $false
}

function Asegurar-Docker {
  if (Docker-Corriendo) { return }
  if (Abrir-Docker) {
    Ok 'Docker Desktop arranco'
    return
  }
  Error2 'Docker no esta corriendo.'
  Aviso 'Abri Docker Desktop, espera a que diga "Engine running" y volve a correr el script.'
  Aviso 'Verificacion rapida: docker ps'
  exit 1
}

function Supabase-Corriendo($projectId) {
  $db = & cmd /c "docker ps --filter name=supabase_db_$projectId --format {{.Names}} 2>&1"
  $kong = & cmd /c "docker ps --filter name=supabase_kong_$projectId --format {{.Names}} 2>&1"
  return (($db -match "supabase_db_$projectId") -and ($kong -match "supabase_kong_$projectId"))
}

function Leer-Status {
  $salida = & cmd /c "npx -y supabase@2.122.1 status -o json 2>&1"
  if ($LASTEXITCODE -ne 0) { return $null }
  try { return ($salida | ConvertFrom-Json) } catch { return $null }
}

function Escribir-EnvLocal($ip) {
  $ruta = Join-Path $Raiz '.env.local'
  $ejemplo = Join-Path $Raiz '.env.example'
  if (-not (Test-Path $ruta)) { Copy-Item $ejemplo $ruta }
  $lineas = @(Get-Content $ruta)
  $url = "http://${ip}:$(Leer-Puerto 'api' 54321)"
  $indice = -1
  for ($i = 0; $i -lt $lineas.Count; $i++) {
    if ($lineas[$i] -match '^VITE_SUPABASE_URL=') { $indice = $i; break }
  }
  if ($indice -ge 0) { $lineas[$indice] = "VITE_SUPABASE_URL=$url" }
  else { $lineas += "VITE_SUPABASE_URL=$url" }
  Guardar-SinBom $ruta (($lineas -join "`r`n") + "`r`n")
}

function Asegurar-Key($projectId) {
  $ruta = Join-Path $Raiz '.env.local'
  $contenido = Get-Content $ruta -Raw
  if ($contenido -match '(?m)^VITE_SUPABASE_PUBLISHABLE_KEY=[ \t]*\S') { return }
  $json = Leer-Status
  $key = $json.PUBLISHABLE_KEY
  if (-not $key) { Start-Sleep -Seconds 5; $json = Leer-Status; $key = $json.PUBLISHABLE_KEY }
  if (-not $key) { throw 'No pude leer la publishable key desde Supabase.' }
  $contenido = ($contenido -replace '(?m)^VITE_SUPABASE_PUBLISHABLE_KEY=.*$', "VITE_SUPABASE_PUBLISHABLE_KEY=$key").TrimEnd()
  Guardar-SinBom $ruta ($contenido + "`r`n")
}

function Escribir-Config($siteUrl) {
  $ruta = Join-Path $Raiz 'supabase\config.toml'
  $config = Get-Content $ruta -Raw
  $actual = [regex]::Match($config, '(?m)^\s*site_url\s*=\s*"([^"]*)"').Groups[1].Value
  if ($actual -ne $siteUrl) {
    $config = [regex]::Replace($config, '(?m)^\s*site_url\s*=\s*"[^"]*"', "site_url = `"$siteUrl`"")
    if ($config -notmatch 'http://localhost:8443') {
      $config = [regex]::Replace($config, '(?m)^(\s*additional_redirect_urls\s*=\s*\[)', "`$1`"http://localhost:8443`", ")
    }
    Guardar-SinBom $ruta $config
    return $true
  }
  return $false
}

function Arrancar-Supabase {
  # cmd /c fusiona stderr en stdout: PowerShell solo ve texto y no convierte
  # los avisos de npx en errores terminantes (pasa en consola y en logs).
  $salida = & cmd /c "npx -y supabase@2.122.1 start 2>&1"
  $codigo = $LASTEXITCODE
  $salida | ForEach-Object { Write-Host $_ }
  if ($codigo -ne 0) {
    Error2 'Supabase no pudo arrancar. Revisa los mensajes de arriba.'
    Aviso 'Causas tipicas: Docker apagado, puertos de supabase/config.toml ocupados o .env.local corrupto.'
    exit 1
  }
}

function Asegurar-Funciones {
  $ruta = Join-Path $Raiz 'supabase\functions\.env'
  $ejemplo = Join-Path $Raiz 'supabase\functions\.env.example'
  if (-not (Test-Path $ruta)) { Copy-Item $ejemplo $ruta }
  $contenido = Get-Content $ruta -Raw
  # [ \t]* y no \s*: \s incluye el salto de linea y daria falso positivo con la linea siguiente.
  return ($contenido -match '(?m)^IA_API_KEY=[ \t]*\S')
}


# El primer analisis de PDF compila pdf.js en un worker frio y puede caer por WORKER_LIMIT.
# Se le pide a analizar-ia que lo cargue ya (no toca la BD ni gasta cupo de IA).
function Precalentar-Funciones {
  $json = Leer-Status
  $key = $json.ANON_KEY
  if (-not $key) { Aviso 'No pude leer la ANON_KEY: me salto el precalentamiento de la IA.'; return }
  $url = "http://127.0.0.1:$(Leer-Puerto 'api' 54321)/functions/v1/analizar-ia"
  $headers = @{ Authorization = "Bearer $key"; 'x-prociso-precalentar' = '1' }
  Write-Host '  Precalentando funciones de IA (la primera vez puede tardar ~1 min)' -NoNewline
  for ($i = 0; $i -lt 30; $i++) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $url -Headers $headers -Body '{}' -ContentType 'application/json' -TimeoutSec 60
      if ($r.StatusCode -eq 200) {
        Write-Host ''
        Ok 'Funciones de IA precalentadas'
        return
      }
    } catch { }
    Write-Host '.' -NoNewline
    Start-Sleep -Seconds 4
  }
  Write-Host ''
  Aviso 'No pude precalentar las funciones de IA: si el primer analisis falla, reintentalo.'
}

function Asegurar-Firewall($puerto) {
  $nombre = "PROCISO dev $puerto"
  if (Get-NetFirewallRule -DisplayName $nombre -ErrorAction SilentlyContinue) { return }
  $esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if ($esAdmin) {
    New-NetFirewallRule -DisplayName $nombre -Direction Inbound -Protocol TCP -LocalPort $puerto -Action Allow -Profile Private -ErrorAction SilentlyContinue | Out-Null
    Ok "Regla de firewall creada para el puerto $puerto"
  } else {
    Aviso "Si el celular no conecta, abri PowerShell como admin y ejecuta:"
    Aviso "New-NetFirewallRule -DisplayName '$nombre' -Direction Inbound -Protocol TCP -LocalPort $puerto -Action Allow -Profile Private"
  }
}

# ---------------------------------------------------------------------------

Info '== PROCISO: arranque en red local =='

$projectId = Leer-ProjectId

if ($Restaurar) {
  Info 'Restaurando site_url a localhost...'
  $cambio = Escribir-Config 'http://localhost:8443'
  if ($cambio) {
    Asegurar-Docker
    & cmd /c "npx -y supabase@2.122.1 stop 2>&1" | Out-Null
    Arrancar-Supabase
  }
  Ok 'Listo. La app vuelve a usar localhost:8443'
  exit 0
}

# 1. Requisitos
foreach ($cmd in @('node', 'pnpm', 'docker')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Error2 "Falta '$cmd'. Instalalo y volve a intentar."
    if ($cmd -eq 'pnpm') { Aviso 'npm install -g pnpm@10.34.3' }
    exit 1
  }
}
$nodeMayor = [int]((node --version) -replace '^v(\d+)\..*', '$1')
if ($nodeMayor -lt 20) { Aviso "Node $nodeMayor detectado. Se recomienda Node 22." }
Asegurar-Docker
Ok 'Node, pnpm y Docker disponibles'

# 2. IP
if (-not $Ip) { $Ip = Obtener-IpLan }
if ($Ip -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { Error2 "IP invalida: $Ip"; exit 1 }
$enInterfaz = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -eq $Ip }
if (-not $enInterfaz) { Aviso "La IP $Ip no esta configurada en esta maquina: no vas a poder entrar desde otro dispositivo." }
Ok "IP de red detectada: $Ip"

$appUrl = "http://${Ip}:${Puerto}"
$puertoApi = Leer-Puerto 'api' 54321
$puertoStudio = Leer-Puerto 'studio' 54323
$puertoCorreo = Leer-Puerto @('local_smtp', 'inbucket') 54324
$apiUrl = "http://${Ip}:${puertoApi}"

# 3. Dependencias
if (-not (Test-Path (Join-Path $Raiz 'node_modules'))) {
  Info 'Instalando dependencias (primera vez)...'
  $ErrorActionPreference = 'Continue'
  pnpm install --frozen-lockfile
  $ErrorActionPreference = 'Stop'
  if ($LASTEXITCODE -ne 0) { Error2 'Fallo pnpm install.'; exit 1 }
}

# 4. Puerto de la app libre
$ocupado = Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($ocupado) {
  $proceso = Get-Process -Id $ocupado.OwningProcess -ErrorAction SilentlyContinue
  Error2 "El puerto $Puerto ya esta en uso por $($proceso.ProcessName) (PID $($ocupado.OwningProcess))."
  Aviso "Si es una instancia vieja de PROCISO: Stop-Process -Id $($ocupado.OwningProcess) -Force"
  Aviso "O usa otro puerto: .\iniciar-red.ps1 -Puerto $($Puerto + 1)"
  exit 1
}

# 5. Config
Escribir-EnvLocal $Ip
Asegurar-Funciones | Out-Null
$cambioConfig = Escribir-Config $appUrl

$corriendo = Supabase-Corriendo $projectId
if (-not $corriendo) {
  Info 'Levantando Supabase local (puede tardar la primera vez)...'
  Arrancar-Supabase
} elseif ($cambioConfig) {
  Info 'La configuracion de red cambio: reiniciando Supabase para aplicar los redirects de auth...'
  & cmd /c "npx -y supabase@2.122.1 stop 2>&1" | Out-Null
  Arrancar-Supabase
} else {
  Ok 'Supabase ya estaba corriendo con esta IP'
}

Asegurar-Key $projectId
Ok ".env.local apunta a $apiUrl"

# 6. Firewall
Asegurar-Firewall $Puerto

# 7. Funciones de IA (opcional)
if (-not $SinFunciones) {
  if (Asegurar-Funciones) {
    Info 'Abriendo funciones de IA en otra ventana...'
    Start-Process powershell -ArgumentList @(
      '-NoExit', '-Command',
      "Set-Location '$Raiz'; Write-Host 'Funciones IA - PROCISO' -ForegroundColor Cyan; npx -y supabase@2.122.1 functions serve --env-file supabase/functions/.env"
    ) | Out-Null
    Precalentar-Funciones
  } else {
    Aviso 'Sin IA_API_KEY en supabase/functions/.env: los botones de IA van a fallar (la app anda igual).'
  }
}

# 8. Resumen
Info ''
Info '==============================  PROCISO EN RED  =============================='
Write-Host "  App:        $appUrl" -ForegroundColor Green
Write-Host "  Studio:     http://${Ip}:${puertoStudio}" -ForegroundColor Gray
Write-Host "  Correo:     http://${Ip}:${puertoCorreo}" -ForegroundColor Gray
Write-Host "  API:        $apiUrl" -ForegroundColor Gray
Write-Host ''
Write-Host '  Usuarios:   ana@cowin.test / Prociso2026!' -ForegroundColor Gray
Write-Host '              admin@prociso.test / Prociso2026!' -ForegroundColor Gray
Write-Host ''
Aviso 'La grabacion de audio no funciona desde el celular (HTTP no es contexto seguro).'
Aviso 'No uses esta configuracion en Wi-Fi publico: expone Postgres, Studio y Mailpit.'
Info '============================================================================='
Info ''

$env:FIGMA_DEV_SERVER_HOST = '0.0.0.0'
$env:PORT = "$Puerto"
# vite y pnpm escriben avisos en stderr: no queremos que corten el arranque.
$ErrorActionPreference = 'Continue'
pnpm dev
