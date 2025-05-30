# PC Buddy - Get Backup Information Script
# Retrieves information about existing backups

param(
    [string]$BackupLocation = ""
)

try {
    # Use provided backup location or fall back to registry/default
    if (-not $BackupLocation) {
        # Check for custom backup location in registry
        $registryPath = "HKCU:\Software\PC-Buddy"
        
        try {
            if (Test-Path $registryPath) {
                $BackupLocation = Get-ItemPropertyValue -Path $registryPath -Name "BackupLocation" -ErrorAction Stop
            }
        } catch {
            # Custom location not set, will use default
        }
        
        # Use default if no custom location
        if (-not $BackupLocation) {
            $documentsPath = [Environment]::GetFolderPath('MyDocuments')
            $BackupLocation = Join-Path $documentsPath "PC-Buddy-Backups"
        }
    }
    
    $backupExists = Test-Path $BackupLocation
    
    # Get backup history from registry
    $lastBackupDate = "Never"
    $backupCount = 0
    
    try {
        if (Test-Path $registryPath) {
            $lastBackupDate = Get-ItemPropertyValue -Path $registryPath -Name "LastBackupDate" -ErrorAction SilentlyContinue
            $backupCount = Get-ItemPropertyValue -Path $registryPath -Name "BackupCount" -ErrorAction SilentlyContinue
            
            if (-not $lastBackupDate) { $lastBackupDate = "Never" }
            if (-not $backupCount) { $backupCount = 0 }
        }
    } catch {
        # Registry values not set
    }
    
    # If backup location exists, get more details
    $totalSize = 0
    $fileCount = 0
    
    if ($backupExists) {
        try {
            $backupFiles = Get-ChildItem -Path $BackupLocation -Recurse -File -ErrorAction SilentlyContinue
            $fileCount = $backupFiles.Count
            $totalSize = ($backupFiles | Measure-Object -Property Length -Sum).Sum
        } catch {
            # Error getting file details
        }
    }
    
    # Create result object
    $result = @{
        BackupLocation = $BackupLocation
        BackupLocationExists = $backupExists
        LastBackupDate = $lastBackupDate
        BackupCount = $backupCount
        TotalBackupSize = $totalSize
        BackupFileCount = $fileCount
    }
    
    $result | ConvertTo-Json
    
} catch {
    Write-Error "Failed to get backup information: $($_.Exception.Message)"
} 