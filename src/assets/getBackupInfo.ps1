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
    $backupFiles = @()
    
    if ($backupExists) {
        try {
            # Look for both files and directories - prioritize ZIP files
            $files = Get-ChildItem -Path $BackupLocation -File -ErrorAction SilentlyContinue | Where-Object { 
                $_.Extension -eq ".zip" -or $_.Extension -eq ".7z" -or $_.Name -like "*backup*" -or $_.Name -like "SystemBackup_*"
            }
            $directories = Get-ChildItem -Path $BackupLocation -Directory -ErrorAction SilentlyContinue | Where-Object { 
                $_.Name -like "*backup*" -or $_.Name -like "SystemBackup_*" 
            }
            
            # Combine files and directories for counting and processing
            $allBackupItems = @()
            $allBackupItems += $files
            $allBackupItems += $directories
            
            $fileCount = $allBackupItems.Count
            $totalSize = 0
            
            # Calculate total size for files (directories will show their contained size)
            foreach ($item in $allBackupItems) {
                if ($item.PSIsContainer) {
                    # It's a directory - calculate size of all contents
                    try {
                        $dirSize = (Get-ChildItem -Path $item.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
                        $totalSize += $dirSize
                    } catch {
                        # If we can't calculate directory size, skip it
                    }
                } else {
                    # It's a file
                    $totalSize += $item.Length
                }
            }
            
            # Get backup file/directory details
            $backupFiles = $allBackupItems | ForEach-Object {
                $itemSize = 0
                $itemType = "File"
                
                if ($_.PSIsContainer) {
                    # It's a directory
                    $itemType = "Directory"
                    try {
                        $itemSize = (Get-ChildItem -Path $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
                        if ($null -eq $itemSize) { $itemSize = 0 }
                    } catch {
                        $itemSize = 0
                    }
                } else {
                    # It's a file
                    $itemSize = $_.Length
                    if ($null -eq $itemSize) { $itemSize = 0 }
                }
                
                @{
                    Name = $_.Name
                    Type = $itemType
                    Size = $itemSize
                    SizeFormatted = if ($itemSize -gt 1GB) {
                        "{0:N2} GB" -f ($itemSize / 1GB)
                    } elseif ($itemSize -gt 1MB) {
                        "{0:N2} MB" -f ($itemSize / 1MB)
                    } elseif ($itemSize -gt 1KB) {
                        "{0:N2} KB" -f ($itemSize / 1KB)
                    } else {
                        "{0} bytes" -f $itemSize
                    }
                    CreatedDate = $_.CreationTime.ToString("yyyy-MM-dd HH:mm:ss")
                    ModifiedDate = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
                }
            } | Sort-Object { [DateTime]$_.CreatedDate } -Descending
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
        BackupFiles = $backupFiles
    }
    
    $result | ConvertTo-Json
    
} catch {
    Write-Error "Failed to get backup information: $($_.Exception.Message)"
} 