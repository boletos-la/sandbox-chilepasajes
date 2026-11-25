Add-Type -AssemblyName System.IO.Compression.FileSystem

$baseDir = "c:\Users\EQUIPO2\Desktop\test-chilepasajes"
$zipPackage = Join-Path $baseDir "Dossier-Acreditacion-Chilepasajes.zip"
$dossierDir = Join-Path $baseDir "Dossier-Acreditacion-Chilepasajes"
$tempPackageDir = Join-Path $baseDir "acreditacion\temp_package"

if (Test-Path $tempPackageDir) {
    Remove-Item -Path $tempPackageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempPackageDir -Force | Out-Null

# Copiar el Word completado
Copy-Item -Path (Join-Path $baseDir "Acreditacion-Integracion-API-Chilepasajes-Completado.docx") -Destination (Join-Path $tempPackageDir "Acreditacion-Integracion-API-Chilepasajes.docx") -Force

# Copiar la carpeta casos/ (incluyendo los 24 JSONs y los 2 PDFs de C10)
Copy-Item -Path (Join-Path $baseDir "acreditacion\casos") -Destination (Join-Path $tempPackageDir "casos") -Recurse -Force

# Copiar C05.json en raíz del paquete
Copy-Item -Path (Join-Path $baseDir "acreditacion\C05.json") -Destination (Join-Path $tempPackageDir "C05.json") -Force

# Sincronizar también la carpeta Dossier-Acreditacion-Chilepasajes/
if (Test-Path $dossierDir) {
    Remove-Item -Path $dossierDir -Recurse -Force
}
Copy-Item -Path $tempPackageDir -Destination $dossierDir -Recurse -Force

# Eliminar zip previo si existe
if (Test-Path $zipPackage) {
    Remove-Item -Path $zipPackage -Force
}

# Crear ZIP final de entrega
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempPackageDir, $zipPackage)
Remove-Item -Path $tempPackageDir -Recurse -Force

Write-Output ("Paquete ZIP final y carpeta Dossier-Acreditacion-Chilepasajes actualizados en: " + $zipPackage)
