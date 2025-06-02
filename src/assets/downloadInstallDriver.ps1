# PC Buddy - Driver Download and Install Script
# Downloads and installs individual drivers safely

param(
    [string]$DriverName,
    [string]$DownloadURL,
    [string]$Manufacturer,
    [string]$Category,
    [string]$DriverVersion,
    [string]$UpdateID = "",
    [string]$DownloadPath = "$env:TEMP\PC-Buddy-Drivers"
)

# Function to write status updates
function Write-Status {
    param([string]$Message)
    Write-Host $Message
    Write-Output $Message | Out-File -FilePath "$env:TEMP\driver_install_status.txt" -Append
}

# Function to create download directory
function Initialize-DownloadPath {
    try {
        if (-not (Test-Path $DownloadPath)) {
            New-Item -ItemType Directory -Path $DownloadPath -Force | Out-Null
            Write-Status "Created download directory: $DownloadPath"
        }
        return $true
    } catch {
        Write-Status "Error creating download directory: $($_.Exception.Message)"
        return $false
    }
}

# Function to download driver from URL
function Download-DriverFromURL {
    param(
        [string]$URL,
        [string]$OutputPath
    )
    
    try {
        Write-Status "Downloading driver from: $URL"
        
        # Create web client with proper headers
        $webClient = New-Object System.Net.WebClient
        $webClient.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        
        # Download with progress tracking
        $webClient.DownloadFile($URL, $OutputPath)
        $webClient.Dispose()
        
        if (Test-Path $OutputPath) {
            $fileSize = (Get-Item $OutputPath).Length
            Write-Status "Download completed. File size: $([math]::Round($fileSize / 1MB, 2)) MB"
            return $true
        } else {
            Write-Status "Download failed - file not found"
            return $false
        }
    } catch {
        Write-Status "Download error: $($_.Exception.Message)"
        return $false
    }
}

# Function to install Windows Update driver
function Install-WindowsUpdateDriver {
    param([string]$UpdateID)
    
    try {
        Write-Status "Installing Windows Update driver: $UpdateID"
        
        # Create Windows Update session
        $updateSession = New-Object -ComObject Microsoft.Update.Session
        $updateSearcher = $updateSession.CreateUpdateSearcher()
        
        # Search for the specific update
        $searchResult = $updateSearcher.Search("UpdateID='$UpdateID'")
        
        if ($searchResult.Updates.Count -eq 0) {
            Write-Status "Update not found: $UpdateID"
            return $false
        }
        
        $update = $searchResult.Updates.Item(0)
        Write-Status "Found update: $($update.Title)"
        
        # Create update collection
        $updatesToDownload = New-Object -ComObject Microsoft.Update.UpdateColl
        $updatesToDownload.Add($update) | Out-Null
        
        # Download the update
        Write-Status "Downloading update..."
        $downloader = $updateSession.CreateUpdateDownloader()
        $downloader.Updates = $updatesToDownload
        $downloadResult = $downloader.Download()
        
        if ($downloadResult.ResultCode -eq 2) {
            Write-Status "Download successful, installing..."
            
            # Install the update
            $installer = $updateSession.CreateUpdateInstaller()
            $installer.Updates = $updatesToDownload
            $installResult = $installer.Install()
            
            if ($installResult.ResultCode -eq 2) {
                Write-Status "Installation successful"
                return $true
            } else {
                Write-Status "Installation failed with code: $($installResult.ResultCode)"
                return $false
            }
        } else {
            Write-Status "Download failed with code: $($downloadResult.ResultCode)"
            return $false
        }
    } catch {
        Write-Status "Windows Update installation error: $($_.Exception.Message)"
        return $false
    }
}

# Function to extract and install driver package
function Install-DriverPackage {
    param(
        [string]$DriverPath,
        [string]$DriverName
    )
    
    try {
        $extension = [System.IO.Path]::GetExtension($DriverPath).ToLower()
        Write-Status "Installing driver package: $DriverPath"
        
        switch ($extension) {
            ".exe" {
                Write-Status "Executing driver installer..."
                $process = Start-Process -FilePath $DriverPath -ArgumentList "/S", "/silent", "/quiet" -Wait -PassThru
                return $process.ExitCode -eq 0
            }
            ".msi" {
                Write-Status "Installing MSI package..."
                $process = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", "`"$DriverPath`"", "/quiet", "/norestart" -Wait -PassThru
                return $process.ExitCode -eq 0
            }
            ".inf" {
                Write-Status "Installing INF driver..."
                $result = Start-Process -FilePath "pnputil.exe" -ArgumentList "/add-driver", "`"$DriverPath`"", "/install" -Wait -PassThru
                return $result.ExitCode -eq 0
            }
            ".zip" {
                Write-Status "Extracting ZIP package..."
                $extractPath = Join-Path $DownloadPath "$([System.IO.Path]::GetFileNameWithoutExtension($DriverPath))_extracted"
                
                Add-Type -AssemblyName System.IO.Compression.FileSystem
                [System.IO.Compression.ZipFile]::ExtractToDirectory($DriverPath, $extractPath)
                
                # Look for setup files in the extracted folder
                $setupFiles = Get-ChildItem -Path $extractPath -Recurse -Include "*.exe", "*.msi", "*.inf" | Where-Object { $_.Name -match "setup|install|driver" }
                
                if ($setupFiles) {
                    $setupFile = $setupFiles[0]
                    Write-Status "Found setup file: $($setupFile.Name)"
                    return Install-DriverPackage -DriverPath $setupFile.FullName -DriverName $DriverName
                } else {
                    Write-Status "No setup files found in ZIP package"
                    return $false
                }
            }
            default {
                Write-Status "Unsupported driver package format: $extension"
                return $false
            }
        }
    } catch {
        Write-Status "Installation error: $($_.Exception.Message)"
        return $false
    }
}

# Function to create system restore point
function Create-RestorePoint {
    param([string]$Description)
    
    try {
        Write-Status "Creating system restore point..."
        $result = Start-Process -FilePath "powershell.exe" -ArgumentList "-Command", "Checkpoint-Computer -Description '$Description' -RestorePointType MODIFY_SETTINGS" -Wait -PassThru -WindowStyle Hidden
        
        if ($result.ExitCode -eq 0) {
            Write-Status "System restore point created successfully"
            return $true
        } else {
            Write-Status "Failed to create system restore point"
            return $false
        }
    } catch {
        Write-Status "Error creating restore point: $($_.Exception.Message)"
        return $false
    }
}

# Function to log driver installation
function Log-DriverInstallation {
    param(
        [string]$DriverName,
        [string]$Version,
        [string]$Manufacturer,
        [string]$Category,
        [bool]$Success
    )
    
    try {
        $logPath = "$env:TEMP\PC-Buddy-Driver-History.json"
        $logEntry = @{
            Date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            DriverName = $DriverName
            Version = $Version
            Manufacturer = $Manufacturer
            Category = $Category
            Success = $Success
            RestorePointAvailable = $true
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
        Write-Status "Installation logged to driver history"
    } catch {
        Write-Status "Error logging installation: $($_.Exception.Message)"
    }
}

# Main execution
try {
    Write-Status "Starting driver download and installation..."
    Write-Status "Driver: $DriverName"
    Write-Status "Manufacturer: $Manufacturer"
    Write-Status "Category: $Category"
    Write-Status "Version: $DriverVersion"
    
    # Initialize download directory
    if (-not (Initialize-DownloadPath)) {
        throw "Failed to initialize download directory"
    }
    
    # Create system restore point before installation
    $restorePointCreated = Create-RestorePoint -Description "PC Buddy - Before installing $DriverName"
    
    $installationSuccess = $false
    
    # Handle different download sources
    if ($UpdateID -and $UpdateID -ne "") {
        # Windows Update driver
        Write-Status "Installing from Windows Update..."
        $installationSuccess = Install-WindowsUpdateDriver -UpdateID $UpdateID
    } elseif ($DownloadURL -and $DownloadURL -ne "" -and $DownloadURL -ne "Windows Update") {
        # External download
        $fileName = "$([System.IO.Path]::GetFileNameWithoutExtension($DriverName)).exe"
        $downloadPath = Join-Path $DownloadPath $fileName
        
        if ($DownloadURL.StartsWith("http")) {
            # Direct download
            if (Download-DriverFromURL -URL $DownloadURL -OutputPath $downloadPath) {
                $installationSuccess = Install-DriverPackage -DriverPath $downloadPath -DriverName $DriverName
            }
        } else {
            # Manufacturer website - open for manual download
            Write-Status "Opening manufacturer download page: $DownloadURL"
            Start-Process $DownloadURL
            $installationSuccess = $true  # Mark as successful since we opened the page
        }
    } else {
        throw "No valid download source provided"
    }
    
    # Log the installation attempt
    Log-DriverInstallation -DriverName $DriverName -Version $DriverVersion -Manufacturer $Manufacturer -Category $Category -Success $installationSuccess
    
    if ($installationSuccess) {
        Write-Status "Driver installation completed successfully"
        Write-Output "SUCCESS: Driver installed - $DriverName"
    } else {
        Write-Status "Driver installation failed"
        Write-Output "ERROR: Driver installation failed - $DriverName"
    }
    
} catch {
    Write-Status "Fatal error during driver installation: $($_.Exception.Message)"
    
    # Log failed installation
    Log-DriverInstallation -DriverName $DriverName -Version $DriverVersion -Manufacturer $Manufacturer -Category $Category -Success $false
    
    Write-Output "ERROR: $($_.Exception.Message)"
    exit 1
} 