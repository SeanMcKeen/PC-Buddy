# 🖥️ PC Buddy

<div align="center">

**🚀 A Modern Windows System Optimization & Management Tool**

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/user/pc-buddy/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](https://www.microsoft.com/windows)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Tech Stack](#-tech-stack) • [Contributing](#-contributing)

</div>

---

## 📋 Overview

PC Buddy is a **comprehensive Windows system optimization tool** built with Electron that transforms complex system maintenance into simple, one-click operations. Whether you're a system administrator managing multiple machines or a home user wanting to keep your PC running smoothly, PC Buddy provides an intuitive interface for essential Windows maintenance tasks.

**🎯 Key Benefits:**
- **One-Click System Repairs** - Automated SFC and DISM operations
- **Smart Startup Management** - Safely optimize boot performance  
- **Visual Disk Monitoring** - Real-time space usage and cleanup
- **Quick Access Hub** - Essential Windows settings at your fingertips
- **Custom Productivity** - Personalized shortcuts with emoji icons

## ✨ Features

### 🔧 System Health & Repair
Transform your PC maintenance with intelligent automation:

**🔍 Automated Diagnostics**
- **System File Checker (SFC)**: Scans and repairs corrupted Windows files
- **DISM Integration**: Automatically triggered when SFC finds unfixable issues  
- **Smart Workflow**: Runs both tools in sequence for complete system healing
- **Progress Tracking**: Real-time status updates with estimated completion times

**📊 System Intelligence Dashboard**
```
💻 System Info Display:
├── 🖥️  OS Version & Build
├── ⚙️  CPU Model & Architecture  
├── 🧠 RAM (Total/Available)
├── 🏠 Computer Name
└── ⏱️  System Uptime
```

### 🚀 Startup Optimization
Take control of your boot sequence with safety-first design:

**🎛️ Smart Program Management**
- **Visual Toggle Controls**: Modern switches replace confusing enable/disable buttons
- **Color-Coded Safety System**:
  - 🟢 **Safe** - Programs you can safely disable (Spotify, Discord, etc.)
  - 🟡 **Caution** - May impact functionality (Graphics drivers, office tools)
  - 🔴 **Danger** - Critical system components (Windows Security, Audio drivers)

**🛡️ Protection Features**
- **Confirmation Dialogs**: Double-confirmation before disabling critical items
- **Impact Warnings**: Clear explanations of what each program does
- **Task Manager Integration**: Quick access for advanced users
- **Instant Apply**: Changes take effect immediately, no restart required

### 💾 Intelligent Disk Management
Monitor and optimize storage with visual clarity:

**📈 Real-Time Monitoring**
- **Visual Progress Bars**: See exactly how much space each drive is using
- **Multi-Drive Support**: Manage all connected drives from one interface
- **Smart Recommendations**: Automatically suggests which drive needs attention
- **Usage Breakdown**: Understand what's taking up your space

**🧹 Deep Cleaning Engine**
```
Cleanup Targets:
├── 🗑️  Temporary Files (%TEMP%, Windows\Temp)
├── 🌐 Browser Cache (Chrome, Edge, Firefox)
├── 📦 Windows Update Cache
├── 🔄 System Log Files
└── 💾 Recycle Bin Contents
```

### ⚡ Quick Access Shortcuts
Your Windows control center in one place:

**📁 Essential Folders Hub**
- **AppData** - Access application data and settings
- **Downloads** - Jump to your download folder instantly  
- **Documents** - Quick access to user documents
- **Desktop** - Navigate to desktop items

**🔧 System Settings Central**
- **Control Panel** - Classic Windows configuration
- **Programs & Features** - Uninstall/modify software
- **Device Manager** - Hardware management
- **System Properties** - Computer specifications and settings

**🌐 Network & Connectivity**
- **Network Settings** - Ethernet and WiFi configuration
- **WiFi Management** - Wireless network preferences
- **Display Settings** - Monitor configuration and resolution
- **Sound Settings** - Audio devices and volume control
- **Windows Update** - Check for and install updates

### ✨ Custom Shortcuts System
Create your personal productivity launcher:

**🎨 Emoji-Powered Organization**
```
📂 Folder Categories:
├── 😀 Smileys & Emotion (30+ options)
├── 👤 People & Body (30+ options)  
├── 🐶 Animals & Nature (30+ options)
├── 🍎 Food & Drink (30+ options)
├── ⚽ Activities & Sports (30+ options)
├── 🚗 Travel & Places (30+ options)
├── 💡 Objects & Tools (30+ options)
└── ❤️ Symbols & Flags (30+ options)
```

**🔧 Smart Path Recognition**
- **File Paths**: `C:\Program Files\Notepad++\notepad++.exe`
- **Folder Paths**: `C:\Users\%USERNAME%\Pictures`  
- **Websites**: `https://github.com`, `https://google.com`
- **System Commands**: `cmd`, `notepad`, `calc`

**💾 Persistent Storage**
- Shortcuts saved to local storage
- Survive app restarts and updates
- Export/import capability for backup
- No cloud dependency required

### 🔄 Professional Auto-Update System
Stay current with zero effort:

**📱 Modern Notification Cards**
- **Elegant Design**: Top-right notification cards with gradient styling
- **Interactive States**: 
  - 📥 **Available** - New version ready to download
  - ⬇️ **Downloading** - Progress bar with percentage
  - ✅ **Ready** - Downloaded and ready to install
  - ⚙️ **Installing** - Update in progress with restart warning

**🎛️ User Control Options**
- **Defer Updates**: Download now, install later
- **Immediate Install**: Apply updates instantly
- **Progress Tracking**: Real-time download progress
- **Dismiss Capability**: Hide notifications if not ready

### 🎨 Modern User Interface
Experience desktop software that feels native and responsive:

**📱 Responsive Masonry Layout**
- **Pinterest-Style Grid**: Cards automatically arrange for optimal viewing
- **Hardware Acceleration**: Smooth 60fps animations using CSS transforms
- **Smart Resizing**: Layout adapts to window size changes instantly
- **Performance Optimized**: Efficient rendering with minimal resource usage

**🎭 Smooth Interaction Design**
- **Loading Screen**: Professional startup with animated logo and progress dots
- **Tab Transitions**: Smooth fade animations between sections
- **Hover Effects**: Subtle card elevations and color changes
- **Responsive Feedback**: Visual confirmation for all user actions

**🌓 Modern Aesthetics**
- **Dark Sidebar**: Sleek navigation with collapsible design
- **Light Content Area**: High contrast for optimal readability
- **Consistent Spacing**: Professional typography and spacing
- **Windows Integration**: Respects system theme and scaling

## 🚀 Installation

### Prerequisites
- **Windows 10** or **Windows 11** (64-bit)
- **Node.js 16.0.0+** ([Download here](https://nodejs.org/))
- **Administrator privileges** (for system repair functions)

### Quick Start
```bash
# 1. Clone the repository
git clone https://github.com/user/pc-buddy.git
cd pc-buddy

# 2. Install dependencies
npm install

# 3. Launch the application
npm start
```

### Building for Production
```bash
# Development build
npm run build

# Windows installer (.exe)
npm run dist

# Portable version (.zip)  
npm run build:portable
```

## 📖 Usage Guide

### 🔧 System Repair Workflow
```
1. Launch PC Buddy
2. Navigate to "System Health" tab
3. Review system information panel
4. Click "Start Scan" for automated repair
5. Monitor progress with real-time updates
6. Review completion report
```

### 🚀 Startup Optimization Process
```
1. Open "System Health" section
2. Scroll to "Startup Optimizer"
3. Review safety badges for each program:
   🟢 Safe to disable
   🟡 Proceed with caution  
   🔴 Keep enabled (critical)
4. Use toggle switches to enable/disable
5. Confirm dangerous operations when prompted
```

### ✨ Custom Shortcut Creation
```
1. Switch to "Shortcuts" tab
2. Locate "Custom Shortcuts" section
3. Click "Add Custom Shortcut"
4. Select emoji icon from picker
5. Enter shortcut name (25 chars max)
6. Specify target:
   • File: C:\path\to\program.exe
   • Folder: C:\Users\%USERNAME%\Documents
   • Website: https://example.com
7. Save and test shortcut
```

### 💾 Disk Cleanup Operation
```
1. Navigate to "System Health"
2. Find "Disk Usage & Cleanup" 
3. Review drive usage visualization
4. Click "Choose Drive to Clean"
5. Select target drive (C: recommended)
6. Confirm cleanup operation
7. Monitor progress and completion
```

## 🛠️ Tech Stack

### Core Framework
- **[Electron 22+](https://electronjs.org/)** - Cross-platform desktop applications
- **[Node.js 16+](https://nodejs.org/)** - JavaScript runtime environment
- **[PowerShell 5.1+](https://docs.microsoft.com/powershell/)** - Windows automation

### Frontend Technologies  
- **Vanilla JavaScript (ES6+)** - Modern language features
- **CSS3 Grid & Flexbox** - Responsive layout systems
- **CSS Custom Properties** - Dynamic theming support
- **Web Animations API** - Hardware-accelerated transitions

### Key Libraries
- **electron-updater** - Automatic application updates
- **sudo-prompt** - Elevated permission management  
- **os** - Operating system interface
- **child_process** - System command execution

### Architecture Patterns
- **Main Process** - System integration and security
- **Renderer Process** - User interface and interactions
- **IPC Communication** - Secure inter-process messaging
- **Context Isolation** - Enhanced security model

## 🏗️ Project Structure

```
PC-Buddy/
├── 📁 src/
│   ├── 📁 main/
│   │   ├── 📄 main.js           # Electron main process
│   │   └── 📄 preload.js        # Secure API bridge
│   ├── 📁 renderer/
│   │   ├── 📄 index.html        # Application UI
│   │   ├── 📄 styles.css        # Modern CSS styling
│   │   └── 📄 renderer.js       # Frontend logic
│   └── 📁 assets/
│       ├── 📄 getStartupPrograms.ps1  # Startup enumeration
│       ├── 📄 toggleStartup.ps1       # Startup control  
│       ├── 📄 deepClean.ps1           # Disk cleanup
│       └── 📄 getDiskUsage.ps1        # Storage analysis
├── 📁 docs/                     # Documentation
├── 📄 package.json             # Dependencies & scripts
├── 📄 README.md                # This file
└── 📄 LICENSE                  # MIT License
```

## 🔧 Configuration

### Auto-updater Setup
```javascript
// Configure GitHub releases for updates
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'your-username', 
  repo: 'pc-buddy',
  private: false
});
```

### PowerShell Execution Policy
```powershell
# Enable script execution (run as administrator)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Custom Shortcuts Storage
```javascript
// Shortcuts persist in localStorage
const shortcuts = JSON.parse(
  localStorage.getItem('customShortcuts') || '[]'
);
```

## 🤝 Contributing

We welcome contributions from the community! Here's how to get started:

### Development Workflow
```bash
# 1. Fork and clone
git clone https://github.com/your-username/pc-buddy.git

# 2. Create feature branch  
git checkout -b feature/amazing-feature

# 3. Make changes and test
npm start

# 4. Commit with descriptive message
git commit -m "Add amazing feature that does X"

# 5. Push and create PR
git push origin feature/amazing-feature
```

### Contribution Guidelines
- **Code Style**: Follow existing patterns and conventions
- **Testing**: Test on Windows 10 and 11 before submitting
- **Documentation**: Update README for new features
- **Performance**: Ensure smooth 60fps animations
- **Security**: Use proper IPC communication patterns

## 🐛 Troubleshooting

### Common Issues
```
❌ "Access Denied" during system repair
✅ Solution: Run as Administrator

❌ PowerShell scripts won't execute  
✅ Solution: Set-ExecutionPolicy RemoteSigned

❌ Antivirus blocks application
✅ Solution: Add PC Buddy to exclusions list

❌ Startup changes not applying
✅ Solution: Restart Windows Explorer
```

### Debug Mode
```bash
# Enable verbose logging
npm start -- --debug

# Check log files
%APPDATA%/PC Buddy/logs/
```

## 📝 Roadmap

### Version 2.1.0 (Planned)
- 🔄 **Registry Cleanup** - Safe registry optimization
- 📊 **Performance Metrics** - CPU/RAM usage tracking
- 🎨 **Theme Customization** - Light/dark mode toggle
- 🌐 **Multi-language Support** - Localization framework

### Version 2.2.0 (Future)
- ☁️ **Cloud Sync** - Settings backup to cloud
- 📱 **Mobile Companion** - Remote PC management
- 🤖 **AI Optimization** - Machine learning recommendations
- 📈 **Advanced Analytics** - Detailed system insights

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Microsoft** - For PowerShell and Windows APIs
- **Electron Team** - For the incredible cross-platform framework  
- **Open Source Community** - For inspiration and feedback
- **Beta Testers** - For helping improve reliability and usability

## 📞 Support & Community

### Get Help
- 📧 **Email**: support@pc-buddy.app
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/user/pc-buddy/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/user/pc-buddy/discussions)
- 📖 **Documentation**: [Wiki](https://github.com/user/pc-buddy/wiki)

### Community
- 💬 **Discord**: [PC Buddy Community](https://discord.gg/pc-buddy)
- 🐦 **Twitter**: [@PCBuddyApp](https://twitter.com/PCBuddyApp)
- 📺 **YouTube**: [PC Buddy Tutorials](https://youtube.com/c/PCBuddy)

---

<div align="center">

**🚀 Built with passion for the Windows community**

[![Star this repo](https://img.shields.io/github/stars/user/pc-buddy?style=social)](https://github.com/user/pc-buddy/stargazers)
[![Follow on GitHub](https://img.shields.io/github/followers/user?style=social)](https://github.com/user)
[![Tweet](https://img.shields.io/twitter/url?style=social&url=https%3A%2F%2Fgithub.com%2Fuser%2Fpc-buddy)](https://twitter.com/intent/tweet?text=Check%20out%20PC%20Buddy%20-%20A%20modern%20Windows%20optimization%20tool!&url=https://github.com/user/pc-buddy)

</div>
