const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const sudo = require('sudo-prompt');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const os = require('os');


console.log('[Updater] App version:', app.getVersion());

autoUpdater.on('checking-for-update', () => console.log('[Updater] Checking for update...'));
autoUpdater.on('update-not-available', () => console.log('[Updater] No update available.'));
autoUpdater.on('update-available', (info) => console.log('[Updater] Update available:', info.version));
autoUpdater.on('download-progress', (p) => console.log(`[Updater] Downloading: ${Math.round(p.percent)}%`));
autoUpdater.on('update-downloaded', () => console.log('[Updater] Update downloaded. Will install on quit.'));
autoUpdater.on('error', (err) => console.error('[Updater] Error:', err));

const options = { name: 'PC Buddy' };

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   
      nodeIntegration: false,   
      enableRemoteModule: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.webContents.once('did-finish-load', () => autoUpdater.checkForUpdatesAndNotify());
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
            return resolve('SFC found problems but DISM failed.');
          }
          return resolve('SFC found problems. DISM repair attempted.');
        });
      } else {
        return resolve('SFC completed successfully.');
      }
    });
  });
});

ipcMain.handle('run-disk-cleanup', async () => {
  return new Promise((resolve, reject) => {
    sudo.exec('cleanmgr /sagerun:1', options, (err, stdout, stderr) => {
      if (err) {
        console.error('[Disk Cleanup Error]', err);
        return resolve('Disk cleanup failed.');
      }
      return resolve('Disk cleanup completed successfully.');
    });
  });
});

function normalizeStartupItems(items) {
  return items.map((item, i) => {
    const fallbackCommand = item.Command && item.Command.trim() ? item.Command : `${item.Name}.exe`;
    return {
      ...item,
      Name: item.Name || 'Unnamed',
      Command: fallbackCommand,
      priority: item.Safety === 'danger' ? 3 : item.Safety === 'caution' ? 2 : 1,
      index: i
    };
  });
}




function fetchStartupPrograms() {
  return new Promise((resolve, reject) => {
    const scriptPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'getStartupPrograms.ps1')
      : path.join(__dirname, '..', 'assets', 'getStartupPrograms.ps1');

    const tempJsonPath = path.join(os.tmpdir(), 'startup_programs.json');

    console.log('[Debug] Looking for script at:', scriptPath);
    console.log('[Debug] Will write JSON to:', tempJsonPath);

    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath
    ]);

    let stderr = '';
    ps.stderr.on('data', data => stderr += data.toString());

    ps.on('close', (code) => {
      console.log('[Debug] PowerShell exit code:', code);
      console.log('[Debug] Raw PS error output on exit:', stderr);

      if (code !== 0) return reject(new Error(`PowerShell script failed: ${stderr}`));

      try {
        const raw = fs.readFileSync(tempJsonPath, 'utf8').replace(/^\uFEFF/, '');
        const data = JSON.parse(raw);

        resolve(normalizeStartupItems(data));
        console.log('[Debug] Normalized startup items:', data);
      } catch (err) {
        reject(new Error(`Failed to parse JSON from file: ${err.message}`));
      }
    });
  });
}

ipcMain.handle('get-startup-programs', async () => {
  const list = await fetchStartupPrograms();
  return list.sort((a, b) => a.priority - b.priority);
});

ipcMain.handle('toggle-startup-program', async (event, programName, enable) => {
  const list = await fetchStartupPrograms();
  const item = list.find(p => p.Name.toLowerCase() === programName.toLowerCase());
  if (!item) throw new Error(`Startup item '${programName}' not found`);

  const scriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'toggleStartup.ps1')
    : path.join(__dirname, '..', 'assets', 'toggleStartup.ps1');

  const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -Name "${item.RegistryName}" -Source "${item.Source}" -Enable ${enable ? '1' : '0'}`;

  return new Promise((resolve, reject) => {
    sudo.exec(command, options, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.trim());
    });
  });
});

ipcMain.on('open-task-manager', () => {
  exec('start taskmgr.exe /0 /startup', (error) => {
    if (error) console.error('Failed to open Task Manager:', error);
  });
});
