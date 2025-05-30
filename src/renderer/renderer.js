console.log('[renderer.js] loaded');
console.log('systemInfoAPI:', window.systemInfoAPI);

// Tool Action Handlers
const toolActions = {
  diskCleanup: () => promptDriveSelection(),
  systemRepair: () => window.electronAPI.runSystemRepair()
};

// Tool Button Click Handling
document.querySelectorAll('.tool-btn').forEach(button => {
  button.addEventListener('click', async () => {
    const card = button.closest('.tool-card');
    const loadingEl = card.querySelector('.loadingMessage');
    const resultEl = card.querySelector('.toolResult');
    const statusText = card.querySelector('.statusText');

    resultEl.classList.remove('success', 'error');
    resultEl.textContent = '';
    loadingEl.style.display = 'block';

    let dotCount = 0;
    const baseText = button.innerText.includes('Repair') ? 'Repairing System' : 'Cleaning Disk';
    statusText.textContent = baseText;

    const statusInterval = setInterval(() => {
      dotCount = (dotCount + 1) % 4;
      statusText.textContent = baseText + '.'.repeat(dotCount);
    }, 500);

    try {
      const result = await toolActions[button.dataset.action]();
      resultEl.classList.add('success');
      resultEl.textContent = result;
    } catch (err) {
      resultEl.classList.add('error');
      resultEl.textContent = 'Error: ' + err.message;
    } finally {
      clearInterval(statusInterval);
      loadingEl.style.display = 'none';
      statusText.textContent = '';
      setTimeout(() => {
        resultEl.textContent = '';
        resultEl.classList.remove('success', 'error');
      }, 5000);
    }
  });
});


function getExeNameFallback(name, command) {
  // Special handling for Discord and similar known launchers
  if (/Discord\.exe/i.test(command)) return 'Discord.exe';
  if (/Steam\.exe/i.test(command)) return 'Steam.exe';
  if (/EpicGamesLauncher\.exe/i.test(command)) return 'EpicGamesLauncher.exe';
  if (/Notion\.exe/i.test(command)) return 'Notion.exe';
  if (/Opera\.exe/i.test(command)) return 'Opera GX.exe';
  return name;
}

window.addEventListener('DOMContentLoaded', async () => {
  console.log('[renderer.js] DOM fully loaded');

  // -------------------------
  // Sidebar & Section Switching
  // -------------------------
  const sidebarItems = document.querySelectorAll('#sidebar li');
  const sections = document.querySelectorAll('.section');

  function switchSection(sectionId) {
    sidebarItems.forEach(item => {
      item.classList.toggle('active', item.dataset.section === sectionId);
    });
    sections.forEach(section => {
      section.classList.toggle('active', section.id === sectionId);
    });
  }

  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      const sectionId = item.dataset.section;
      if (sectionId) switchSection(sectionId);
    });
  });

  const defaultSection = sidebarItems[0]?.dataset.section;
  if (defaultSection) switchSection(defaultSection);

  document.getElementById('toggleSidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  // -------------------------
  // Update Notification Banner
  // -------------------------
  const banner = document.getElementById('update-banner');
  const updateText = document.getElementById('update-text');
  const installBtn = document.getElementById('install-btn');

  window.electronAPI.onUpdateAvailable((version) => {
    updateText.textContent = `A new version (${version}) is available.`;
    banner.style.display = 'block';
  });

  window.electronAPI.onDownloadProgress((progress) => {
    updateText.textContent = `Downloading update: ${Math.round(progress.percent)}%`;
  });

  window.electronAPI.onUpdateDownloaded(() => {
    updateText.textContent = 'Update downloaded. Click to install.';
    installBtn.disabled = false;
  });

  installBtn.onclick = () => {
    updateText.textContent = 'Installing update...';
    window.electronAPI.startUpdate();
  };

  // -------------------------
  // System Info Section
  // -------------------------
  const info = window.systemInfoAPI.getSystemInfo?.();
  const list = document.getElementById('systemInfoList');
  if (info && list) {
    for (const [key, value] of Object.entries(info)) {
      const item = document.createElement('li');
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      item.textContent = `${label}: ${value}`;
      list.appendChild(item);
    }
  }

  // -------------------------
  // Tool Buttons (Repair & Cleanup)
  // -------------------------

  document.querySelectorAll('.tool-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const card = button.closest('.tool-card');
      const loadingEl = card.querySelector('.loadingMessage');
      const resultEl = card.querySelector('.toolResult');
      const statusText = card.querySelector('.statusText');

      resultEl.classList.remove('success', 'error');
      resultEl.textContent = '';
      loadingEl.style.display = 'block';

      let dotCount = 0;
      const baseText = button.innerText.includes('Repair') ? 'Repairing System' : 'Cleaning Disk';
      statusText.textContent = baseText;

      const statusInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        statusText.textContent = baseText + '.'.repeat(dotCount);
      }, 500);

      try {
        const result = await toolActions[button.dataset.action]();
        resultEl.classList.add('success');
        resultEl.textContent = result;
      } catch (err) {
        resultEl.classList.add('error');
        resultEl.textContent = 'Error: ' + err.message;
      } finally {
        clearInterval(statusInterval);
        loadingEl.style.display = 'none';
        statusText.textContent = '';
        setTimeout(() => {
          resultEl.textContent = '';
          resultEl.classList.remove('success', 'error');
        }, 5000);
      }
    });
  });

  // -------------------------
  // Startup Section
  // -------------------------
  const listEl = document.getElementById('startupList');
  const entries = await window.startupAPI.getStartupPrograms();

  if (!entries.length) {
    listEl.textContent = 'No startup entries found.';
    return;
  }

  entries.forEach(program => {
    const name = program.name || program.Name || 'Unknown';
    const command = program.command || program.Command || 'Unknown';
    const safety = (program.safety || program.Safety || 'unknown').toLowerCase();
    const isEnabled = (program.status || program.Status || '').toLowerCase() === 'enabled';

    const container = document.createElement('div');
    container.classList.add('startup-item');

    const exeName = extractExeName(command, getExeNameFallback(name, command));

    const label = document.createElement('span');
    label.className = 'startup-label';
    label.textContent = exeName;
    label.title = extractCommandPath(command);

    const badge = document.createElement('span');
    badge.className = `safety-badge ${safety}`;
    badge.textContent =
      safety === 'safe' ? 'Safe' :
      safety === 'caution' ? 'Caution' :
      safety === 'danger' ? 'Danger' : 'Unknown';

    badge.title =
      safety === 'safe'
        ? 'Safe to disable'
        : safety === 'caution'
        ? 'May impact some functionality'
        : safety === 'danger'
        ? 'Critical system component'
        : 'Unknown impact';

    const toggleContainer = document.createElement('label');
    toggleContainer.className = 'toggle-switch';

    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = isEnabled;

    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'toggle-slider';

    toggleContainer.append(toggleInput, toggleSlider);

    toggleInput.onchange = async (e) => {
      if (safety === 'danger') {
        e.preventDefault();
        toggleInput.checked = !toggleInput.checked;

        const confirmed = await showModal({
          type: 'warning',
          title: 'Warning',
          message: "Disabling this could harm system stability.\nContinue?",
          confirmText: 'Yes, I understand'
        });

        if (!confirmed) return;
        toggleInput.checked = !toggleInput.checked;
      }

      toggleInput.disabled = true;
      toggleSlider.classList.add('disabled');

      try {
        const result = await window.startupAPI.toggleStartup(name, toggleInput.checked);
        console.log(result);
      } catch (err) {
        console.error('Toggle failed:', err);
        toggleInput.checked = !toggleInput.checked;
        await showModal({
          type: 'error',
          title: 'Operation Failed',
          message: 'Try running the app as admin.',
          confirmText: 'OK',
          showCancel: false
        });
      } finally {
        toggleInput.disabled = false;
        toggleSlider.classList.remove('disabled');
      }
    };

    const controls = document.createElement('div');
    controls.className = 'startup-controls-horizontal';
    controls.append(badge, toggleContainer);

    container.append(label, controls);
    listEl.appendChild(container);
  });

  const taskBtn = document.getElementById('openTaskManagerBtn');
  taskBtn?.addEventListener('click', () => {
    window.startupAPI.openTaskManager();
  });

  
});

document.getElementById('chooseDriveBtn')?.addEventListener('click', async () => {
  const result = await promptDriveSelection();
  if (result?.startCleanup === true) {
    // Only show spinner after confirmation
    const card = document.getElementById('diskCleanupCard');
    const loadingEl = card.querySelector('.loadingMessage');
    const resultEl = card.querySelector('.toolResult');
    const statusText = card.querySelector('.statusText');

    resultEl.classList.remove('success', 'error');
    resultEl.textContent = '';
    loadingEl.style.display = 'block';

    let dotCount = 0;
    statusText.textContent = 'Cleaning Disk';

    const statusInterval = setInterval(() => {
      dotCount = (dotCount + 1) % 4;
      statusText.textContent = 'Cleaning Disk' + '.'.repeat(dotCount);
    }, 500);

    try {
      const cleanupResult = await window.cleanupAPI.cleanDrive(result.drive);
      resultEl.classList.add('success');
      resultEl.textContent = cleanupResult || `Cleanup started on drive ${result.drive}`;
    } catch (err) {
      resultEl.classList.add('error');
      resultEl.textContent = 'Error: ' + err.message;
    } finally {
      clearInterval(statusInterval);
      loadingEl.style.display = 'none';
      statusText.textContent = '';
      setTimeout(() => {
        resultEl.textContent = '';
        resultEl.classList.remove('success', 'error');
      }, 5000);
    }
  }
});

function extractCommandPath(command) {
  if (!command) return 'Unknown';
  const match = command.match(/^"?([^"]+\.exe)/i);
  return match ? match[1] : command;
}


function extractExeName(commandLine, fallbackName = 'Unknown') {
  if (!commandLine || !commandLine.trim()) return fallbackName;

  // Try to extract the real target from "--processStart"
  const processStartMatch = commandLine.match(/--processStart(?:AndWait)?\s+([a-zA-Z0-9_.-]+\.exe)/i);
  if (processStartMatch) return processStartMatch[1];

  // Fallback: match first .exe or .lnk in the command string
  const match = commandLine.match(/(?:^|\\)([a-zA-Z0-9 _.-]+\.(exe|lnk))\b/i);
  if (!match) return fallbackName;

  let name = match[1];
  if (name.toLowerCase().endsWith('.lnk')) {
    name = name.slice(0, -4); // strip ".lnk"
  }

  return name.trim();
}

function showModal({ type = 'warning', title, message, confirmText = 'OK', showCancel = true }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const content = document.createElement('div');
    content.className = 'modal-content';
    
    const header = document.createElement('div');
    header.className = `modal-header ${type}`;
    
    const icon = document.createElement('span');
    icon.className = 'modal-warning-icon';
    icon.textContent = type === 'error' ? '❌' : '⚠️';
    
    const titleEl = document.createElement('h3');
    titleEl.className = 'modal-title';
    titleEl.textContent = title;
    
    header.appendChild(icon);
    header.appendChild(titleEl);
    
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.textContent = message;
    
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    
    if (showCancel) {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'modal-button cancel';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = () => {
        document.body.removeChild(overlay);
        resolve(false);
      };
      actions.appendChild(cancelBtn);
    }
    
    const confirmBtn = document.createElement('button');
    confirmBtn.className = `modal-button ${type}`;
    confirmBtn.textContent = confirmText;
    confirmBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve(true);
    };
    
    actions.appendChild(confirmBtn);
    
    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(actions);
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Handle escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showCancel) {
        document.body.removeChild(overlay);
        window.removeEventListener('keydown', handleEscape);
        resolve(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
  });
}

async function promptDriveSelection() {
  const disks = await window.cleanupAPI.getDiskUsage();
  if (!disks || !disks.length) {
    await showModal({
      type: 'error',
      title: 'No Drives Found',
      message: 'We couldn’t detect any drives to clean.'
    });
    return;
  }

  const systemDrive = disks.find(d => d.IsSystem) || disks[0];
  let selectedDrive = systemDrive;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const content = document.createElement('div');
    content.className = 'modal-content';

    const header = document.createElement('div');
    header.className = 'modal-header warning';

    const icon = document.createElement('span');
    icon.className = 'modal-warning-icon';
    icon.textContent = '⚠️';

    const titleEl = document.createElement('h3');
    titleEl.className = 'modal-title';
    titleEl.textContent = `Clean ${selectedDrive.Name}: Drive`;

    header.appendChild(icon);
    header.appendChild(titleEl);
    content.appendChild(header);

    const body = document.createElement('div');
    body.className = 'modal-body';
    body.innerHTML = `This will clean temporary files and system junk from ${selectedDrive.Name}:.`;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'modal-button cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve({ startCleanup: false });
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'modal-button warning';
    confirmBtn.textContent = 'Yes, Clean It';
    confirmBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve({ startCleanup: true, drive: selectedDrive.Name });
    };

    const moreDrivesBtn = document.createElement('button');
    moreDrivesBtn.className = 'modal-button secondary';
    moreDrivesBtn.textContent = 'Show More Drives';
    moreDrivesBtn.style.marginLeft = 'auto';

    moreDrivesBtn.onclick = () => {
      body.innerHTML = 'Select another drive to clean:';
      actions.innerHTML = ''; // Clear previous actions

      disks.forEach((d) => {
        const driveBtn = document.createElement('button');
        driveBtn.className = 'modal-button drive-select';
        driveBtn.textContent = `${d.Name}: ${d.PercentUsed}% used (${d.UsedGB} GB of ${d.TotalGB} GB)`;

        driveBtn.onclick = async () => {
          const confirm = await showModal({
            type: 'warning',
            title: `Clean ${d.Name}: Drive`,
            message: `Are you sure you want to clean temp files from ${d.Name}:?`,
            confirmText: 'Yes, Clean It'
          });

          if (confirm) {
            document.body.removeChild(overlay);
            resolve({ startCleanup: true, drive: d.Name });
          }
        };

        body.appendChild(document.createElement('br'));
        body.appendChild(driveBtn);
      });

      const cancelDriveBtn = document.createElement('button');
      cancelDriveBtn.className = 'modal-button cancel';
      cancelDriveBtn.textContent = 'Cancel';
      cancelDriveBtn.onclick = () => {
        document.body.removeChild(overlay);
        resolve({ startCleanup: false });
      };

      actions.appendChild(cancelDriveBtn);
    };

    actions.append(cancelBtn, confirmBtn, moreDrivesBtn);

    content.appendChild(body);
    content.appendChild(actions);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
  });
}

