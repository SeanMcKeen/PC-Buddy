# PC Buddy - Driver Information Script
# Detects system type and gathers comprehensive driver information

param(
    [string]$OutputPath = "$env:TEMP\driver_info.json"
)

# Function to write status updates
function Write-Status {
    param([string]$Message)
    # Only write to status file, not to console output to avoid JSON corruption
    Write-Output $Message | Out-File -FilePath "$env:TEMP\driver_scan_status.txt" -Append
}

# Function to detect if system is laptop or desktop
function Get-SystemType {
    try {
        $chassis = Get-WmiObject -Class Win32_SystemEnclosure
        $chassisTypes = $chassis.ChassisTypes
        
        # Laptop chassis types: 8, 9, 10, 11, 12, 14, 18, 21, 30, 31, 32
        $laptopTypes = @(8, 9, 10, 11, 12, 14, 18, 21, 30, 31, 32)
        
        foreach ($type in $chassisTypes) {
            if ($laptopTypes -contains $type) {
                return "Laptop"
            }
        }
        return "Desktop"
    } catch {
        Write-Status "Error detecting system type: $($_.Exception.Message)"
        return "Unknown"
    }
}

# Function to get system manufacturer and model
function Get-SystemInfo {
    try {
        $computer = Get-WmiObject -Class Win32_ComputerSystem
        $bios = Get-WmiObject -Class Win32_BIOS
        
        return @{
            Manufacturer = $computer.Manufacturer
            Model = $computer.Model
            SerialNumber = $bios.SerialNumber
            BIOSVersion = $bios.SMBIOSBIOSVersion
        }
    } catch {
        Write-Status "Error getting system info: $($_.Exception.Message)"
        return @{}
    }
}

# Function to get all hardware devices and their drivers (optimized)
function Get-HardwareDevices {
    try {
        Write-Status "Starting device enumeration..."
        
        # Get all devices in one query to minimize WMI overhead
        $devices = Get-WmiObject -Class Win32_PnPEntity | Where-Object { 
            $_.DeviceID -and $_.Name -and $_.Status -eq "OK" 
        }
        
        Write-Status "Found $($devices.Count) active devices, getting driver information..."
        
        # GET ALL PNP DRIVERS IN ONE QUERY - This is the key optimization!
        $allPnPDrivers = @{}
        try {
            $pnpDrivers = Get-WmiObject -Class Win32_PnPSignedDriver
            foreach ($driver in $pnpDrivers) {
                if ($driver.DeviceID) {
                    $allPnPDrivers[$driver.DeviceID] = $driver
                }
            }
            Write-Status "Loaded $($allPnPDrivers.Count) PnP driver records for fast lookup"
        } catch {
            Write-Status "Warning: Could not load PnP drivers, will use registry lookups only"
        }
        
        $deviceList = @()
        $processedCount = 0
        
        foreach ($device in $devices) {
            try {
                # Skip certain device types that don't need driver updates to speed up processing
                if ($device.PNPClass -in @("Volume", "DiskDrive", "SCSIAdapter") -and 
                    $device.Name -notmatch "Graphics|Audio|Network|USB|Bluetooth") {
                    continue
                }
                
                # Get basic device properties
                $deviceObj = @{
                    Name = $device.Name
                    DeviceID = $device.DeviceID
                    HardwareID = $device.HardwareID
                    CompatibleID = $device.CompatibleID
                    Manufacturer = $device.Manufacturer
                    Status = $device.Status
                    PNPClass = $device.PNPClass
                    ClassGuid = $device.ClassGuid
                    Driver = $null
                    DriverVersion = $null
                    DriverDate = $null
                    DriverProvider = $null
                    Category = $null
                    DriverFile = $null
                    DriverCompany = $null
                    DriverInfName = $null
                }
                
                # Categorize device first to skip non-important devices
                $deviceObj.Category = Get-DeviceCategory -Device $device
                
                # Skip "Other" category devices that aren't important for driver updates
                if ($deviceObj.Category -eq "Other" -and 
                    $device.Name -notmatch "Graphics|Audio|Network|USB|Bluetooth|Intel|AMD|NVIDIA|Realtek") {
                    continue
                }
                
                # Fast lookup in our pre-loaded PnP drivers hash table
                if ($allPnPDrivers.ContainsKey($device.DeviceID)) {
                    $pnpDriver = $allPnPDrivers[$device.DeviceID]
                    $deviceObj.DriverVersion = $pnpDriver.DriverVersion
                    $deviceObj.DriverDate = $pnpDriver.DriverDate
                    $deviceObj.DriverProvider = $pnpDriver.DriverProviderName
                    $deviceObj.DriverInfName = $pnpDriver.InfName
                }
                
                # Only do expensive registry lookups for important devices without driver info
                if (-not $deviceObj.DriverVersion -and $deviceObj.Category -in @("Graphics", "Audio", "Network", "Chipset", "USB", "Bluetooth")) {
                    try {
                        $cleanDeviceID = $device.DeviceID -replace '\\', '\\'
                        $regPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$cleanDeviceID"
                        
                        if (Test-Path $regPath) {
                            $regData = Get-ItemProperty -Path $regPath -ErrorAction SilentlyContinue
                            
                            if ($regData.DriverVersion) { 
                                $deviceObj.DriverVersion = $regData.DriverVersion 
                            }
                            if ($regData.DriverDate) { 
                                $deviceObj.DriverDate = $regData.DriverDate 
                            }
                            if ($regData.DriverDesc) { 
                                $deviceObj.Driver = $regData.DriverDesc 
                            }
                            if ($regData.Mfg) { 
                                $deviceObj.DriverProvider = $regData.Mfg 
                            }
                            if ($regData.InfPath) { 
                                $deviceObj.DriverInfName = $regData.InfPath 
                            }
                        }
                    } catch {
                        # Registry lookup failed, continue with what we have
                    }
                }
                
                # Clean up version format if we have one
                if ($deviceObj.DriverVersion) {
                    $deviceObj.DriverVersion = $deviceObj.DriverVersion.Trim()
                    
                    # Convert driver date if it's in YYYYMMDD format
                    if ($deviceObj.DriverDate -and $deviceObj.DriverDate -match '^\d{8}$') {
                        $year = $deviceObj.DriverDate.Substring(0, 4)
                        $month = $deviceObj.DriverDate.Substring(4, 2)  
                        $day = $deviceObj.DriverDate.Substring(6, 2)
                        $deviceObj.DriverDate = "$year-$month-$day"
                    }
                }
                
                $deviceList += $deviceObj
                $processedCount++
                
                # Report progress every 50 devices
                if ($processedCount % 50 -eq 0) {
                    Write-Status "Processed $processedCount devices..."
                }
                
            } catch {
                Write-Status "Error processing device $($device.Name): $($_.Exception.Message)"
            }
        }
        
        Write-Status "Device enumeration completed. Processed $($deviceList.Count) relevant devices."
        return $deviceList
    } catch {
        Write-Status "Error getting hardware devices: $($_.Exception.Message)"
        return @()
    }
}

# Function to categorize devices
function Get-DeviceCategory {
    param($Device)
    
    $name = $device.Name.ToLower()
    $class = $device.PNPClass
    
    if ($class -eq "Display") { return "Graphics" }
    if ($class -eq "Net") { return "Network" }
    if ($class -eq "AudioEndpoint" -or $class -eq "MEDIA") { return "Audio" }
    if ($class -eq "USB") { return "USB" }
    if ($class -eq "System") { return "Chipset" }
    if ($class -eq "Bluetooth") { return "Bluetooth" }
    if ($class -eq "Camera") { return "Camera" }
    if ($class -eq "Monitor") { return "Monitor" }
    if ($class -eq "Printer") { return "Printer" }
    
    # Category by name patterns
    if ($name -match "graphics|video|display|nvidia|amd|intel.*graphics") { return "Graphics" }
    if ($name -match "audio|sound|speaker|microphone") { return "Audio" }
    if ($name -match "network|ethernet|wifi|wireless|lan") { return "Network" }
    if ($name -match "bluetooth") { return "Bluetooth" }
    if ($name -match "camera|webcam") { return "Camera" }
    if ($name -match "usb|hub") { return "USB" }
    if ($name -match "chipset|bridge|controller.*intel|controller.*amd") { return "Chipset" }
    if ($name -match "touchpad|mouse|keyboard") { return "Input" }
    if ($name -match "storage|disk|nvme|sata") { return "Storage" }
    
    return "Other"
}

# Function to get CPU information
function Get-CPUInfo {
    try {
        $cpu = Get-WmiObject -Class Win32_Processor | Select-Object -First 1
        return @{
            Name = $cpu.Name
            Manufacturer = $cpu.Manufacturer
            Description = $cpu.Description
            Family = $cpu.Family
            Model = $cpu.Model
            Stepping = $cpu.Stepping
        }
    } catch {
        Write-Status "Error getting CPU info: $($_.Exception.Message)"
        return @{}
    }
}

# Function to get motherboard information
function Get-MotherboardInfo {
    try {
        $motherboard = Get-WmiObject -Class Win32_BaseBoard
        return @{
            Manufacturer = $motherboard.Manufacturer
            Product = $motherboard.Product
            Version = $motherboard.Version
            SerialNumber = $motherboard.SerialNumber
        }
    } catch {
        Write-Status "Error getting motherboard info: $($_.Exception.Message)"
        return @{}
    }
}

# Main execution
try {
    Write-Status "Starting driver information scan..."
    
    # Initialize output object
    $outputData = @{
        ScanDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        SystemType = Get-SystemType
        SystemInfo = Get-SystemInfo
        CPUInfo = Get-CPUInfo
        MotherboardInfo = Get-MotherboardInfo
        HardwareDevices = @()
        Categories = @{}
    }
    
    Write-Status "System type detected: $($outputData.SystemType)"
    Write-Status "System: $($outputData.SystemInfo.Manufacturer) $($outputData.SystemInfo.Model)"
    
    Write-Status "Scanning hardware devices..."
    $outputData.HardwareDevices = Get-HardwareDevices
    
    # Group devices by category
    $outputData.Categories = @{}
    if ($outputData.HardwareDevices.Count -gt 0) {
        $categoryGroups = $outputData.HardwareDevices | Group-Object Category
        foreach ($group in $categoryGroups) {
            $outputData.Categories[$group.Name] = $group.Group
        }
    }
    
    Write-Status "Scan completed. Found $($outputData.HardwareDevices.Count) devices."
    
    # Convert to JSON and save
    $jsonData = $outputData | ConvertTo-Json -Depth 10
    $jsonData | Out-File -FilePath $OutputPath -Encoding ASCII
    
    Write-Status "Driver information saved to: $OutputPath"
    
    # Return only the JSON data for parsing, not status messages
    Write-Output $jsonData
    
} catch {
    Write-Status "Fatal error during driver scan: $($_.Exception.Message)"
    
    # Create a fallback error response
    $errorResponse = @{
        ScanDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        SystemType = "Unknown"
        SystemInfo = @{}
        CPUInfo = @{}
        MotherboardInfo = @{}
        HardwareDevices = @()
        Categories = @{}
        Error = $_.Exception.Message
    }
    
    $errorJson = $errorResponse | ConvertTo-Json -Depth 5
    $errorJson | Out-File -FilePath $OutputPath -Encoding ASCII
    Write-Output $errorJson
    exit 1
} 