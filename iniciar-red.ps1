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

function Supabase-Corriendo($projectId) {
  $db = docker ps --filter "name=supabase_db_$projectId" --format '{{.Names}}' 2>$null
  $kong = docker ps --filter "name=supabase_kong_$projectId" --format '{{.Names}}' 2>$null
  return (($db -match "supabase_db_$projectId") -and ($kong -match "supabase_kong_$projectId"))
}

function Escribir-EnvLocal($ip) {
  $ruta = Join-Path $Raiz '.env.local'
  $ejemplo = Join-Path $Raiz '.env.example'
  if (-not (Test-Path $ruta)) { Copy-Item $ejemplo $ruta }
  $lineas = @(Get-Content $ruta)
  $url = "http://${ip}:54321"
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
  $json = npx -y supabase@2.122.1 status -o json 2>$null | ConvertFrom-Json
  $key = $json.PUBLISHABLE_KEY
  if (-not $key) { Start-Sleep -Seconds 5; $json = npx -y supabase@2.122.1 status -o json 2>$null | ConvertFrom-Json; $key = $json.PUBLISHABLE_KEY }
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
    Aviso 'Causas tipicas: Docker apagado, puertos 54321-54324 ocupados o .env.local corrupto.'
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
    npx -y supabase@2.122.1 stop 2>$null | Out-Null
    npx -y supabase@2.122.1 start 2>$null | Out-Null
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
docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Error2 'Docker no esta corriendo. Abri Docker Desktop y espera a que termine de iniciar.'; exit 1 }
Ok 'Node, pnpm y Docker disponibles'

# 2. IP
if (-not $Ip) { $Ip = Obtener-IpLan }
if ($Ip -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { Error2 "IP invalida: $Ip"; exit 1 }
$enInterfaz = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -eq $Ip }
if (-not $enInterfaz) { Aviso "La IP $Ip no esta configurada en esta maquina: no vas a poder entrar desde otro dispositivo." }
Ok "IP de red detectada: $Ip"

$appUrl = "http://${Ip}:${Puerto}"
$apiUrl = "http://${Ip}:54321"

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
  } else {
    Aviso 'Sin IA_API_KEY en supabase/functions/.env: los botones de IA van a fallar (la app anda igual).'
  }
}

# 8. Resumen
Info ''
Info '==============================  PROCISO EN RED  =============================='
Write-Host "  App:        $appUrl" -ForegroundColor Green
Write-Host "  Studio:     http://${Ip}:54323" -ForegroundColor Gray
Write-Host "  Correo:     http://${Ip}:54324" -ForegroundColor Gray
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
