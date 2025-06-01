console.log('[preload.js] loaded');

const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { shell } = require('electron');
const fs = require('fs');

// Helper function to execute commands
function execCommand(command, description) {
  console.log(`[API] ${description}:`, command);
  return exec(command, (error) => {
    if (error) {
      console.error(`[${description}] Error:`, error);
    }
  });
}

// Get app version from package.json
const appVersion = require('../../package.json').version;

contextBridge.exposeInMainWorld('electronAPI', {
  runSystemRepair: () => ipcRenderer.invoke('run-sfc-and-dism'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, version) => cb(version)),
  onDownloadProgress: (cb) => ipcRenderer.on('update-download-progress', (_, progress) => cb(progress)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', () => cb()),
  startUpdate: () => ipcRenderer.send('start-update'),
  openExternal: (url) => execCommand(`start ${url}`, 'Opening external URL')
});

contextBridge.exposeInMainWorld('systemInfoAPI', {
  getSystemInfo: () => {
    const totalMemoryGB = (os.totalmem() / (1024 ** 3)).toFixed(1);
    const freeMemoryGB = (os.freemem() / (1024 ** 3)).toFixed(1);
    const usedMemoryGB = (totalMemoryGB - freeMemoryGB).toFixed(1);
    
    // Get friendly OS name
    const getFriendlyOSName = () => {
      const platform = os.platform();
      const release = os.release();
      
      if (platform === 'win32') {
        // Windows version mapping
        const versionMap = {
          '10.0': 'Windows 11', // Windows 11 also reports as 10.0 but with higher build numbers
          '6.3': 'Windows 8.1',
          '6.2': 'Windows 8',
          '6.1': 'Windows 7'
        };
        
        const majorMinor = release.split('.').slice(0, 2).join('.');
        
        // For Windows 10/11, we need to check build number
        if (majorMinor === '10.0') {
          const buildNumber = parseInt(release.split('.')[2]);
          if (buildNumber >= 22000) {
            return 'Windows 11';
          } else {
            return 'Windows 10';
          }
        }
        
        return versionMap[majorMinor] || 'Windows';
      }
      return platform;
    };
    
    // Get friendly CPU name
    const getFriendlyCPUName = () => {
      const cpus = os.cpus();
      if (cpus && cpus.length > 0) {
        let cpuModel = cpus[0].model;
        
        // Clean up CPU name
        cpuModel = cpuModel
          .replace(/\(R\)/g, '')
          .replace(/\(TM\)/g, '')
          .replace(/CPU/g, '')
          .replace(/Processor/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        const coreCount = cpus.length;
        return `${cpuModel} (${coreCount} cores)`;
      }
      return 'Unknown CPU';
    };
    
    // Get friendly uptime
    const getFriendlyUptime = (seconds) => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      
      if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
      } else if (hours > 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
      } else {
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
      }
    };
    
    // Get friendly architecture
    const getFriendlyArch = () => {
      const arch = os.arch();
      const archMap = {
        'x64': '64-bit',
        'x32': '32-bit',
        'arm': 'ARM',
        'arm64': 'ARM 64-bit'
      };
      return archMap[arch] || arch;
    };
    
    return {
      operatingSystem: getFriendlyOSName(),
      processor: getFriendlyCPUName(),
      architecture: getFriendlyArch(),
      totalMemory: `${totalMemoryGB} GB`,
      usedMemory: `${usedMemoryGB} GB`,
      availableMemory: `${freeMemoryGB} GB`,
      computerName: os.hostname(),
      systemUptime: getFriendlyUptime(os.uptime())
    };
  },
  getAppVersion: () => appVersion
});

contextBridge.exposeInMainWorld('startupAPI', {
  getStartupPrograms: () => ipcRenderer.invoke('get-startup-programs'),
  toggleStartup: (name, enable) => ipcRenderer.invoke('toggle-startup-program', name, enable),
  openTaskManager: () => ipcRenderer.send('open-task-manager')
});

contextBridge.exposeInMainWorld('folderAPI', {
  openAppData: async () => {
    // Use enhanced path opening method that forces windows to top
    const appDataPath = path.join(os.homedir(), 'AppData');
    await ipcRenderer.invoke('open-path', appDataPath);
  },
  openDownloads: async () => {
    const downloadsPath = path.join(os.homedir(), 'Downloads');
    await ipcRenderer.invoke('open-path', downloadsPath);
  },
  openDocuments: async () => {
    const documentsPath = path.join(os.homedir(), 'Documents');
    await ipcRenderer.invoke('open-path', documentsPath);
  },
  openDesktop: async () => {
    // Fix Desktop path - check multiple possible locations
    
    // Common Desktop paths on Windows
    const possibleDesktopPaths = [
      path.join(os.homedir(), 'OneDrive', 'Desktop'),  // OneDrive Desktop
      path.join(os.homedir(), 'Desktop'),              // Standard Desktop  
      path.join(os.homedir(), 'OneDrive', 'Bureau'),   // French OneDrive
      path.join(os.homedir(), 'Bureau')                // French standard
    ];
    
    // Find the first existing Desktop path
    let desktopPath = null;
    for (const testPath of possibleDesktopPaths) {
      try {
        if (fs.existsSync(testPath)) {
          desktopPath = testPath;
          break;
        }
      } catch (error) {
        console.log(`[Desktop] Path check failed for ${testPath}:`, error.message);
      }
    }
    
    if (!desktopPath) {
      // Fallback to standard path even if it doesn't exist
      desktopPath = path.join(os.homedir(), 'Desktop');
    }
    
    console.log(`[Desktop] Using path: ${desktopPath}`);
    await ipcRenderer.invoke('open-path', desktopPath);
  }
});

contextBridge.exposeInMainWorld('cleanupAPI', {
  getDiskUsage: () => ipcRenderer.invoke('get-disk-usage'),
  cleanDrive: (driveLetter) => ipcRenderer.invoke('clean-drive', driveLetter)
});

// Shortcut API
contextBridge.exposeInMainWorld('shortcutAPI', {
  openFileExplorer: () => ipcRenderer.invoke('open-file-explorer'),
  selectFileOrFolder: () => ipcRenderer.invoke('select-file-or-folder')
});

// Enhanced system API with input validation
contextBridge.exposeInMainWorld('systemAPI', {
  openPath: (filePath) => {
    // Validate path input to prevent command injection
    if (typeof filePath !== 'string' || filePath.length === 0 || filePath.length > 260) {
      console.error('[Security] Invalid file path provided');
      return Promise.reject(new Error('Invalid file path'));
    }
    
    // Sanitize path - remove potentially dangerous characters
    const sanitizedPath = filePath.replace(/[<>:"|?*]/g, '');
    
    return shell.openPath(sanitizedPath);
  },
  openControlPanel: async () => {
    // Open actual Control Panel using enhanced Windows command
    await ipcRenderer.invoke('exec-command', 'powershell -Command "Start-Process control -WindowStyle Normal"');
  },
  openProgramsAndFeatures: async () => {
    // Open Programs and Features using enhanced command
    await ipcRenderer.invoke('exec-command', 'powershell -Command "Start-Process appwiz.cpl -WindowStyle Normal"');
  },
  openDeviceManager: async () => {
    // Open Device Manager using enhanced command
    await ipcRenderer.invoke('exec-command', 'powershell -Command "Start-Process devmgmt.msc -WindowStyle Normal"');
  },
  openSystemProperties: async () => {
    // Open System Properties using enhanced command
    await ipcRenderer.invoke('exec-command', 'powershell -Command "Start-Process sysdm.cpl -WindowStyle Normal"');
  },
  openDisplaySettings: async () => {
    // Open Display Settings
    await shell.openExternal('ms-settings:display');
    setTimeout(() => ipcRenderer.invoke('ensure-apps-on-top').catch(console.error), 200);
  },
  openSoundSettings: async () => {
    // Open Sound Settings
    await shell.openExternal('ms-settings:sound');
    setTimeout(() => ipcRenderer.invoke('ensure-apps-on-top').catch(console.error), 200);
  },
  openWindowsUpdate: async () => {
    // Open Windows Update
    await shell.openExternal('ms-settings:windowsupdate');
    setTimeout(() => ipcRenderer.invoke('ensure-apps-on-top').catch(console.error), 200);
  },
  bringWindowToFront: () => ipcRenderer.invoke('bring-window-to-front'),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('set-always-on-top', enabled),
  ensureAppsOnTop: () => ipcRenderer.invoke('ensure-apps-on-top'),
  runPowerShellCommand: (command) => {
    // Validate PowerShell command input
    if (typeof command !== 'string' || command.length === 0 || command.length > 1000) {
      console.error('[Security] Invalid PowerShell command provided');
      return Promise.reject(new Error('Invalid command'));
    }
    
    // Basic command sanitization - reject dangerous patterns
    const dangerousPatterns = [
      /invoke-expression/i,
      /iex\s/i,
      /download.*file/i,
      /start-process/i,
      /invoke-webrequest/i,
      /curl\s/i,
      /wget\s/i,
      /&\s*[^&]/,  // Command chaining
      /\|\s*[^|]/,  // Piping to other commands
      /;\s*/,       // Command separation
      /`/           // Backticks
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        console.error('[Security] Potentially dangerous PowerShell command blocked:', command);
        return Promise.reject(new Error('Command contains potentially dangerous patterns'));
      }
    }
    
    return ipcRenderer.invoke('run-powershell-command', command);
  }
});

// Backup API
contextBridge.exposeInMainWorld('backupAPI', {
  createBackup: () => ipcRenderer.invoke('create-backup'),
  getBackupInfo: () => ipcRenderer.invoke('get-backup-info'),
  openBackupLocation: () => ipcRenderer.invoke('open-backup-location'),
  selectBackupPath: () => ipcRenderer.invoke('select-backup-path'),
  getBackupPath: () => ipcRenderer.invoke('get-backup-path'),
  deleteBackup: (backupFile) => ipcRenderer.invoke('delete-backup', backupFile)
});

// Network API - MISSING FROM THIS FILE!
contextBridge.exposeInMainWorld('networkAPI', {
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
  testConnectivity: (target) => ipcRenderer.invoke('test-connectivity', target),
  traceRoute: (target) => ipcRenderer.invoke('trace-route', target),
  performDnsLookup: (domain) => ipcRenderer.invoke('dns-lookup', domain),
  flushDns: () => ipcRenderer.invoke('flush-dns'),
  renewIpConfig: () => ipcRenderer.invoke('renew-ip-config'),
  resetNetworkStack: () => ipcRenderer.invoke('reset-network-stack'),
  getNetworkAdapters: () => ipcRenderer.invoke('get-network-adapters'),
  pingHost: (host) => ipcRenderer.invoke('ping-host', host)
});
