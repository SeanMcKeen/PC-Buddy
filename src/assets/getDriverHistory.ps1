# PC Buddy - Driver History Script
# Retrieves driver installation history and restore points

param(
    [string]$OutputPath = "$env:TEMP\driver_history.json"
)

# Function to write status updates
function Write-Status {
    param([string]$Message)
    Write-Host $Message
}

# Function to get driver installation history
function Get-DriverInstallHistory {
    try {
        $historyPath = "$env:TEMP\PC-Buddy-Driver-History.json"
        
        if (Test-Path $historyPath) {
            $history = Get-Content $historyPath -Raw | ConvertFrom-Json
            Write-Status "Found $($history.Count) driver installation records"
            return $history
        } else {
            Write-Status "No driver installation history found"
            return @()
        }
    } catch {
        Write-Status "Error reading driver history: $($_.Exception.Message)"
        return @()
    }
}

# Function to get system restore points
function Get-RestorePoints {
    try {
        Write-Status "Getting system restore points..."
        
        # Get restore points using PowerShell cmdlet
        $restorePoints = Get-ComputerRestorePoint | Sort-Object CreationTime -Descending
        
        $points = @()
        foreach ($point in $restorePoints) {
            $pointObj = @{
                SequenceNumber = $point.SequenceNumber
                Description = $point.Description
                CreationTime = $point.CreationTime.ToString("yyyy-MM-dd HH:mm:ss")
                RestorePointType = $point.RestorePointType.ToString()
                IsPCBuddyCreated = $point.Description -match "PC Buddy"
            }
            $points += $pointObj
        }
        
        Write-Status "Found $($points.Count) restore points"
        return $points
    } catch {
        Write-Status "Error getting restore points: $($_.Exception.Message)"
        return @()
    }
}

# Function to get Windows Update driver history
function Get-WindowsUpdateDriverHistory {
    try {
        Write-Status "Getting Windows Update driver history..."
        
        # Get Windows Update history
        $updateSession = New-Object -ComObject Microsoft.Update.Session
        $updateSearcher = $updateSession.CreateUpdateSearcher()
        $historyCount = $updateSearcher.GetTotalHistoryCount()
        
        if ($historyCount -eq 0) {
            return @()
        }
        
        # Get last 100 updates
        $maxResults = [Math]::Min($historyCount, 100)
        $updateHistory = $updateSearcher.QueryHistory(0, $maxResults)
        
        $driverUpdates = @()
        
        for ($i = 0; $i -lt $updateHistory.Count; $i++) {
            $update = $updateHistory.Item($i)
            
            # Filter for driver updates
            if ($update.Categories.Count -gt 0) {
                $isDriver = $false
                for ($j = 0; $j -lt $update.Categories.Count; $j++) {
                    if ($update.Categories.Item($j).Name -eq "Drivers") {
                        $isDriver = $true
                        break
                    }
                }
                
                if ($isDriver) {
                    $updateObj = @{
                        Title = $update.Title
                        Date = $update.Date.ToString("yyyy-MM-dd HH:mm:ss")
                        Operation = $update.Operation.ToString()
                        ResultCode = $update.ResultCode.ToString()
                        UpdateID = $update.UpdateIdentity.UpdateID
                        Success = $update.ResultCode -eq 2  # orcSucceeded = 2
                    }
                    $driverUpdates += $updateObj
                }
            }
        }
        
        Write-Status "Found $($driverUpdates.Count) Windows Update driver installations"
        return $driverUpdates
    } catch {
        Write-Status "Error getting Windows Update history: $($_.Exception.Message)"
        return @()
    }
}

# Function to get recently installed drivers from system
function Get-RecentlyInstalledDrivers {
    try {
        Write-Status "Getting recently installed drivers from system..."
        
        # Get drivers installed in the last 30 days
        $cutoffDate = (Get-Date).AddDays(-30)
        $drivers = Get-WmiObject Win32_PnPSignedDriver | Where-Object {
            $_.DriverDate -and [DateTime]::ParseExact($_.DriverDate.Split('.')[0], "yyyyMMdd", $null) -ge $cutoffDate
        }
        
        $recentDrivers = @()
        foreach ($driver in $drivers) {
            try {
                $driverDate = [DateTime]::ParseExact($driver.DriverDate.Split('.')[0], "yyyyMMdd", $null)
                
                $driverObj = @{
                    DeviceName = $driver.DeviceName
                    DriverVersion = $driver.DriverVersion
                    DriverDate = $driverDate.ToString("yyyy-MM-dd")
                    DriverProvider = $driver.DriverProviderName
                    InfName = $driver.InfName
                    IsSigned = $driver.IsSigned
                    HardwareID = $driver.HardwareID
                }
                $recentDrivers += $driverObj
            } catch {
                # Skip drivers with invalid date format
            }
        }
        
        # Sort by date descending
        $recentDrivers = $recentDrivers | Sort-Object DriverDate -Descending
        
        Write-Status "Found $($recentDrivers.Count) recently installed drivers"
        return $recentDrivers
    } catch {
        Write-Status "Error getting recently installed drivers: $($_.Exception.Message)"
        return @()
    }
}

# Main execution
try {
    Write-Status "Starting driver history collection..."
    
    # Initialize output object
    $outputData = @{
        ScanDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        PCBuddyInstallHistory = @()
        WindowsUpdateHistory = @()
        RecentSystemDrivers = @()
        RestorePoints = @()
        Summary = @{
            TotalPCBuddyInstalls = 0
            TotalWindowsUpdates = 0
            TotalRecentDrivers = 0
            TotalRestorePoints = 0
            LastInstallDate = $null
        }
    }
    
    # Get PC Buddy driver installation history
    $outputData.PCBuddyInstallHistory = Get-DriverInstallHistory
    
    # Get Windows Update driver history
    $outputData.WindowsUpdateHistory = Get-WindowsUpdateDriverHistory
    
    # Get recently installed drivers from system
    $outputData.RecentSystemDrivers = Get-RecentlyInstalledDrivers
    
    # Get system restore points
    $outputData.RestorePoints = Get-RestorePoints
    
    # Calculate summary statistics
    $outputData.Summary.TotalPCBuddyInstalls = $outputData.PCBuddyInstallHistory.Count
    $outputData.Summary.TotalWindowsUpdates = $outputData.WindowsUpdateHistory.Count
    $outputData.Summary.TotalRecentDrivers = $outputData.RecentSystemDrivers.Count
    $outputData.Summary.TotalRestorePoints = $outputData.RestorePoints.Count
    
    # Find last installation date
    $allDates = @()
    if ($outputData.PCBuddyInstallHistory.Count -gt 0) {
        $allDates += $outputData.PCBuddyInstallHistory | ForEach-Object { [DateTime]$_.Date }
    }
    if ($outputData.WindowsUpdateHistory.Count -gt 0) {
        $allDates += $outputData.WindowsUpdateHistory | ForEach-Object { [DateTime]$_.Date }
    }
    
    if ($allDates.Count -gt 0) {
        $outputData.Summary.LastInstallDate = ($allDates | Sort-Object -Descending | Select-Object -First 1).ToString("yyyy-MM-dd HH:mm:ss")
    }
    
    Write-Status "History collection completed"
    Write-Status "Summary: $($outputData.Summary.TotalPCBuddyInstalls) PC Buddy installs, $($outputData.Summary.TotalWindowsUpdates) Windows updates, $($outputData.Summary.TotalRestorePoints) restore points"
    
    # Save results
    $jsonData = $outputData | ConvertTo-Json -Depth 10
    $jsonData | Out-File -FilePath $OutputPath -Encoding UTF8
    
    Write-Status "Driver history saved to: $OutputPath"
    Write-Output "SUCCESS: Driver history collected"
    
} catch {
    Write-Status "Fatal error during history collection: $($_.Exception.Message)"
    Write-Output "ERROR: $($_.Exception.Message)"
    exit 1
} 