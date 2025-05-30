$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'

function Get-FilePublisher {
    param([string]$filePath)
    try {
        $signature = Get-AuthenticodeSignature -FilePath $filePath
        if ($signature.Status -eq 'Valid') {
            return $signature.SignerCertificate.Subject -replace '^CN=|,.*$'
        }
    } catch {}
    return $null
}

function Resolve-ShortcutTarget {
    param([string]$shortcutPath)
    try {
        if ($shortcutPath -like '*.lnk') {
            $shell = New-Object -ComObject WScript.Shell
            $shortcut = $shell.CreateShortcut($shortcutPath)
            return $shortcut.TargetPath
        }
    } catch {}
    return $shortcutPath
}

function Get-SafetyRating {
    param([string]$name, [string]$command)
    $critical = @('SecurityHealth', 'RtkAudUService', 'explorer')
    $system = @('OneDrive', 'Teams', 'Discord', 'Steam', 'Spotify', 'Slack', 'Chrome', 'Firefox', 'Edge')

    if ($critical | Where-Object { $name -like "*$_*" -or $command -like "*$_*" }) { return 'danger' }
    if ($system | Where-Object { $name -like "*$_*" -or $command -like "*$_*" }) { return 'caution' }
        return 'safe'
    }

function Normalize-ExeName {
    param ([string]$command)
    if ($command) {
        $exe = $command -replace '"', '' -split '\s+' | Where-Object { $_ -like '*.exe' } | Select-Object -First 1
        return ([System.IO.Path]::GetFileName($exe)).ToLower()
    }
    return $null
}

function Get-RegistryStatus {
    param (
        [string]$registryName,
        [string]$exeName
    )
    $keys = @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run',
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder'
    )

    foreach ($key in $keys) {
        try {
            $props = Get-ItemProperty -Path $key
            foreach ($prop in $props.PSObject.Properties) {
                $normName = $prop.Name.Replace('.lnk', '')
                $normReg = $registryName.Replace('.lnk', '')
                if ($normName -ieq $normReg -or $normName -ieq $exeName) {
                    $bytes = [byte[]]$prop.Value
                    if ($bytes[0] -eq 3) { return 'disabled' }
                    else { return 'enabled' }
                }
            }
        } catch {}
    }
    return 'enabled'  # fallback default
}

function Get-StartupPrograms {
    $items = @()

    # Registry entries
    $regSources = @(
        @{ Path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'; Hive = 'HKCU' },
        @{ Path = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run'; Hive = 'HKLM' }
    )

    foreach ($src in $regSources) {
        $entries = Get-ItemProperty -Path $src.Path
        foreach ($prop in $entries.PSObject.Properties) {
            if ($prop.Name -like 'PS*') { continue }

            $name = $prop.Name
            $command = $prop.Value.Trim('"')
            $exeName = Normalize-ExeName $command

            $items += [PSCustomObject]@{
                Name        = $name
                RegistryName= $name
                Command     = $command
                Source      = $src.Path
                Status      = Get-RegistryStatus -registryName $name -exeName $exeName
                Publisher   = Get-FilePublisher -filePath $command
                Safety      = Get-SafetyRating -name $name -command $command
                Description = 'Registry startup'
            }
        }
    }

    # Startup folders
    $folders = @(
        "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup",
        "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Startup"
    )

    foreach ($folder in $folders) {
        if (Test-Path $folder) {
            Get-ChildItem -Path $folder -Filter *.lnk | ForEach-Object {
                $target = Resolve-ShortcutTarget $_.FullName
                $exeName = Normalize-ExeName $target
                $items += [PSCustomObject]@{
                    Name        = $_.BaseName
                    RegistryName= $_.Name
                    Command     = $target
                    Source      = 'Startup'
                    Status      = Get-RegistryStatus -registryName $_.Name -exeName $exeName
                    Publisher   = Get-FilePublisher -filePath $target
                    Safety      = Get-SafetyRating -name $_.BaseName -command $target
                    Description = 'Startup folder item'
                }
            }
        }
    }

    # Deduplication
    $seen = @{}
    $deduped = @()
    foreach ($item in $items) {
        $key = "$($item.RegistryName.ToLowerInvariant())|$(Normalize-ExeName $item.Command)"
        if (-not $seen.ContainsKey($key)) {
            $seen[$key] = $true
            $deduped += $item
        }
    }

    return $deduped
}

$startupPrograms = Get-StartupPrograms
$startupPrograms | ConvertTo-Json -Depth 4 | Out-File -Encoding UTF8 "$env:TEMP\startup_programs.json"
