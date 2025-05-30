const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const sudo = require('sudo-prompt');
const { spawn, exec } = require('child_process');
const os = require('os');

// Sudo options for elevated commands
const options = { name: 'PC Buddy' };

// Log to AppData/Roaming/PC Buddy/updater.log
const logFile = path.join(app.getPath('userData'), 'updater.log');
fs.writeFileSync(logFile, ''); // clear at startup

function log(...args) {
  const msg = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  console.log(...args);
  fs.appendFileSync(logFile, msg);
}

autoUpdater.logger = { info: log, warn: log, error: log, debug: log };

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    log('[Updater] Checking for updates...');
    autoUpdater.checkForUpdates();
  });
}

// Update events
autoUpdater.on('update-available', (info) => {
  log('[Updater] Update available:', info.version);
  mainWindow.webContents.send('update-available', info.version);
});

autoUpdater.on('update-not-available', () => {
  log('[Updater] No update available.');
});

autoUpdater.on('download-progress', (progress) => {
  log(`[Updater] Download progress: ${Math.round(progress.percent)}%`);
  mainWindow.webContents.send('update-download-progress', progress);
});

autoUpdater.on('update-downloaded', () => {
  log('[Updater] Update downloaded, prompting user to install.');
  mainWindow.webContents.send('update-downloaded');
});

ipcMain.on('start-update', () => {
  log('[Updater] User confirmed install. Quitting and installing.');
  autoUpdater.quitAndInstall();
});

app.whenReady().then(createWindow);

// Helper function to get script path based on packaging
function getScriptPath(scriptName) {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', scriptName)
    : path.join(__dirname, '..', 'assets', scriptName);
}

// System repair handler
ipcMain.handle('run-sfc-and-dism', async () => {
  return new Promise((resolve) => {
    sudo.exec('sfc /scannow', options, (sfcErr, sfcOut, sfcErrOut) => {
      const output = sfcOut + sfcErrOut;
      const needsDism = /unable to fix/i.test(output);

      if (sfcErr) {
        log('[SFC Error]', sfcErr);
        return resolve('System scan failed. Please try again later.');
      }

      if (needsDism) {
        sudo.exec('DISM /Online /Cleanup-Image /RestoreHealth', options, (dismErr) => {
          if (dismErr) {
            log('[DISM Error]', dismErr);
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

// Disk cleanup handler
ipcMain.handle('run-disk-cleanup', async () => {
  return new Promise((resolve) => {
    sudo.exec('cleanmgr /sagerun:1', options, (err) => {
      if (err) {
        log('[Disk Cleanup Error]', err);
        return resolve('Disk cleanup failed.');
      }
      return resolve('Disk cleanup completed successfully.');
    });
  });
});

// Normalize startup items for consistent structure
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

// Fetch startup programs
function fetchStartupPrograms() {
  return new Promise((resolve, reject) => {
    const scriptPath = getScriptPath('getStartupPrograms.ps1');
    const tempJsonPath = path.join(os.tmpdir(), 'startup_programs.json');

    log('[Debug] Looking for script at:', scriptPath);
    log('[Debug] Will write JSON to:', tempJsonPath);

    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath
    ]);

    let stderr = '';
    ps.stderr.on('data', data => stderr += data.toString());

    ps.on('close', (code) => {
      log('[Debug] PowerShell exit code:', code);
      if (stderr) log('[Debug] PowerShell stderr:', stderr);

      if (code !== 0) return reject(new Error(`PowerShell script failed: ${stderr}`));

      try {
        const raw = fs.readFileSync(tempJsonPath, 'utf8').replace(/^\uFEFF/, '');
        const data = JSON.parse(raw);
        const normalized = normalizeStartupItems(data);
        log('[Debug] Normalized startup items count:', normalized.length);
        resolve(normalized);
      } catch (err) {
        reject(new Error(`Failed to parse JSON from file: ${err.message}`));
      }
    });
  });
}

// IPC handlers
ipcMain.handle('get-startup-programs', async () => {
  const list = await fetchStartupPrograms();
  return list.sort((a, b) => a.priority - b.priority);
});

ipcMain.handle('toggle-startup-program', async (event, programName, enable) => {
  const list = await fetchStartupPrograms();
  const item = list.find(p => p.Name.toLowerCase() === programName.toLowerCase());
  if (!item) throw new Error(`Startup item '${programName}' not found`);

  const scriptPath = getScriptPath('toggleStartup.ps1');
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
    if (error) log('Failed to open Task Manager:', error);
  });
});

ipcMain.handle('clean-drive', async (event, driveLetter = 'C') => {
  return new Promise((resolve) => {
    const letter = driveLetter.toUpperCase().replace(':', '');
    const scriptPath = getScriptPath('deepClean.ps1');
    const command = `powershell -ExecutionPolicy Bypass -NoProfile -File "${scriptPath}" -DriveLetter ${letter}`;

    exec(command, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        log('[Deep Clean Error]', error);
        return resolve(`Cleanup failed for ${letter}:.`);
      }
      log('[Deep Clean Output]', stdout);
      resolve(`Cleanup completed for ${letter}:.`);
    });
  });
});

ipcMain.handle('get-disk-usage', async () => {
  return new Promise((resolve, reject) => {
    const scriptPath = getScriptPath('getDiskUsage.ps1');
    const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        log('[get-disk-usage] PowerShell exec error:', error);
        return reject(error);
      }

      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch (parseError) {
        log('[get-disk-usage] JSON parse error:', parseError);
        log('[stdout]', stdout);
        reject(parseError);
      }
    });
  });
});
