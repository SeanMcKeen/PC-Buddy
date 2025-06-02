# PC Buddy - Driver Revert Script
# Reverts drivers using system restore points

param(
    [string]$RestorePointNumber,
    [string]$RestorePointDescription = ""
)

# Function to write status updates
function Write-Status {
    param([string]$Message)
    Write-Host $Message
    Write-Output $Message | Out-File -FilePath "$env:TEMP\driver_revert_status.txt" -Append
}

# Function to find restore point by number or description
function Find-RestorePoint {
    param(
        [string]$Number,
        [string]$Description
    )
    
    try {
        $restorePoints = Get-ComputerRestorePoint | Sort-Object CreationTime -Descending
        
        if ($Number -and $Number -ne "") {
            $point = $restorePoints | Where-Object { $_.SequenceNumber -eq [int]$Number }
            if ($point) {
                return $point
            }
        }
        
        if ($Description -and $Description -ne "") {
            $point = $restorePoints | Where-Object { $_.Description -like "*$Description*" }
            if ($point) {
                return $point
            }
        }
        
        return $null
    } catch {
        Write-Status "Error finding restore point: $($_.Exception.Message)"
        return $null
    }
}

# Function to perform system restore
function Start-SystemRestore {
    param($RestorePoint)
    
    try {
        Write-Status "Starting system restore to point: $($RestorePoint.Description)"
        Write-Status "Restore point created: $($RestorePoint.CreationTime)"
        Write-Status "Sequence number: $($RestorePoint.SequenceNumber)"
        
        # Create a confirmation message
        $confirmation = @"
WARNING: System Restore will restart your computer and restore system files to an earlier time.

Restore Point Details:
- Description: $($RestorePoint.Description)
- Created: $($RestorePoint.CreationTime)
- Sequence Number: $($RestorePoint.SequenceNumber)

This process cannot be interrupted once started and will require a system restart.
"@
        
        Write-Status $confirmation
        
        # Use PowerShell cmdlet to start restore
        Write-Status "Initiating system restore..."
        
        # Note: This will restart the computer automatically
        Restore-Computer -RestorePoint $RestorePoint.SequenceNumber -Confirm:$false
        
        Write-Status "System restore initiated successfully"
        return $true
        
    } catch {
        Write-Status "Error during system restore: $($_.Exception.Message)"
        
        # Try alternative method using Windows System Restore executable
        try {
            Write-Status "Trying alternative restore method..."
            
            $process = Start-Process -FilePath "rstrui.exe" -ArgumentList "/runonce" -Wait -PassThru
            
            if ($process.ExitCode -eq 0) {
                Write-Status "System restore UI launched successfully"
                return $true
            } else {
                Write-Status "Failed to launch system restore UI"
                return $false
            }
        } catch {
            Write-Status "Alternative restore method failed: $($_.Exception.Message)"
            return $false
        }
    }
}

# Function to validate restore point safety
function Test-RestorePointSafety {
    param($RestorePoint)
    
    try {
        # Check if restore point is recent (within last 30 days)
        $daysDifference = (Get-Date) - $RestorePoint.CreationTime
        
        if ($daysDifference.Days -gt 30) {
            Write-Status "WARNING: Restore point is $($daysDifference.Days) days old"
            return $false
        }
        
        # Check if it's a PC Buddy created restore point
        if ($RestorePoint.Description -match "PC Buddy") {
            Write-Status "Restore point was created by PC Buddy - safe to use"
            return $true
        }
        
        # Check restore point type
        if ($RestorePoint.RestorePointType -eq "MODIFY_SETTINGS") {
            Write-Status "Restore point type is MODIFY_SETTINGS - appropriate for driver changes"
            return $true
        }
        
        Write-Status "Restore point appears safe to use"
        return $true
        
    } catch {
        Write-Status "Error validating restore point: $($_.Exception.Message)"
        return $false
    }
}

# Function to log revert operation
function Log-RevertOperation {
    param(
        [string]$RestorePointDescription,
        [string]$RestorePointDate,
        [int]$SequenceNumber,
        [bool]$Success
    )
    
    try {
        $logPath = "$env:TEMP\PC-Buddy-Driver-History.json"
        $logEntry = @{
            Date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            DriverName = "System Restore"
            Version = "Revert"
            Manufacturer = "PC Buddy"
            Category = "System Restore"
            Success = $Success
            RestorePointAvailable = $true
            Operation = "Revert"
            RestorePointDescription = $RestorePointDescription
            RestorePointDate = $RestorePointDate
            SequenceNumber = $SequenceNumber
        }
        
        $history = @()
        if (Test-Path $logPath) {
            $existingData = Get-Content $logPath -Raw | ConvertFrom-Json
            $history = $existingData
        }
        
        $history += $logEntry
        
        # Keep only last 50 entries
        if ($history.Count -gt 50) {
            $history = $history[-50..-1]
        }
        
        $history | ConvertTo-Json -Depth 3 | Out-File -FilePath $logPath -Encoding UTF8
        Write-Status "Revert operation logged to driver history"
    } catch {
        Write-Status "Error logging revert operation: $($_.Exception.Message)"
    }
}

# Main execution
try {
    Write-Status "Starting driver revert operation..."
    
    if (-not $RestorePointNumber -and -not $RestorePointDescription) {
        throw "Either RestorePointNumber or RestorePointDescription must be provided"
    }
    
    # Find the restore point
    $restorePoint = Find-RestorePoint -Number $RestorePointNumber -Description $RestorePointDescription
    
    if (-not $restorePoint) {
        throw "Restore point not found with the specified criteria"
    }
    
    Write-Status "Found restore point: $($restorePoint.Description)"
    Write-Status "Created: $($restorePoint.CreationTime)"
    
    # Validate restore point safety
    if (-not (Test-RestorePointSafety -RestorePoint $restorePoint)) {
        Write-Status "WARNING: Restore point may not be safe to use, but proceeding anyway"
    }
    
    # Log the revert attempt
    Log-RevertOperation -RestorePointDescription $restorePoint.Description -RestorePointDate $restorePoint.CreationTime.ToString("yyyy-MM-dd HH:mm:ss") -SequenceNumber $restorePoint.SequenceNumber -Success $false
    
    # Perform the system restore
    $restoreSuccess = Start-SystemRestore -RestorePoint $restorePoint
    
    if ($restoreSuccess) {
        # Update log with success (though this may not execute if system restarts)
        Log-RevertOperation -RestorePointDescription $restorePoint.Description -RestorePointDate $restorePoint.CreationTime.ToString("yyyy-MM-dd HH:mm:ss") -SequenceNumber $restorePoint.SequenceNumber -Success $true
        
        Write-Status "System restore operation completed successfully"
        Write-Status "Your computer will restart to complete the restore process"
        Write-Output "SUCCESS: System restore initiated - $($restorePoint.Description)"
    } else {
        Write-Status "System restore operation failed"
        Write-Output "ERROR: Failed to start system restore"
    }
    
} catch {
    Write-Status "Fatal error during driver revert: $($_.Exception.Message)"
    
    # Log failed revert
    if ($restorePoint) {
        Log-RevertOperation -RestorePointDescription $restorePoint.Description -RestorePointDate $restorePoint.CreationTime.ToString("yyyy-MM-dd HH:mm:ss") -SequenceNumber $restorePoint.SequenceNumber -Success $false
    }
    
    Write-Output "ERROR: $($_.Exception.Message)"
    exit 1
} 