try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    Write-Output "Word COM available: True"
    $word.Quit()
} catch {
    Write-Output "Word COM available: False ($($_.Exception.Message))"
}
