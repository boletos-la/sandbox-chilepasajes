Add-Type -AssemblyName System.IO.Compression.FileSystem

$baseDir = "c:\Users\EQUIPO2\Desktop\test-chilepasajes"
$zipPackage = Join-Path $baseDir "Dossier-Acreditacion-Chilepasajes.zip"
$tempPackageDir = Join-Path $baseDir "acreditacion\temp_package"

if (Test-Path $tempPackageDir) {
    Remove-Item -Path $tempPackageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempPackageDir -Force | Out-Null

# Copiar el Word completado
Copy-Item -Path (Join-Path $baseDir "Acreditacion-Integracion-API-Chilepasajes-Completado.docx") -Destination (Join-Path $tempPackageDir "Acreditacion-Integracion-API-Chilepasajes.docx")

# Copiar la carpeta casos/
Copy-Item -Path (Join-Path $baseDir "acreditacion\casos") -Destination (Join-Path $tempPackageDir "casos") -Recurse

# Copiar C05.json
Copy-Item -Path (Join-Path $baseDir "acreditacion\C05.json") -Destination (Join-Path $tempPackageDir "C05.json")

# Eliminar zip previo si existe
if (Test-Path $zipPackage) {
    Remove-Item -Path $zipPackage -Force
}

# Crear ZIP final de entrega
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempPackageDir, $zipPackage)
Remove-Item -Path $tempPackageDir -Recurse -Force

Write-Output ("Paquete ZIP final creado exitosamente en: " + $zipPackage)
