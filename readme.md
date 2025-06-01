# 🖥️ PC Buddy

<div align="center">

**🚀 A Modern Windows System Optimization & Management Tool**

[![Version](https://img.shields.io/badge/version-0.2.3-blue.svg)](https://github.com/SeanMcKeen/pc-buddy/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](https://www.microsoft.com/windows)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

[Features](#-features) • [Installation](#-installation) • [Tech Stack](#-tech-stack) • [Version History](#-version-history)

</div>

---

## 📋 Overview

PC Buddy is a **comprehensive Windows system optimization tool** built with Electron that transforms complex system maintenance into simple, one-click operations. Whether you're managing multiple machines or keeping your personal PC running smoothly, PC Buddy provides an intuitive interface for essential Windows maintenance tasks.

**🎯 Key Benefits:**
- **One-Click System Repairs** - Automated SFC and DISM operations
- **Smart Backup Management** - Registry-integrated backup path selection with recursive protection
- **Intelligent Startup Management** - Safely optimize boot performance with color-coded safety ratings
- **Visual Disk Monitoring** - Real-time space usage with progress bars and cleanup
- **Quick Access Hub** - Essential Windows settings at your fingertips
- **Custom Shortcuts** - Personalized shortcuts with emoji icons (200+ emojis across 8 categories)
- **Network Management** - Comprehensive network tools including connectivity testing, DNS lookup, adapter management, and diagnostics

## ✨ Features

### 🔧 System Health & Repair
- **Automated SFC/DISM**: Intelligent workflow runs both tools in sequence for complete system healing
- **System Dashboard**: Real-time OS info, CPU, RAM, uptime, and computer details
- **Progress Tracking**: Visual status updates with estimated completion times

### 💾 Smart Backup Management
- **Registry-Integrated Settings**: Backup location stored in Windows registry for persistence
- **Custom Path Selection**: Browse and select any folder for backup storage
- **Recursive Protection**: Automatically excludes backup folders to prevent infinite backup loops
- **Backup Information Display**: Shows last backup date and current backup location
- **One-Click Folder Access**: Opens backup location directly in File Explorer

### 🚀 Startup Optimization  
- **Safety-First Design**: Color-coded ratings (🟢 Safe, 🟡 Caution, 🔴 Danger)
- **Modern Toggle Switches**: Sleek controls with confirmation dialogs for critical items
- **Task Manager Integration**: Quick access for advanced users
- **Real Executable Detection**: Smart parsing of complex startup commands

### 💽 Visual Disk Management
- **Real-Time Progress Bars**: Color-coded usage visualization (Green/Orange/Red)
- **Individual Drive Cards**: Clean any drive with dedicated buttons
- **Smart Recommendations**: System drive highlighted with special badges
- **Auto-Refresh**: Usage updates automatically after cleanup

### ⚡ Quick Access Shortcuts
- **Essential Folders**: AppData, Downloads, Documents, Desktop
- **System Settings**: Control Panel, Device Manager, Programs & Features, System Properties
- **Network & Internet**: WiFi, Display, Sound, Windows Update settings

### 🌐 Network Management & Diagnostics
- **Real-Time Network Information**: Display hostname, local/public IP addresses, DNS servers, ISP, and location
- **Connectivity Testing**: Ping any website or IP address with detailed response times and packet loss statistics
- **Advanced Route Tracing**: Visual network path analysis showing each hop between your computer and target
- **DNS Lookup Tools**: Resolve domain names and display detailed DNS record information
- **Network Diagnostics**: Clear DNS cache, renew IP configuration, and reset network stack for troubleshooting
- **Network Adapter Management**: Visual cards showing all network adapters with connection status, IP addresses, and MAC addresses
- **Smart Adapter Detection**: Automatically identifies and categorizes Wi-Fi, Ethernet, Bluetooth, VPN, and virtual adapters
- **Connection Status Monitoring**: Real-time connection status with color-coded indicators (✅ Connected, 🔴 Disconnected, ⭕ Disabled)
- **Professional Network Interface**: Clean, user-friendly display of technical network information

### ✨ Custom Shortcuts System
- **Emoji Icons**: 200+ emojis across 8 categories (Smileys, People, Animals, Food, Activities, Travel, Objects, Symbols)
- **Smart Path Recognition**: Files, folders, websites, system commands
- **Browse Button Integration**: Easy file/folder selection with native system dialogs
- **Persistent Storage**: Shortcuts survive app restarts
- **Full CRUD**: Create, edit, delete with hover actions

### 🎨 Modern Interface
- **Enhanced Loading Experience**: 5-second minimum loading with descriptive progress messages
- **Pinterest-Style Layout**: Responsive masonry grid with hardware acceleration and wider cards
- **Smooth Animations**: 60fps transitions with component-based loading tracking
- **Auto-Update Notifications**: Beautiful top-right cards with progress tracking
- **Professional Design**: Dark sidebar with collapsible navigation
- **Responsive Design**: Optimized for different screen sizes with mobile-friendly layouts

### ⚙️ Advanced Settings
- **Theme Support**: Light and Dark mode with persistent storage
- **Auto-Refresh**: Configurable automatic system information updates
- **Default Page Selection**: Choose which section opens on startup
- **Registry-Based Storage**: All settings persist through Windows registry integration
- **Reset Functionality**: One-click reset to factory defaults

## 🚀 Installation

### Prerequisites
- **Windows 10/11** (64-bit)
- **Node.js 16.0+** ([Download](https://nodejs.org/))
- **Administrator privileges** (for system repair functions)

### Quick Start
```bash
# Clone repository
git clone https://github.com/SeanMcKeen/pc-buddy.git
cd pc-buddy

# Install dependencies
npm install

# Launch application
npm start
```

### Building
```bash
# Development build
npm run build

# Windows installer
npm run dist
```

## 🛠️ Tech Stack

- **[Electron 22+](https://electronjs.org/)** - Cross-platform desktop framework
- **[Node.js 16+](https://nodejs.org/)** - JavaScript runtime
- **[PowerShell 5.1+](https://docs.microsoft.com/powershell/)** - Windows automation
- **Windows Registry API** - Persistent settings storage
- **Vanilla JavaScript** - Modern ES6+ features with hardware-accelerated rendering
- **CSS3** - Advanced animations, transitions, and responsive design
- **electron-updater** - Automatic application updates
- **sudo-prompt** - Elevated permission management

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** changes (`git commit -m 'Add amazing feature'`)
4. **Push** to branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Guidelines
- Follow existing code patterns
- Test on Windows 10 and 11
- Update documentation for new features
- Ensure smooth 60fps animations

## 🐛 Troubleshooting

```
❌ "Access Denied" during system repair
✅ Solution: Run as Administrator

❌ PowerShell scripts won't execute  
✅ Solution: Set-ExecutionPolicy RemoteSigned

❌ Antivirus blocks application
✅ Solution: Add PC Buddy to exclusions

❌ Startup changes not applying
✅ Solution: Restart Windows Explorer

❌ Backup path not saving
✅ Solution: Ensure registry write permissions
```

## 📝 Version History

### 0.2.3 (Current)
- 🌐 **Brand New Network Management Tab**
  - **Network Information Display**: Real-time system network info (hostname, local/public IP, DNS servers, ISP, location)
  - **Connectivity Testing**: Ping any website or IP address with detailed results and response times
  - **Advanced Route Tracing**: Visual network path analysis with hop-by-hop breakdown
  - **DNS Lookup Tools**: Domain name resolution with detailed record information
  - **Network Diagnostics**: Clear DNS cache, renew IP address, reset network stack
  - **Network Adapter Management**: Visual cards showing all network adapters with connection status, IP addresses, MAC addresses, and types
  - **Smart Adapter Detection**: Automatically identifies Wi-Fi, Ethernet, Bluetooth, VPN, and virtual adapters
  - **Connection Status Monitoring**: Real-time status with color-coded indicators (Connected/Disconnected/Disabled)

- 🔧 **Major Code Refactoring & Architecture Improvements**
  - **Massive Codebase Cleanup**: 537+ lines removed from main.js (34% reduction) through intelligent consolidation
  - **Utility Module System**: Created comprehensive utility classes (PowerShellUtils, ValidationUtils, BackupUtils, NetworkUtils, SystemUtils)
  - **Eliminated Code Duplication**: Consolidated 5+ duplicate PowerShell patterns, 4+ backup path implementations, 30+ error handling instances
  - **Enhanced Security**: Centralized input validation and sanitization across all operations
  - **Improved Maintainability**: Single source of truth for common operations and consistent error handling patterns
  - **Better Performance**: Reduced redundancy and optimized resource management

- 🛡️ **Security & Permission Improvements**
  - **Smart Admin Privilege Management**: App no longer prompts for admin on startup unnecessarily
  - **Selective Elevation**: Only backup creation requires admin privileges, not backup information reading
  - **Enhanced Input Validation**: Comprehensive path validation and sanitization to prevent security vulnerabilities
  - **Improved Error Handling**: Better error messages with context information and security gap prevention

- 🎨 **User Interface & Experience Enhancements**
  - **Network Tab Integration**: Beautiful masonry layout for network tools with responsive design
  - **Clean Network Adapter Display**: Removed technical clutter (address count, sort priority) for user-friendly interface
  - **Enhanced Loading System**: Component-based loading with better progress tracking
  - **Improved Animations**: Smoother transitions and better performance optimization
  - **Better Error Feedback**: More helpful error messages and user guidance

- 🔄 **Backup System Improvements**
  - **Fixed Admin Prompting**: Backup information display no longer requires admin privileges
  - **Enhanced Security**: Better file handling and permission management
  - **Improved Performance**: Faster backup information retrieval without unnecessary elevation

- 🛠️ **Technical Infrastructure**
  - **Enhanced API Architecture**: Better separation of concerns with dedicated network APIs
  - **Improved Error Handling**: Context-aware error reporting and logging
  - **Better Resource Management**: Optimized memory usage and performance
  - **Enhanced Debugging**: Better logging and error tracking capabilities
  - **Code Organization**: Cleaner file structure and modular design patterns

- 🎭 **Visual & Theme Improvements**
  - **RGB Mode Implementation**: Full-spectrum color theme option (experimental)
  - **Better Responsive Design**: Improved layouts for different screen sizes
  - **Enhanced Visual Hierarchy**: Cleaner information presentation
  - **Improved Accessibility**: Better contrast and readability

### 0.2.2
- 🔒 **Enhanced Security Framework**
  - Comprehensive security policy document with 2025 best practices
  - Vulnerability reporting procedures and supported versions
  - Enterprise-grade security considerations and configuration guidelines
  - PowerShell script security enhancements and audit logging recommendations

- ✨ **Custom Shortcuts Enhancement**
  - Native browse button for easy file and folder selection
  - Enhanced file type filters (executables, documents, media files)
  - Improved path input with responsive design and better UX
  - Smart dialog with support for both files and directories

- 🎨 **User Interface Improvements**
  - Enhanced custom shortcuts modal with modern browse controls
  - Improved responsive design for mobile and tablet screens
  - Better visual hierarchy and accessibility in file selection
  - Consistent styling across all browse controls

- 🛠️ **Development & Maintenance**
  - Updated development timeline references to Q2 2025
  - Enhanced API structure with dedicated shortcut path selection
  - Improved error handling and user feedback mechanisms
  - Code organization improvements and documentation updates

### 0.2.1
- 🔄 **Major Backup System Overhaul**
  - Registry-integrated backup path selection and storage
  - Recursive backup prevention (excludes backup folders automatically)
  - Browse button for custom backup location selection
  - Real-time backup location display in settings
  - Improved error handling and fallback mechanisms

- 🎨 **Enhanced User Interface**
  - Extended loading screen with 5-second minimum duration
  - Component-based loading tracking system with descriptive messages
  - Wider cards by default (50px increase across all breakpoints)
  - Improved backup path control styling with better button sizing
  - Enhanced responsive design for mobile screens

- 🛠️ **Registry Integration & Settings**
  - Consistent Windows registry read/write operations
  - Registry-based backup path persistence
  - Enhanced settings reset functionality
  - Improved registry error handling and debugging

- 🔧 **Technical Improvements**
  - Simplified registry operations using Windows `reg` commands
  - Enhanced PowerShell script parameter passing
  - Improved backup script integration with `-BackupLocation` parameter
  - Better registry value parsing with multiple fallback patterns
  - Comprehensive logging and debugging enhancements

### 0.2.0
- ✨ Modern disk cleanup with visual progress bars
- 🎨 Refactored drive selection (removed clunky modal)
- 🚀 Enhanced startup management with safety ratings
- 💾 Auto-refresh disk usage after cleanup
- 🎭 Improved animations and loading screens

## 👨‍💻 Author & License

**Created by Sean McKeen**

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) for details.

### ⚠️ Attribution Notice
If you use this software, please:
- **Keep the author credit intact** 
- **Do not claim this work as your own**
- **Respect the open-source nature** of this project

## 📞 Support

- 📧 **Issues**: [GitHub Issues](https://github.com/SeanMcKeen/pc-buddy/issues)
- 📖 **Documentation**: [Wiki](https://github.com/SeanMcKeen/pc-buddy/wiki)

---

<div align="center">

**🚀 Built with passion for the Windows community**

[![GitHub](https://img.shields.io/badge/GitHub-SeanMcKeen-blue?style=social&logo=github)](https://github.com/SeanMcKeen)

</div>
