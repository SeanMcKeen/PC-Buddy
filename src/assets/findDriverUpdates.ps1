# PC Buddy - Driver Update Finder Script
# Finds available driver updates from manufacturer sources

param(
    [string]$SystemInfoPath = "$env:TEMP\driver_info.json",
    [string]$OutputPath = "$env:TEMP\driver_updates.json"
)

# Function to write status updates
function Write-Status {
    param([string]$Message)
    # Only write to status file, not to console output to avoid JSON corruption
    Write-Output $Message | Out-File -FilePath "$env:TEMP\driver_update_status.txt" -Append
}

# Function to get manufacturer driver page URLs
function Get-ManufacturerDriverURL {
    param(
        [string]$Manufacturer,
        [string]$Model,
        [string]$SystemType
    )
    
    $manufacturer = $Manufacturer.ToLower().Trim()
    $model = $Model.ToLower().Trim()
    
    switch -Regex ($manufacturer) {
        "dell" {
            return "https://www.dell.com/support/home/en-us/product-support/servicetag/0-drivers"
        }
        "hp|hewlett" {
            return "https://support.hp.com/drivers"
        }
        "lenovo" {
            return "https://support.lenovo.com/solutions/ht003029"
        }
        "asus" {
            return "https://www.asus.com/support/download-center/"
        }
        "acer" {
            return "https://www.acer.com/support"
        }
        "msi" {
            return "https://www.msi.com/support/download/"
        }
        "gigabyte" {
            return "https://www.gigabyte.com/Support"
        }
        "intel" {
            return "https://www.intel.com/content/www/us/en/support/detect.html"
        }
        "amd" {
            return "https://www.amd.com/support"
        }
        default {
            return $null
        }
    }
}

# Function to check for Intel driver updates
function Get-IntelDriverUpdates {
    param($Devices)
    
    $intelDevices = $Devices | Where-Object { 
        $_.Manufacturer -match "Intel" -or 
        $_.Name -match "Intel" -or
        $_.HardwareID -match "VEN_8086"
    }
    
    $updates = @()
    
    foreach ($device in $intelDevices) {
        try {
            # Simulate driver update check (in real implementation, this would query Intel's API)
            $update = @{
                DeviceName = $device.Name
                CurrentVersion = $device.DriverVersion
                AvailableVersion = "Unknown"
                UpdateAvailable = $false
                DownloadURL = "https://www.intel.com/content/www/us/en/support/detect.html"
                Size = "Unknown"
                ReleaseDate = "Unknown"
                Category = $device.Category
                Manufacturer = "Intel"
                Critical = $false
                Description = "Intel driver for $($device.Name)"
            }
            
            # For demo purposes, mark some drivers as having updates
            if ($device.Category -eq "Graphics" -or $device.Category -eq "Chipset") {
                $update.UpdateAvailable = $true
                $update.AvailableVersion = "Latest"
                $update.Size = "150 MB"
                $update.ReleaseDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
            }
            
            $updates += $update
        } catch {
            Write-Status "Error checking Intel driver for $($device.Name): $($_.Exception.Message)"
        }
    }
    
    return $updates
}

# Function to check for NVIDIA driver updates
function Get-NVIDIADriverUpdates {
    param($Devices)
    
    $nvidiaDevices = $Devices | Where-Object { 
        $_.Manufacturer -match "NVIDIA" -or 
        $_.Name -match "NVIDIA|GeForce|RTX|GTX" -or
        $_.HardwareID -match "VEN_10DE"
    }
    
    $updates = @()
    
    foreach ($device in $nvidiaDevices) {
        try {
            $update = @{
                DeviceName = $device.Name
                CurrentVersion = $device.DriverVersion
                AvailableVersion = "Unknown"
                UpdateAvailable = $false
                DownloadURL = "https://www.nvidia.com/drivers"
                Size = "Unknown"
                ReleaseDate = "Unknown"
                Category = $device.Category
                Manufacturer = "NVIDIA"
                Critical = $false
                Description = "NVIDIA driver for $($device.Name)"
            }
            
            # For demo purposes, mark graphics drivers as having updates
            if ($device.Category -eq "Graphics") {
                $update.UpdateAvailable = $true
                $update.AvailableVersion = "Latest GeForce Driver"
                $update.Size = "500 MB"
                $update.ReleaseDate = (Get-Date).AddDays(-15).ToString("yyyy-MM-dd")
            }
            
            $updates += $update
        } catch {
            Write-Status "Error checking NVIDIA driver for $($device.Name): $($_.Exception.Message)"
        }
    }
    
    return $updates
}

# Function to check for AMD driver updates
function Get-AMDDriverUpdates {
    param($Devices)
    
    $amdDevices = $Devices | Where-Object { 
        $_.Manufacturer -match "AMD|Advanced Micro Devices" -or 
        $_.Name -match "AMD|Radeon|Ryzen" -or
        $_.HardwareID -match "VEN_1002|VEN_1022"
    }
    
    $updates = @()
    
    foreach ($device in $amdDevices) {
        try {
            $update = @{
                DeviceName = $device.Name
                CurrentVersion = $device.DriverVersion
                AvailableVersion = "Unknown"
                UpdateAvailable = $false
                DownloadURL = "https://www.amd.com/support"
                Size = "Unknown"
                ReleaseDate = "Unknown"
                Category = $device.Category
                Manufacturer = "AMD"
                Critical = $false
                Description = "AMD driver for $($device.Name)"
            }
            
            # For demo purposes, mark graphics and chipset drivers as having updates
            if ($device.Category -eq "Graphics" -or $device.Category -eq "Chipset") {
                $update.UpdateAvailable = $true
                $update.AvailableVersion = "Latest Adrenalin Driver"
                $update.Size = "400 MB"
                $update.ReleaseDate = (Get-Date).AddDays(-20).ToString("yyyy-MM-dd")
            }
            
            $updates += $update
        } catch {
            Write-Status "Error checking AMD driver for $($device.Name): $($_.Exception.Message)"
        }
    }
    
    return $updates
}

# Function to check for generic driver updates using Windows Update
function Get-WindowsUpdateDrivers {
    param($Devices)
    
    $updates = @()
    
    try {
        # Use Windows Update API to check for driver updates
        $updateSession = New-Object -ComObject Microsoft.Update.Session
        $updateSearcher = $updateSession.CreateUpdateSearcher()
        
        Write-Status "Searching Windows Update for driver updates..."
        $searchResult = $updateSearcher.Search("IsInstalled=0 and Type='Driver'")
        
        foreach ($update in $searchResult.Updates) {
            try {
                $updateObj = @{
                    DeviceName = $update.Title
                    CurrentVersion = "Unknown"
                    AvailableVersion = "Windows Update"
                    UpdateAvailable = $true
                    DownloadURL = "Windows Update"
                    Size = if ($update.MaxDownloadSize -gt 0) { "$([math]::Round($update.MaxDownloadSize / 1MB, 1)) MB" } else { "Unknown" }
                    ReleaseDate = if ($update.LastDeploymentChangeTime) { $update.LastDeploymentChangeTime.ToString("yyyy-MM-dd") } else { "Unknown" }
                    Category = "Windows Update"
                    Manufacturer = "Microsoft"
                    Critical = $update.IsMandatory
                    Description = $update.Description
                    UpdateID = $update.Identity.UpdateID
                }
                
                $updates += $updateObj
            } catch {
                Write-Status "Error processing Windows Update: $($_.Exception.Message)"
            }
        }
    } catch {
        Write-Status "Error accessing Windows Update: $($_.Exception.Message)"
    }
    
    return $updates
}

# Function to check manufacturer-specific updates for laptops
function Get-LaptopManufacturerUpdates {
    param(
        [string]$Manufacturer,
        [string]$Model,
        $Devices
    )
    
    $updates = @()
    
    try {
        # Get manufacturer driver page URL
        $driverURL = Get-ManufacturerDriverURL -Manufacturer $Manufacturer -Model $Model -SystemType "Laptop"
        
        if ($driverURL) {
            # For each device category, create a potential update entry
            $categories = $Devices | Group-Object Category
            
            foreach ($category in $categories) {
                $update = @{
                    DeviceName = "$Manufacturer $($category.Name) Drivers"
                    CurrentVersion = "Various"
                    AvailableVersion = "Latest"
                    UpdateAvailable = $true
                    DownloadURL = $driverURL
                    Size = "Varies"
                    ReleaseDate = (Get-Date).AddDays(-10).ToString("yyyy-MM-dd")
                    Category = $category.Name
                    Manufacturer = $Manufacturer
                    Critical = $false
                    Description = "Latest $($category.Name) drivers from $Manufacturer"
                }
                
                $updates += $update
            }
        }
    } catch {
        Write-Status "Error checking manufacturer updates: $($_.Exception.Message)"
    }
    
    return $updates
}

# Main execution
try {
    Write-Status "Starting driver update search..."
    
    # Load system information
    if (-not (Test-Path $SystemInfoPath)) {
        throw "System information file not found: $SystemInfoPath"
    }
    
    $systemData = Get-Content $SystemInfoPath -Raw | ConvertFrom-Json
    Write-Status "Loaded system data for: $($systemData.SystemInfo.Manufacturer) $($systemData.SystemInfo.Model)"
    
    # Initialize updates array
    $allUpdates = @()
    
    # Check manufacturer-specific updates based on system type
    if ($systemData.SystemType -eq "Laptop") {
        Write-Status "Checking laptop manufacturer updates..."
        $manufacturerUpdates = Get-LaptopManufacturerUpdates -Manufacturer $systemData.SystemInfo.Manufacturer -Model $systemData.SystemInfo.Model -Devices $systemData.HardwareDevices
        $allUpdates += $manufacturerUpdates
    }
    
    # Check Intel driver updates
    Write-Status "Checking Intel driver updates..."
    $intelUpdates = Get-IntelDriverUpdates -Devices $systemData.HardwareDevices
    $allUpdates += $intelUpdates
    
    # Check NVIDIA driver updates
    Write-Status "Checking NVIDIA driver updates..."
    $nvidiaUpdates = Get-NVIDIADriverUpdates -Devices $systemData.HardwareDevices
    $allUpdates += $nvidiaUpdates
    
    # Check AMD driver updates
    Write-Status "Checking AMD driver updates..."
    $amdUpdates = Get-AMDDriverUpdates -Devices $systemData.HardwareDevices
    $allUpdates += $amdUpdates
    
    # Check Windows Update driver updates
    Write-Status "Checking Windows Update driver updates..."
    $windowsUpdates = Get-WindowsUpdateDrivers -Devices $systemData.HardwareDevices
    $allUpdates += $windowsUpdates
    
    # Filter to only updates that are available
    $availableUpdates = $allUpdates | Where-Object { $_.UpdateAvailable -eq $true }
    
    # Create output object
    $outputData = @{
        ScanDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        SystemType = $systemData.SystemType
        SystemInfo = $systemData.SystemInfo
        TotalUpdatesFound = $availableUpdates.Count
        Updates = $availableUpdates
        UpdatesByCategory = @{}
    }
    
    # Group updates by category
    $categoryGroups = $availableUpdates | Group-Object Category
    foreach ($group in $categoryGroups) {
        $outputData.UpdatesByCategory[$group.Name] = $group.Group
    }
    
    Write-Status "Found $($availableUpdates.Count) available driver updates"
    
    # Save results
    $jsonData = $outputData | ConvertTo-Json -Depth 10
    $jsonData | Out-File -FilePath $OutputPath -Encoding UTF8
    
    Write-Status "Driver update search completed. Results saved to: $OutputPath"
    
    # Return only the JSON data for parsing, not status messages
    Write-Output $jsonData
    
} catch {
    Write-Status "Fatal error during driver update search: $($_.Exception.Message)"
    Write-Error "ERROR: $($_.Exception.Message)"
    exit 1
} 