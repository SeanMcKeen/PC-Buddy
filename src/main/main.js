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
      enableRemoteModule: false,  // recommended for security
      sandbox: false
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

ipcMain.handle('get-startup-programs', async () => {
  return new Promise((resolve) => {
    const psCommand = `$startup = @();
    $wmi = Get-CimInstance Win32_StartupCommand;
    foreach ($i in $wmi) {
      $startup += [PSCustomObject]@{
        Name = $i.Name;
        Command = $i.Command;
        Source = 'WMI'
      }
    };
    $folders = @(
      "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup",
      "$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"
    );
    foreach ($f in $folders) {
      if (Test-Path $f) {
        Get-ChildItem $f -Filter *.lnk | ForEach-Object {
          $s = $_.FullName;
          $w = (New-Object -ComObject WScript.Shell).CreateShortcut($s);
          $startup += [PSCustomObject]@{
            Name = $_.BaseName;
            Command = $w.TargetPath;
            Source = 'Startup Folder'
          }
        }
      }
    };
    $regKeys = @(
      'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
      'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
    );
    foreach ($key in $regKeys) {
      if (Test-Path $key) {
        $p = Get-ItemProperty -Path $key;
        foreach ($prop in $p.PSObject.Properties) {
          if ($prop.Name -notin @('PSPath','PSParentPath','PSChildName','PSDrive','PSProvider')) {
            $startup += [PSCustomObject]@{
              Name = $prop.Name;
              Command = $prop.Value;
              Source = $key
            }
          }
        }
      }
    };
    $startup | Sort-Object -Property Name, Command -Unique | ConvertTo-Json -Compress
    `.replace(/\r?\n/g, ' ').replace(/"/g, '`"');

    const command = `powershell.exe -NoProfile -Command "${psCommand}"`;

    exec(command, { maxBuffer: 1024 * 500 }, (err, stdout) => {
      if (err) {
        console.error('Startup fetch error:', err);
        return resolve([]);
      }

      try {
        let data = JSON.parse(stdout);
        if (!Array.isArray(data)) data = [data];

        const programs = data.map(entry => {
        const rawCommand = (entry.Command || '').trim();
        const nameFallback = entry.Name || 'Unknown';
        const location = entry.Source || 'Unknown';

        const match = rawCommand.match(/([a-zA-Z0-9_. -]+?\.(exe|lnk))/i);
        const displayName = match ? match[1].trim() : nameFallback;

        let safety = 'unknown';
        if (location.includes('HKCU')) safety = 'safe';
        else if (location.includes('HKLM')) safety = 'caution';
        else if (location.toLowerCase().includes('startup')) safety = 'safe';
        else if (location.toLowerCase().includes('wmi')) safety = 'caution';

        return {
          name: displayName,
          command: rawCommand,
          location,
          safety
        };
      });


        resolve(programs);
      } catch (e) {
        console.error('Failed to parse startup JSON:', e);
        resolve([]);
      }
    });
  });
});

ipcMain.handle('toggle-startup-program', async (event, programName, enable) => {
  const action = enable ? 'Enable' : 'Disable';
  const command = `powershell -Command "Write-Output 'Pretend to ${action} ${programName}'"`; // temp placeholder

  return new Promise((resolve, reject) => {
    sudo.exec(command, { name: 'PC Buddy' }, (error) => {
      if (error) {
        console.error(`${action} failed for ${programName}:`, error);
        return reject(new Error(`${action} failed: ${error.message}`));
      }
      resolve(`${action}d ${programName}`);
    });
  });
});

ipcMain.on('open-task-manager', () => {
  exec('start taskmgr.exe', (error) => {
    if (error) {
      console.error('Failed to open Task Manager:', error);
    }
  });
});