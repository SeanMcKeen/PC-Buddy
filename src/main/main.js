const { app, BrowserWindow, ipcMain, shell, dialog, Notification } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const sudo = require('sudo-prompt');
const { spawn, exec } = require('child_process');
const os = require('os');

// Import utility classes
const {
  PowerShellUtils,
  ValidationUtils,
  BackupUtils,
  NetworkUtils,
  SystemUtils,
  setLogger,
  sanitizeForShell,
  validatePath,
  getScriptPath
} = require('./utilities');

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

// Set the logger for utilities
setLogger(log);

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

// System repair handler with enhanced security
ipcMain.handle('run-sfc-and-dism', async () => {
  try {
    // Ensure only authorized SFC command is run
    const sfcResult = await SystemUtils.executeSudoCommand('sfc /scannow', 'run-sfc-and-dism');
    const needsDism = /unable to fix/i.test(sfcResult);

    if (needsDism) {
      // Ensure only authorized DISM command is run
      await SystemUtils.executeSudoCommand('DISM /Online /Cleanup-Image /RestoreHealth', 'run-sfc-and-dism');
      return 'SFC found problems. DISM repair completed successfully.';
    } else {
      return 'SFC scan completed successfully. No problems found.';
    }
  } catch (error) {
    if (error.message.includes('unable to fix')) {
      return 'SFC found problems but DISM repair failed.';
    }
    throw ValidationUtils.createError('System scan failed. Please try running as administrator.', 'run-sfc-and-dism');
  }
});

// Disk cleanup handler
ipcMain.handle('run-disk-cleanup', async () => {
  try {
    await SystemUtils.executeSudoCommand('cleanmgr /sagerun:1', 'run-disk-cleanup');
    return 'Disk cleanup completed successfully.';
  } catch (error) {
    log('[Disk Cleanup Error]', error);
    return 'Disk cleanup failed.';
  }
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

// Fetch startup programs using new utility classes
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

      if (code !== 0) return reject(ValidationUtils.createError(`PowerShell script failed: ${stderr}`, 'fetchStartupPrograms'));

      try {
        const raw = fs.readFileSync(tempJsonPath, 'utf8').replace(/^\uFEFF/, '');
        const data = JSON.parse(raw);
        const normalized = normalizeStartupItems(data);
        log('[Debug] Normalized startup items count:', normalized.length);
        resolve(normalized);
      } catch (err) {
        reject(ValidationUtils.createError(`Failed to parse JSON from file: ${err.message}`, 'fetchStartupPrograms'));
      }
    });
  });
}

// IPC handlers using new utility classes
ipcMain.handle('get-startup-programs', async () => {
  const list = await fetchStartupPrograms();
  return list.sort((a, b) => a.priority - b.priority);
});

ipcMain.handle('toggle-startup-program', async (event, programName, enable) => {
  const list = await fetchStartupPrograms();
  const item = list.find(p => p.Name.toLowerCase() === programName.toLowerCase());
  if (!item) throw ValidationUtils.createError(`Startup item '${programName}' not found`, 'toggle-startup-program');

  const args = [`-Name "${item.RegistryName}"`, `-Source "${item.Source}"`, `-Enable ${enable ? '1' : '0'}`];
  return await PowerShellUtils.executeScript('toggleStartup.ps1', args, true);
});

ipcMain.handle('clean-drive', async (event, driveLetter = 'C') => {
  try {
    const letter = driveLetter.toUpperCase().replace(':', '');
    const args = [`-DriveLetter ${letter}`];
    const result = await PowerShellUtils.executeScript('deepClean.ps1', args);
    log('[Deep Clean Output]', result);
    return `Cleanup completed for ${letter}:.`;
  } catch (error) {
    log('[Deep Clean Error]', error);
    return `Cleanup failed for ${driveLetter}:.`;
  }
});

ipcMain.handle('get-disk-usage', async () => {
  try {
    const result = await PowerShellUtils.executeScript('getDiskUsage.ps1');
    return JSON.parse(result);
  } catch (error) {
    if (error.message.includes('JSON')) {
      log('[get-disk-usage] JSON parse error:', error);
    } else {
      log('[get-disk-usage] PowerShell exec error:', error);
    }
    throw error;
  }
});

// Backup Management Handlers with Enhanced Security
ipcMain.handle('create-backup', async () => {
  try {
    return await BackupUtils.executeWithBackupPath('createBackup.ps1', 'create-backup');
  } catch (error) {
    log('[create-backup] Error:', error);
    throw ValidationUtils.createError(`Backup failed: ${error.message}`, 'create-backup');
  }
});

ipcMain.handle('get-backup-info', async () => {
  try {
    const result = await BackupUtils.executeWithBackupPath('getBackupInfo.ps1', 'get-backup-info');
    return JSON.parse(result);
  } catch (error) {
    if (error.message.includes('JSON')) {
      log('[get-backup-info] JSON parse error:', error);
    } else {
      log('[get-backup-info] Error:', error);
    }
    throw error;
  }
});

ipcMain.handle('open-backup-location', async () => {
  try {
    const backupLocation = await BackupUtils.getCurrentBackupPath();
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(backupLocation)) {
      fs.mkdirSync(backupLocation, { recursive: true });
    }
    
    // Open the backup location in Explorer
    return new Promise((resolve, reject) => {
      exec(`start "" "${backupLocation}"`, (error) => {
        if (error) {
          log('[open-backup-location] Error opening explorer:', error);
          return reject(ValidationUtils.createError('Failed to open backup location', 'open-backup-location'));
        }
        resolve(`Opened backup location: ${backupLocation}`);
      });
    });
  } catch (error) {
    log('[open-backup-location] Error:', error);
    throw error;
  }
});

// Backup path selection handler
ipcMain.handle('select-backup-path', async () => {
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
            return reject(ValidationUtils.createError('Failed to save backup location', 'select-backup-path'));
          }
          
          log('[select-backup-path] Registry command success:', stdout);
          log('[select-backup-path] Successfully saved path:', selectedPath);
          resolve(selectedPath);
        });
      });
    } catch (error) {
      log('[select-backup-path] Error:', error);
      throw ValidationUtils.createError('Failed to save backup location', 'select-backup-path');
    }
  } else {
    throw ValidationUtils.createError('No folder selected', 'select-backup-path');
  }
});

// Get current backup path
ipcMain.handle('get-backup-path', async () => {
  return await BackupUtils.getCurrentBackupPath();
});

// Enhanced PowerShell command handler with security restrictions
ipcMain.handle('run-powershell-command', async (event, command) => {
  try {
    // Input validation
    ValidationUtils.validateStringInput(command, 1000, 'run-powershell-command');
    
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
      throw ValidationUtils.createError('Command not authorized for execution', 'run-powershell-command');
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
        throw ValidationUtils.createError('Command contains prohibited patterns', 'run-powershell-command');
      }
    }
    
    // Sanitize and execute the command
    const sanitizedCommand = sanitizeForShell(command);
    log('[run-powershell-command] Executing whitelisted command');
    
    return await PowerShellUtils.executeCommand(sanitizedCommand);
    
  } catch (error) {
    log('[run-powershell-command] Error:', error);
    throw error;
  }
});

// Open Explorer for file/folder selection (fixed command)
ipcMain.handle('open-file-explorer', async () => {
  return new Promise((resolve, reject) => {
    // Use 'start explorer' instead of just 'explorer.exe'
    exec('start explorer', (error) => {
      if (error) {
        log('[open-file-explorer] Error:', error);
        return reject(ValidationUtils.createError('Failed to open file explorer', 'open-file-explorer'));
      }
      resolve('File explorer opened');
    });
  });
});

// File/Folder selection dialog for custom shortcuts
ipcMain.handle('select-file-or-folder', async () => {
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
    throw ValidationUtils.createError('No file or folder selected', 'select-file-or-folder');
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
        return reject(ValidationUtils.createError('Invalid backup file parameter', 'delete-backup'));
      }

      const backupPath = await BackupUtils.getCurrentBackupPath();
      log('[delete-backup] Using backup path:', backupPath);
      
      // Validate backup path for security
      try {
        ValidationUtils.validateAndSanitizePath(backupPath, 'delete-backup');
      } catch (pathError) {
        log('[delete-backup] Invalid backup path:', pathError.message);
        return reject(ValidationUtils.createError('Invalid backup path specified', 'delete-backup'));
      }
      
      // Validate backup file name for security
      if (backupFile.includes('..') || backupFile.includes('/') || backupFile.includes('\\')) {
        log('[delete-backup] Invalid backup file name (path traversal attempt):', backupFile);
        return reject(ValidationUtils.createError('Invalid backup file name', 'delete-backup'));
      }
      
      const fullBackupPath = path.join(backupPath, backupFile);
      log('[delete-backup] Full backup path to delete:', fullBackupPath);
      
      // Additional security check - ensure file is in the backup directory
      if (!fullBackupPath.startsWith(backupPath)) {
        log('[delete-backup] Path traversal attempt blocked:', fullBackupPath);
        return reject(ValidationUtils.createError('Invalid backup file path', 'delete-backup'));
      }
      
      // Check if file/directory exists
      if (!fs.existsSync(fullBackupPath)) {
        log('[delete-backup] Backup file does not exist:', fullBackupPath);
        return reject(ValidationUtils.createError('Backup file does not exist', 'delete-backup'));
      }
      
      // Check if it's a directory or file and delete accordingly
      let stats;
      try {
        stats = fs.statSync(fullBackupPath);
      } catch (statError) {
        log('[delete-backup] Error getting file stats:', statError);
        return reject(ValidationUtils.createError('Failed to access backup file', 'delete-backup'));
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
                    moveReject(ValidationUtils.createError(`Failed to delete directory: ${moveError.message}`, 'delete-backup'));
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
                      moveReject(ValidationUtils.createError(`Directory moved but temp cleanup failed: ${delError.message}`, 'delete-backup'));
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
          return reject(ValidationUtils.createError('Cannot delete backup: operation timed out (backup may be very large)', 'delete-backup'));
        } else if (deleteError.message.includes('Access is denied')) {
          return reject(ValidationUtils.createError('Cannot delete backup: access denied. Try running PC Buddy as administrator.', 'delete-backup'));
        } else if (deleteError.message.includes('cannot find')) {
          return reject(ValidationUtils.createError('Cannot delete backup: file not found', 'delete-backup'));
        } else if (deleteError.message.includes('path') && deleteError.message.includes('long')) {
          return reject(ValidationUtils.createError('Cannot delete backup: file paths are too long for Windows. Please delete manually.', 'delete-backup'));
        } else if (deleteError.code === 'EBUSY') {
          return reject(ValidationUtils.createError('Cannot delete backup: file is currently in use', 'delete-backup'));
        } else if (deleteError.code === 'EACCES') {
          return reject(ValidationUtils.createError('Cannot delete backup: access denied', 'delete-backup'));
        } else if (deleteError.code === 'ENOENT') {
          return reject(ValidationUtils.createError('Cannot delete backup: file not found', 'delete-backup'));
        } else {
          return reject(ValidationUtils.createError(`Failed to delete backup: ${deleteError.message}`, 'delete-backup'));
        }
      }
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      log('[delete-backup] Unexpected error after', totalTime, 'ms:', error);
      reject(ValidationUtils.createError(`Failed to delete backup: ${error.message}`, 'delete-backup'));
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

// ====================================
// NETWORK API HANDLERS - BASIC WINDOWS COMMANDS ONLY
// ====================================

// Get comprehensive network information - SIMPLIFIED AND RELIABLE
ipcMain.handle('get-network-info', async () => {
  console.log('[IPC] get-network-info handler called');
  return new Promise((resolve, reject) => {
    try {
      console.log('[IPC] Starting network info collection...');
      const networkInfo = {};
      let completedTasks = 0;
      const totalTasks = 3;
      
      // 1. Get basic network interfaces (always works)
      try {
        const interfaces = os.networkInterfaces();
        networkInfo.interfaces = interfaces;
        
        // Find primary interface
        let primaryInterface = null;
        for (const [name, addresses] of Object.entries(interfaces)) {
          const ipv4Addr = addresses.find(addr => !addr.internal && addr.family === 'IPv4');
          if (ipv4Addr) {
            primaryInterface = { name, address: ipv4Addr.address };
            break;
          }
        }
        
        networkInfo.localIPv4 = primaryInterface ? primaryInterface.address : 'Not available';
        networkInfo.primaryInterface = primaryInterface ? primaryInterface.name : 'Not available';
        networkInfo.hostname = os.hostname() || 'Unknown';
      } catch (err) {
        networkInfo.localIPv4 = 'Error';
        networkInfo.primaryInterface = 'Error';
        networkInfo.hostname = 'Error';
      }
      
      // 2. Get DNS servers using basic ipconfig command
      exec('ipconfig /all', { timeout: 5000 }, (error, stdout) => {
        if (!error && stdout) {
          try {
            // Simple DNS server extraction
            const lines = stdout.split('\n');
            const dnsServers = [];
            
            for (const line of lines) {
              if (line.includes('DNS Servers') && line.includes(':')) {
                const serverMatch = line.match(/:\s*([0-9.]+)/);
                if (serverMatch) {
                  dnsServers.push(serverMatch[1]);
                }
              }
            }
            
            networkInfo.dnsServers = dnsServers.length > 0 ? dnsServers : ['8.8.8.8', '1.1.1.1'];
          } catch (parseErr) {
            networkInfo.dnsServers = ['8.8.8.8', '1.1.1.1'];
          }
        } else {
          networkInfo.dnsServers = ['8.8.8.8', '1.1.1.1'];
        }
        
        completedTasks++;
        if (completedTasks === totalTasks) resolve(networkInfo);
      });
      
      // 3. Try to get public IP using simple PowerShell (optional, can fail)
      exec('powershell -Command "try { (Invoke-RestMethod -Uri \'http://ipinfo.io/ip\' -TimeoutSec 5).Trim() } catch { \'Unable to retrieve\' }"', { timeout: 8000 }, (error, stdout) => {
        if (!error && stdout && stdout.trim() && stdout.trim() !== 'Unable to retrieve') {
          networkInfo.publicIPv4 = stdout.trim();
        } else {
          networkInfo.publicIPv4 = 'Unable to retrieve';
        }
        
        completedTasks++;
        if (completedTasks === totalTasks) resolve(networkInfo);
      });
      
      // 4. Try to get ISP info (optional, can fail)
      exec('powershell -Command "try { $info = Invoke-RestMethod -Uri \'http://ipinfo.io/json\' -TimeoutSec 5; \\"$($info.city), $($info.region), $($info.country)\\" + \\"||\\" + $info.org } catch { \'Unable to retrieve||Unable to retrieve\' }"', { timeout: 10000 }, (error, stdout) => {
        if (!error && stdout && stdout.trim()) {
          const [location, isp] = stdout.trim().split('||');
          networkInfo.location = location || 'Unable to retrieve';
          networkInfo.isp = isp || 'Unable to retrieve';
        } else {
          networkInfo.location = 'Unable to retrieve';
          networkInfo.isp = 'Unable to retrieve';
        }
        
        // Set defaults for other fields
        networkInfo.publicIPv6 = 'Not available';
        
        completedTasks++;
        if (completedTasks === totalTasks) resolve(networkInfo);
      });
      
    } catch (error) {
      console.error('[Network] Error in get-network-info:', error);
      reject(new Error(`Failed to get network info: ${error.message}`));
    }
  });
});

// Network connectivity test - FIXED to use original ping approach
ipcMain.handle('test-connectivity', async (event, target) => {
  console.log('[IPC] test-connectivity handler called with target:', target);
  return new Promise((resolve, reject) => {
    try {
      // Basic input validation
      if (!target || typeof target !== 'string' || target.length > 255) {
        return reject(ValidationUtils.createError('Invalid target address', 'test-connectivity'));
      }
      
      // Simple sanitization for ping command
      const sanitizedTarget = target.replace(/[^a-zA-Z0-9.-]/g, '');
      if (!sanitizedTarget) {
        return reject(ValidationUtils.createError('Invalid target address format', 'test-connectivity'));
      }
      
      // Use basic ping command that works on all Windows PCs
      const command = `ping -n 4 ${sanitizedTarget}`;
      
      exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
        const result = {
          target: sanitizedTarget,
          success: !error && !stdout.includes('could not find host'),
          output: stdout + stderr,
          timestamp: new Date().toISOString()
        };
        
        // Parse basic ping statistics if successful
        if (result.success && stdout) {
          try {
            const lossMatch = stdout.match(/\((\d+)% loss\)/);
            const timeMatch = stdout.match(/Average = (\d+)ms/);
            
            result.packetLoss = lossMatch ? parseInt(lossMatch[1]) : 0;
            result.averageTime = timeMatch ? parseInt(timeMatch[1]) : null;
          } catch (parseErr) {
            // Parsing failed, but that's okay
          }
        }
        
        resolve(result);
      });
      
    } catch (error) {
      reject(ValidationUtils.createError(`Failed to test connectivity: ${error.message}`, 'test-connectivity'));
    }
  });
});

// DNS lookup using basic nslookup command - FIXED to use original approach
ipcMain.handle('dns-lookup', async (event, domain) => {
  console.log('[IPC] dns-lookup handler called with domain:', domain);
  return new Promise((resolve, reject) => {
    try {
      // Basic input validation
      if (!domain || typeof domain !== 'string' || domain.length > 255) {
        return reject(ValidationUtils.createError('Invalid domain name', 'dns-lookup'));
      }
      
      // Simple sanitization for nslookup
      const sanitizedDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '');
      if (!sanitizedDomain) {
        return reject(ValidationUtils.createError('Invalid domain format', 'dns-lookup'));
      }
      
      // Use basic nslookup command
      const command = `nslookup ${sanitizedDomain}`;
      
      exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
        const result = {
          domain: sanitizedDomain,
          success: !error && !stdout.includes('can\'t find'),
          output: stdout + stderr,
          timestamp: new Date().toISOString(),
          records: []
        };
        
        // Parse DNS records if successful
        if (result.success && stdout) {
          try {
            const lines = stdout.split('\n');
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              
              // Look for Name: records
              if (trimmedLine.includes('Name:')) {
                const nameMatch = trimmedLine.match(/Name:\s*(.+)/);
                if (nameMatch) {
                  result.records.push({
                    type: 'Name',
                    value: nameMatch[1].trim()
                  });
                }
              }
              
              // Look for Address: records  
              if (trimmedLine.includes('Address:') && !trimmedLine.includes('#')) {
                const addressMatch = trimmedLine.match(/Address:\s*(.+)/);
                if (addressMatch) {
                  result.records.push({
                    type: 'Address',
                    value: addressMatch[1].trim()
                  });
                }
              }
            }
          } catch (parseErr) {
            // Parsing failed, but we still have the raw output
          }
        }
        
        resolve(result);
      });
      
    } catch (error) {
      reject(ValidationUtils.createError(`Failed to perform DNS lookup: ${error.message}`, 'dns-lookup'));
    }
  });
});

// Flush DNS cache - FIXED to not require admin
ipcMain.handle('flush-dns', async () => {
  console.log('[IPC] flush-dns handler called');
  return new Promise((resolve, reject) => {
    try {
      // This command works on all Windows PCs without admin
      const command = 'ipconfig /flushdns';
      
      exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          reject(ValidationUtils.createError(`Failed to flush DNS cache: ${error.message}`, 'flush-dns'));
        } else {
          resolve({
            success: true,
            message: 'DNS cache cleared successfully',
            output: stdout + stderr
          });
        }
      });
      
    } catch (error) {
      reject(ValidationUtils.createError(`Failed to flush DNS cache: ${error.message}`, 'flush-dns'));
    }
  });
});

// Renew IP configuration - FIXED to not require admin initially
ipcMain.handle('renew-ip-config', async () => {
  return new Promise((resolve, reject) => {
    try {
      // Use ipconfig /renew which works without admin on most systems
      const command = 'ipconfig /renew';
      
      exec(command, { timeout: 20000 }, (error, stdout, stderr) => {
        if (error) {
          // If renew fails, try release and renew separately
          exec('ipconfig /release', { timeout: 10000 }, (releaseError) => {
            if (releaseError) {
              reject(ValidationUtils.createError(`Failed to release/renew IP: ${releaseError.message}`, 'renew-ip-config'));
            } else {
              exec('ipconfig /renew', { timeout: 15000 }, (renewError, renewStdout, renewStderr) => {
                if (renewError) {
                  reject(ValidationUtils.createError(`Failed to renew IP: ${renewError.message}`, 'renew-ip-config'));
                } else {
                  resolve({
                    success: true,
                    message: 'IP address renewed successfully',
                    output: renewStdout + renewStderr
                  });
                }
              });
            }
          });
        } else {
          resolve({
            success: true,
            message: 'IP address renewed successfully',
            output: stdout + stderr
          });
        }
      });
      
    } catch (error) {
      reject(ValidationUtils.createError(`Failed to renew IP configuration: ${error.message}`, 'renew-ip-config'));
    }
  });
});

// Trace route using basic tracert - FIXED to use original approach
ipcMain.handle('trace-route', async (event, target) => {
  return new Promise((resolve, reject) => {
    try {
      // Basic input validation
      if (!target || typeof target !== 'string' || target.length > 255) {
        return reject(ValidationUtils.createError('Invalid target address', 'trace-route'));
      }
      
      // Simple sanitization
      const sanitizedTarget = target.replace(/[^a-zA-Z0-9.-]/g, '');
      if (!sanitizedTarget) {
        return reject(ValidationUtils.createError('Invalid target format', 'trace-route'));
      }
      
      // Use basic tracert command with limited hops
      const command = `tracert -h 15 ${sanitizedTarget}`;
      
      exec(command, { timeout: 45000 }, (error, stdout, stderr) => {
        const result = {
          target: sanitizedTarget,
          success: !error,
          output: stdout + stderr,
          timestamp: new Date().toISOString(),
          hops: []
        };
        
        // Parse trace route hops
        if (stdout) {
          try {
            const lines = stdout.split('\n');
            for (const line of lines) {
              const hopMatch = line.match(/^\s*(\d+)\s+(.+)/);
              if (hopMatch && hopMatch[1] && hopMatch[2]) {
                result.hops.push({
                  hop: parseInt(hopMatch[1]),
                  details: hopMatch[2].trim()
                });
              }
            }
          } catch (parseErr) {
            // Parsing failed, but we have the raw output
          }
        }
        
        resolve(result);
      });
      
    } catch (error) {
      reject(ValidationUtils.createError(`Failed to trace route: ${error.message}`, 'trace-route'));
    }
  });
});

// Simple ping to specific host - FIXED to use original approach
ipcMain.handle('ping-host', async (event, host) => {
  return new Promise((resolve, reject) => {
    try {
      // Basic validation
      if (!host || typeof host !== 'string' || host.length > 255) {
        return reject(ValidationUtils.createError('Invalid host address', 'ping-host'));
      }
      
      // Simple sanitization
      const sanitizedHost = host.replace(/[^a-zA-Z0-9.-]/g, '');
      if (!sanitizedHost) {
        return reject(ValidationUtils.createError('Invalid host format', 'ping-host'));
      }
      
      // Single ping
      const command = `ping -n 1 ${sanitizedHost}`;
      
      exec(command, { timeout: 8000 }, (error, stdout, stderr) => {
        resolve({
          host: sanitizedHost,
          success: !error && !stdout.includes('could not find host'),
          output: stdout + stderr,
          timestamp: new Date().toISOString()
        });
      });
      
    } catch (error) {
      reject(ValidationUtils.createError(`Failed to ping host: ${error.message}`, 'ping-host'));
    }
  });
});

// Get network adapters - Enhanced to show ALL adapters including disconnected ones
ipcMain.handle('get-network-adapters', async () => {
  return new Promise((resolve, reject) => {
    try {
      // Use netsh to get ALL network adapters (including disconnected ones)
      const command = 'netsh interface show interface';
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('[get-network-adapters] netsh command failed, falling back to Node.js method:', error);
          // Fallback to Node.js method
          try {
            const interfaces = os.networkInterfaces();
            const adapters = [];
            
            for (const [name, addresses] of Object.entries(interfaces)) {
              // Skip loopback interfaces
              if (name.toLowerCase().includes('loopback') || name.toLowerCase().includes('pseudo')) {
                continue;
              }
              
              const adapter = {
                name,
                addresses: addresses.map(addr => ({
                  address: addr.address,
                  family: addr.family,
                  internal: addr.internal,
                  mac: addr.mac || 'Unknown'
                })),
                status: 'Connected' // Node.js only shows connected interfaces
              };
              adapters.push(adapter);
            }
            
            resolve(adapters);
          } catch (fallbackError) {
            reject(new Error(`Failed to get network adapters: ${fallbackError.message}`));
          }
          return;
        }
        
        try {
          // Parse netsh output to get interface names and states
          const lines = stdout.split('\n').slice(3); // Skip header lines
          const netshAdapters = [];
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // Parse netsh output format: Admin State   Connect State   Type         Interface Name
            const parts = trimmed.split(/\s{2,}/); // Split on 2+ spaces
            if (parts.length >= 4) {
              const adminState = parts[0];
              const connectState = parts[1];
              const type = parts[2];
              const interfaceName = parts[3];
              
              // Skip loopback and other system interfaces
              if (interfaceName.toLowerCase().includes('loopback') || 
                  interfaceName.toLowerCase().includes('pseudo') ||
                  interfaceName.toLowerCase().includes('teredo') ||
                  interfaceName.toLowerCase().includes('isatap')) {
                continue;
              }
              
              netshAdapters.push({
                name: interfaceName,
                adminState,
                connectState,
                type,
                isConnected: connectState.toLowerCase() === 'connected'
              });
            }
          }
          
          // Now get IP addresses for connected adapters from Node.js
          const nodeInterfaces = os.networkInterfaces();
          const adapters = [];
          
          for (const netshAdapter of netshAdapters) {
            let addresses = [];
            let status = 'Disconnected';
            
            if (netshAdapter.isConnected && nodeInterfaces[netshAdapter.name]) {
              addresses = nodeInterfaces[netshAdapter.name].map(addr => ({
                address: addr.address,
                family: addr.family,
                internal: addr.internal,
                mac: addr.mac || 'Unknown'
              }));
              status = 'Connected';
            } else if (netshAdapter.adminState.toLowerCase() === 'disabled') {
              status = 'Disabled';
            }
            
            adapters.push({
              name: netshAdapter.name,
              addresses,
              status,
              type: netshAdapter.type,
              adminState: netshAdapter.adminState,
              connectState: netshAdapter.connectState
            });
          }
          
          console.log(`[get-network-adapters] Found ${adapters.length} adapters (including disconnected)`);
          resolve(adapters);
          
        } catch (parseError) {
          console.error('[get-network-adapters] Failed to parse netsh output:', parseError);
          // Fallback to Node.js method
          try {
            const interfaces = os.networkInterfaces();
            const adapters = [];
            
            for (const [name, addresses] of Object.entries(interfaces)) {
              // Skip loopback interfaces
              if (name.toLowerCase().includes('loopback') || name.toLowerCase().includes('pseudo')) {
                continue;
              }
              
              const adapter = {
                name,
                addresses: addresses.map(addr => ({
                  address: addr.address,
                  family: addr.family,
                  internal: addr.internal,
                  mac: addr.mac || 'Unknown'
                })),
                status: 'Connected' // Node.js only shows connected interfaces
              };
              adapters.push(adapter);
            }
            
            resolve(adapters);
          } catch (fallbackError) {
            reject(new Error(`Failed to get network adapters: ${fallbackError.message}`));
          }
        }
      });
      
    } catch (error) {
      reject(new Error(`Failed to get network adapters: ${error.message}`));
    }
  });
});

// ====================================
// SYSTEM INFO AND ELECTRON API HANDLERS
// ====================================

// Get system information
ipcMain.handle('get-system-info', async () => {
  return {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    hostname: os.hostname(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    cpus: os.cpus(),
    uptime: os.uptime()
  };
});

// Get app version
ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

// Open file with default application
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return true;
  } catch (error) {
    throw new Error(`Failed to open file: ${error.message}`);
  }
});

// Open URL in default browser
ipcMain.handle('open-url', async (event, url) => {
  try {
    await shell.openExternal(url);
    return true;
  } catch (error) {
    throw new Error(`Failed to open URL: ${error.message}`);
  }
});

// Execute command
ipcMain.handle('exec-command', async (event, command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command failed: ${error.message}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
});

// Open path in file explorer
ipcMain.handle('open-path', async (event, path) => {
  try {
    
    // For folders and files, use enhanced explorer commands to ensure they open on top
    if (fs.existsSync(path)) {
      const stats = fs.statSync(path);
      
      if (stats.isDirectory()) {
        // For directories, use multiple commands to ensure window comes to front
        return new Promise((resolve, reject) => {
          // Use PowerShell to force window to foreground after opening
          const command = `powershell -Command "& { Start-Process explorer.exe -ArgumentList '${path}' -WindowStyle Normal; Start-Sleep -Milliseconds 500; Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\\"user32.dll\\")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport(\\"user32.dll\\")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName); }'; $explorerWindow = [Win32]::FindWindow('CabinetWClass', $null); if ($explorerWindow -ne [IntPtr]::Zero) { [Win32]::SetForegroundWindow($explorerWindow) } }"`;
          
          exec(command, (error, stdout, stderr) => {
            if (error) {
              console.error('PowerShell explorer command failed, trying cmd alternative:', error);
              // Try simpler cmd alternative
              exec(`cmd /c start "" explorer.exe "${path}" && timeout /t 1 /nobreak > nul && powershell -Command "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.Application]::SetSuspendState('False', 'False', 'False')"`, (altError, altStdout, altStderr) => {
                if (altError) {
                  console.error('Alternative command failed, falling back to shell.openPath:', altError);
                  shell.openPath(path).then(() => resolve(true)).catch(reject);
                } else {
                  resolve(true);
                }
              });
            } else {
              resolve(true);
            }
          });
        });
      } else {
        // For files, use enhanced select command to highlight and bring to front
        return new Promise((resolve, reject) => {
          const command = `powershell -Command "& { Start-Process explorer.exe -ArgumentList '/select,\\"${path}\\"' -WindowStyle Normal; Start-Sleep -Milliseconds 500; Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\\"user32.dll\\")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport(\\"user32.dll\\")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName); }'; $explorerWindow = [Win32]::FindWindow('CabinetWClass', $null); if ($explorerWindow -ne [IntPtr]::Zero) { [Win32]::SetForegroundWindow($explorerWindow) } }"`;
          
          exec(command, (error, stdout, stderr) => {
            if (error) {
              console.error('PowerShell explorer select failed, trying cmd alternative:', error);
              // Try alternative
              exec(`cmd /c start "" explorer.exe /select,"${path}" && timeout /t 1 /nobreak > nul`, (altError, altStdout, altStderr) => {
                if (altError) {
                  console.error('Alternative select failed, falling back to shell.openPath:', altError);
                  shell.openPath(path).then(() => resolve(true)).catch(reject);
                } else {
                  resolve(true);
                }
              });
            } else {
              resolve(true);
            }
          });
        });
      }
    } else {
      // For non-existent paths, try to open them with start command first
      return new Promise((resolve, reject) => {
        exec(`powershell -Command "Start-Process '${path}' -WindowStyle Normal"`, (error, stdout, stderr) => {
          if (error) {
            console.error('PowerShell start command failed, falling back to shell.openPath:', error);
            shell.openPath(path).then(() => resolve(true)).catch(reject);
          } else {
            resolve(true);
          }
        });
      });
    }
  } catch (error) {
    throw new Error(`Failed to open path: ${error.message}`);
  }
});

// Show notification
ipcMain.handle('show-notification', async (event, options) => {
  try {
    if (Notification.isSupported()) {
      new Notification(options).show();
      return true;
    }
    return false;
  } catch (error) {
    throw new Error(`Failed to show notification: ${error.message}`);
  }
});

ipcMain.on('open-task-manager', () => {
  exec('start taskmgr.exe /0 /startup', (error) => {
    if (error) log('Failed to open Task Manager:', error);
  });
});

// Reset network stack - REQUIRES ADMIN, with clear warning
ipcMain.handle('reset-network-stack', async () => {
  try {
    const commands = [
      'netsh winsock reset',
      'netsh int ip reset',
      'ipconfig /flushdns',
      'netsh interface ip delete arpcache'
    ];
    
    for (const command of commands) {
      await SystemUtils.executeSudoCommand(command, 'reset-network-stack');
    }
    
    return 'Network stack reset successfully. Please restart your computer for changes to take effect.';
  } catch (error) {
    throw ValidationUtils.createError('Failed to reset network stack', 'reset-network-stack');
  }
});

// ====================================
// DRIVER MANAGEMENT API HANDLERS
// ====================================

// Scan system for driver information
ipcMain.handle('scan-system-drivers', async () => {
  try {
    log('[Driver Scan] Starting system driver scan...');
    return await PowerShellUtils.executeScript('getDriverInfo.ps1', [], false);
  } catch (error) {
    log('[Driver Scan Error]', error);
    throw ValidationUtils.createError('Failed to scan system drivers', 'scan-system-drivers');
  }
});

// Find available driver updates
ipcMain.handle('find-driver-updates', async () => {
  try {
    log('[Driver Updates] Searching for driver updates...');
    return await PowerShellUtils.executeScript('findDriverUpdates.ps1', [], false);
  } catch (error) {
    log('[Driver Updates Error]', error);
    throw ValidationUtils.createError('Failed to find driver updates', 'find-driver-updates');
  }
});

// Download and install a specific driver
ipcMain.handle('install-driver', async (event, driverInfo) => {
  try {
    const { name, downloadURL, manufacturer, category, version, updateID } = driverInfo;
    
    // Validate input parameters
    if (!name || typeof name !== 'string') {
      throw ValidationUtils.createError('Invalid driver name', 'install-driver');
    }
    
    const sanitizedName = ValidationUtils.validateStringInput(name, 200, 'install-driver');
    const sanitizedManufacturer = manufacturer ? ValidationUtils.validateStringInput(manufacturer, 100, 'install-driver') : 'Unknown';
    const sanitizedCategory = category ? ValidationUtils.validateStringInput(category, 50, 'install-driver') : 'Other';
    const sanitizedVersion = version ? ValidationUtils.validateStringInput(version, 50, 'install-driver') : 'Unknown';
    
    log(`[Driver Install] Installing driver: ${sanitizedName} from ${sanitizedManufacturer}`);
    
    const args = [
      `-DriverName "${sanitizedName}"`,
      `-Manufacturer "${sanitizedManufacturer}"`,
      `-Category "${sanitizedCategory}"`,
      `-DriverVersion "${sanitizedVersion}"`
    ];
    
    if (downloadURL && downloadURL !== 'Windows Update') {
      args.push(`-DownloadURL "${downloadURL}"`);
    }
    
    if (updateID) {
      args.push(`-UpdateID "${updateID}"`);
    }
    
    return await PowerShellUtils.executeScript('downloadInstallDriver.ps1', args, true);
  } catch (error) {
    log('[Driver Install Error]', error);
    throw ValidationUtils.createError('Failed to install driver', 'install-driver');
  }
});

// Get driver installation history
ipcMain.handle('get-driver-history', async () => {
  try {
    log('[Driver History] Getting driver installation history...');
    return await PowerShellUtils.executeScript('getDriverHistory.ps1', [], false);
  } catch (error) {
    log('[Driver History Error]', error);
    throw ValidationUtils.createError('Failed to get driver history', 'get-driver-history');
  }
});

// Revert driver using system restore
ipcMain.handle('revert-driver', async (event, restorePointInfo) => {
  try {
    const { restorePointNumber, restorePointDescription } = restorePointInfo;
    
    if (!restorePointNumber && !restorePointDescription) {
      throw ValidationUtils.createError('Either restore point number or description must be provided', 'revert-driver');
    }
    
    log(`[Driver Revert] Reverting to restore point: ${restorePointNumber || restorePointDescription}`);
    
    const args = [];
    if (restorePointNumber) {
      args.push(`-RestorePointNumber "${restorePointNumber}"`);
    }
    if (restorePointDescription) {
      args.push(`-RestorePointDescription "${restorePointDescription}"`);
    }
    
    return await PowerShellUtils.executeScript('revertDriver.ps1', args, true);
  } catch (error) {
    log('[Driver Revert Error]', error);
    throw ValidationUtils.createError('Failed to revert driver', 'revert-driver');
  }
});

// Get driver scan status
ipcMain.handle('get-driver-scan-status', async () => {
  try {
    const statusFile = path.join(os.tmpdir(), 'driver_scan_status.txt');
    if (fs.existsSync(statusFile)) {
      const status = fs.readFileSync(statusFile, 'utf8');
      return status.split('\n').filter(line => line.trim()).slice(-10); // Last 10 status messages
    }
    return [];
  } catch (error) {
    log('[Driver Status Error]', error);
    return [];
  }
});

// Get driver update status
ipcMain.handle('get-driver-update-status', async () => {
  try {
    const statusFile = path.join(os.tmpdir(), 'driver_update_status.txt');
    if (fs.existsSync(statusFile)) {
      const status = fs.readFileSync(statusFile, 'utf8');
      return status.split('\n').filter(line => line.trim()).slice(-10); // Last 10 status messages
    }
    return [];
  } catch (error) {
    log('[Driver Update Status Error]', error);
    return [];
  }
});

// Get driver installation status
ipcMain.handle('get-driver-install-status', async () => {
  try {
    const statusFile = path.join(os.tmpdir(), 'driver_install_status.txt');
    if (fs.existsSync(statusFile)) {
      const status = fs.readFileSync(statusFile, 'utf8');
      return status.split('\n').filter(line => line.trim()).slice(-10); // Last 10 status messages
    }
    return [];
  } catch (error) {
    log('[Driver Install Status Error]', error);
    return [];
  }
});

// Clear driver status files
ipcMain.handle('clear-driver-status', async () => {
  try {
    const statusFiles = [
      path.join(os.tmpdir(), 'driver_scan_status.txt'),
      path.join(os.tmpdir(), 'driver_update_status.txt'),
      path.join(os.tmpdir(), 'driver_install_status.txt'),
      path.join(os.tmpdir(), 'driver_revert_status.txt')
    ];
    
    for (const file of statusFiles) {
      if (fs.existsSync(file)) {
        fs.writeFileSync(file, '');
      }
    }
    
    return true;
  } catch (error) {
    log('[Clear Status Error]', error);
    return false;
  }
});

// Open driver downloads folder
ipcMain.handle('open-driver-downloads', async () => {
  try {
    const downloadsPath = path.join(os.tmpdir(), 'PC-Buddy-Drivers');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }
    
    await shell.openPath(downloadsPath);
    return true;
  } catch (error) {
    throw new Error(`Failed to open driver downloads folder: ${error.message}`);
  }
});

// Batch install multiple drivers
ipcMain.handle('batch-install-drivers', async (event, driverList) => {
  try {
    if (!Array.isArray(driverList) || driverList.length === 0) {
      throw ValidationUtils.createError('Invalid driver list provided', 'batch-install-drivers');
    }
    
    log(`[Batch Install] Installing ${driverList.length} drivers...`);
    
    const results = [];
    
    for (const driver of driverList) {
      try {
        log(`[Batch Install] Installing: ${driver.name}`);
        const result = await PowerShellUtils.executeScript('downloadInstallDriver.ps1', [
          `-DriverName "${driver.name}"`,
          `-Manufacturer "${driver.manufacturer || 'Unknown'}"`,
          `-Category "${driver.category || 'Other'}"`,
          `-DriverVersion "${driver.version || 'Unknown'}"`,
          driver.downloadURL ? `-DownloadURL "${driver.downloadURL}"` : '',
          driver.updateID ? `-UpdateID "${driver.updateID}"` : ''
        ].filter(arg => arg), true);
        
        results.push({
          driver: driver.name,
          success: result.includes('SUCCESS'),
          message: result
        });
      } catch (error) {
        log(`[Batch Install] Failed to install ${driver.name}:`, error);
        results.push({
          driver: driver.name,
          success: false,
          message: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    log(`[Batch Install] Completed: ${successCount}/${driverList.length} drivers installed successfully`);
    
    return {
      total: driverList.length,
      successful: successCount,
      failed: driverList.length - successCount,
      results: results
    };
  } catch (error) {
    log('[Batch Install Error]', error);
    throw ValidationUtils.createError('Failed to batch install drivers', 'batch-install-drivers');
  }
});

