Add-Type -AssemblyName System.IO.Compression.FileSystem

$sourceDocx = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\Acreditacion-Integracion-API-Chilepasajes.docx"
$targetDocx = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\Acreditacion-Integracion-API-Chilepasajes-Completado.docx"
$tempDir = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\acreditacion\temp_docx"

$modifiedDocumentXml = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\acreditacion\document_modified.xml"
$modifiedStylesXml = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\acreditacion\styles_modified.xml"
$modifiedRelsXml = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\acreditacion\document.xml.rels.modified"

# Limpiar directorio temporal
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}

# Descomprimir
[System.IO.Compression.ZipFile]::ExtractToDirectory($sourceDocx, $tempDir)

# Sobrescribir word/document.xml
Copy-Item -Path $modifiedDocumentXml -Destination (Join-Path $tempDir "word\document.xml") -Force

# Sobrescribir word/styles.xml
Copy-Item -Path $modifiedStylesXml -Destination (Join-Path $tempDir "word\styles.xml") -Force

# Sobrescribir word/_rels/document.xml.rels
Copy-Item -Path $modifiedRelsXml -Destination (Join-Path $tempDir "word\_rels\document.xml.rels") -Force

# Eliminar targetDocx previo si existe
if (Test-Path $targetDocx) {
    Remove-Item -Path $targetDocx -Force
}

# Comprimir a targetDocx
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $targetDocx)

# Limpiar tempDir
Remove-Item -Path $tempDir -Recurse -Force

# Asegurar que casos/ exista también en la raíz del proyecto para que al abrir el docx funcione inmediatamente
$rootDirCasos = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\casos"
Copy-Item -Path "c:\Users\EQUIPO2\Desktop\test-chilepasajes\acreditacion\casos" -Destination $rootDirCasos -Recurse -Force

Write-Output ("Docx con hipervinculos y orden exacto generado exitosamente en: " + $targetDocx)
