# get-disk-usage.ps1
$drives = Get-PSDrive -PSProvider 'FileSystem' | Where-Object { $_.Free -gt 0 }
$results = @()

foreach ($drive in $drives) {
    $used = $drive.Used
    $free = $drive.Free
    $total = $used + $free
    $percentUsed = if ($total -ne 0) { [math]::Round(($used / $total) * 100, 1) } else { 0 }

    $results += [PSCustomObject]@{
        Name         = $drive.Name
        UsedGB       = [math]::Round($used / 1GB, 1)
        FreeGB       = [math]::Round($free / 1GB, 1)
        TotalGB      = [math]::Round($total / 1GB, 1)
        PercentUsed  = $percentUsed
        IsSystem     = ($env:SystemDrive -eq "$($drive.Name):")
    }
}

$results | ConvertTo-Json -Compress
