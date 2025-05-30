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
  return new Promise((resolve, reject) => {
    sudo.exec('sfc /scannow', options, (sfcErr, sfcOut, sfcErrOut) => {
      const output = sfcOut + sfcErrOut;
      const needsDism = /unable to fix/i.test(output);

      if (sfcErr) {
        log('[SFC Error]', sfcErr);
        return reject(new Error('System scan failed. Please try running as administrator.'));
      }

      if (needsDism) {
        sudo.exec('DISM /Online /Cleanup-Image /RestoreHealth', options, (dismErr) => {
          if (dismErr) {
            log('[DISM Error]', dismErr);
            return reject(new Error('SFC found problems but DISM repair failed.'));
          }
          return resolve('SFC found problems. DISM repair completed successfully.');
        });
      } else {
        return resolve('SFC scan completed successfully. No problems found.');
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

// Helper function to get current backup path
async function getCurrentBackupPath() {
  return new Promise((resolve, reject) => {
    // Use Windows reg command to query the registry (matches how we write it)
    const regCommand = `reg query "HKCU\\Software\\PC-Buddy" /v BackupLocation 2>nul`;
    
    exec(regCommand, (error, stdout, stderr) => {
      if (error) {
        log('[getCurrentBackupPath] Registry query failed:', error);
        // Fallback to JavaScript default
        const os = require('os');
        const path = require('path');
        const defaultPath = path.join(os.homedir(), 'Documents', 'PC-Buddy-Backups');
        log('[getCurrentBackupPath] Using JavaScript fallback:', defaultPath);
        resolve(defaultPath);
      } else {
        log('[getCurrentBackupPath] Registry query stdout:', JSON.stringify(stdout));
        
        // Parse the reg query output - try multiple patterns
        // Pattern 1: "    BackupLocation    REG_SZ    C:\path\here"
        let match = stdout.match(/BackupLocation\s+REG_SZ\s+(.+?)(?:\s*$|\r|\n)/m);
        
        // Pattern 2: Try simpler pattern if first fails
        if (!match) {
          match = stdout.match(/REG_SZ\s+(.+?)(?:\s*$|\r|\n)/m);
        }
        
        if (match && match[1] && match[1].trim()) {
          const registryPath = match[1].trim();
          log('[getCurrentBackupPath] Found registry path:', registryPath);
          resolve(registryPath);
        } else {
          // No registry value found, use default
          const os = require('os');
          const path = require('path');
          const defaultPath = path.join(os.homedir(), 'Documents', 'PC-Buddy-Backups');
          log('[getCurrentBackupPath] No registry value found in output, using default:', defaultPath);
          resolve(defaultPath);
        }
      }
    });
  });
}

// Backup Management Handlers
ipcMain.handle('create-backup', async () => {
  return new Promise(async (resolve, reject) => {
    try {
      const backupPath = await getCurrentBackupPath();
      const scriptPath = getScriptPath('createBackup.ps1');
      const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -BackupLocation "${backupPath}"`;
      
      log('[create-backup] Running command:', command);
      log('[create-backup] Using backup path:', backupPath);
      
      sudo.exec(command, options, (error, stdout, stderr) => {
        if (error) {
          log('[create-backup] Error:', error);
          log('[create-backup] Stderr:', stderr);
          return reject(new Error(`Backup failed: ${error.message}`));
        }
        
        log('[create-backup] Success:', stdout);
        resolve(stdout.trim());
      });
    } catch (pathError) {
      log('[create-backup] Path error:', pathError);
      reject(new Error(`Failed to get backup path: ${pathError.message}`));
    }
  });
});

ipcMain.handle('get-backup-info', async () => {
  return new Promise(async (resolve, reject) => {
    try {
      const backupPath = await getCurrentBackupPath();
      const scriptPath = getScriptPath('getBackupInfo.ps1');
      const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -BackupLocation "${backupPath}"`;

      log('[get-backup-info] Running command:', command);
      log('[get-backup-info] Using backup path:', backupPath);

      exec(command, (error, stdout, stderr) => {
        if (error) {
          log('[get-backup-info] PowerShell exec error:', error);
          return reject(error);
        }

        try {
          const data = JSON.parse(stdout);
          resolve(data);
        } catch (parseError) {
          log('[get-backup-info] JSON parse error:', parseError);
          log('[stdout]', stdout);
          reject(parseError);
        }
      });
    } catch (pathError) {
      log('[get-backup-info] Path error:', pathError);
      reject(new Error(`Failed to get backup path: ${pathError.message}`));
    }
  });
});

ipcMain.handle('open-backup-location', async () => {
  return new Promise(async (resolve, reject) => {
    try {
      const backupLocation = await getCurrentBackupPath();
      
      // Create the directory if it doesn't exist
      const fs = require('fs');
      if (!fs.existsSync(backupLocation)) {
        fs.mkdirSync(backupLocation, { recursive: true });
      }
      
      // Open the backup location in Explorer
      exec(`start "" "${backupLocation}"`, (error) => {
        if (error) {
          log('[open-backup-location] Error opening explorer:', error);
          return reject(new Error('Failed to open backup location'));
        }
        resolve(`Opened backup location: ${backupLocation}`);
      });
      
    } catch (error) {
      log('[open-backup-location] Error:', error);
      reject(new Error('Failed to determine backup location'));
    }
  });
});

// Backup path selection handler
ipcMain.handle('select-backup-path', async () => {
  const { dialog } = require('electron');
  
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Backup Location',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Select Folder'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    log('[select-backup-path] User selected path:', selectedPath);
    
    // Save the selected path to registry using a simpler registry command
    try {
      const regCommand = `reg add "HKCU\\Software\\PC-Buddy" /v BackupLocation /t REG_SZ /d "${selectedPath}" /f`;
      
      return new Promise((resolve, reject) => {
        exec(regCommand, (error, stdout, stderr) => {
          if (error) {
            log('[select-backup-path] Registry command error:', error);
            log('[select-backup-path] stderr:', stderr);
            return reject(new Error('Failed to save backup location'));
          }
          
          log('[select-backup-path] Registry command success:', stdout);
          log('[select-backup-path] Successfully saved path:', selectedPath);
          resolve(selectedPath);
        });
      });
    } catch (error) {
      log('[select-backup-path] Error:', error);
      throw new Error('Failed to save backup location');
    }
  } else {
    throw new Error('No folder selected');
  }
});

// Get current backup path
ipcMain.handle('get-backup-path', async () => {
  return new Promise((resolve, reject) => {
    // Use Windows reg command to query the registry (matches how we write it)
    const regCommand = `reg query "HKCU\\Software\\PC-Buddy" /v BackupLocation 2>nul`;
    
    exec(regCommand, (error, stdout, stderr) => {
      if (error) {
        log('[get-backup-path] Registry query failed:', error);
        // Fallback to JavaScript default
        const os = require('os');
        const path = require('path');
        const defaultPath = path.join(os.homedir(), 'Documents', 'PC-Buddy-Backups');
        log('[get-backup-path] Using JavaScript fallback:', defaultPath);
        resolve(defaultPath);
      } else {
        log('[get-backup-path] Registry query stdout:', JSON.stringify(stdout));
        
        // Parse the reg query output - try multiple patterns
        // Pattern 1: "    BackupLocation    REG_SZ    C:\path\here"
        let match = stdout.match(/BackupLocation\s+REG_SZ\s+(.+?)(?:\s*$|\r|\n)/m);
        
        // Pattern 2: Try simpler pattern if first fails
        if (!match) {
          match = stdout.match(/REG_SZ\s+(.+?)(?:\s*$|\r|\n)/m);
        }
        
        if (match && match[1] && match[1].trim()) {
          const registryPath = match[1].trim();
          log('[get-backup-path] Found registry path:', registryPath);
          resolve(registryPath);
        } else {
          // No registry value found, use default
          const os = require('os');
          const path = require('path');
          const defaultPath = path.join(os.homedir(), 'Documents', 'PC-Buddy-Backups');
          log('[get-backup-path] No registry value found in output, using default:', defaultPath);
          resolve(defaultPath);
        }
      }
    });
  });
});

// Run PowerShell command handler
ipcMain.handle('run-powershell-command', async (event, command) => {
  return new Promise((resolve, reject) => {
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${command}"`, (error, stdout, stderr) => {
      if (error) {
        log('[run-powershell-command] Error:', error);
        return reject(new Error(stderr || error.message));
      }
      resolve(stdout.trim());
    });
  });
});
