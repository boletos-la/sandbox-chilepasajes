Add-Type -AssemblyName System.IO.Compression.FileSystem

$docxPath = 'c:\Users\EQUIPO2\Desktop\test-chilepasajes\Acreditacion-Integracion-API-Chilepasajes.docx'
$zip = [System.IO.Compression.ZipFile]::OpenRead($docxPath)
$entry = $zip.GetEntry('word/_rels/document.xml.rels')
$reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
$rels = $reader.ReadToEnd()
$reader.Close()
$zip.Dispose()

[System.IO.File]::WriteAllText('c:\Users\EQUIPO2\Desktop\test-chilepasajes\acreditacion\document.xml.rels', $rels, [System.Text.Encoding]::UTF8)
Write-Output $rels
