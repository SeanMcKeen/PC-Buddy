console.log('[preload.js] loaded');

const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { shell } = require('electron');

// Helper function to execute commands
function execCommand(command, description) {
  console.log(`[API] ${description}:`, command);
  return exec(command, (error) => {
    if (error) {
      console.error(`[${description}] Error:`, error);
    }
  });
}

// Helper function to execute system settings commands  
function openSystemSetting(command, name) {
  execCommand(command, `Opening ${name}`);
}

// Helper function to format uptime
function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
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
  openAppData: () => execCommand(`explorer "${path.join(os.homedir(), 'AppData')}"`, 'Opening AppData'),
  openDownloads: () => execCommand(`explorer "${path.join(os.homedir(), 'Downloads')}"`, 'Opening Downloads'),
  openDocuments: () => execCommand(`explorer "${path.join(os.homedir(), 'Documents')}"`, 'Opening Documents'),
  openDesktop: () => execCommand(`explorer "${path.join(os.homedir(), 'Desktop')}"`, 'Opening Desktop')
});

contextBridge.exposeInMainWorld('cleanupAPI', {
  getDiskUsage: () => ipcRenderer.invoke('get-disk-usage'),
  cleanDrive: (driveLetter) => ipcRenderer.invoke('clean-drive', driveLetter)
});

contextBridge.exposeInMainWorld('systemAPI', {
  openPath: (path) => shell.openPath(path),
  openControlPanel: () => shell.openExternal('ms-settings:appsfeatures'),
  openProgramsAndFeatures: () => shell.openExternal('appwiz.cpl'),
  openDeviceManager: () => shell.openExternal('devmgmt.msc'),
  openSystemProperties: () => shell.openExternal('sysdm.cpl'),
  openNetworkSettings: () => shell.openExternal('ms-settings:network'),
  openWifiSettings: () => shell.openExternal('ms-settings:network-wifi'),
  openDisplaySettings: () => shell.openExternal('ms-settings:display'),
  openSoundSettings: () => shell.openExternal('ms-settings:sound'),
  openWindowsUpdate: () => shell.openExternal('ms-settings:windowsupdate'),
  runPowerShellCommand: (command) => ipcRenderer.invoke('run-powershell-command', command)
});

// Backup API
contextBridge.exposeInMainWorld('backupAPI', {
  createBackup: () => ipcRenderer.invoke('create-backup'),
  getBackupInfo: () => ipcRenderer.invoke('get-backup-info'),
  openBackupLocation: () => ipcRenderer.invoke('open-backup-location'),
  selectBackupPath: () => ipcRenderer.invoke('select-backup-path'),
  getBackupPath: () => ipcRenderer.invoke('get-backup-path')
});
