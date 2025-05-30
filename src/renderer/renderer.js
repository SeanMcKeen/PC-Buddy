console.log('[renderer.js] loaded');
console.log('systemInfoAPI:', window.systemInfoAPI);

// Tool Action Handlers
const toolActions = {
  systemRepair: () => window.electronAPI.runSystemRepair(),
  createBackup: () => window.backupAPI.createBackup()
};

// Helper function to handle tool button loading states
function handleToolButtonAction(button, action) {
  const card = button.closest('.tool-card');
  const loadingEl = card.querySelector('.loadingMessage');
  const resultEl = card.querySelector('.toolResult');
  const statusText = card.querySelector('.statusText');

  resultEl.classList.remove('success', 'error');
  resultEl.textContent = '';
  loadingEl.style.display = 'block';

  // Trigger smooth masonry layout recalculation when loading state changes
  setTimeout(() => {
    masonryInstances.forEach(masonry => {
      if (masonry.container.classList.contains('active')) {
        masonry.container.classList.add('content-changing');
        masonry.calculateLayout(true);
        setTimeout(() => {
          masonry.container.classList.remove('content-changing');
        }, 600); // Match transition duration
      }
    });
  }, 100);

  let dotCount = 0;
  const isSystemRepair = button.innerText.includes('Scan') || button.dataset.action === 'systemRepair';
  const isBackup = button.innerText.includes('Backup') || button.dataset.action === 'createBackup';
  
  let baseText;
  if (isSystemRepair) {
    baseText = 'Running System Scan';
  } else if (isBackup) {
    baseText = 'Creating Backup';
  } else {
    baseText = 'Cleaning Disk';
  }
  
  statusText.textContent = baseText;

  const statusInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    statusText.textContent = baseText + '.'.repeat(dotCount);
  }, 500);

  return action().then(result => {
    resultEl.classList.add('success');
    resultEl.textContent = result;
  }).catch(err => {
    resultEl.classList.add('error');
    resultEl.textContent = 'Error: ' + err.message;
  }).finally(() => {
    clearInterval(statusInterval);
    loadingEl.style.display = 'none';
    statusText.textContent = '';
    
    // Trigger smooth masonry layout recalculation when loading state ends
    setTimeout(() => {
      masonryInstances.forEach(masonry => {
        if (masonry.container.classList.contains('active')) {
          masonry.container.classList.add('content-changing');
          masonry.calculateLayout(true);
          setTimeout(() => {
            masonry.container.classList.remove('content-changing');
          }, 600); // Match transition duration
        }
      });
    }, 100);
    
    setTimeout(() => {
      resultEl.textContent = '';
      resultEl.classList.remove('success', 'error');
    }, 5000);
  });
}

// Simple notification function using modal system
function showNotification(message, type = 'info') {
  return showModal({
    type: type,
    title: type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Information',
    message: message,
    confirmText: 'OK',
    showCancel: false
  });
}

// Function to refresh backup info display
async function refreshBackupInfo() {
  try {
    const backupInfo = await window.backupAPI.getBackupInfo();
    
    const lastBackupEl = document.getElementById('lastBackupTime');
    const backupLocationEl = document.getElementById('backupLocation');
    
    if (lastBackupEl) {
      lastBackupEl.textContent = backupInfo.LastBackupDate;
      lastBackupEl.style.color = backupInfo.LastBackupDate === 'Never' ? 'var(--text-muted)' : 'var(--text-primary)';
    }
    
    if (backupLocationEl) {
      const location = backupInfo.BackupLocation;
      const maxLength = 50;
      const displayLocation = location.length > maxLength ? 
        '...' + location.substring(location.length - maxLength + 3) : 
        location;
      
      backupLocationEl.textContent = displayLocation;
      backupLocationEl.title = location;
      backupLocationEl.style.color = 'var(--text-primary)';
    }
    
    console.log('[Backup Info] Refreshed backup info:', backupInfo);
  } catch (error) {
    console.error('[Backup Info] Failed to refresh backup info:', error);
  }
}

// Special exe name handling for known applications
function getExeNameFallback(name, command) {
  const knownApps = {
    'Discord.exe': 'Discord.exe',
    'Steam.exe': 'Steam.exe',
    'EpicGamesLauncher.exe': 'EpicGamesLauncher.exe',
    'Notion.exe': 'Notion.exe',
    'Opera.exe': 'Opera GX.exe'
  };
  
  for (const [pattern, displayName] of Object.entries(knownApps)) {
    if (new RegExp(pattern, 'i').test(command)) return displayName;
  }
  return name;
}

// Utility functions
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

window.addEventListener('DOMContentLoaded', async () => {
  console.log('[renderer.js] DOM fully loaded');

  // -------------------------
  // Settings System
  // -------------------------
  
  // Load settings from localStorage
  const settings = {
    theme: localStorage.getItem('pc-buddy-theme') || 'light',
    defaultPage: localStorage.getItem('pc-buddy-default-page') || 'systemHealth',
    autoRefresh: localStorage.getItem('pc-buddy-auto-refresh') !== 'false'
  };
  
  console.log('[Settings] Loaded user settings:', settings);
  
  // Apply theme on startup
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.checked = theme === 'dark';
    }
  }
  
  // Apply settings on startup
  function applySettings() {
    applyTheme(settings.theme);
    
    const defaultPageSelect = document.getElementById('defaultPageSelect');
    if (defaultPageSelect) {
      defaultPageSelect.value = settings.defaultPage;
    }
    
    const autoRefreshToggle = document.getElementById('autoRefreshToggle');
    if (autoRefreshToggle) {
      autoRefreshToggle.checked = settings.autoRefresh;
    }
    
    // Update about version
    const aboutVersion = document.getElementById('aboutVersion');
    if (aboutVersion && window.systemInfoAPI?.getAppVersion) {
      aboutVersion.textContent = `v${window.systemInfoAPI.getAppVersion()}`;
    }
  }
  
  // Initialize settings when DOM is ready
  applySettings();

  // -------------------------
  // Loading Screen Management
  // -------------------------
  const loadingScreen = document.getElementById('loadingScreen');
  const loadingText = document.querySelector('.loading-text');
  const progressDots = document.querySelectorAll('.progress-dots .dot');
  
  let currentDot = 0;
  const updateLoadingProgress = (text) => {
    if (text) {
      loadingText.textContent = text;
    }
    
    // Reset all dots
    progressDots.forEach(dot => dot.classList.remove('active'));
    
    // Activate current dot
    if (currentDot < progressDots.length) {
      progressDots[currentDot].classList.add('active');
      currentDot++;
    }
  };

  // Initial progress message
  updateLoadingProgress();

  // -------------------------
  // Tool Button Click Handling (consolidated)
  // -------------------------
  document.querySelectorAll('.tool-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const action = toolActions[button.dataset.action];
      if (action) {
        await handleToolButtonAction(button, action);
    }
  });
});

  // -------------------------
  // Sidebar & Section Switching
  // -------------------------
  const sidebarItems = document.querySelectorAll('#sidebar li[data-section]');
  const sections = document.querySelectorAll('.section');

  function switchSection(sectionId) {
    // Prevent multiple rapid section switches
    if (window.switchingSections) return;
    window.switchingSections = true;

    // Disable masonry animations during section switch
    masonryInstances.forEach(masonry => {
      masonry.container.classList.add('switching-sections');
    });

    // Hide all sections with fade-out
    sections.forEach(section => {
      section.style.opacity = '0';
      section.style.transform = 'translateY(10px)';
    });

    // Update sidebar immediately
    sidebarItems.forEach(item => {
      item.classList.toggle('active', item.dataset.section === sectionId);
    });

    // Wait for fade-out to complete, then switch sections
    setTimeout(() => {
      // Hide old sections
      sections.forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
      });

      const targetSection = document.getElementById(sectionId);
      if (targetSection) {
        // Show new section
        targetSection.style.display = 'block';
        targetSection.classList.add('active');
        
        // Force a reflow to ensure display change is applied
        targetSection.offsetHeight;
        
        // Initialize masonry for new section after it's visible
        setTimeout(() => {
          // Destroy old masonry instances that are no longer active
          masonryInstances.forEach((masonry, section) => {
            if (!section.classList.contains('active')) {
              masonry.destroy();
              masonryInstances.delete(section);
            }
          });
          
          // Initialize masonry for active section
          initMasonryLayout();
          
          // Fade in the new section
          setTimeout(() => {
            targetSection.style.opacity = '1';
            targetSection.style.transform = 'translateY(0)';
            
            // Re-enable animations after layout is complete
            setTimeout(() => {
              masonryInstances.forEach(masonry => {
                masonry.container.classList.remove('switching-sections');
              });
              
              // Reset all section styles
              sections.forEach(section => {
                section.style.display = '';
                section.style.opacity = '';
                section.style.transform = '';
              });
              
              window.switchingSections = false;
            }, 200); // Wait for fade-in to complete
          }, 100); // Small delay for masonry to initialize
        }, 50); // Wait for section to be visible
      } else {
        window.switchingSections = false;
      }
    }, 200); // Wait for fade-out animation
  }

  sidebarItems.forEach(item => {
  item.addEventListener('click', () => {
      const sectionId = item.dataset.section;
      if (sectionId) switchSection(sectionId);
    });
  });

  const defaultSection = settings.defaultPage || sidebarItems[0]?.dataset.section;
  if (defaultSection) switchSection(defaultSection);

  document.getElementById('toggleSidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
    
    // Refresh masonry layout after sidebar toggle with slight delay
    setTimeout(() => {
      masonryInstances.forEach(masonry => {
        if (masonry.container.classList.contains('active')) {
          masonry.handleResize();
        }
      });
    }, 350); // Wait for sidebar transition to complete
  });

  // -------------------------
  // Update Notification Banner
  // -------------------------
  const notification = document.getElementById('update-notification');
  const updateCard = notification?.querySelector('.update-card');
  const updateText = document.getElementById('update-text');
  const installBtn = document.getElementById('install-btn');
  const dismissBtn = document.getElementById('dismiss-btn');
  const updateProgress = document.getElementById('update-progress');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  // Dismiss functionality
  dismissBtn?.addEventListener('click', () => {
    notification.style.display = 'none';
  });

  window.electronAPI.onUpdateAvailable((version) => {
    updateText.textContent = `Version ${version} is ready to download.`;
    updateCard?.classList.remove('downloading', 'ready', 'installing');
    updateProgress.style.display = 'none';
    installBtn.disabled = true;
    installBtn.innerHTML = '<span class="button-icon">⬇️</span>Download';
    notification.style.display = 'block';
  });

  window.electronAPI.onDownloadProgress((progress) => {
    updateCard?.classList.add('downloading');
    updateCard?.classList.remove('ready', 'installing');
    updateText.textContent = 'Downloading update...';
    updateProgress.style.display = 'block';
    progressFill.style.width = `${progress.percent}%`;
    progressText.textContent = `${Math.round(progress.percent)}%`;
    installBtn.disabled = true;
    installBtn.innerHTML = '<span class="button-icon">⬇️</span>Downloading';
  });

  window.electronAPI.onUpdateDownloaded(() => {
    updateCard?.classList.add('ready');
    updateCard?.classList.remove('downloading', 'installing');
    updateText.textContent = 'Update downloaded successfully!';
    updateProgress.style.display = 'none';
    installBtn.disabled = false;
    installBtn.innerHTML = '<span class="button-icon">📥</span>Install Now';
  });

  installBtn?.addEventListener('click', () => {
    updateCard?.classList.add('installing');
    updateCard?.classList.remove('downloading', 'ready');
    updateText.textContent = 'Installing update and restarting...';
    updateProgress.style.display = 'none';
    installBtn.disabled = true;
    installBtn.innerHTML = '<span class="button-icon">⚙️</span>Installing';
    dismissBtn.style.display = 'none';
    window.electronAPI.startUpdate();
  });

  // -------------------------
  // System Info Section
  // -------------------------
  
  const info = window.systemInfoAPI.getSystemInfo?.();
  const grid = document.getElementById('systemInfoGrid');
  if (info && grid) {
    // Define system info items with icons and types
    const systemInfoItems = [
      {
        key: 'operatingSystem',
        label: 'Operating System',
        icon: '🖥️',
        type: 'os'
      },
      {
        key: 'processor',
        label: 'Processor',
        icon: '⚡',
        type: 'cpu'
      },
      {
        key: 'architecture',
        label: 'Architecture',
        icon: '🏗️',
        type: 'arch'
      },
      {
        key: 'memory',
        label: 'Memory Usage',
        icon: '💾',
        type: 'memory-combined'
      },
      {
        key: 'computerName',
        label: 'Computer Name',
        icon: '🏷️',
        type: 'name'
      },
      {
        key: 'systemUptime',
        label: 'System Uptime',
        icon: '⏰',
        type: 'uptime'
      }
    ];

    systemInfoItems.forEach(item => {
      if (item.key === 'memory' || info[item.key]) {
        const itemEl = document.createElement('div');
        itemEl.className = 'system-info-item';
        itemEl.setAttribute('data-type', item.type);
        
        let valueContent = info[item.key] || '';
        
        // Special handling for combined memory display
        if (item.type === 'memory-combined' && info.totalMemory && info.usedMemory && info.availableMemory) {
          const totalGB = parseFloat(info.totalMemory.replace(' GB', ''));
          const usedGB = parseFloat(info.usedMemory.replace(' GB', ''));
          const usagePercent = ((usedGB / totalGB) * 100).toFixed(1);
          
          valueContent = `
            <div class="memory-overview">
              <div class="memory-stats">
                <div class="memory-stat">
                  <span class="memory-stat-value">${info.usedMemory}</span>
                  <span class="memory-stat-label">Used</span>
                </div>
                <div class="memory-stat">
                  <span class="memory-stat-value">${info.availableMemory}</span>
                  <span class="memory-stat-label">Available</span>
                </div>
                <div class="memory-stat">
                  <span class="memory-stat-value">${info.totalMemory}</span>
                  <span class="memory-stat-label">Total</span>
                </div>
              </div>
              <div class="memory-bar">
                <div class="memory-fill" style="width: ${usagePercent}%"></div>
              </div>
              <div class="memory-percentage">${usagePercent}% used</div>
            </div>
          `;
        }
        
        itemEl.innerHTML = `
          <div class="system-info-header">
            <span class="system-info-icon">${item.icon}</span>
            <span class="system-info-label">${item.label}</span>
          </div>
          <div class="system-info-value">${valueContent}</div>
        `;
        
        grid.appendChild(itemEl);
      }
    });
  }
  
  markComponentLoaded('systemInfo');

  // -------------------------
  // Startup Section
  // -------------------------
  
  const listEl = document.getElementById('startupList');
  
  try {
  const entries = await window.startupAPI.getStartupPrograms();

  if (!entries.length) {
    listEl.textContent = 'No startup entries found.';
    } else {
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
        
        const safetyConfig = {
          safe: { text: 'Safe', title: 'Safe to disable' },
          caution: { text: 'Caution', title: 'May impact some functionality' },
          danger: { text: 'Danger', title: 'Critical system component' },
          unknown: { text: 'Unknown', title: 'Unknown impact' }
        };
        
        const config = safetyConfig[safety] || safetyConfig.unknown;
        badge.textContent = config.text;
        badge.title = config.title;

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
    }
    
    markComponentLoaded('startupPrograms');
  } catch (error) {
    console.error('Failed to load startup programs:', error);
    listEl.innerHTML = '<p class="error-message">Failed to load startup programs</p>';
    markComponentLoaded('startupPrograms');
  }

  const taskBtn = document.getElementById('openTaskManagerBtn');
  taskBtn?.addEventListener('click', () => {
    window.startupAPI.openTaskManager();
  });

  // -------------------------
  // Backup Management Section
  // -------------------------
  
  try {
    // Use the reusable refresh function with a minimum delay
    const [backupResult] = await Promise.all([
      refreshBackupInfo(),
      new Promise(resolve => setTimeout(resolve, 800)) // Minimum 800ms delay
    ]);
    markComponentLoaded('backupInfo');
  } catch (error) {
    console.error('Failed to load backup information:', error);
    const lastBackupEl = document.getElementById('lastBackupTime');
    const backupLocationEl = document.getElementById('backupLocation');
    
    if (lastBackupEl) {
      lastBackupEl.textContent = 'Error loading';
      lastBackupEl.style.color = 'var(--danger-color)';
    }
    if (backupLocationEl) {
      backupLocationEl.textContent = 'Error loading';
      backupLocationEl.style.color = 'var(--danger-color)';
    }
    
    // Still wait minimum delay even on error
    setTimeout(() => {
      markComponentLoaded('backupInfo');
    }, 800);
  }

  // -------------------------
  // Disk Usage Section
  // -------------------------
  
  try {
    const diskList = document.getElementById('diskList');
    const disks = await window.cleanupAPI.getDiskUsage();
    
    if (!disks || !disks.length) {
      diskList.innerHTML = '<p class="no-disks">No drives detected</p>';
    } else {
      // Sort drives: system drive first, then by letter
      const sortedDisks = disks.sort((a, b) => {
        if (a.IsSystem && !b.IsSystem) return -1;
        if (!a.IsSystem && b.IsSystem) return 1;
        return a.Name.localeCompare(b.Name);
      });

      diskList.innerHTML = '';
      
      sortedDisks.forEach(disk => {
        const diskCard = document.createElement('div');
        diskCard.className = 'disk-card';
        if (disk.IsSystem) diskCard.classList.add('system-drive');

        // Determine color based on usage percentage
        let usageColor = '#4caf50'; // Green
        if (disk.PercentUsed > 80) usageColor = '#f44336'; // Red
        else if (disk.PercentUsed > 60) usageColor = '#ff9800'; // Orange

        diskCard.innerHTML = `
          <div class="disk-header">
            <div class="disk-info">
              <span class="disk-name">${disk.Name}:</span>
              ${disk.IsSystem ? '<span class="system-badge">System</span>' : ''}
            </div>
            <div class="disk-percentage">${disk.PercentUsed}%</div>
          </div>
          <div class="disk-progress-bar">
            <div class="disk-progress-fill" style="width: ${disk.PercentUsed}%; background-color: ${usageColor};"></div>
          </div>
          <div class="disk-details">
            <span class="disk-used">${disk.UsedGB} GB used</span>
            <span class="disk-free">${disk.FreeGB} GB free</span>
            <span class="disk-total">of ${disk.TotalGB} GB</span>
          </div>
          <button class="disk-clean-btn" data-drive="${disk.Name}">
            <span class="btn-icon">🧹</span>
            Clean Drive
          </button>
        `;

        diskList.appendChild(diskCard);
      });

      // Add event listeners to clean buttons
      diskList.querySelectorAll('.disk-clean-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const driveLetter = e.target.closest('.disk-clean-btn').dataset.drive;
          const diskInfo = disks.find(d => d.Name === driveLetter);
          
          const confirmed = await showModal({
            type: 'warning',
            title: `Clean ${driveLetter}: Drive`,
            message: `This will remove temporary files and cache from drive ${driveLetter}:\n\n` +
                    `• Temporary files\n` +
                    `• Browser cache\n` +
                    `• System cache\n` +
                    `• Prefetch files\n\n` +
                    `${diskInfo.IsSystem ? 'This is your system drive. ' : ''}Continue?`,
            confirmText: 'Clean Drive'
          });

          if (confirmed) {
            await performDriveCleanup(driveLetter);
          }
        });
      });
    }
    
    // Wait for DOM rendering to complete before marking as loaded
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        markComponentLoaded('diskUsage');
      });
    });
  } catch (error) {
    console.error('Failed to load disk usage:', error);
    const diskList = document.getElementById('diskList');
    diskList.innerHTML = '<p class="error-message">Failed to load disk information</p>';
    
    // Mark as loaded even on error, but wait for DOM update
    requestAnimationFrame(() => {
      markComponentLoaded('diskUsage');
    });
  }

  // -------------------------
  // Initialize Masonry Layout
  // -------------------------
  
  // Initialize masonry layout
  initMasonryLayout();
  
  // Mark masonry as initialized
  setTimeout(() => {
    markComponentLoaded('masonryInitialized');
  }, 1000); // Give masonry time to calculate initial layout
  
  // Initialize custom shortcuts
  loadCustomShortcuts();

  // Handle window resize for masonry layout
  window.addEventListener('resize', () => {
    clearTimeout(window.masonryResizeTimeout);
    window.masonryResizeTimeout = setTimeout(() => {
      masonryInstances.forEach(masonry => {
        masonry.handleResize();
      });
    }, 150);
  });

  // -------------------------
  // Settings Event Handlers
  // -------------------------
  
  // Theme toggle
  document.getElementById('darkModeToggle')?.addEventListener('change', (e) => {
    const theme = e.target.checked ? 'dark' : 'light';
    settings.theme = theme;
    localStorage.setItem('pc-buddy-theme', theme);
    console.log('[Settings] Theme changed to:', theme);
    applyTheme(theme);
  });
  
  // Default page selection
  document.getElementById('defaultPageSelect')?.addEventListener('change', (e) => {
    settings.defaultPage = e.target.value;
    localStorage.setItem('pc-buddy-default-page', e.target.value);
    console.log('[Settings] Default page changed to:', e.target.value);
  });
  
  // Auto-refresh toggle
  document.getElementById('autoRefreshToggle')?.addEventListener('change', (e) => {
    settings.autoRefresh = e.target.checked;
    localStorage.setItem('pc-buddy-auto-refresh', e.target.checked);
    console.log('[Settings] Auto-refresh changed to:', e.target.checked);
    
    // Start or stop auto-refresh based on setting
    if (settings.autoRefresh) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  });
  
  // Auto-refresh system info functionality
  let autoRefreshInterval = null;
  
  function startAutoRefresh() {
    if (autoRefreshInterval) return; // Already running
    
    autoRefreshInterval = setInterval(() => {
      // Only refresh if on system health page and auto-refresh is enabled
      if (settings.autoRefresh && document.getElementById('systemHealth')?.classList.contains('active')) {
        refreshSystemInfo();
      }
    }, 60000); // Refresh every minute
  }
  
  function stopAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
  }
  
  function refreshSystemInfo() {
    const grid = document.getElementById('systemInfoGrid');
    const info = window.systemInfoAPI.getSystemInfo?.();
    
    if (!info || !grid) return;
    
    // Update existing values without rebuilding the entire grid
    grid.querySelectorAll('.system-info-item').forEach(item => {
      const type = item.getAttribute('data-type');
      const valueEl = item.querySelector('.system-info-value');
      
      // Update specific values
      if (type === 'memory-combined' && info.totalMemory && info.usedMemory && info.availableMemory) {
        const totalGB = parseFloat(info.totalMemory.replace(' GB', ''));
        const usedGB = parseFloat(info.usedMemory.replace(' GB', ''));
        const usagePercent = ((usedGB / totalGB) * 100).toFixed(1);
        
        valueEl.innerHTML = `
          <div class="memory-overview">
            <div class="memory-stats">
              <div class="memory-stat">
                <span class="memory-stat-value">${info.usedMemory}</span>
                <span class="memory-stat-label">Used</span>
              </div>
              <div class="memory-stat">
                <span class="memory-stat-value">${info.availableMemory}</span>
                <span class="memory-stat-label">Available</span>
              </div>
              <div class="memory-stat">
                <span class="memory-stat-value">${info.totalMemory}</span>
                <span class="memory-stat-label">Total</span>
              </div>
            </div>
            <div class="memory-bar">
              <div class="memory-fill" style="width: ${usagePercent}%"></div>
            </div>
            <div class="memory-percentage">${usagePercent}% used</div>
          </div>
        `;
      } else if (type === 'uptime') {
        valueEl.textContent = info.systemUptime;
      }
    });
  }
  
  // Start auto-refresh if enabled
  if (settings.autoRefresh) {
    startAutoRefresh();
  }

  // -------------------------
  // Backup Path Settings
  // -------------------------
  
  // Initialize backup path functionality
  const backupPathInput = document.getElementById('backupPathInput');
  const selectBackupPathBtn = document.getElementById('selectBackupPath');

  // Load current backup path function
  async function loadBackupPath() {
    try {
      console.log('[Backup Path] Loading current backup path...');
      const currentPath = await window.backupAPI.getBackupPath();
      console.log('[Backup Path] Current path:', currentPath);
      if (backupPathInput) {
        backupPathInput.value = currentPath;
        backupPathInput.title = currentPath; // Show full path on hover
      }
    } catch (error) {
      console.error('[Backup Path] Failed to load backup path:', error);
      if (backupPathInput) {
        backupPathInput.value = 'Error loading path';
        backupPathInput.title = 'Failed to load backup path';
      }
    }
  }

  // Initialize backup path if elements exist
  if (backupPathInput && selectBackupPathBtn) {
    console.log('[Backup Path] Elements found, setting up backup path functionality...');
    
    // Load initial backup path
    await loadBackupPath();
    
    // Add event listener for backup path button
    selectBackupPathBtn.addEventListener('click', async () => {
      try {
        console.log('[Backup Path] Select button clicked');
        selectBackupPathBtn.disabled = true;
        selectBackupPathBtn.textContent = 'Selecting...';
        
        const selectedPath = await window.backupAPI.selectBackupPath();
        console.log('[Backup Path] Selected path:', selectedPath);
        backupPathInput.value = selectedPath;
        backupPathInput.title = selectedPath;
        
        // Refresh backup info display immediately
        await refreshBackupInfo();
        
        // Show success message
        showNotification('Backup location updated successfully', 'success');
      } catch (error) {
        console.error('[Backup Path] Failed to select backup path:', error);
        if (error.message !== 'No folder selected') {
          showNotification('Failed to update backup location: ' + error.message, 'error');
        }
      } finally {
        selectBackupPathBtn.disabled = false;
        selectBackupPathBtn.textContent = 'Browse';
      }
    });
  } else {
    console.log('[Backup Path] Some elements missing, backup path functionality not available');
  }
  
  // Mark settings as initialized once all setup is complete
  markComponentLoaded('settingsInitialized');
});

// -------------------------
// Global Settings Functions
// -------------------------

function resetAllSettings() {
  const confirmed = confirm('Are you sure you want to reset all settings to their defaults? This action cannot be undone.');
  
  if (confirmed) {
    console.log('[Settings] Resetting all settings to defaults');
    
    // Clear all settings from localStorage
    localStorage.removeItem('pc-buddy-theme');
    localStorage.removeItem('pc-buddy-default-page');
    localStorage.removeItem('pc-buddy-auto-refresh');
    localStorage.removeItem('customShortcuts');
    
    // Reset backup location in registry
    const regCommand = `reg delete "HKCU\\Software\\PC-Buddy" /v BackupLocation /f 2>nul`;
    
    window.systemAPI.runPowerShellCommand(`& cmd /c "${regCommand}"`).then(() => {
      console.log('[Settings] Backup location reset to default');
      
      // Reload backup path display
      const backupPathInput = document.getElementById('backupPathInput');
      if (backupPathInput && window.backupAPI) {
        window.backupAPI.getBackupPath().then(path => {
          backupPathInput.value = path;
          backupPathInput.title = path;
        }).catch(error => {
          console.error('[Settings] Failed to reload backup path:', error);
        });
      }
      
      // Refresh backup info display
      refreshBackupInfo();
    }).catch(error => {
      console.error('[Settings] Failed to reset backup location:', error);
    });
    
    // Reset to defaults
    document.documentElement.setAttribute('data-theme', 'light');
    
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) darkModeToggle.checked = false;
    
    const defaultPageSelect = document.getElementById('defaultPageSelect');
    if (defaultPageSelect) defaultPageSelect.value = 'systemHealth';
    
    const autoRefreshToggle = document.getElementById('autoRefreshToggle');
    if (autoRefreshToggle) autoRefreshToggle.checked = true;
    
    // Reload custom shortcuts
    loadCustomShortcuts();
    
    // Refresh masonry layout
    setTimeout(() => {
      masonryInstances.forEach(masonry => {
        masonry.refresh();
      });
    }, 100);
    
    console.log('[Settings] All settings reset successfully');
    alert('All settings have been reset to their defaults.');
  }
}

// -------------------------
// Drive Cleanup Function
// -------------------------

async function performDriveCleanup(driveLetter) {
  const card = document.getElementById('diskCleanupCard');
  const loadingEl = card.querySelector('.loadingMessage');
  const resultEl = card.querySelector('.toolResult');
  const statusText = card.querySelector('.statusText');

  // Find and disable the specific drive button
  const driveBtn = card.querySelector(`[data-drive="${driveLetter}"]`);
  if (driveBtn) {
    driveBtn.disabled = true;
    driveBtn.innerHTML = '<span class="btn-icon">⏳</span>Cleaning...';
  }

  resultEl.classList.remove('success', 'error');
  resultEl.textContent = '';
  loadingEl.style.display = 'block';

  let dotCount = 0;
  statusText.textContent = `Cleaning ${driveLetter}: Drive`;

  const statusInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    statusText.textContent = `Cleaning ${driveLetter}: Drive` + '.'.repeat(dotCount);
  }, 500);

  try {
    const cleanupResult = await window.cleanupAPI.cleanDrive(driveLetter);
    resultEl.classList.add('success');
    resultEl.textContent = cleanupResult || `Cleanup completed on drive ${driveLetter}:`;
    
    // Refresh disk usage after cleanup
    setTimeout(async () => {
      try {
        const diskList = document.getElementById('diskList');
        const disks = await window.cleanupAPI.getDiskUsage();
        const updatedDisk = disks.find(d => d.Name === driveLetter);
        
        if (updatedDisk) {
          const diskCard = diskList.querySelector(`[data-drive="${driveLetter}"]`).closest('.disk-card');
          const progressFill = diskCard.querySelector('.disk-progress-fill');
          const percentage = diskCard.querySelector('.disk-percentage');
          const usedText = diskCard.querySelector('.disk-used');
          const freeText = diskCard.querySelector('.disk-free');
          
          // Update progress bar color
          let usageColor = '#4caf50';
          if (updatedDisk.PercentUsed > 80) usageColor = '#f44336';
          else if (updatedDisk.PercentUsed > 60) usageColor = '#ff9800';
          
          progressFill.style.width = `${updatedDisk.PercentUsed}%`;
          progressFill.style.backgroundColor = usageColor;
          percentage.textContent = `${updatedDisk.PercentUsed}%`;
          usedText.textContent = `${updatedDisk.UsedGB} GB used`;
          freeText.textContent = `${updatedDisk.FreeGB} GB free`;
        }
      } catch (refreshError) {
        console.warn('Failed to refresh disk usage after cleanup:', refreshError);
      }
    }, 2000);
    
  } catch (err) {
    resultEl.classList.add('error');
    resultEl.textContent = 'Error: ' + err.message;
  } finally {
    clearInterval(statusInterval);
    loadingEl.style.display = 'none';
    statusText.textContent = '';
    
    // Re-enable the drive button
    if (driveBtn) {
      driveBtn.disabled = false;
      driveBtn.innerHTML = '<span class="btn-icon">🧹</span>Clean Drive';
    }
    
    setTimeout(() => {
      resultEl.textContent = '';
      resultEl.classList.remove('success', 'error');
    }, 5000);
  }
}

// -------------------------
// Modal System
// -------------------------

async function showModal({ type = 'info', title, message, confirmText = 'OK', cancelText = 'Cancel', showCancel = true }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const content = document.createElement('div');
    content.className = 'modal-content';

    const header = document.createElement('div');
    header.className = `modal-header ${type}`;

    const iconMap = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅'
    };

    const icon = document.createElement('span');
    icon.className = `modal-${type}-icon`;
    icon.textContent = iconMap[type] || iconMap.info;

    const titleEl = document.createElement('h3');
    titleEl.className = 'modal-title';
    titleEl.textContent = title;

    header.appendChild(icon);
    header.appendChild(titleEl);
    content.appendChild(header);

    const body = document.createElement('div');
    body.className = 'modal-body';
    body.style.whiteSpace = 'pre-line';
    body.textContent = message;
    content.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    if (showCancel) {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'modal-button cancel';
      cancelBtn.textContent = cancelText;
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

    content.appendChild(actions);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve(false);
      }
    });

    // Focus the confirm button
    setTimeout(() => confirmBtn.focus(), 100);
  });
}

// -------------------------
// Masonry Layout System
// -------------------------

// True Pinterest-style masonry layout
class MasonryLayout {
  constructor(container, options = {}) {
    this.container = container;
    this.gap = options.gap || 20;
    this.cardWidth = this.getCardWidth();
    this.columns = [];
    this.cards = [];
    this.isResizing = false;
    this.isInitializing = true;
    this.resizeObserver = null;
    this.resizeRAF = null;
    this.layoutRAF = null;
    
    this.init();
  }
  
  getCardWidth() {
    const containerWidth = this.container.offsetWidth - 40; // Account for padding
    const minCardWidth = window.innerWidth <= 768 ? 350 : 
                        window.innerWidth <= 1200 ? 430 :
                        window.innerWidth <= 1600 ? 450 : 470;
    
    // Calculate how many columns we can fit
    const possibleColumns = Math.floor((containerWidth + this.gap) / (minCardWidth + this.gap));
    const actualColumns = Math.max(1, possibleColumns);
    
    // Calculate actual card width to fill the space
    return Math.floor((containerWidth - (this.gap * (actualColumns - 1))) / actualColumns);
  }
  
  init() {
    this.container.classList.add('js-masonry', 'loading');
    this.cards = Array.from(this.container.querySelectorAll('.tool-card'));
    
    // Set initial card properties
    this.cardWidth = this.getCardWidth();
    this.cards.forEach(card => {
      card.style.width = `${this.cardWidth}px`;
      card.style.opacity = '1';
    });
    
    // Calculate initial layout without animation
    this.calculateLayout(false);
    
    // Enable animations after initial positioning
    requestAnimationFrame(() => {
      this.container.classList.remove('loading');
      this.isInitializing = false;
      this.setupResizeObserver();
      this.setupWindowResize();
    });
  }
  
  calculateLayout(animate = true) {
    if (this.cards.length === 0) return;
    
    // Cancel any pending layout updates
    if (this.layoutRAF) {
      cancelAnimationFrame(this.layoutRAF);
    }
    
    this.layoutRAF = requestAnimationFrame(() => {
      const containerWidth = this.container.offsetWidth - 40;
      const columnsCount = Math.floor((containerWidth + this.gap) / (this.cardWidth + this.gap));
      
      // Initialize column heights
      this.columns = Array(Math.max(1, columnsCount)).fill(0);
      
      // Calculate positions
      const positions = this.calculateOptimalPositions();
      
      // Apply positions smoothly
      this.applyPositions(positions, animate);
      
      // Set final container height
      const maxHeight = Math.max(...this.columns) + 40;
      this.container.style.height = `${maxHeight}px`;
    });
  }
  
  calculateOptimalPositions() {
    const containerWidth = this.container.offsetWidth - 40;
    const columnsCount = Math.floor((containerWidth + this.gap) / (this.cardWidth + this.gap));
    const positions = [];
    
    // Reset columns
    this.columns = Array(Math.max(1, columnsCount)).fill(0);
    
    // Get card heights efficiently
    this.cards.forEach((card, index) => {
      const height = card.offsetHeight;
      const shortestColumnIndex = this.columns.indexOf(Math.min(...this.columns));
      
      const x = shortestColumnIndex * (this.cardWidth + this.gap);
      const y = this.columns[shortestColumnIndex];
      
      positions[index] = { x, y };
      this.columns[shortestColumnIndex] += height + this.gap;
    });
    
    return positions;
  }
  
  applyPositions(positions, animate = true) {
    this.cards.forEach((card, index) => {
      const { x, y } = positions[index];
      
      // Use transform3d for hardware acceleration
      const transform = `translate3d(${x}px, ${y}px, 0)`;
      
      // Check if we're switching sections
      const isSwitchingSections = this.container.classList.contains('switching-sections');
      
      if (!animate || this.isInitializing || isSwitchingSections) {
        // Instant positioning
        card.style.transition = 'none';
        card.style.transform = transform;
        
        // Re-enable transitions after positioning (only if not switching sections)
        if (!isSwitchingSections) {
          requestAnimationFrame(() => {
            card.style.transition = '';
          });
        }
      } else {
        // Smooth transition
        card.style.transform = transform;
      }
    });
  }
  
  handleResize() {
    // Prevent multiple simultaneous resize operations
    if (this.isResizing) return;
    
    // Cancel any pending resize operations
    if (this.resizeRAF) {
      cancelAnimationFrame(this.resizeRAF);
    }
    
    this.isResizing = true;
    this.container.classList.add('resizing');
    
    this.resizeRAF = requestAnimationFrame(() => {
      const newCardWidth = this.getCardWidth();
      const needsWidthUpdate = Math.abs(newCardWidth - this.cardWidth) > 5; // 5px threshold
      
      if (needsWidthUpdate) {
        this.cardWidth = newCardWidth;
        
        // Update card widths efficiently
        this.cards.forEach(card => {
          card.style.width = `${this.cardWidth}px`;
        });
        
        // Wait a frame for width changes to apply, then recalculate
        requestAnimationFrame(() => {
          this.calculateLayout(true);
          
          // Clean up resize state
          setTimeout(() => {
            this.container.classList.remove('resizing');
            this.isResizing = false;
          }, 300); // Match transition duration
        });
      } else {
        // Just recalculate positions without width changes
        this.calculateLayout(true);
        
        setTimeout(() => {
          this.container.classList.remove('resizing');
          this.isResizing = false;
        }, 300);
      }
    });
  }
  
  setupWindowResize() {
    let resizeTimeout;
    
    const handleWindowResize = () => {
      clearTimeout(resizeTimeout);
      
      resizeTimeout = setTimeout(() => {
        if (!this.isResizing) {
          this.handleResize();
        }
      }, 100); // Debounce window resize
    };
    
    window.addEventListener('resize', handleWindowResize);
    
    // Store reference for cleanup
    this.windowResizeHandler = handleWindowResize;
  }
  
  setupResizeObserver() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    this.resizeObserver = new ResizeObserver((entries) => {
      // Debounce ResizeObserver callbacks
      clearTimeout(this.observerTimeout);
      
      this.observerTimeout = setTimeout(() => {
        if (!this.isResizing) {
          this.calculateLayout(true);
        }
      }, 50);
    });
    
    // Observe container for size changes
    this.resizeObserver.observe(this.container);
    
    // Add MutationObserver to watch for content changes in cards
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    
    this.mutationObserver = new MutationObserver((mutations) => {
      let shouldRecalculate = false;
      
      mutations.forEach(mutation => {
        // Check if any visible content changed that could affect card height
        if (mutation.type === 'childList' || 
            (mutation.type === 'attributes' && 
             (mutation.attributeName === 'style' || mutation.attributeName === 'class'))) {
          
          // Check if the mutation affects display/visibility
          const target = mutation.target;
          if (target.closest && target.closest('.tool-card')) {
            shouldRecalculate = true;
          }
        }
      });
      
      if (shouldRecalculate) {
        clearTimeout(this.mutationTimeout);
        this.mutationTimeout = setTimeout(() => {
          if (!this.isResizing) {
            this.container.classList.add('content-changing');
            this.calculateLayout(true);
            setTimeout(() => {
              this.container.classList.remove('content-changing');
            }, 500); // Match transition duration
          }
        }, 150);
      }
    });
    
    // Observe all cards for content changes
    this.cards.forEach(card => {
      this.mutationObserver.observe(card, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    });
  }
  
  refresh() {
    this.cards = Array.from(this.container.querySelectorAll('.tool-card'));
    
    // Update card widths
    this.cards.forEach(card => {
      card.style.width = `${this.cardWidth}px`;
    });
    
    this.setupResizeObserver();
    
    // Recalculate layout
    setTimeout(() => {
      this.calculateLayout(true);
    }, 50);
  }
  
  destroy() {
    // Clean up event listeners
    if (this.windowResizeHandler) {
      window.removeEventListener('resize', this.windowResizeHandler);
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    
    // Cancel any pending animations
    if (this.resizeRAF) {
      cancelAnimationFrame(this.resizeRAF);
    }
    
    if (this.layoutRAF) {
      cancelAnimationFrame(this.layoutRAF);
    }
    
    // Clean up timeouts
    clearTimeout(this.observerTimeout);
    clearTimeout(this.mutationTimeout);
    
    // Reset container
    this.container.classList.remove('js-masonry', 'loading', 'resizing');
    
    // Reset cards
    this.cards.forEach(card => {
      card.style.transform = '';
      card.style.width = '';
      card.style.transition = '';
    });
  }
}

// Global masonry instances
let masonryInstances = new Map();

function initMasonryLayout() {
  const sections = document.querySelectorAll('.section.active');
  
  sections.forEach(section => {
    const cards = section.querySelectorAll('.tool-card');
    if (cards.length === 0) return;
    
    // Destroy existing instance if it exists
    if (masonryInstances.has(section)) {
      masonryInstances.get(section).destroy();
    }
    
    // Create new masonry instance
    const masonry = new MasonryLayout(section, { gap: 20 });
    masonryInstances.set(section, masonry);
  });
}

function refreshMasonryLayout() {
  masonryInstances.forEach(masonry => {
    masonry.refresh();
  });
}

document.addEventListener('DOMContentLoaded', initMasonryLayout);

// -------------------------
// Custom Shortcuts System
// -------------------------

// Emoji categories with comprehensive emoji lists
const emojiCategories = {
  smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
  people: ['👤', '👥', '👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '👩‍🦱', '👨‍🦱', '👩‍🦰', '👨‍🦰', '👱‍♀️', '👱‍♂️', '👩‍🦳', '👨‍🦳', '👩‍🦲', '👨‍🦲', '🧔', '👵', '🧓', '👴', '👲', '👳‍♀️', '👳‍♂️', '🧕', '👮‍♀️', '👮‍♂️'],
  animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇'],
  food: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥒', '🥬', '🌶️', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞'],
  activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️'],
  travel: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚝'],
  objects: ['💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🔩', '⚙️', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓'],
  symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐']
};

let currentEmojiCategory = 'smileys';
let editingShortcutId = null;

// Load custom shortcuts from localStorage
function loadCustomShortcuts() {
  const shortcuts = JSON.parse(localStorage.getItem('customShortcuts') || '[]');
  const container = document.getElementById('customShortcutsList');
  
  container.innerHTML = '';
  
  shortcuts.forEach((shortcut, index) => {
    const shortcutElement = document.createElement('div');
    shortcutElement.className = 'shortcut-btn custom-shortcut';
    shortcutElement.innerHTML = `
      <span class="shortcut-icon">${shortcut.icon}</span>
      <span class="shortcut-label">${shortcut.name}</span>
      <div class="shortcut-actions">
        <button class="shortcut-action-btn edit" onclick="editCustomShortcut(${index})" title="Edit">✏️</button>
        <button class="shortcut-action-btn delete" onclick="deleteCustomShortcut(${index})" title="Delete">🗑️</button>
      </div>
    `;
    
    // Add click handler for opening the shortcut
    shortcutElement.addEventListener('click', (e) => {
      if (!e.target.closest('.shortcut-actions')) {
        openCustomShortcut(shortcut.path);
      }
    });
    
    container.appendChild(shortcutElement);
  });
}

// Custom shortcut modal functions
function openCustomShortcutModal() {
  editingShortcutId = null;
  document.getElementById('shortcutName').value = '';
  document.getElementById('shortcutPath').value = '';
  document.getElementById('iconPreview').textContent = '📁';
  document.getElementById('customShortcutModal').style.display = 'flex';
}

function closeCustomShortcutModal() {
  document.getElementById('customShortcutModal').style.display = 'none';
  editingShortcutId = null;
}

function openEmojiPicker() {
  document.getElementById('emojiPickerModal').style.display = 'flex';
  switchEmojiCategory('smileys');
}

function closeEmojiPicker() {
  document.getElementById('emojiPickerModal').style.display = 'none';
}

function switchEmojiCategory(category) {
  currentEmojiCategory = category;
  
  // Update active category button
  document.querySelectorAll('.emoji-category').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });
  
  // Populate emoji grid
  const grid = document.getElementById('emojiGrid');
  grid.innerHTML = '';
  
  emojiCategories[category].forEach(emoji => {
    const emojiButton = document.createElement('div');
    emojiButton.className = 'emoji-item';
    emojiButton.textContent = emoji;
    emojiButton.onclick = () => selectEmoji(emoji);
    grid.appendChild(emojiButton);
  });
}

function selectEmoji(emoji) {
  document.getElementById('iconPreview').textContent = emoji;
  closeEmojiPicker();
}

function setExamplePath(path) {
  document.getElementById('shortcutPath').value = path;
}

function saveCustomShortcut() {
  const name = document.getElementById('shortcutName').value.trim();
  const path = document.getElementById('shortcutPath').value.trim();
  const icon = document.getElementById('iconPreview').textContent;
  
  if (!name || !path) {
    alert('Please fill in both name and path fields.');
    return;
  }
  
  const shortcuts = JSON.parse(localStorage.getItem('customShortcuts') || '[]');
  const shortcut = { name, path, icon };
  
  if (editingShortcutId !== null) {
    shortcuts[editingShortcutId] = shortcut;
  } else {
    shortcuts.push(shortcut);
  }
  
  localStorage.setItem('customShortcuts', JSON.stringify(shortcuts));
  loadCustomShortcuts();
  closeCustomShortcutModal();
  
  // Refresh masonry layout
  setTimeout(() => {
    masonryInstances.forEach(masonry => {
      masonry.refresh();
    });
  }, 100);
}

function editCustomShortcut(index) {
  const shortcuts = JSON.parse(localStorage.getItem('customShortcuts') || '[]');
  const shortcut = shortcuts[index];
  
  if (shortcut) {
    editingShortcutId = index;
    document.getElementById('shortcutName').value = shortcut.name;
    document.getElementById('shortcutPath').value = shortcut.path;
    document.getElementById('iconPreview').textContent = shortcut.icon;
    document.getElementById('customShortcutModal').style.display = 'flex';
  }
}

function deleteCustomShortcut(index) {
  if (confirm('Are you sure you want to delete this shortcut?')) {
    const shortcuts = JSON.parse(localStorage.getItem('customShortcuts') || '[]');
    shortcuts.splice(index, 1);
    localStorage.setItem('customShortcuts', JSON.stringify(shortcuts));
    loadCustomShortcuts();
    
    // Refresh masonry layout
    setTimeout(() => {
      masonryInstances.forEach(masonry => {
        masonry.refresh();
      });
    }, 100);
  }
}

function openCustomShortcut(path) {
  console.log('[customShortcut] Opening:', path);
  
  // Determine if it's a URL or file path
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // Open URL in default browser
    window.electronAPI && window.electronAPI.openExternal ? 
      window.electronAPI.openExternal(path) : 
      window.open(path, '_blank');
  } else {
    // Open file/folder with system default
    window.systemAPI.openPath(path);
  }
}

// Initialize custom shortcuts on page load
document.addEventListener('DOMContentLoaded', () => {
  loadCustomShortcuts();
});

// -------------------------
// Update Notification Test Functions (Development Only)
// -------------------------

window.testUpdateNotification = {
  showAvailable: (version = '2.1.0') => {
    const notification = document.getElementById('update-notification');
    const updateCard = notification?.querySelector('.update-card');
    const updateText = document.getElementById('update-text');
    const installBtn = document.getElementById('install-btn');
    const dismissBtn = document.getElementById('dismiss-btn');
    const updateProgress = document.getElementById('update-progress');
    
    updateText.textContent = `Version ${version} is ready to download.`;
    updateCard?.classList.remove('downloading', 'ready', 'installing');
    updateProgress.style.display = 'none';
    installBtn.disabled = true;
    installBtn.innerHTML = '<span class="button-icon">⬇️</span>Download';
    dismissBtn.style.display = 'inline-flex';
    notification.style.display = 'block';
    
    console.log('✅ Test: Update Available notification shown');
  },
  
  downloadProgress: (percent = 0) => {
    const notification = document.getElementById('update-notification');
    const updateCard = notification?.querySelector('.update-card');
    const updateText = document.getElementById('update-text');
    const installBtn = document.getElementById('install-btn');
    const updateProgress = document.getElementById('update-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    updateCard?.classList.add('downloading');
    updateCard?.classList.remove('ready', 'installing');
    updateText.textContent = 'Downloading update...';
    updateProgress.style.display = 'block';
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${Math.round(percent)}%`;
    installBtn.disabled = true;
    installBtn.innerHTML = '<span class="button-icon">⬇️</span>Downloading';
    notification.style.display = 'block';
    
    console.log(`⬇️ Test: Download progress ${percent}%`);
  },
  
  downloadComplete: () => {
    const notification = document.getElementById('update-notification');
    const updateCard = notification?.querySelector('.update-card');
    const updateText = document.getElementById('update-text');
    const installBtn = document.getElementById('install-btn');
    const updateProgress = document.getElementById('update-progress');
    
    updateCard?.classList.add('ready');
    updateCard?.classList.remove('downloading', 'installing');
    updateText.textContent = 'Update downloaded successfully!';
    updateProgress.style.display = 'none';
    installBtn.disabled = false;
    installBtn.innerHTML = '<span class="button-icon">📥</span>Install Now';
    notification.style.display = 'block';
    
    console.log('✅ Test: Download complete notification shown');
  },
  
  installing: () => {
    const notification = document.getElementById('update-notification');
    const updateCard = notification?.querySelector('.update-card');
    const updateText = document.getElementById('update-text');
    const installBtn = document.getElementById('install-btn');
    const dismissBtn = document.getElementById('dismiss-btn');
    const updateProgress = document.getElementById('update-progress');
    
    updateCard?.classList.add('installing');
    updateCard?.classList.remove('downloading', 'ready');
    updateText.textContent = 'Installing update and restarting...';
    updateProgress.style.display = 'none';
    installBtn.disabled = true;
    installBtn.innerHTML = '<span class="button-icon">⚙️</span>Installing';
    dismissBtn.style.display = 'none';
    notification.style.display = 'block';
    
    console.log('⚙️ Test: Installing notification shown');
  },
  
  hide: () => {
    const notification = document.getElementById('update-notification');
    notification.style.display = 'none';
    console.log('❌ Test: Notification hidden');
  },
  
  simulateDownload: async (duration = 3000) => {
    console.log('🚀 Test: Starting download simulation...');
    window.testUpdateNotification.showAvailable();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Animate progress from 0 to 100
    for (let i = 0; i <= 100; i += 5) {
      window.testUpdateNotification.downloadProgress(i);
      await new Promise(resolve => setTimeout(resolve, duration / 20));
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    window.testUpdateNotification.downloadComplete();
    
    console.log('✅ Test: Download simulation complete');
  },
  
  help: () => {
    console.log(`
🧪 Update Notification Test Commands:

• testUpdateNotification.showAvailable('2.1.0')  - Show update available
• testUpdateNotification.downloadProgress(50)    - Show download at 50%
• testUpdateNotification.downloadComplete()      - Show download complete
• testUpdateNotification.installing()            - Show installing state
• testUpdateNotification.hide()                  - Hide notification
• testUpdateNotification.simulateDownload(3000)  - Full download simulation
• testUpdateNotification.help()                  - Show this help

Example: testUpdateNotification.simulateDownload()
    `);
  }
};

// Auto-show help on load
console.log('🧪 Update notification test functions loaded! Type "testUpdateNotification.help()" for commands.');

// -------------------------
// Loading State Management
// -------------------------

let componentsLoaded = {
  systemInfo: false,
  startupPrograms: false,
  backupInfo: false,
  diskUsage: false,
  settingsInitialized: false,
  masonryInitialized: false
};

let loadingTimeout = null;
let minimumLoadingTime = 5000; // Minimum 5 seconds loading time
let loadingStartTime = Date.now();

function checkAllComponentsLoaded() {
  const allLoaded = Object.values(componentsLoaded).every(loaded => loaded);
  const loadingScreen = document.getElementById('loadingScreen');
  const currentTime = Date.now();
  const elapsedTime = currentTime - loadingStartTime;
  
  console.log('[Loading] Check components:', componentsLoaded);
  console.log('[Loading] All loaded:', allLoaded, 'Elapsed time:', elapsedTime);
  
  if (allLoaded && loadingScreen) {
    // Calculate remaining time to meet minimum loading duration
    const remainingTime = Math.max(0, minimumLoadingTime - elapsedTime);
    
    console.log('[Loading] Remaining time:', remainingTime);
    
    // Update progress to show completion
    updateLoadingProgress();
    
    // Show "Ready!" message
    const progressTextEl = document.querySelector('.loading-text');
    if (progressTextEl) {
      progressTextEl.textContent = 'Ready!';
    }
    
    // Activate all progress dots
    const progressDots = document.querySelectorAll('.progress-dots .dot');
    progressDots.forEach(dot => dot.classList.add('active'));
    
    // Wait for minimum loading time plus additional delay for smooth UX
    setTimeout(() => {
      console.log('[Loading] Hiding loading screen');
      loadingScreen.classList.add('hidden');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 500); // Wait for fade animation
    }, remainingTime + 2000); // Extra 2s after minimum time for "Ready!" message
  }
}

function markComponentLoaded(component) {
  console.log(`[Loading] Component loaded: ${component}`);
  componentsLoaded[component] = true;
  
  // Add delay for each component to spread loading out
  setTimeout(() => {
    updateLoadingProgress();
    checkAllComponentsLoaded();
  }, 500); // 500ms delay between each component load
}

function updateLoadingProgress() {
  const loadedCount = Object.values(componentsLoaded).filter(loaded => loaded).length;
  const totalCount = Object.keys(componentsLoaded).length;
  const percentage = Math.round((loadedCount / totalCount) * 100);
  
  const progressFill = document.querySelector('.progress-fill');
  const progressText = document.querySelector('.progress-text');
  const loadingText = document.querySelector('.loading-text');
  
  if (progressFill) progressFill.style.width = `${percentage}%`;
  if (progressText) progressText.textContent = `${percentage}%`;
  
  // Update descriptive loading text based on what's loaded
  if (loadingText) {
    if (percentage === 0) {
      loadingText.textContent = 'Initializing application...';
    } else if (percentage < 20) {
      loadingText.textContent = 'Loading system information...';
    } else if (percentage < 40) {
      loadingText.textContent = 'Loading startup programs...';
    } else if (percentage < 60) {
      loadingText.textContent = 'Loading backup information...';
    } else if (percentage < 80) {
      loadingText.textContent = 'Analyzing disk usage...';
    } else if (percentage < 90) {
      loadingText.textContent = 'Initializing settings...';
    } else if (percentage < 100) {
      loadingText.textContent = 'Finalizing interface...';
    } else {
      loadingText.textContent = 'Ready!';
    }
  }
  
  // Update progress dots based on percentage
  const progressDots = document.querySelectorAll('.progress-dots .dot');
  const activeDots = Math.ceil((percentage / 100) * progressDots.length);
  
  progressDots.forEach((dot, index) => {
    if (index < activeDots) {
      dot.classList.add('active');
    }
  });
  
  console.log(`[Loading] Progress: ${loadedCount}/${totalCount} (${percentage}%)`);
}