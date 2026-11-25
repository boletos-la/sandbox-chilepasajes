Add-Type -AssemblyName System.IO.Compression.FileSystem

$baseDir = "c:\Users\EQUIPO2\Desktop\test-chilepasajes"
$integDir = Join-Path $baseDir "Integracion-Chilepasajes"
$integZip = Join-Path $baseDir "Integracion-Chilepasajes.zip"

if (Test-Path $integDir) {
    Copy-Item -Path (Join-Path $baseDir "Acreditacion-Integracion-API-Chilepasajes-Completado.docx") -Destination (Join-Path $integDir "Integracion-API-Chilepasajes.docx") -Force
    Copy-Item -Path (Join-Path $baseDir "acreditacion\C05.json") -Destination (Join-Path $integDir "C05.json") -Force
    if (Test-Path (Join-Path $integDir "casos")) {
        Remove-Item -Path (Join-Path $integDir "casos") -Recurse -Force
    }
    Copy-Item -Path (Join-Path $baseDir "acreditacion\casos") -Destination (Join-Path $integDir "casos") -Recurse -Force

    if (Test-Path $integZip) {
        Remove-Item -Path $integZip -Force
    }
    [System.IO.Compression.ZipFile]::CreateFromDirectory($integDir, $integZip)
    Write-Output "Integracion-Chilepasajes y Integracion-Chilepasajes.zip sincronizados con las evidencias v2."
}
