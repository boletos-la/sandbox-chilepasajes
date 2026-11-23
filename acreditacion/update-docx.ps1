Add-Type -AssemblyName System.IO.Compression.FileSystem

$sourceDocx = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\Acreditacion-Integracion-API-Chilepasajes.docx"
$targetDocx = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\Acreditacion-Integracion-API-Chilepasajes-Completado.docx"
$tempDir = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\acreditacion\temp_docx"
$modifiedXmlPath = "c:\Users\EQUIPO2\Desktop\test-chilepasajes\acreditacion\document_modified.xml"

if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}

[System.IO.Compression.ZipFile]::ExtractToDirectory($sourceDocx, $tempDir)

Copy-Item -Path $modifiedXmlPath -Destination (Join-Path $tempDir "word\document.xml") -Force

if (Test-Path $targetDocx) {
    Remove-Item -Path $targetDocx -Force
}

[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $targetDocx)

Remove-Item -Path $tempDir -Recurse -Force

Write-Output ("Docx updated successfully at: " + $targetDocx)
