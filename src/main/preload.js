console.log('[preload.js] loaded');

const { contextBridge, ipcRenderer, shell } = require('electron');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

contextBridge.exposeInMainWorld('electronAPI', {
  runSystemRepair: () => ipcRenderer.invoke('run-sfc-and-dism'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, version) => cb(version)),
  onDownloadProgress: (cb) => ipcRenderer.on('update-download-progress', (_, progress) => cb(progress)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', () => cb()),
  startUpdate: () => ipcRenderer.send('start-update'),
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
  openAppData: () => {
    const appDataPath = path.join(os.homedir(), 'AppData');
    console.log('[folderAPI] Opening AppData with explorer:', appDataPath);
    execFile('explorer.exe', [appDataPath], (error) => {
      if (error) {
        console.error('[folderAPI] Failed to open AppData:', error);
      }
    });
  }
});

contextBridge.exposeInMainWorld('cleanupAPI', {
  getDiskUsage: () => ipcRenderer.invoke('get-disk-usage'),
  cleanDrive: (driveLetter) => ipcRenderer.invoke('clean-drive', driveLetter)
});

function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
