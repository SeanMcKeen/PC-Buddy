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
    icon: path.join(__dirname, '../assets/images/logo.png'),
    autoHideMenuBar: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: !app.isPackaged
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Hide menu bar completely when packaged
  if (app.isPackaged) {
    mainWindow.setMenuBarVisibility(false);
  }

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

// Enhanced security helper functions
function sanitizeForShell(input) {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }
  
  // Remove or escape dangerous characters for shell commands (Windows path safe)
  return input
    .replace(/[;&|`$(){}[\]<>]/g, '') // Remove shell metacharacters (preserve backslash and colon for Windows paths)
    .replace(/\.\./g, '') // Remove directory traversal attempts
    .replace(/^\s+|\s+$/g, '') // Trim whitespace
    .substring(0, 500); // Limit length to prevent buffer overflow attempts
}

function validatePath(path) {
  if (typeof path !== 'string' || path.length === 0 || path.length > 260) {
    throw new Error('Invalid path format');
  }
  
  // Block only truly dangerous path patterns (Windows-compatible)
  const dangerousPatterns = [
    /\.\./,                    // Directory traversal
    /[<>"|?*]/,               // Invalid Windows path chars (excluding colon for drive letters)
    /:.*:/,                   // Multiple colons (invalid)
    /^[^A-Za-z].*:/,         // Colon not after drive letter
    /^\\\\.*\\admin\$/i,     // Admin shares
    /^\\\\.*\\c\$/i,         // Hidden C$ shares
    /script:/i,               // Script protocols
    /javascript:/i,           // JavaScript protocol
    /vbscript:/i,            // VBScript protocol
    /data:/i                  // Data protocol
  ];
  
  // Check for reserved Windows names in path components
  const pathComponents = path.split(/[\\\/]/);
  const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  
  for (const component of pathComponents) {
    if (component && reservedNames.test(component.split('.')[0])) {
      throw new Error('Path contains reserved Windows name');
    }
  }
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(path)) {
      throw new Error('Path contains potentially dangerous patterns');
    }
  }
  
  return path;
}

// System repair handler with enhanced security
ipcMain.handle('run-sfc-and-dism', async () => {
  return new Promise((resolve, reject) => {
    // Ensure only authorized SFC command is run
    const sfcCommand = 'sfc /scannow';
    
    sudo.exec(sfcCommand, options, (sfcErr, sfcOut, sfcErrOut) => {
      const output = sfcOut + sfcErrOut;
      const needsDism = /unable to fix/i.test(output);

      if (sfcErr) {
        log('[SFC Error]', sfcErr);
        return reject(new Error('System scan failed. Please try running as administrator.'));
      }

      if (needsDism) {
        // Ensure only authorized DISM command is run
        const dismCommand = 'DISM /Online /Cleanup-Image /RestoreHealth';
        
        sudo.exec(dismCommand, options, (dismErr) => {
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

// Backup Management Handlers with Enhanced Security
ipcMain.handle('create-backup', async () => {
  return new Promise(async (resolve, reject) => {
    try {
      const backupPath = await getCurrentBackupPath();
      
      // Validate backup path for security
      try {
        validatePath(backupPath);
      } catch (pathError) {
        log('[create-backup] Invalid backup path:', pathError.message);
        return reject(new Error('Invalid backup path specified'));
      }
      
      const scriptPath = getScriptPath('createBackup.ps1');
      
      // Sanitize backup path for PowerShell execution
      const sanitizedBackupPath = sanitizeForShell(backupPath);
      
      const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -BackupLocation "${sanitizedBackupPath}"`;
    
      log('[create-backup] Running command with sanitized path');
      log('[create-backup] Using backup path:', sanitizedBackupPath);
    
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
      
      // Validate backup path for security
      try {
        validatePath(backupPath);
      } catch (pathError) {
        log('[get-backup-info] Invalid backup path:', pathError.message);
        return reject(new Error('Invalid backup path specified'));
      }
      
      const scriptPath = getScriptPath('getBackupInfo.ps1');
      
      // Sanitize backup path for PowerShell execution  
      const sanitizedBackupPath = sanitizeForShell(backupPath);
      
      const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -BackupLocation "${sanitizedBackupPath}"`;

      log('[get-backup-info] Running command with sanitized path');
      log('[get-backup-info] Using backup path:', sanitizedBackupPath);

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

// Enhanced PowerShell command handler with security restrictions
ipcMain.handle('run-powershell-command', async (event, command) => {
  return new Promise((resolve, reject) => {
    // Input validation
    if (typeof command !== 'string' || command.length === 0 || command.length > 1000) {
      log('[run-powershell-command] Invalid command length');
      return reject(new Error('Invalid command format'));
    }
    
    // Whitelist of allowed PowerShell commands for this application
    const allowedCommands = [
      /^Get-WmiObject.*Win32_/i,
      /^Get-CimInstance.*Win32_/i,
      /^Get-ItemProperty.*HKLM/i,
      /^Get-ItemProperty.*HKCU/i,
      /^Get-Process$/i,
      /^Get-Service$/i,
      /^Get-Volume$/i,
      /^Get-Disk$/i,
      /^Get-ComputerInfo$/i,
      /^Get-PhysicalDisk$/i,
      /^Get-SystemInfo$/i,
      /^systeminfo$/i,
      /^wmic\s+/i,
      /^Get-ChildItem.*Temp/i,
      /^\[System\.IO\.DriveInfo\]/i,
      /^\[Environment\]/i,
      /^hostname$/i
    ];
    
    // Check if command matches any allowed pattern
    const isAllowed = allowedCommands.some(pattern => pattern.test(command));
    
    if (!isAllowed) {
      log('[run-powershell-command] Command not in whitelist:', command);
      return reject(new Error('Command not authorized for execution'));
    }
    
    // Additional security: Remove dangerous patterns even from whitelisted commands
    const dangerousPatterns = [
      /[;&|`]/,          // Command chaining
      /invoke-expression/i,
      /iex\s/i,
      /download/i,
      /start-process/i,
      /invoke-webrequest/i,
      /\.\./,            // Directory traversal
      /system32/i,       // System directory access
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        log('[run-powershell-command] Dangerous pattern detected:', command);
        return reject(new Error('Command contains prohibited patterns'));
      }
    }
    
    // Sanitize the command
    const sanitizedCommand = sanitizeForShell(command);
    
    log('[run-powershell-command] Executing whitelisted command');
    
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${sanitizedCommand}"`, (error, stdout, stderr) => {
      if (error) {
        log('[run-powershell-command] Error:', error);
        return reject(new Error(stderr || error.message));
      }
      resolve(stdout.trim());
    });
  });
});

// Open Explorer for file/folder selection (fixed command)
ipcMain.handle('open-file-explorer', async () => {
  return new Promise((resolve, reject) => {
    // Use 'start explorer' instead of just 'explorer.exe'
    exec('start explorer', (error) => {
      if (error) {
        log('[open-file-explorer] Error:', error);
        return reject(new Error('Failed to open file explorer'));
      }
      resolve('File explorer opened');
    });
  });
});

// File/Folder selection dialog for custom shortcuts
ipcMain.handle('select-file-or-folder', async () => {
  const { dialog } = require('electron');
  
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select File or Folder for Shortcut',
    properties: ['openFile', 'openDirectory'],
    buttonLabel: 'Select'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    log('[select-file-or-folder] User selected path:', selectedPath);
    return selectedPath;
  } else {
    throw new Error('No file or folder selected');
  }
});

// Delete backup files handler - WINDOWS LONG PATH COMPATIBLE
ipcMain.handle('delete-backup', async (event, backupFile) => {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    log('[delete-backup] Starting deletion request for:', backupFile);
    
    try {
      // Validate input parameters
      if (!backupFile || typeof backupFile !== 'string') {
        log('[delete-backup] Invalid backup file parameter:', backupFile);
        return reject(new Error('Invalid backup file parameter'));
      }

      const backupPath = await getCurrentBackupPath();
      log('[delete-backup] Using backup path:', backupPath);
      
      // Validate backup path for security
      try {
        validatePath(backupPath);
      } catch (pathError) {
        log('[delete-backup] Invalid backup path:', pathError.message);
        return reject(new Error('Invalid backup path specified'));
      }
      
      // Validate backup file name for security
      if (backupFile.includes('..') || backupFile.includes('/') || backupFile.includes('\\')) {
        log('[delete-backup] Invalid backup file name (path traversal attempt):', backupFile);
        return reject(new Error('Invalid backup file name'));
      }
      
      const fs = require('fs');
      const fullBackupPath = path.join(backupPath, backupFile);
      log('[delete-backup] Full backup path to delete:', fullBackupPath);
      
      // Additional security check - ensure file is in the backup directory
      if (!fullBackupPath.startsWith(backupPath)) {
        log('[delete-backup] Path traversal attempt blocked:', fullBackupPath);
        return reject(new Error('Invalid backup file path'));
      }
      
      // Check if file/directory exists
      if (!fs.existsSync(fullBackupPath)) {
        log('[delete-backup] Backup file does not exist:', fullBackupPath);
        return reject(new Error('Backup file does not exist'));
      }
      
      // Check if it's a directory or file and delete accordingly
      let stats;
      try {
        stats = fs.statSync(fullBackupPath);
      } catch (statError) {
        log('[delete-backup] Error getting file stats:', statError);
        return reject(new Error('Failed to access backup file'));
      }
      
      log('[delete-backup] File stats - isDirectory:', stats.isDirectory(), 'size:', stats.size);
      
      try {
        if (stats.isDirectory()) {
          // Handle long paths by moving to temp location first, then deleting
          log('[delete-backup] Deleting directory with long path support:', fullBackupPath);
          const deleteStart = Date.now();
          
          // Create a short temp directory name to avoid path length issues
          const tempId = Date.now().toString(36);
          const tempPath = path.join(os.tmpdir(), `del_${tempId}`);
          log('[delete-backup] Using temp path for deletion:', tempPath);
          
          await new Promise((moveResolve, moveReject) => {
            // First, move the directory to a temp location with a short path
            const moveCommand = `robocopy "${fullBackupPath}" "${tempPath}" /E /MOVE /R:0 /W:0 /NFL /NDL /NP /NJH /NJS`;
            
            exec(moveCommand, { timeout: 120000 }, (moveError, moveStdout, moveStderr) => {
              // Robocopy exit codes 0-7 are success (8+ are errors)
              if (moveError && moveError.code > 7) {
                log('[delete-backup] Robocopy move failed:', moveError);
                log('[delete-backup] Robocopy stderr:', moveStderr);
                
                // If robocopy fails, try direct rmdir with UNC path notation
                log('[delete-backup] Trying direct deletion with UNC path');
                const uncPath = `\\\\?\\${fullBackupPath}`;
                const rmCommand = `rmdir /s /q "${uncPath}"`;
                
                exec(rmCommand, { timeout: 60000 }, (rmError, rmStdout, rmStderr) => {
                  if (rmError) {
                    log('[delete-backup] UNC rmdir failed:', rmError);
                    moveReject(new Error(`Failed to delete directory: ${moveError.message}`));
                  } else {
                    log('[delete-backup] UNC rmdir succeeded');
                    moveResolve();
                  }
                });
              } else {
                log('[delete-backup] Robocopy move completed, now deleting temp directory');
                
                // Now delete the temp directory (which has short paths)
                const deleteTempCommand = `rmdir /s /q "${tempPath}"`;
                
                exec(deleteTempCommand, { timeout: 60000 }, (delError, delStdout, delStderr) => {
                  if (delError) {
                    log('[delete-backup] Temp deletion failed:', delError);
                    // Try to clean up manually
                    try {
                      fs.rmSync(tempPath, { recursive: true, force: true });
                      log('[delete-backup] Manual temp cleanup succeeded');
                      moveResolve();
                    } catch (cleanupError) {
                      log('[delete-backup] Manual cleanup failed:', cleanupError);
                      moveReject(new Error(`Directory moved but temp cleanup failed: ${delError.message}`));
                    }
                  } else {
                    log('[delete-backup] Temp directory deleted successfully');
                    moveResolve();
                  }
                });
              }
            });
          });
          
          const deleteTime = Date.now() - deleteStart;
          log('[delete-backup] Successfully deleted backup directory in', deleteTime, 'ms');
        } else {
          // Delete single file
          log('[delete-backup] Deleting file:', fullBackupPath);
          const deleteStart = Date.now();
          
          fs.unlinkSync(fullBackupPath);
          
          const deleteTime = Date.now() - deleteStart;
          log('[delete-backup] Successfully deleted backup file in', deleteTime, 'ms');
        }
        
        const totalTime = Date.now() - startTime;
        const successMessage = `Backup "${backupFile}" deleted successfully`;
        log('[delete-backup] Operation completed in', totalTime, 'ms');
        resolve(successMessage);
        
      } catch (deleteError) {
        log('[delete-backup] File deletion error:', deleteError);
        
        // Provide more specific error messages
        if (deleteError.message.includes('timeout')) {
          return reject(new Error('Cannot delete backup: operation timed out (backup may be very large)'));
        } else if (deleteError.message.includes('Access is denied')) {
          return reject(new Error('Cannot delete backup: access denied. Try running PC Buddy as administrator.'));
        } else if (deleteError.message.includes('cannot find')) {
          return reject(new Error('Cannot delete backup: file not found'));
        } else if (deleteError.message.includes('path') && deleteError.message.includes('long')) {
          return reject(new Error('Cannot delete backup: file paths are too long for Windows. Please delete manually.'));
        } else if (deleteError.code === 'EBUSY') {
          return reject(new Error('Cannot delete backup: file is currently in use'));
        } else if (deleteError.code === 'EACCES') {
          return reject(new Error('Cannot delete backup: access denied'));
        } else if (deleteError.code === 'ENOENT') {
          return reject(new Error('Cannot delete backup: file not found'));
        } else {
          return reject(new Error(`Failed to delete backup: ${deleteError.message}`));
        }
      }
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      log('[delete-backup] Unexpected error after', totalTime, 'ms:', error);
      reject(new Error(`Failed to delete backup: ${error.message}`));
    }
  });
});

// Window focus management for shortcuts
ipcMain.handle('bring-window-to-front', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Just ensure our window isn't always on top so other apps can appear above it naturally
    mainWindow.setAlwaysOnTop(false);
    return true;
  }
  return false;
});

ipcMain.handle('set-always-on-top', async (event, enabled) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(enabled);
    return enabled;
  }
  return false;
});

// Handler to temporarily reduce window focus so other apps can appear on top
ipcMain.handle('ensure-apps-on-top', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Just ensure we're not always on top so other apps can appear above us naturally
    mainWindow.setAlwaysOnTop(false);
    return true;
  }
  return false;
});
