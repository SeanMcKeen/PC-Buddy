# PC Buddy - System Backup Script
# Creates a system backup using Windows built-in backup tools

param(
    [string]$BackupLocation = ""
)

try {
    # Check for admin privileges
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    
    if (-not $isAdmin) {
        Write-Output "Admin privileges required for system backup. Some files may be skipped."
    }
    
    # Use provided backup location or fall back to registry/default
    if (-not $BackupLocation) {
        $registryPath = "HKCU:\Software\PC-Buddy"
        
        try {
            if (Test-Path $registryPath) {
                $BackupLocation = Get-ItemPropertyValue -Path $registryPath -Name "BackupLocation" -ErrorAction Stop
            }
        } catch {
            # Custom location not set, use default
        }
        
        if (-not $BackupLocation) {
            $documentsPath = [Environment]::GetFolderPath('MyDocuments')
            $BackupLocation = Join-Path $documentsPath "PC-Buddy-Backups"
        }
    }
    
    # Create timestamped backup folder (temporary for creating zip)
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $tempBackupFolder = Join-Path $env:TEMP "PC-Buddy-Backup-$timestamp"
    $zipFileName = "SystemBackup_$timestamp.zip"
    $finalZipPath = Join-Path $BackupLocation $zipFileName
    
    # Create backup directory
    if (-not (Test-Path $BackupLocation)) {
        New-Item -Path $BackupLocation -ItemType Directory -Force | Out-Null
    }
    
    New-Item -Path $tempBackupFolder -ItemType Directory -Force | Out-Null
    
    Write-Output "Creating system backup as ZIP file: $finalZipPath"
    
    # Define important directories to backup
    $userProfile = $env:USERPROFILE
    $backupItems = @(
        @{
            Source = Join-Path $userProfile "Desktop"
            Destination = Join-Path $tempBackupFolder "Desktop"
            Name = "Desktop"
        },
        @{
            Source = Join-Path $userProfile "Documents"
            Destination = Join-Path $tempBackupFolder "Documents"
            Name = "Documents"
        },
        @{
            Source = Join-Path $userProfile "Pictures"
            Destination = Join-Path $tempBackupFolder "Pictures"
            Name = "Pictures"
        },
        @{
            Source = Join-Path $userProfile "Music"
            Destination = Join-Path $tempBackupFolder "Music"
            Name = "Music"
        },
        @{
            Source = Join-Path $userProfile "Videos"
            Destination = Join-Path $tempBackupFolder "Videos"
            Name = "Videos"
        }
    )
    
    # Backup summary
    $backupSummary = @{
        StartTime = Get-Date
        BackupLocation = $finalZipPath
        Items = @()
        TotalFiles = 0
        TotalSize = 0
        Errors = @()
    }
    
    # Process each backup item
    foreach ($item in $backupItems) {
        if (Test-Path $item.Source) {
            Write-Output "Backing up $($item.Name)..."
            
            try {
                # Get file count and size before backup, excluding backup directories
                $sourceFiles = Get-ChildItem -Path $item.Source -Recurse -File -ErrorAction SilentlyContinue | 
                    Where-Object { 
                        # Exclude backup directories to prevent recursive backups
                        -not ($_.FullName -like "*PC-Buddy-Backups*" -or $_.FullName -like "*SystemBackup_*") -and
                        (
                            $_.Extension -in @('.doc', '.docx', '.pdf', '.txt', '.xlsx', '.pptx', '.jpg', '.png', '.mp3', '.mp4') -or
                            $_.Length -lt 50MB 
                        )
                    }
                
                $itemSummary = @{
                    Name = $item.Name
                    FileCount = $sourceFiles.Count
                    Size = ($sourceFiles | Measure-Object -Property Length -Sum).Sum
                    Status = "Success"
                }
                
                # Copy files with robocopy for better handling
                $robocopyArgs = @(
                    "`"$($item.Source)`"",
                    "`"$($item.Destination)`"",
                    "/E",           # Copy subdirectories including empty ones
                    "/R:1",         # Retry only once on failure
                    "/W:1",         # Wait 1 second between retries
                    "/NFL",         # No file list
                    "/NDL",         # No directory list
                    "/NP",          # No progress
                    "/XF", "*.tmp", "*.temp", "Thumbs.db", # Exclude temp files
                    "/XD", "node_modules", ".git", ".vs", "PC-Buddy-Backups", "SystemBackup_*"   # Exclude unnecessary directories and backup folders
                )
                
                $robocopyProcess = Start-Process -FilePath "robocopy" -ArgumentList $robocopyArgs -NoNewWindow -Wait -PassThru
                
                if ($robocopyProcess.ExitCode -le 3) {  # Robocopy exit codes 0-3 are success
                    $backupSummary.Items += $itemSummary
                    $backupSummary.TotalFiles += $itemSummary.FileCount
                    $backupSummary.TotalSize += $itemSummary.Size
                } else {
                    $itemSummary.Status = "Failed"
                    $backupSummary.Items += $itemSummary
                    $backupSummary.Errors += "Failed to backup $($item.Name): Robocopy exit code $($robocopyProcess.ExitCode)"
                }
                
            } catch {
                $itemSummary = @{
                    Name = $item.Name
                    FileCount = 0
                    Size = 0
                    Status = "Error"
                }
                $backupSummary.Items += $itemSummary
                $backupSummary.Errors += "Error backing up $($item.Name): $($_.Exception.Message)"
            }
        } else {
            Write-Output "$($item.Name) folder not found, skipping..."
        }
    }
    
    # Create backup manifest
    $backupSummary.EndTime = Get-Date
    $backupSummary.Duration = ($backupSummary.EndTime - $backupSummary.StartTime).TotalMinutes
    
    $manifestPath = Join-Path $tempBackupFolder "backup_manifest.json"
    $backupSummary | ConvertTo-Json -Depth 3 | Out-File -FilePath $manifestPath -Encoding UTF8
    
    # Create ZIP file from backup folder
    Write-Output "Creating ZIP archive..."
    try {
        # Use built-in .NET compression
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::CreateFromDirectory($tempBackupFolder, $finalZipPath)
        
        # Clean up temporary folder
        Remove-Item -Path $tempBackupFolder -Recurse -Force -ErrorAction SilentlyContinue
        
        # Get final ZIP file size
        $zipInfo = Get-Item $finalZipPath
        $zipSizeMB = [math]::Round($zipInfo.Length / 1MB, 2)
        
        Write-Output "ZIP file created successfully: $zipSizeMB MB"
        
    } catch {
        $backupSummary.Errors += "Failed to create ZIP file: $($_.Exception.Message)"
        Write-Output "Warning: Failed to create ZIP file, backup remains in folder: $tempBackupFolder"
    }
    
    # Update registry with backup information
    try {
        if (-not (Test-Path $registryPath)) {
            New-Item -Path $registryPath -Force | Out-Null
        }
        
        Set-ItemProperty -Path $registryPath -Name "LastBackupDate" -Value $timestamp
        
        # Increment backup count
        $currentCount = 0
        try {
            $currentCount = Get-ItemPropertyValue -Path $registryPath -Name "BackupCount" -ErrorAction SilentlyContinue
            if (-not $currentCount) { $currentCount = 0 }
        } catch { }
        
        Set-ItemProperty -Path $registryPath -Name "BackupCount" -Value ($currentCount + 1)
        
    } catch {
        $backupSummary.Errors += "Failed to update registry: $($_.Exception.Message)"
    }
    
    # Generate result message
    $successCount = ($backupSummary.Items | Where-Object { $_.Status -eq "Success" }).Count
    $totalItems = $backupSummary.Items.Count
    $sizeInMB = [math]::Round($backupSummary.TotalSize / 1MB, 2)
    
    if ($backupSummary.Errors.Count -eq 0) {
        Write-Output "Backup completed successfully! Backed up $($backupSummary.TotalFiles) files ($sizeInMB MB) from $successCount/$totalItems locations to: $finalZipPath"
    } else {
        Write-Output "Backup completed with warnings. Backed up $($backupSummary.TotalFiles) files ($sizeInMB MB) from $successCount/$totalItems locations. Check manifest for details."
    }
    
} catch {
    Write-Error "Backup failed: $($_.Exception.Message)"
    exit 1
} 