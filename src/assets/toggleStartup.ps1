param (
    [Parameter(Mandatory=$true)]
    [string]$Name,

    [Parameter(Mandatory=$true)]
    [string]$Source,

    [Parameter(Mandatory=$true)]
    [int]$Enable
)

function Set-StartupStatus {
    param (
        [string]$RegistryPath,
        [string]$Name,
        [int]$Enable
    )

    Write-Output "[DEBUG] Set-StartupStatus called with:"
    Write-Output "[DEBUG] RegistryPath: $RegistryPath"
    Write-Output "[DEBUG] Name: $Name"
    Write-Output "[DEBUG] Enable: $Enable"

    if (-not (Test-Path $RegistryPath)) {
        Write-Output "[DEBUG] Creating registry path: $RegistryPath"
        New-Item -Path $RegistryPath -Force | Out-Null
    }

    # Always create a new 12-byte array with proper format
    $newValue = [byte[]](0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    
    # Set first byte to 02 for enabled, 03 for disabled
    $newValue[0] = if ($Enable -eq 1) { 0x02 } else { 0x03 }
    
    Write-Output "[DEBUG] Setting first byte to: $($newValue[0])"

    try {
        Write-Output "[DEBUG] Attempting to set registry value"
        Set-ItemProperty -Path $RegistryPath -Name $Name -Value $newValue -ErrorAction Stop
        Write-Output "[DEBUG] Successfully set registry value"
        
        if ($Enable -eq 1) {
            Write-Output "[$Name] has been enabled"
        } else {
            Write-Output "[$Name] has been disabled"
        }
    } catch {
        Write-Error "Failed to update registry value for '$Name': $_"
        exit 1
    }
}

# Main script logic
$registryPath = switch -Regex ($Source) {
    'HKU\\.*\\Run' { 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run' }
    'HKLM\\.*\\Run' { 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run' }
    'Startup' { 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder' }
    default {
        Write-Error "Unknown source location: $Source"
        exit 1
    }
}

Set-StartupStatus -RegistryPath $registryPath -Name $Name -Enable $Enable
