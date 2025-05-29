const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const sudo = require('sudo-prompt');
const { autoUpdater } = require('electron-updater');

console.log('[Updater] App version:', app.getVersion());

autoUpdater.on('checking-for-update', () => {
  console.log('[Updater] Checking for update...');
});

autoUpdater.on('update-not-available', () => {
  console.log('[Updater] No update available.');
});

autoUpdater.on('update-available', (info) => {
  console.log('[Updater] Update available:', info.version);
});

autoUpdater.on('download-progress', (p) => {
  console.log(`[Updater] Downloading: ${Math.round(p.percent)}%`);
});

autoUpdater.on('update-downloaded', () => {
  console.log('[Updater] Update downloaded. Will install on quit.');
});

autoUpdater.on('error', (err) => {
  console.error('[Updater] Error:', err);
});


const options = {
  name: 'PC Buddy',
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,       // required for contextBridge
      nodeIntegration: false,        // keeps things secure
      enableRemoteModule: false,  // recommended for security
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.webContents.once('did-finish-load', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });
}

autoUpdater.on('update-available', () => {
  console.log('Update available.');
});

autoUpdater.on('update-downloaded', () => {
  console.log('Update downloaded. Will install on quit.');
});


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

ipcMain.handle('run-disk-cleanup', async () => {
  return new Promise((resolve, reject) => {
    sudo.exec('cleanmgr /sagerun:1', options, (err, stdout, stderr) => {
      if (err) {
        console.error('[Disk Cleanup Error]', err);
        return resolve('Disk cleanup failed. Please try again later.');
      }
      return resolve('Disk cleanup completed successfully.');
    });
  });
});

function fetchStartupPrograms() {
  return new Promise((resolve, reject) => {
    const scriptPath = app.isPackaged
      ? path.join(process.resourcesPath, 'assets', 'getStartupPrograms.ps1')
      : path.join(__dirname, '..', 'assets', 'getStartupPrograms.ps1');


    console.log('[Debug] Looking for PowerShell script at:', scriptPath);

    const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath]);

    let stdout = '', stderr = '';
    ps.stdout.on('data', data => stdout += data.toString());
    ps.stderr.on('data', data => stderr += data.toString());

    ps.on('close', (code) => {
      if (code !== 0) return reject(new Error(`PowerShell script failed: ${stderr}`));
      try {
        let data = JSON.parse(stdout);
        data = normalizeStartupItems(data);
        resolve(data);
      } catch (err) {
        reject(new Error('Failed to parse JSON from startup script.'));
      }
    });
  });
}



ipcMain.handle('get-startup-programs', async () => {
  const list = await fetchStartupPrograms();
  const priority = { caution: 2, safe: 1, unknown: 3 };
  list.sort((a, b) => priority[a.Safety] - priority[b.Safety]);
  return list;
});


function extractExecutableName(command) {
  if (!command) return '';
  return command
    .replace(/%windir%/gi, 'C:\\Windows')
    .replace(/^"(.*)"$/, '$1')
    .trim()
    .match(/([^\\\/]+\.exe)/i)?.[1]
    ?.toLowerCase() || '';
}

function normalizeStartupItems(items) {
  const seen = new Set();
  return items.filter(item => {
    const exe = extractExecutableName(item.Command);
    if (!exe || seen.has(exe)) return false;
    seen.add(exe);
    item.Name = exe; // Update display name for consistency
    return true;
  });
}

ipcMain.handle('toggle-startup-program', async (event, programName, enable) => {
  const list = await fetchStartupPrograms();
  const item = list.find(p => p.Name.toLowerCase() === programName.toLowerCase());
  if (!item) throw new Error(`Startup item '${programName}' not found`);

  const scriptPath = app.isPackaged
  ? path.join(process.resourcesPath, 'assets', 'toggleStartup.ps1')
  : path.join(__dirname, '..', 'assets', 'toggleStartup.ps1');

  
  // Use the registry name instead of the display name
  const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Name "${item.RegistryName}" -Source "${item.Source}" -Enable ${enable ? '1' : '0'}`;

  return new Promise((resolve, reject) => {
    sudo.exec(command, { name: 'PC Buddy' }, (err, stdout, stderr) => {
      if (err) {
        console.error('[Toggle Error]', err);
        return reject(new Error(stderr || err.message));
      }
      resolve(stdout.trim());
    });
  });
});



ipcMain.on('open-task-manager', () => {
  exec('start taskmgr.exe /0 /startup', (error) => {
    if (error) {
      console.error('Failed to open Task Manager:', error);
    }
  });
});