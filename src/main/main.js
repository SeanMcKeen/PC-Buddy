const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const sudo = require('sudo-prompt');
const options = {
  name: 'PC Buddy',
};

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,       // required for contextBridge
      nodeIntegration: false,        // keeps things secure
      enableRemoteModule: false  // recommended for security
    }
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(createWindow);

ipcMain.handle('run-sfc-and-dism', async () => {
  return new Promise((resolve, reject) => {
    sudo.exec('sfc /scannow', options, (sfcErr, sfcOut, sfcErrOut) => {
      const output = sfcOut + sfcErrOut;
      const needsDism = /unable to fix/i.test(output);

      if (sfcErr) {
        console.error('[SFC Error]', sfcErr);
        return resolve('System scan failed. Please try again later.');
      }

      if (needsDism) {
        sudo.exec('DISM /Online /Cleanup-Image /RestoreHealth', options, (dismErr, dismOut, dismErrOut) => {
          if (dismErr) {
            console.error('[DISM Error]', dismErr);
            return resolve('SFC found problems but DISM failed. Try again manually.');
          }
          return resolve('SFC found problems. DISM repair attempted.');
        });
      } else {
        return resolve('SFC completed successfully. No further action needed.');
      }
    });
  });
});

