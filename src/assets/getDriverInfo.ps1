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

# Function to get all hardware devices and their drivers
function Get-HardwareDevices {
    try {
        $devices = Get-WmiObject -Class Win32_PnPEntity | Where-Object { $_.DeviceID -and $_.Name }
        $deviceList = @()
        
        foreach ($device in $devices) {
            try {
                # Get driver details
                $driverQuery = "ASSOCIATORS OF {Win32_PnPEntity.DeviceID='$($device.DeviceID)'} WHERE AssocClass=Win32_SystemDriverPNPEntity"
                $driver = Get-WmiObject -Query $driverQuery -ErrorAction SilentlyContinue
                
                # Get additional device properties
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
                }
                
                if ($driver) {
                    $deviceObj.Driver = $driver.Name
                    $deviceObj.DriverVersion = $driver.Version
                    $deviceObj.DriverDate = $driver.InstallDate
                    $deviceObj.DriverProvider = $driver.DriverProviderName
                }
                
                # Try to get driver info from registry
                if ($device.DeviceID) {
                    try {
                        $regPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($device.DeviceID)"
                        if (Test-Path $regPath) {
                            $regData = Get-ItemProperty -Path $regPath -ErrorAction SilentlyContinue
                            if ($regData.DriverVersion) { $deviceObj.DriverVersion = $regData.DriverVersion }
                            if ($regData.DriverDate) { $deviceObj.DriverDate = $regData.DriverDate }
                        }
                    } catch {
                        # Ignore registry errors
                    }
                }
                
                # Categorize device
                $deviceObj.Category = Get-DeviceCategory -Device $device
                
                $deviceList += $deviceObj
            } catch {
                Write-Status "Error processing device $($device.Name): $($_.Exception.Message)"
            }
        }
        
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

# Function to get installed drivers list
function Get-InstalledDrivers {
    try {
        $drivers = Get-WmiObject -Class Win32_SystemDriver
        $driverList = @()
        
        foreach ($driver in $drivers) {
            $driverList += @{
                Name = $driver.Name
                PathName = $driver.PathName
                State = $driver.State
                Status = $driver.Status
                Description = $driver.Description
                DisplayName = $driver.DisplayName
                InstallDate = $driver.InstallDate
            }
        }
        
        return $driverList
    } catch {
        Write-Status "Error getting installed drivers: $($_.Exception.Message)"
        return @()
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
        InstalledDrivers = @()
        Categories = @{}
    }
    
    Write-Status "System type detected: $($outputData.SystemType)"
    Write-Status "System: $($outputData.SystemInfo.Manufacturer) $($outputData.SystemInfo.Model)"
    
    Write-Status "Scanning hardware devices..."
    $outputData.HardwareDevices = Get-HardwareDevices
    
    Write-Status "Getting installed drivers..."
    $outputData.InstalledDrivers = Get-InstalledDrivers
    
    # Group devices by category
    $outputData.Categories = $outputData.HardwareDevices | Group-Object Category | ForEach-Object {
        @{ $_.Name = $_.Group }
    }
    
    Write-Status "Scan completed. Found $($outputData.HardwareDevices.Count) devices."
    
    # Convert to JSON and save
    $jsonData = $outputData | ConvertTo-Json -Depth 10
    $jsonData | Out-File -FilePath $OutputPath -Encoding UTF8
    
    Write-Status "Driver information saved to: $OutputPath"
    
    # Return only the JSON data for parsing, not status messages
    Write-Output $jsonData
    
} catch {
    Write-Status "Fatal error during driver scan: $($_.Exception.Message)"
    Write-Error "ERROR: $($_.Exception.Message)"
    exit 1
} 