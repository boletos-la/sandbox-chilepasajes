Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("c:\Users\EQUIPO2\Desktop\test-chilepasajes\Acreditacion-Integracion-API-Chilepasajes.docx")
$entry = $zip.GetEntry("word/styles.xml")
$reader = New-Object System.IO.StreamReader($entry.Open())
$text = $reader.ReadToEnd()
$reader.Close()
$zip.Dispose()
[System.IO.File]::WriteAllText("c:\Users\EQUIPO2\Desktop\test-chilepasajes\acreditacion\styles.xml", $text)
Write-Output ("styles.xml extracted. Length: " + $text.Length)
