# Pide la API key de Claude sin mostrarla ni guardarla en disco, y levanta la app con el OCR activo.
# Uso:  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev-con-clave.ps1
$secure = Read-Host "Pega tu ANTHROPIC_API_KEY y presiona Enter (no se mostrara)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:ANTHROPIC_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
if ([string]::IsNullOrWhiteSpace($env:ANTHROPIC_API_KEY)) {
    Write-Host "No se pego ninguna clave: la app arranca, pero el OCR seguira desactivado." -ForegroundColor Yellow
} else {
    Write-Host "Clave cargada en esta sesion. Levantando la app en http://localhost:5180 ..." -ForegroundColor Green
}
Set-Location (Split-Path $PSScriptRoot -Parent)
npm run dev
