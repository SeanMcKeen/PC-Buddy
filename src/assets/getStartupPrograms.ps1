# getStartupPrograms.ps1

function Get-FilePublisher {
    param([string]$filePath)
    
    try {
        $signature = Get-AuthenticodeSignature -FilePath $filePath -ErrorAction Stop
        if ($signature.Status -eq "Valid") {
            return $signature.SignerCertificate.Subject -replace '^CN=|,.*$'
        }
    } catch {}
    return $null
}

function Resolve-ShortcutTarget {
    param([string]$shortcutPath)
    
    try {
        if ($shortcutPath -like "*.lnk") {
            $shell = New-Object -ComObject WScript.Shell
            $shortcut = $shell.CreateShortcut($shortcutPath)
            return $shortcut.TargetPath
        }
    } catch {}
    return $shortcutPath
}

function Get-SafetyRating {
    param(
        [string]$name,
        [string]$command,
        [string]$source
    )

    # Critical system components that should not be disabled
    $criticalComponents = @(
        'SecurityHealth',        # Windows Security
        'RtkAudUService',       # Audio drivers
        'igfxpers',             # Intel Graphics
        'NvBackend',            # NVIDIA
        'IAStorIcon',           # Intel Storage
        'CTFMon',               # CTF Loader (Windows input)
        'SecurityHealthSystray', # Windows Security Systray
        'HxOutlook',            # Windows Mail
        'RuntimeBroker',        # Windows Runtime
        'StartMenuExperienceHost', # Start Menu
        'SearchHost',           # Windows Search
        'ShellExperienceHost',  # Windows Shell
        'sihost',              # Shell Infrastructure Host
        'explorer'             # Windows Explorer
    )

    # Components that may impact system functionality but are not critical
    $systemComponents = @(
        'OneDrive',
        'Teams',
        'DropboxUpdate',
        'GoogleUpdate',
        'AdobeUpdateService',
        'EvernoteClipper',
        'Discord',
        'Steam',
        'Epic Games',
        'Spotify',
        'ccleaner',
        'uTorrent',
        'Skype',
        'Slack',
        'Chrome',
        'Firefox',
        'Edge'
    )

    # Check for critical system components
    foreach ($critical in $criticalComponents) {
        if ($name -like "*$critical*" -or $command -like "*$critical*") {
            return 'danger'
        }
    }

    # Check for system components with moderate impact
    foreach ($sys in $systemComponents) {
        if ($name -like "*$sys*" -or $command -like "*$sys*") {
            return 'caution'
        }
    }

    # Default to safe for user-installed applications
    return 'safe'
}

function Get-StartupPrograms {
    $items = @()
    
    # 1. WMI Startup Commands (covers Run and RunOnce keys)
    try {
        $wmiStartupItems = Get-CimInstance -ClassName Win32_StartupCommand
        foreach ($item in $wmiStartupItems) {
            $command = $item.Command
            $name = $item.Name
            
            # Resolve .lnk files to their target executables
            $resolvedCommand = Resolve-ShortcutTarget -shortcutPath ($command -replace '"', '')
            
            # Check status in registry
            $regPath = switch -Regex ($item.Location) {
                'HKU\\.*\\Run' { 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run' }
                'HKLM\\.*\\Run' { 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run' }
                'Startup' { 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder' }
                default { $null }
            }
            
            $status = 'enabled'  # Default to enabled
            if ($regPath) {
                $approvedStatus = Get-ItemProperty -Path $regPath -Name $name -ErrorAction SilentlyContinue
                if ($approvedStatus) {
                    $bytes = [byte[]]($approvedStatus.$name)
                    $status = if ($bytes -and $bytes[0] -eq 3) { 'disabled' } else { 'enabled' }
                }
            }
            
            $items += [PSCustomObject]@{
                Name = $name
                RegistryName = $name
                Command = $resolvedCommand
                Source = $item.Location
                Status = $status
                Publisher = Get-FilePublisher -filePath $resolvedCommand
                Safety = Get-SafetyRating -name $name -command $resolvedCommand -source $item.Location
                Description = $item.Description
            }
        }
    } catch {
        Write-Error "Failed to get WMI startup items: $_"
        # Don't return here, continue with other startup locations
    }

    # 2. Startup Folder Items
    $startupFolders = @(
        "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup",
        "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp"
    )

    foreach ($folder in $startupFolders) {
        if (Test-Path $folder) {
            Get-ChildItem -Path $folder -File | ForEach-Object {
                $resolvedPath = Resolve-ShortcutTarget -shortcutPath $_.FullName
                $items += [PSCustomObject]@{
                    Name = $_.BaseName
                    RegistryName = $_.Name
                    Command = $resolvedPath
                    Source = 'Startup'
                    Status = 'enabled'
                    Publisher = Get-FilePublisher -filePath $resolvedPath
                    Safety = Get-SafetyRating -name $_.BaseName -command $resolvedPath -source 'Startup'
                    Description = "Startup folder item"
                }
            }
        }
    }

    # Sort items by safety rating (safe -> caution -> danger)
    $safetyOrder = @{
        'safe' = 1
        'caution' = 2
        'danger' = 3
    }
    
    $items = $items | Sort-Object { $safetyOrder[$_.Safety] }

    return $items
}

# Get and return startup programs
$startupPrograms = Get-StartupPrograms
$startupPrograms | ConvertTo-Json

