param (
    [Parameter(Mandatory = $true)]
    [string]$DriveLetter
)

$ErrorActionPreference = 'SilentlyContinue'
$driveRoot = ($DriveLetter.TrimEnd(':') + ':\')

Write-Host "Targeting drive $driveRoot for deep cleaning..."

# Define known paths to clean on that drive
$paths = @(
    "$driveRoot\Temp\*",
    "$driveRoot\Windows\Temp\*",
    "$driveRoot\Windows\Prefetch\*",
    "$driveRoot\Users\*\AppData\Local\Temp\*",
    "$driveRoot\Users\*\AppData\Local\Microsoft\Windows\INetCache\*",
    "$driveRoot\Users\*\AppData\Local\Microsoft\Windows\Temporary Internet Files\*",
    "$driveRoot\Users\*\AppData\Local\Google\Chrome\User Data\Default\Cache\*",
    "$driveRoot\Users\*\AppData\Roaming\Mozilla\Firefox\Profiles\*\cache2\*",
    "$driveRoot\Users\*\Downloads\*.tmp"
)

foreach ($path in $paths) {
    Write-Host "🧹 Cleaning: $path"
    Remove-Item -Path $path -Force -Recurse
}

# Recycle Bin (only works for system drive)
if ($driveRoot -eq $env:SystemDrive) {
    try {
        Clear-RecycleBin -Force
        Write-Host "[Recycle Bin] Emptied."
    } catch {}
}

# DISM only works on system drive
if ($driveRoot -eq $env:SystemDrive) {
    Write-Host "🧼 Running DISM cleanup..."
    DISM /Online /Cleanup-Image /StartComponentCleanup | Out-Null
}

Write-Host "`n Deep clean on $driveRoot completed!"
