console.log('[preload.js] loaded');

const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

// Helper function to execute commands
function execCommand(command, description) {
  console.log(`[API] ${description}:`, command);
  exec(command, (error) => {
    if (error) {
      console.error(`[API] Failed to ${description.toLowerCase()}:`, error);
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

contextBridge.exposeInMainWorld('electronAPI', {
  runSystemRepair: () => ipcRenderer.invoke('run-sfc-and-dism'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, version) => cb(version)),
  onDownloadProgress: (cb) => ipcRenderer.on('update-download-progress', (_, progress) => cb(progress)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', () => cb()),
  startUpdate: () => ipcRenderer.send('start-update'),
  openExternal: (url) => execCommand(`start ${url}`, 'Opening external URL')
});

contextBridge.exposeInMainWorld('systemInfoAPI', {
  getSystemInfo: () => ({
    osType: os.type(),
    osPlatform: os.platform(),
    osRelease: os.release(),
    arch: os.arch(),
    cpu: os.cpus()[0].model,
    ram: (os.totalmem() / (1024 ** 3)).toFixed(2) + ' GB',
    hostname: os.hostname(),
    uptime: formatUptime(os.uptime())
  })
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
  openControlPanel: () => openSystemSetting('control', 'Control Panel'),
  openProgramsAndFeatures: () => openSystemSetting('appwiz.cpl', 'Programs and Features'),
  openDeviceManager: () => openSystemSetting('devmgmt.msc', 'Device Manager'),
  openSystemProperties: () => openSystemSetting('sysdm.cpl', 'System Properties'),
  openNetworkSettings: () => openSystemSetting('ncpa.cpl', 'Network Settings'),
  openWifiSettings: () => openSystemSetting('start ms-settings:network-wifi', 'WiFi Settings'),
  openDisplaySettings: () => openSystemSetting('start ms-settings:display', 'Display Settings'),
  openSoundSettings: () => openSystemSetting('start ms-settings:sound', 'Sound Settings'),
  openWindowsUpdate: () => openSystemSetting('start ms-settings:windowsupdate', 'Windows Update'),
  
  openPath: (filePath) => {
    console.log('[systemAPI] Opening path:', filePath);
    
    if (filePath.toLowerCase().endsWith('.exe')) {
      // Execute .exe files directly
      exec(`"${filePath}"`, (error) => {
        if (error) {
          console.error('[systemAPI] Failed to execute .exe file:', error);
          // Fallback: try with explorer
          execCommand(`explorer "${filePath}"`, 'Opening with explorer (fallback)');
        }
      });
    } else if (filePath.includes('\\') || filePath.includes('/')) {
      // File/folder path - use explorer
      execCommand(`explorer "${filePath}"`, 'Opening folder/file with explorer');
    } else {
      // Command or program name
      execCommand(filePath, 'Executing command');
    }
  }
});
