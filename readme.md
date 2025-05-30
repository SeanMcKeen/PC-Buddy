# 🖥️ PC Buddy

<div align="center">

**🚀 A Modern Windows System Optimization & Management Tool**

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://github.com/SeanMcKeen/pc-buddy/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](https://www.microsoft.com/windows)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Tech Stack](#-tech-stack)

</div>

---

## 📋 Overview

PC Buddy is a **comprehensive Windows system optimization tool** built with Electron that transforms complex system maintenance into simple, one-click operations. Whether you're managing multiple machines or keeping your personal PC running smoothly, PC Buddy provides an intuitive interface for essential Windows maintenance tasks.

**🎯 Key Benefits:**
- **One-Click System Repairs** - Automated SFC and DISM operations
- **Smart Startup Management** - Safely optimize boot performance with color-coded safety ratings
- **Visual Disk Monitoring** - Real-time space usage with progress bars and cleanup
- **Quick Access Hub** - Essential Windows settings at your fingertips
- **Custom Shortcuts** - Personalized shortcuts with emoji icons (200+ emojis across 8 categories)

## ✨ Features

### 🔧 System Health & Repair
- **Automated SFC/DISM**: Intelligent workflow runs both tools in sequence for complete system healing
- **System Dashboard**: Real-time OS info, CPU, RAM, uptime, and computer details
- **Progress Tracking**: Visual status updates with estimated completion times

### 🚀 Startup Optimization  
- **Safety-First Design**: Color-coded ratings (🟢 Safe, 🟡 Caution, 🔴 Danger)
- **Modern Toggle Switches**: Sleek controls with confirmation dialogs for critical items
- **Task Manager Integration**: Quick access for advanced users

### 💾 Visual Disk Management
- **Real-Time Progress Bars**: Color-coded usage visualization (Green/Orange/Red)
- **Individual Drive Cards**: Clean any drive with dedicated buttons
- **Smart Recommendations**: System drive highlighted with special badges
- **Auto-Refresh**: Usage updates automatically after cleanup

### ⚡ Quick Access Shortcuts
- **Essential Folders**: AppData, Downloads, Documents, Desktop
- **System Settings**: Control Panel, Device Manager, Programs & Features, System Properties
- **Network & Internet**: WiFi, Display, Sound, Windows Update settings

### ✨ Custom Shortcuts System
- **Emoji Icons**: 200+ emojis across 8 categories (Smileys, People, Animals, Food, Activities, Travel, Objects, Symbols)
- **Smart Path Recognition**: Files, folders, websites, system commands
- **Persistent Storage**: Shortcuts survive app restarts
- **Full CRUD**: Create, edit, delete with hover actions

### 🎨 Modern Interface
- **Pinterest-Style Layout**: Responsive masonry grid with hardware acceleration
- **Smooth Animations**: 60fps transitions with loading screens
- **Auto-Update Notifications**: Beautiful top-right cards with progress tracking
- **Professional Design**: Dark sidebar with collapsible navigation

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

## 📖 Usage

### System Repair
1. Navigate to **System Health** tab
2. Click **Start Scan** for automated SFC/DISM repair
3. Monitor real-time progress with status updates

### Startup Management
1. View startup programs with safety badges
2. Use toggle switches to enable/disable programs
3. Confirm dangerous operations when prompted

### Disk Cleanup
1. View all drives with visual usage bars
2. Click **Clean Drive** on desired drive
3. Confirm cleanup operation

### Custom Shortcuts
1. Go to **Shortcuts** tab → **Custom Shortcuts**
2. Click **Add Custom Shortcut**
3. Choose emoji icon and enter name/path
4. Save and use immediately

## 🛠️ Tech Stack

- **[Electron 22+](https://electronjs.org/)** - Cross-platform desktop framework
- **[Node.js 16+](https://nodejs.org/)** - JavaScript runtime
- **[PowerShell 5.1+](https://docs.microsoft.com/powershell/)** - Windows automation
- **Vanilla JavaScript** - Modern ES6+ features
- **CSS3** - Hardware-accelerated animations and responsive design
- **electron-updater** - Automatic application updates
- **sudo-prompt** - Elevated permission management

## 🔧 Configuration

### PowerShell Execution Policy
```powershell
# Enable script execution (run as administrator)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Auto-updater Setup
```javascript
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'SeanMcKeen',
  repo: 'PC-Buddy'
});
```

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
```

## 📝 Version History

### 0.2.0 (Current)
- ✨ Modern disk cleanup with visual progress bars
- 🎨 Refactored drive selection (removed clunky modal)
- 🚀 Enhanced startup management with safety ratings
- 💾 Auto-refresh disk usage after cleanup
- 🎭 Improved animations and loading screens

### 0.1.3
- 🔧 Added system repair utilities
- 📊 Real-time system information
- 🎨 Modern UI design

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
