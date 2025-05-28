const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  runSystemRepair: () => ipcRenderer.invoke('run-sfc-and-dism')
});
