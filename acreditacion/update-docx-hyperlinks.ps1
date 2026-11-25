Add-Type -AssemblyName System.IO.Compression.FileSystem

$sourceDocx = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\Acreditacion-Integracion-API-Chilepasajes.docx"
$targetDocx = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\Acreditacion-Integracion-API-Chilepasajes-Completado.docx"
$tempDir = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\acreditacion\temp_docx"

$modifiedDocumentXml = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\acreditacion\document_modified.xml"
$modifiedStylesXml = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\acreditacion\styles_modified.xml"
$modifiedRelsXml = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\acreditacion\document.xml.rels.modified"

if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}

[System.IO.Compression.ZipFile]::ExtractToDirectory($sourceDocx, $tempDir)

Copy-Item -Path $modifiedDocumentXml -Destination (Join-Path $tempDir "word\document.xml") -Force
Copy-Item -Path $modifiedStylesXml -Destination (Join-Path $tempDir "word\styles.xml") -Force
Copy-Item -Path $modifiedRelsXml -Destination (Join-Path $tempDir "word\_rels\document.xml.rels") -Force

if (Test-Path $targetDocx) {
    Remove-Item -Path $targetDocx -Force
}

[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $targetDocx)
Remove-Item -Path $tempDir -Recurse -Force

# Sincronizar casos/ en la raíz del proyecto sin anidar casos/casos
$rootDirCasos = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\casos"
if (Test-Path (Join-Path $rootDirCasos "casos")) {
    Remove-Item -Path (Join-Path $rootDirCasos "casos") -Recurse -Force
}
if (-not (Test-Path $rootDirCasos)) {
    New-Item -ItemType Directory -Path $rootDirCasos -Force | Out-Null
}
Copy-Item -Path "c:\Users\EQUIPO2\Desktop\test-chilepasajes\acreditacion\casos\*" -Destination $rootDirCasos -Force

Write-Output ("Docx con hipervinculos y orden exacto generado exitosamente en: " + $targetDocx)
