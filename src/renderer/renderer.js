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

// Simple notification function using modal system - FIXED TO PREVENT FREEZING
function showNotification(message, type = 'info') {
  // Add a small delay to prevent modal conflicts and make it non-blocking
  setTimeout(() => {
    showModal({
      type: type,
      title: type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Information',
      message: message,
      confirmText: 'OK',
      showCancel: false
    }).catch(error => {
      console.error('[showNotification] Modal error:', error);
    });
  }, 100);
}

// Function to refresh backup info display
async function refreshBackupInfo() {
  try {
    const backupInfo = await window.backupAPI.getBackupInfo();
    
    const lastBackupEl = document.getElementById('lastBackupTime');
    const backupLocationEl = document.getElementById('backupLocation');
    const backupFilesSection = document.getElementById('backupFilesSection');
    const backupFilesList = document.getElementById('backupFilesList');
    
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
    
    // Display backup files if they exist
    if (backupFilesList && backupInfo.BackupFiles && backupInfo.BackupFiles.length > 0) {
      backupFilesList.innerHTML = '';
      
      backupInfo.BackupFiles.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'backup-file-item';
        
        const fileInfo = document.createElement('div');
        fileInfo.className = 'backup-file-info';
        
        const fileName = document.createElement('div');
        fileName.className = 'backup-file-name';
        fileName.textContent = file.Name;
        
        const fileType = document.createElement('div');
        fileType.className = 'backup-file-type';
        fileType.textContent = `(${file.Type || 'File'})`;
        fileType.style.fontSize = '0.85em';
        fileType.style.color = 'var(--text-muted)';
        
        const fileDetails = document.createElement('div');
        fileDetails.className = 'backup-file-details';
        
        const fileSize = document.createElement('span');
        fileSize.className = 'backup-file-size';
        fileSize.textContent = file.SizeFormatted;
        
        const fileDate = document.createElement('span');
        fileDate.className = 'backup-file-date';
        fileDate.textContent = `Created: ${file.CreatedDate}`;
        
        fileDetails.appendChild(fileSize);
        fileDetails.appendChild(fileDate);
        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileType);
        fileInfo.appendChild(fileDetails);
        
        const fileActions = document.createElement('div');
        fileActions.className = 'backup-file-actions';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'backup-delete-btn';
        deleteBtn.innerHTML = '<span>🗑️</span> Delete';
        deleteBtn.onclick = () => deleteBackupFile(file.Name);
        
        fileActions.appendChild(deleteBtn);
        fileItem.appendChild(fileInfo);
        fileItem.appendChild(fileActions);
        backupFilesList.appendChild(fileItem);
      });
      
      backupFilesSection.style.display = 'block';
    } else if (backupFilesList) {
      // Show "no backups" message
      backupFilesList.innerHTML = '<div class="no-backups-message">No backup files found</div>';
      backupFilesSection.style.display = 'block';
    }
    
    console.log('[Backup Info] Refreshed backup info:', backupInfo);
  } catch (error) {
    console.error('[Backup Info] Failed to refresh backup info:', error);
  }
}

// Function to delete a backup file - FIXED TO PREVENT FREEZING
async function deleteBackupFile(fileName) {
  // Find the delete button for this file to provide visual feedback
  const deleteButtons = document.querySelectorAll('.backup-delete-btn');
  let currentDeleteBtn = null;
  
  deleteButtons.forEach(btn => {
    if (btn.onclick && btn.onclick.toString().includes(fileName)) {
      currentDeleteBtn = btn;
    }
  });

  try {
    const confirmed = await showModal({
      type: 'warning',
      title: 'Delete Backup',
      message: `Are you sure you want to delete the backup file "${fileName}"?\n\nThis action cannot be undone.`,
      confirmText: 'Delete Backup'
    });
    
    if (confirmed) {
      // Add visual feedback to button
      if (currentDeleteBtn) {
        currentDeleteBtn.disabled = true;
        currentDeleteBtn.classList.add('processing');
        currentDeleteBtn.innerHTML = '<span>⏳</span> Deleting...';
      }

      try {
        console.log('[Delete Backup] Starting deletion of:', fileName);
        
        // Set up a timeout to show extended progress for large files
        let progressTimeout = null;
        let progressStep = 0;
        const progressMessages = [
          '<span>⏳</span> Deleting...',
          '<span>🗂️</span> Removing files...',
          '<span>📁</span> Cleaning directories...',
          '<span>🧹</span> Finalizing cleanup...'
        ];
        
        // Start progress animation for longer operations
        progressTimeout = setInterval(() => {
          if (currentDeleteBtn) {
            progressStep = (progressStep + 1) % progressMessages.length;
            currentDeleteBtn.innerHTML = progressMessages[progressStep];
          }
        }, 2000); // Change message every 2 seconds
        
        const result = await window.backupAPI.deleteBackup(fileName);
        
        // Clear progress animation
        if (progressTimeout) {
          clearInterval(progressTimeout);
        }
        
        console.log('[Delete Backup] Success:', result);
        
        // Show completion feedback briefly
        if (currentDeleteBtn) {
          currentDeleteBtn.innerHTML = '<span>✅</span> Deleted!';
          currentDeleteBtn.classList.remove('processing');
          currentDeleteBtn.classList.add('success');
        }
        
        // Refresh the backup info to update the list
        await refreshBackupInfo();
        
        // Show success message with delay to prevent UI conflicts
        showNotification(`Backup "${fileName}" deleted successfully`, 'success');
        
      } catch (error) {
        console.error('[Delete Backup] Error:', error);
        
        // Clear any ongoing progress animation
        if (progressTimeout) {
          clearInterval(progressTimeout);
        }
        
        // Restore button state on error
        if (currentDeleteBtn) {
          currentDeleteBtn.disabled = false;
          currentDeleteBtn.classList.remove('processing');
          currentDeleteBtn.innerHTML = '<span>🗑️</span> Delete';
        }
        
        // Show more specific error messages
        let errorMessage = 'Failed to delete backup: ' + error.message;
        if (error.message.includes('timeout')) {
          errorMessage = 'Backup deletion timed out. The backup may be very large. Please try again or delete manually.';
        } else if (error.message.includes('in use')) {
          errorMessage = 'Cannot delete backup: files are currently in use. Please close any programs that might be accessing the backup.';
        } else if (error.message.includes('access denied')) {
          errorMessage = 'Cannot delete backup: access denied. Try running PC Buddy as administrator.';
        }
        
        showNotification(errorMessage, 'error');
      }
    }
  } catch (error) {
    console.error('[Delete Backup] Modal error:', error);
    
    // Restore button state on error
    if (currentDeleteBtn) {
      currentDeleteBtn.disabled = false;
      currentDeleteBtn.classList.remove('processing');
      currentDeleteBtn.innerHTML = '<span>🗑️</span> Delete';
    }
    
    showNotification('An error occurred while showing the confirmation dialog', 'error');
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
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
      themeSelect.value = theme;
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
    
    // Update all version displays dynamically
    if (window.systemInfoAPI?.getAppVersion) {
      const version = `v${window.systemInfoAPI.getAppVersion()}`;
      
      const aboutVersion = document.getElementById('aboutVersion');
      if (aboutVersion) {
        aboutVersion.textContent = version;
      }
      
      const loadingVersion = document.getElementById('loadingVersion');
      if (loadingVersion) {
        loadingVersion.textContent = version;
      }
      
      const sidebarVersion = document.getElementById('sidebarVersion');
      if (sidebarVersion) {
        sidebarVersion.textContent = version;
      }
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

    // Add switching class to body to optimize performance
    document.body.classList.add('switching-sections');

    // Disable masonry animations during section switch and store current instances
    const currentMasonryInstances = Array.from(masonryInstances.entries());
    currentMasonryInstances.forEach(([section, masonry]) => {
      masonry.container.classList.add('switching-sections');
    });

    // Hide all sections with optimized fade-out
    sections.forEach(section => {
      section.style.opacity = '0';
      section.style.transform = 'translateY(10px)';
      section.style.pointerEvents = 'none';
    });

    // Update sidebar immediately
    sidebarItems.forEach(item => {
      item.classList.toggle('active', item.dataset.section === sectionId);
    });

    // Wait for fade-out to complete, then switch sections
    setTimeout(() => {
      // Hide old sections efficiently
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
        
        // Clean up old masonry instances first
        setTimeout(() => {
          // Destroy old masonry instances that are no longer active
          currentMasonryInstances.forEach(([section, masonry]) => {
            if (!section.classList.contains('active')) {
              masonry.destroy();
              masonryInstances.delete(section);
            }
          });
          
          // Ensure all switching-sections classes are removed before creating new instances
          document.querySelectorAll('.switching-sections').forEach(element => {
            element.classList.remove('switching-sections');
          });
          document.body.classList.remove('switching-sections');
          
          // Initialize masonry for active section
          initMasonryLayout();
          
          // Wait for masonry to initialize before fading in
          setTimeout(() => {
            // Fade in the new section with hardware acceleration
            targetSection.style.opacity = '1';
            targetSection.style.transform = 'translateY(0)';
            targetSection.style.pointerEvents = '';
            
            // Final cleanup after fade-in completes
            setTimeout(() => {
              // Reset all section styles
              sections.forEach(section => {
                section.style.display = '';
                section.style.opacity = '';
                section.style.transform = '';
                section.style.pointerEvents = '';
              });
              
              // Ensure no switching classes remain anywhere
              document.querySelectorAll('.switching-sections').forEach(element => {
                element.classList.remove('switching-sections');
              });
              
              window.switchingSections = false;
            }, 200); // Wait for fade-in animation to complete
          }, 100); // Wait for masonry to initialize
        }, 50); // Wait for section to be visible
      } else {
        // Clean up if section not found
        document.body.classList.remove('switching-sections');
        document.querySelectorAll('.switching-sections').forEach(element => {
          element.classList.remove('switching-sections');
        });
        window.switchingSections = false;
      }
    }, 150); // Reduced fade-out wait time
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
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    
    // Add transitioning class to prevent layout thrashing
    sidebar.classList.add('transitioning');
    
    // Use shorter, more responsive delay for masonry updates
    setTimeout(() => {
      masonryInstances.forEach(masonry => {
        if (masonry.container.classList.contains('active')) {
          masonry.handleResize();
        }
      });
    }, 250); // Reduced from 350ms for more responsive feel
    
    // Remove transitioning class after transition completes
    setTimeout(() => {
      sidebar.classList.remove('transitioning');
    }, 300); // Match CSS transition duration
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
                  <span class="memory-stat-value">${info.totalMemory}</span>
                  <span class="memory-stat-label">Total</span>
                </div>
                <div class="memory-stat">
                  <span class="memory-stat-value">${info.usedMemory}</span>
                  <span class="memory-stat-label">Used</span>
                </div>
                <div class="memory-stat">
                  <span class="memory-stat-value">${info.availableMemory}</span>
                  <span class="memory-stat-label">Available</span>
                </div>
              </div>
              <div class="memory-bar">
                <div class="memory-fill" style="width: ${usagePercent}%"></div>
              </div>
              <div class="memory-percentage">${usagePercent}% used</div>
            </div>
          `;
        }
        
        // Create elements safely without innerHTML for dynamic content
        const headerDiv = document.createElement('div');
        headerDiv.className = 'system-info-header';
        
        const iconSpan = document.createElement('span');
        iconSpan.className = 'system-info-icon';
        iconSpan.textContent = item.icon; // Safe - no HTML
        
        const labelSpan = document.createElement('span');
        labelSpan.className = 'system-info-label';
        labelSpan.textContent = item.label; // Safe - no HTML
        
        headerDiv.appendChild(iconSpan);
        headerDiv.appendChild(labelSpan);
        
        const valueDiv = document.createElement('div');
        valueDiv.className = 'system-info-value';
        
        if (item.key === 'memory') {
          // For memory, we need to create the complex structure safely
          valueDiv.innerHTML = valueContent; // This is safe - valueContent is constructed from safe data
        } else {
          valueDiv.textContent = info[item.key] || 'N/A'; // Safe - no HTML
        }
        
        itemEl.appendChild(headerDiv);
        itemEl.appendChild(valueDiv);
        
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

        // Create header
        const diskHeader = document.createElement('div');
        diskHeader.className = 'disk-header';
        
        const diskInfo = document.createElement('div');
        diskInfo.className = 'disk-info';
        
        const diskName = document.createElement('span');
        diskName.className = 'disk-name';
        diskName.textContent = `${disk.Name}:`; // Safe - escaped
        diskInfo.appendChild(diskName);
        
        if (disk.IsSystem) {
          const systemBadge = document.createElement('span');
          systemBadge.className = 'system-badge';
          systemBadge.textContent = 'System';
          diskInfo.appendChild(systemBadge);
        }
        
        const diskPercentage = document.createElement('div');
        diskPercentage.className = 'disk-percentage';
        diskPercentage.textContent = `${disk.PercentUsed}%`; // Safe - escaped
        
        diskHeader.appendChild(diskInfo);
        diskHeader.appendChild(diskPercentage);
        
        // Create progress bar
        const progressBar = document.createElement('div');
        progressBar.className = 'disk-progress-bar';
        
        const progressFill = document.createElement('div');
        progressFill.className = 'disk-progress-fill';
        progressFill.style.width = `${disk.PercentUsed}%`;
        progressFill.style.backgroundColor = usageColor;
        
        progressBar.appendChild(progressFill);
        
        // Create details
        const diskDetails = document.createElement('div');
        diskDetails.className = 'disk-details';
        
        const diskUsed = document.createElement('span');
        diskUsed.className = 'disk-used';
        diskUsed.textContent = `${disk.UsedGB} GB used`; // Safe - escaped
        
        const diskFree = document.createElement('span');
        diskFree.className = 'disk-free';
        diskFree.textContent = `${disk.FreeGB} GB free`; // Safe - escaped
        
        const diskTotal = document.createElement('span');
        diskTotal.className = 'disk-total';
        diskTotal.textContent = `of ${disk.TotalGB} GB`; // Safe - escaped
        
        diskDetails.appendChild(diskUsed);
        diskDetails.appendChild(diskFree);
        diskDetails.appendChild(diskTotal);
        
        // Create clean button
        const cleanBtn = document.createElement('button');
        cleanBtn.className = 'disk-clean-btn';
        cleanBtn.dataset.drive = disk.Name; // Safe - attribute
        
        const btnIcon = document.createElement('span');
        btnIcon.className = 'btn-icon';
        btnIcon.textContent = '🧹';
        
        cleanBtn.appendChild(btnIcon);
        cleanBtn.appendChild(document.createTextNode(' Clean Drive'));
        
        // Assemble the card
        diskCard.appendChild(diskHeader);
        diskCard.appendChild(progressBar);
        diskCard.appendChild(diskDetails);
        diskCard.appendChild(cleanBtn);

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
  
  // Load network information
  try {
    console.log('[Network] Starting network info load...');
    await refreshNetworkInfo();
    markComponentLoaded('networkInfo');
  } catch (error) {
    console.error('Failed to load network information:', error);
    const networkInfoGrid = document.getElementById('networkInfoGrid');
    if (networkInfoGrid) {
      networkInfoGrid.innerHTML = '<div class="error-message">Failed to load network information</div>';
    }
    // Still mark as loaded even on error to prevent hanging
    markComponentLoaded('networkInfo');
  }
  
  // Load network adapters
  try {
    console.log('[Network] Starting network adapters load...');
    await refreshNetworkAdapters();
    markComponentLoaded('networkAdapters');
  } catch (error) {
    console.error('Failed to load network adapters:', error);
    const networkAdaptersGrid = document.getElementById('networkAdaptersGrid');
    if (networkAdaptersGrid) {
      networkAdaptersGrid.innerHTML = '<div class="error-message">Failed to load network adapters</div>';
    }
    // Still mark as loaded even on error to prevent hanging
    markComponentLoaded('networkAdapters');
  }
  
  // Initialize masonry layout
  initMasonryLayout();
  
  // Mark masonry as initialized
  setTimeout(() => {
    markComponentLoaded('masonryInitialized');
  }, 1000); // Give masonry time to calculate initial layout
  
  // Initialize custom shortcuts
  loadCustomShortcuts();

  // Handle window resize for masonry layout with improved debouncing
  let windowResizeTimeout;
  let isWindowResizing = false;
  
  window.addEventListener('resize', () => {
    clearTimeout(windowResizeTimeout);
    
    // Set flag to prevent layout calculations during rapid resize events
    if (!isWindowResizing) {
      isWindowResizing = true;
      document.body.classList.add('window-resizing');
    }
    
    windowResizeTimeout = setTimeout(() => {
      masonryInstances.forEach(masonry => {
        if (masonry.container.classList.contains('active')) {
          masonry.handleResize();
        }
      });
      
      // Clean up resizing state
      setTimeout(() => {
        isWindowResizing = false;
        document.body.classList.remove('window-resizing');
      }, 100);
    }, 100); // Reduced from 150ms for better responsiveness
  });

  // -------------------------
  // Settings Event Handlers
  // -------------------------
  
  // Theme selection dropdown
  document.getElementById('themeSelect')?.addEventListener('change', (e) => {
    const theme = e.target.value;
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
                <span class="memory-stat-value">${info.totalMemory}</span>
                <span class="memory-stat-label">Total</span>
              </div>
              <div class="memory-stat">
                <span class="memory-stat-value">${info.usedMemory}</span>
                <span class="memory-stat-label">Used</span>
              </div>
              <div class="memory-stat">
                <span class="memory-stat-value">${info.availableMemory}</span>
                <span class="memory-stat-label">Available</span>
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

  // Initialize custom shortcuts on page load
  loadCustomShortcuts();
  
  // Add event listener for browse button in custom shortcut modal
  const browsePathButton = document.getElementById('browsePathButton');
  const shortcutPathInput = document.getElementById('shortcutPath');
  
  if (browsePathButton && shortcutPathInput && window.shortcutAPI) {
    browsePathButton.addEventListener('click', async () => {
      try {
        console.log('[Custom Shortcut] Browse button clicked - opening file/folder selection dialog');
        browsePathButton.disabled = true;
        browsePathButton.textContent = 'Selecting...';
        
        const selectedPath = await window.shortcutAPI.selectFileOrFolder();
        console.log('[Custom Shortcut] User selected path:', selectedPath);
        
        // Automatically fill the input with the selected path
        shortcutPathInput.value = selectedPath;
        shortcutPathInput.title = selectedPath; // Show full path on hover
        
        // Reset placeholder text
        shortcutPathInput.placeholder = 'Selected: ' + selectedPath.split('\\').pop();
        
      } catch (error) {
        console.error('[Custom Shortcut] Failed to select file/folder:', error);
        if (error.message !== 'No file or folder selected') {
          alert('Failed to open file selection: ' + error.message);
        }
      } finally {
        browsePathButton.disabled = false;
        browsePathButton.textContent = 'Select File/Folder';
      }
    });
  } else {
    console.log('[Custom Shortcut] Browse functionality not available - missing elements or API');
  }
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
// Modal System - ENHANCED TO PREVENT FREEZING
// -------------------------

// Track active modals to prevent stacking
let activeModalCount = 0;
const MAX_MODALS = 1;

async function showModal({ type = 'info', title, message, confirmText = 'OK', cancelText = 'Cancel', showCancel = true }) {
  return new Promise((resolve, reject) => {
    // Prevent too many modals from stacking
    if (activeModalCount >= MAX_MODALS) {
      console.warn('[showModal] Maximum modals reached, rejecting new modal request');
      reject(new Error('Maximum modals reached'));
      return;
    }

    activeModalCount++;
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = 1000 + activeModalCount;

    // Add cleanup function
    const cleanup = (result) => {
      try {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        activeModalCount = Math.max(0, activeModalCount - 1);
        resolve(result);
      } catch (error) {
        console.error('[showModal] Cleanup error:', error);
        activeModalCount = Math.max(0, activeModalCount - 1);
        resolve(false);
      }
    };

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
      cancelBtn.onclick = () => cleanup(false);
      actions.appendChild(cancelBtn);
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.className = `modal-button ${type}`;
    confirmBtn.textContent = confirmText;
    confirmBtn.onclick = () => cleanup(true);
    actions.appendChild(confirmBtn);

    content.appendChild(actions);
    overlay.appendChild(content);

    try {
      document.body.appendChild(overlay);
    } catch (error) {
      console.error('[showModal] Error appending overlay:', error);
      activeModalCount = Math.max(0, activeModalCount - 1);
      reject(error);
      return;
    }

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup(false);
      }
    });

    // Close on Escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', escapeHandler);
        cleanup(false);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Focus the confirm button with error handling
    setTimeout(() => {
      try {
        if (confirmBtn && confirmBtn.focus) {
          confirmBtn.focus();
        }
      } catch (error) {
        console.warn('[showModal] Focus error:', error);
      }
    }, 100);

    // Auto-cleanup after 30 seconds to prevent hanging
    setTimeout(() => {
      if (overlay.parentNode) {
        console.warn('[showModal] Auto-cleanup triggered for hanging modal');
        cleanup(false);
      }
    }, 30000);
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
    
    // Don't resize during section switching or window resizing
    if (window.switchingSections || document.body.classList.contains('window-resizing')) {
      return;
    }
    
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
        
        // Update card widths efficiently with transform3d
        this.cards.forEach(card => {
          card.style.width = `${this.cardWidth}px`;
          // Ensure hardware acceleration is maintained
          if (!card.style.transform || !card.style.transform.includes('translate3d')) {
            card.style.transform = 'translate3d(0, 0, 0)';
          }
        });
        
        // Wait a frame for width changes to apply, then recalculate
        requestAnimationFrame(() => {
          this.calculateLayout(true);
          
          // Clean up resize state with shorter timing
          setTimeout(() => {
            this.container.classList.remove('resizing');
            this.isResizing = false;
          }, 250); // Reduced from 300ms
        });
      } else {
        // Just recalculate positions without width changes
        this.calculateLayout(true);
        
        setTimeout(() => {
          this.container.classList.remove('resizing');
          this.isResizing = false;
        }, 250); // Reduced from 300ms
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
    
    // Ensure the section doesn't have any stuck switching classes
    section.classList.remove('switching-sections');
    
    // Ensure all cards have proper transitions enabled
    cards.forEach(card => {
      card.style.transition = '';
      if (!card.style.transform || !card.style.transform.includes('translate3d')) {
        card.style.transform = 'translate3d(0, 0, 0)';
      }
    });
    
    // Create new masonry instance
    const masonry = new MasonryLayout(section, { gap: 20 });
    masonryInstances.set(section, masonry);
  });
}

// Add function to restore smoothness if it gets stuck
function restoreSmoothAnimations() {
  console.log('[Smoothness] Restoring smooth animations...');
  
  // Remove any stuck switching classes
  document.querySelectorAll('.switching-sections').forEach(element => {
    element.classList.remove('switching-sections');
  });
  
  // Remove body-level classes that might be stuck
  document.body.classList.remove('switching-sections', 'window-resizing');
  
  // Reset all tool cards to have proper animations
  document.querySelectorAll('.tool-card').forEach(card => {
    card.style.transition = '';
    card.style.willChange = 'transform';
    if (!card.style.transform || !card.style.transform.includes('translate3d')) {
      card.style.transform = 'translate3d(0, 0, 0)';
    }
  });
  
  // Reset sidebar transitions
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.remove('transitioning');
  }
  
  // Refresh all masonry instances
  masonryInstances.forEach(masonry => {
    masonry.container.classList.remove('switching-sections', 'resizing');
    masonry.refresh();
  });
  
  // Reset switching state
  window.switchingSections = false;
  
  console.log('[Smoothness] Smooth animations restored!');
}

// Make the restore function available globally for debugging
window.restoreSmoothness = restoreSmoothAnimations;

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
    
    // Create shortcut icon
    const shortcutIcon = document.createElement('span');
    shortcutIcon.className = 'shortcut-icon';
    shortcutIcon.textContent = shortcut.icon; // Safe - escaped
    
    // Create shortcut label
    const shortcutLabel = document.createElement('span');
    shortcutLabel.className = 'shortcut-label';
    shortcutLabel.textContent = shortcut.name; // Safe - escaped
    
    // Create actions container
    const shortcutActions = document.createElement('div');
    shortcutActions.className = 'shortcut-actions';
    
    // Create edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'shortcut-action-btn edit';
    editBtn.textContent = '✏️';
    editBtn.title = 'Edit';
    editBtn.onclick = () => editCustomShortcut(index);
    
    // Create delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'shortcut-action-btn delete';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete';
    deleteBtn.onclick = () => deleteCustomShortcut(index);
    
    shortcutActions.appendChild(editBtn);
    shortcutActions.appendChild(deleteBtn);
    
    // Assemble the shortcut element
    shortcutElement.appendChild(shortcutIcon);
    shortcutElement.appendChild(shortcutLabel);
    shortcutElement.appendChild(shortcutActions);
    
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
  const name = validateAndSanitizeInput(document.getElementById('shortcutName').value, 50);
  const path = validateAndSanitizeInput(document.getElementById('shortcutPath').value, 260);
  const icon = document.getElementById('iconPreview').textContent;
  
  // Enhanced validation
  if (!name || name.length < 1) {
    alert('Please enter a valid shortcut name (1-50 characters).');
    return;
  }
  
  if (!path || !validateShortcutPath(path)) {
    alert('Please enter a valid file path, folder path, or URL.');
    return;
  }
  
  // Validate icon is a single emoji character
  if (!icon || icon.length > 4) { // Emojis can be up to 4 bytes
    alert('Please select a valid emoji icon.');
    return;
  }
  
  const shortcuts = JSON.parse(localStorage.getItem('customShortcuts') || '[]');
  const shortcut = { name, path, icon };
  
  if (editingShortcutId !== null) {
    shortcuts[editingShortcutId] = shortcut;
  } else {
    // Limit total number of shortcuts to prevent abuse
    if (shortcuts.length >= 20) {
      alert('Maximum number of custom shortcuts (20) reached.');
      return;
    }
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
  
  // Additional security validation before opening
  if (!path || typeof path !== 'string') {
    console.error('[Security] Invalid path provided to openCustomShortcut');
    return;
  }
  
  // Sanitize the path
  const sanitizedPath = validateAndSanitizeInput(path, 260);
  
  if (!validateShortcutPath(sanitizedPath)) {
    console.error('[Security] Invalid path format:', sanitizedPath);
    alert('Invalid shortcut path format');
    return;
  }
  
  // Determine if it's a URL or file path
  if (sanitizedPath.startsWith('http://') || sanitizedPath.startsWith('https://')) {
    // Open URL in default browser
    const promise = window.electronAPI && window.electronAPI.openExternal ? 
      window.electronAPI.openExternal(sanitizedPath) : 
      shell.openExternal(sanitizedPath);
    
    promise.then(() => {
      console.log('[customShortcut] URL opened successfully');
    }).catch(error => {
      console.error('[customShortcut] Failed to open URL:', error);
      alert('Failed to open URL. Please check the URL format.');
    });
  } else {
    // Open file/folder path
    const promise = window.systemAPI?.openPath ? 
      window.systemAPI.openPath(sanitizedPath) : 
      shell.openPath(sanitizedPath);
    
    promise.then(() => {
      console.log('[customShortcut] Path opened successfully');
    }).catch(error => {
      console.error('[customShortcut] Failed to open path:', error);
      alert('Failed to open shortcut. Please check the path format.');
    });
  }
}

// Enhanced input validation and sanitization
function validateAndSanitizeInput(input, maxLength = 100) {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove potentially dangerous characters but preserve Windows path characters
  const sanitized = input
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/^\s+|\s+$/g, '') // Trim whitespace
    .substring(0, maxLength);
    
  return sanitized;
}

function validateShortcutPath(path) {
  if (!path || typeof path !== 'string') {
    return false;
  }
  
  // Allow URLs, Windows file paths, and UNC paths
  const validPatterns = [
    /^https?:\/\/.+/i, // HTTP/HTTPS URLs
    /^[a-zA-Z]:\\.+/i, // Windows drive paths (C:\...)
    /^\\\\[^\\]+\\.+/i, // UNC paths (\\server\share)
    /^%.+%/i // Environment variables (%USERPROFILE%, etc.)
  ];
  
  // Check if path matches any valid pattern
  const isValidFormat = validPatterns.some(pattern => pattern.test(path));
  
  // Block dangerous patterns but allow legitimate Windows paths
  const dangerousPatterns = [
    /\.\./,                    // Directory traversal
    /[<>"|?*]/,               // Invalid Windows path chars (excluding colon for drive letters)
    /javascript:/i,           // JavaScript protocol
    /vbscript:/i,            // VBScript protocol
    /data:/i,                 // Data protocol
    /script:/i                // Script protocol
  ];
  
  const hasDangerousPattern = dangerousPatterns.some(pattern => pattern.test(path));
  
  return isValidFormat && !hasDangerousPattern;
}

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
  networkInfo: false,
  networkAdapters: false,
  settingsInitialized: false,
  masonryInitialized: false
};

let loadingTimeout = null;
let minimumLoadingTime = 5000; // Minimum 5 seconds loading time
let loadingStartTime = Date.now();

function markComponentLoaded(component) {
  console.log(`[Loading] Component loaded: ${component}`);
  componentsLoaded[component] = true;
  
  // Use immediate execution to avoid pause when minimized
  updateLoadingProgress();
  checkAllComponentsLoaded();
}

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
    
    // Use immediate execution when possible, fallback to setTimeout for delay
    if (remainingTime <= 0) {
      // Hide immediately if minimum time has passed
      console.log('[Loading] Hiding loading screen immediately');
      loadingScreen.classList.add('hidden');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 500); // Wait for fade animation
    } else {
      // Wait for minimum loading time, but check periodically if minimized
      let waitTime = 0;
      const checkInterval = setInterval(() => {
        waitTime += 100;
        if (waitTime >= remainingTime + 2000) { // Extra 2s after minimum time
          clearInterval(checkInterval);
          console.log('[Loading] Hiding loading screen after minimum wait');
          loadingScreen.classList.add('hidden');
          setTimeout(() => {
            loadingScreen.style.display = 'none';
          }, 500); // Wait for fade animation
        }
      }, 100); // Check every 100ms instead of single setTimeout
    }
  }
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
    } else if (percentage < 15) {
      loadingText.textContent = 'Loading system information...';
    } else if (percentage < 25) {
      loadingText.textContent = 'Loading startup programs...';
    } else if (percentage < 35) {
      loadingText.textContent = 'Loading backup information...';
    } else if (percentage < 50) {
      loadingText.textContent = 'Analyzing disk usage...';
    } else if (percentage < 65) {
      loadingText.textContent = 'Loading network information...';
    } else if (percentage < 75) {
      loadingText.textContent = 'Loading network adapters...';
    } else if (percentage < 85) {
      loadingText.textContent = 'Initializing settings...';
    } else if (percentage < 95) {
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

// Initialize custom shortcuts on page load
document.addEventListener('DOMContentLoaded', () => {
  loadCustomShortcuts();
});

// ====================================
// NETWORK PAGE FUNCTIONALITY
// ====================================

// Global network data storage
let currentNetworkInfo = null;
let lastConnectivityResult = null;

// Helper function to get user-friendly adapter name and type (moved to global scope)
function getAdapterInfo(adapter) {
  const name = adapter.name.toLowerCase();
  
  console.log('🔍 [getAdapterInfo] Analyzing adapter:', adapter.name, 'addresses:', adapter.addresses.length);
  
  // Determine adapter type and friendly name with more flexible detection
  if (name.includes('loopback') || name.includes('pseudo')) {
    console.log('🔍 [getAdapterInfo] Detected as: System (Loopback)');
    return { 
      friendlyName: 'Loopback Interface', 
      type: 'System', 
      icon: '🔄',
      description: 'Internal system interface'
    };
  } 
  
  // Enhanced Wi-Fi detection - check for common patterns
  else if (name.includes('wi-fi') || name.includes('wireless') || name.includes('wifi') || 
           name.includes('wlan') || name.includes('802.11') || name.includes('rz616') ||
           name.includes('wifi 6e') || name.includes('wireless lan')) {
    console.log('🔍 [getAdapterInfo] Detected as: Wireless (Wi-Fi)');
    return { 
      friendlyName: 'Wi-Fi Adapter', 
      type: 'Wireless', 
      icon: '📶',
      description: 'Wireless network connection'
    };
  } 
  
  // Enhanced Ethernet detection - check for common patterns and your specific adapter
  else if (name.includes('ethernet') || name.includes('local area connection') || 
           name.includes('lan') || name.includes('realtek') || name.includes('intel') ||
           name.includes('broadcom') || name.includes('marvell') || name.includes('killer') ||
           name.includes('gaming') || name.includes('2.5gbe') || name.includes('gigabit') ||
           name.includes('realtek gaming') || name.includes('family controller')) {
    console.log('🔍 [getAdapterInfo] Detected as: Wired (Ethernet)');
    return { 
      friendlyName: 'Ethernet Adapter', 
      type: 'Wired', 
      icon: '🌐',
      description: 'Wired network connection'
    };
  } 
  
  else if (name.includes('bluetooth') || name.includes('bt') || name.includes('personal area network')) {
    console.log('🔍 [getAdapterInfo] Detected as: Bluetooth');
    return { 
      friendlyName: 'Bluetooth Adapter', 
      type: 'Bluetooth', 
      icon: '🔵',
      description: 'Bluetooth network interface'
    };
  } 
  
  else if (name.includes('teredo') || name.includes('6to4') || name.includes('isatap')) {
    console.log('🔍 [getAdapterInfo] Detected as: Virtual (IPv6 Tunnel)');
    return { 
      friendlyName: 'IPv6 Tunnel', 
      type: 'Virtual', 
      icon: '🌉',
      description: 'IPv6 tunneling interface'
    };
  } 
  
  else if (name.includes('vmware') || name.includes('virtualbox') || name.includes('hyper-v') ||
           name.includes('virtual') || name.includes('microsoft wi-fi direct')) {
    console.log('🔍 [getAdapterInfo] Detected as: Virtual (VM/Direct)');
    return { 
      friendlyName: 'Virtual Machine Network', 
      type: 'Virtual', 
      icon: '💻',
      description: 'Virtual machine network adapter'
    };
  } 
  
  else if (name.includes('vpn') || name.includes('tap') || name.includes('tun') ||
           name.includes('openvpn') || name.includes('nordvpn')) {
    console.log('🔍 [getAdapterInfo] Detected as: VPN');
    return { 
      friendlyName: 'VPN Adapter', 
      type: 'VPN', 
      icon: '🔒',
      description: 'VPN network interface'
    };
  } 
  
  else {
    // Try to guess if it's a physical adapter based on common patterns
    if (name.includes('adapter') || name.includes('nic') || name.includes('card') ||
        name.includes('connection') || /^[a-z]+ \d+$/.test(name)) {
      console.log('🔍 [getAdapterInfo] Detected as: Physical (Generic)');
      return { 
        friendlyName: 'Network Adapter', 
        type: 'Physical', 
        icon: '🔗',
        description: 'Network interface'
      };
    }
    console.log('🔍 [getAdapterInfo] Detected as: Other (Unknown)');
    return { 
      friendlyName: 'Unknown Network Interface', 
      type: 'Other', 
      icon: '❓',
      description: 'Unrecognized network interface'
    };
  }
}

// Helper function to check if network API is available
function isNetworkAPIAvailable() {
  if (!window.networkAPI) {
    console.error('[Network] networkAPI is not available on window object');
    showNotification('❌ Network functionality is not available. Please restart the application.', 'error');
    return false;
  }
  return true;
}

// Refresh network information
async function refreshNetworkInfo() {
  console.log('[Network] refreshNetworkInfo called');
  
  if (!isNetworkAPIAvailable()) return;
  
  const networkInfoGrid = document.getElementById('networkInfoGrid');
  const refreshBtn = document.querySelector('#networkInfoCard .tool-btn.secondary');
  
  if (!networkInfoGrid) {
    console.log('[Network] No networkInfoGrid found, exiting');
    return;
  }
  
  // Show loading state
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<span class="btn-icon">🔄</span> Loading...';
  }
  
  networkInfoGrid.innerHTML = '<div class="loading-message">🔄 Loading network information...</div>';
  
  try {
    console.log('[Network] About to call getNetworkInfo...');
    const networkInfo = await window.networkAPI.getNetworkInfo();
    console.log('[Network] Network info received:', networkInfo);
    
    currentNetworkInfo = networkInfo;
    
    // Build info grid HTML
    let infoHtml = '';
    
    // Basic network information
    if (networkInfo.hostname) {
      infoHtml += `<div class="system-info-item" data-type="hostname">
        <div class="system-info-header">
          <span class="system-info-icon">💻</span>
          <span class="system-info-label">Computer Name</span>
        </div>
        <div class="system-info-value">${networkInfo.hostname}</div>
      </div>`;
    }
    
    if (networkInfo.localIPv4) {
      infoHtml += `<div class="system-info-item" data-type="local-ip">
        <div class="system-info-header">
          <span class="system-info-icon">🏠</span>
          <span class="system-info-label">Local IP Address</span>
        </div>
        <div class="system-info-value">${networkInfo.localIPv4}</div>
      </div>`;
    }
    
    if (networkInfo.publicIPv4) {
      infoHtml += `<div class="system-info-item" data-type="public-ip">
        <div class="system-info-header">
          <span class="system-info-icon">🌐</span>
          <span class="system-info-label">Public IP Address</span>
        </div>
        <div class="system-info-value">${networkInfo.publicIPv4}</div>
      </div>`;
    }
    
    if (networkInfo.dnsServers && networkInfo.dnsServers.length > 0) {
      // Show primary DNS server
      if (networkInfo.dnsServers[0]) {
        infoHtml += `<div class="system-info-item" data-type="primary-dns">
          <div class="system-info-header">
            <span class="system-info-icon">🔍</span>
            <span class="system-info-label">Primary DNS Server</span>
          </div>
          <div class="system-info-value">${networkInfo.dnsServers[0]}</div>
        </div>`;
      }
      
      // Show secondary DNS server if available
      if (networkInfo.dnsServers[1]) {
        infoHtml += `<div class="system-info-item" data-type="secondary-dns">
          <div class="system-info-header">
            <span class="system-info-icon">🔍</span>
            <span class="system-info-label">Secondary DNS Server</span>
          </div>
          <div class="system-info-value">${networkInfo.dnsServers[1]}</div>
        </div>`;
      }
    }
    
    if (networkInfo.location && networkInfo.location !== 'Unable to retrieve') {
      infoHtml += `<div class="network-info-item">
        <div class="network-info-header">
          <span class="network-info-icon">📍</span>
          <span class="network-info-label">Location</span>
        </div>
        <div class="network-info-value">${networkInfo.location}</div>
      </div>`;
    }
    
    if (networkInfo.isp && networkInfo.isp !== 'Unable to retrieve') {
      infoHtml += `<div class="network-info-item">
        <div class="network-info-header">
          <span class="network-info-icon">🏢</span>
          <span class="network-info-label">Internet Provider</span>
        </div>
        <div class="network-info-value">${networkInfo.isp}</div>
      </div>`;
    }
    
    if (!infoHtml) {
      infoHtml = '<div class="network-info-item"><div class="network-info-label">No network information available</div></div>';
    }
    
    networkInfoGrid.innerHTML = infoHtml;
    console.log('[Network] Network info displayed successfully');
    
  } catch (error) {
    console.error('[Network] Error getting network info:', error);
    networkInfoGrid.innerHTML = `<div class="error-message">❌ Unable to Load Network Information<br><br>Error: ${error.message}</div>`;
  }
  
  // Reset button state
  if (refreshBtn) {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = '<span class="btn-icon">🔄</span> Refresh My Network Info';
  }
}

// Test connectivity to a target
async function testConnectivity() {
  console.log('[Network] testConnectivity called');
  
  if (!isNetworkAPIAvailable()) return;
  
  const targetInput = document.getElementById('connectivityTarget');
  const resultsContainer = document.getElementById('connectivityResults');
  const statusDiv = document.getElementById('connectivityStatus');
  const detailsDiv = document.getElementById('connectivityDetails');
  const advancedBtn = document.getElementById('advancedTraceBtn');
  const traceResults = document.getElementById('traceResults');
  
  if (!targetInput) {
    showNotification('❌ Cannot find connectivity input field', 'error');
    return;
  }
  
  const target = targetInput.value.trim();
  
  console.log('[Network] Target:', target);
  
  if (!target) {
    showNotification('Please enter a website name or IP address to test (like google.com or 8.8.8.8).', 'error');
    return;
  }
  
  // Show loading state
  if (statusDiv) statusDiv.innerHTML = '<div class="connectivity-status">🔄<br>Testing...</div>';
  if (resultsContainer) resultsContainer.style.display = 'none'; // Hide results container initially
  if (detailsDiv) detailsDiv.innerHTML = '';
  if (advancedBtn) advancedBtn.style.display = 'none';
  if (traceResults) {
    traceResults.innerHTML = '';
    traceResults.style.display = 'none'; // Hide trace results from previous tests
  }
  
  // Show loading message and start progress animation
  const loadingMessage = document.querySelector('#connectivityTestCard .loadingMessage');
  const progressFill = document.getElementById('connectionProgressFill');
  const progressText = document.getElementById('connectionProgressText');
  
  if (loadingMessage) loadingMessage.style.display = 'block';
  
  // Animate progress bar
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += Math.random() * 15 + 5; // Increment by 5-20%
    if (progress > 90) progress = 90; // Cap at 90% until completion
    
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (progressText) progressText.textContent = `${Math.round(progress)}%`;
  }, 500);
  
  try {
    console.log('[Network] About to test connectivity...');
    const result = await window.networkAPI.testConnectivity(target);
    console.log('[Network] Connectivity test result:', result);
    
    lastConnectivityResult = result;
    
    // Display results
    if (result.success) {
      if (statusDiv) statusDiv.innerHTML = '<div class="connectivity-status success">✅ Connection Successful</div>';
      if (resultsContainer) resultsContainer.style.display = 'block'; // Show results container
      
      let detailsHtml = `<div style="text-align: center; margin-bottom: 15px;">
        <strong style="color: var(--success-color); font-size: 1.1em;">✅ Successfully connected to ${result.target}</strong>
      </div>`;
      
      detailsHtml += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; text-align: center;">`;
      
      detailsHtml += `<div style="padding: 8px; background: rgba(var(--success-color), 0.1); border-radius: 6px;">
        <div style="font-size: 0.85em; color: var(--text-muted); margin-bottom: 4px;">Test Completed</div>
        <div style="font-weight: 600;">${new Date(result.timestamp).toLocaleString()}</div>
      </div>`;
      
      if (result.averageTime) {
        detailsHtml += `<div style="padding: 8px; background: rgba(var(--success-color), 0.1); border-radius: 6px;">
          <div style="font-size: 0.85em; color: var(--text-muted); margin-bottom: 4px;">Response Time</div>
          <div style="font-weight: 600;">${result.averageTime}ms</div>
        </div>`;
      }
      
      if (result.packetLoss !== undefined) {
        const lossColor = result.packetLoss > 0 ? 'var(--warning-color)' : 'var(--success-color)';
        detailsHtml += `<div style="padding: 8px; background: rgba(var(--success-color), 0.1); border-radius: 6px;">
          <div style="font-size: 0.85em; color: var(--text-muted); margin-bottom: 4px;">Packet Loss</div>
          <div style="font-weight: 600; color: ${lossColor};">${result.packetLoss}%</div>
        </div>`;
      }
      
      detailsHtml += `</div>`;
      
      if (detailsDiv) detailsDiv.innerHTML = detailsHtml;
      
      // Show advanced trace button
      if (advancedBtn) {
        advancedBtn.style.display = 'inline-block';
        advancedBtn.onclick = () => showAdvancedTrace(result.target);
      }
      
    } else {
      if (statusDiv) statusDiv.innerHTML = '<div class="connectivity-status error">❌ Connection Failed</div>';
      if (resultsContainer) resultsContainer.style.display = 'block'; // Show results container
      
      let detailsHtml = `<div style="text-align: center; margin-bottom: 15px;">
        <strong style="color: var(--danger-color); font-size: 1.1em;">❌ Could not connect to ${result.target}</strong>
      </div>`;
      
      detailsHtml += `<div style="text-align: center; margin-bottom: 15px;">
        <div style="padding: 8px; background: rgba(var(--danger-color), 0.1); border-radius: 6px; display: inline-block;">
          <div style="font-size: 0.85em; color: var(--text-muted); margin-bottom: 4px;">Test Completed</div>
          <div style="font-weight: 600;">${new Date(result.timestamp).toLocaleString()}</div>
        </div>
      </div>`;
      
      detailsHtml += `<div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 8px; padding: 16px;">`;
      detailsHtml += `<div style="font-weight: 600; margin-bottom: 10px; color: var(--warning-color);">💡 Things to try:</div>`;
      detailsHtml += `<ul style="margin: 0; padding-left: 20px; line-height: 1.6;">`;
      detailsHtml += `<li>Check if the website name is spelled correctly</li>`;
      detailsHtml += `<li>Try a simple website like "google.com"</li>`;
      detailsHtml += `<li>Make sure your internet connection is working</li>`;
      detailsHtml += `<li>Try an IP address like "8.8.8.8"</li>`;
      detailsHtml += `</ul></div>`;
      
      if (detailsDiv) detailsDiv.innerHTML = detailsHtml;
    }
    
    console.log('[Network] Connectivity test completed successfully');
    
    // Complete progress bar
    clearInterval(progressInterval);
    if (progressFill) progressFill.style.width = '100%';
    if (progressText) progressText.textContent = '100%';
    
    // Brief delay to show completion, then hide loading
    setTimeout(() => {
      if (loadingMessage) loadingMessage.style.display = 'none';
    }, 500);
    
  } catch (error) {
    console.error('[Network] Error testing connectivity:', error);
    
    // Complete progress bar even on error
    clearInterval(progressInterval);
    if (progressFill) progressFill.style.width = '100%';
    if (progressText) progressText.textContent = 'Failed';
    
    if (statusDiv) statusDiv.innerHTML = '<div class="connectivity-status error">❌ Test Failed</div>';
    if (resultsContainer) resultsContainer.style.display = 'block'; // Show results container
    
    let detailsHtml = `<div style="text-align: center; margin-bottom: 15px;">
      <strong style="color: var(--danger-color); font-size: 1.1em;">❌ Connection test failed</strong>
    </div>`;
    
    detailsHtml += `<div style="text-align: center; margin-bottom: 15px;">
      <div style="padding: 8px; background: rgba(var(--danger-color), 0.1); border-radius: 6px; display: inline-block;">
        <div style="font-size: 0.85em; color: var(--text-muted); margin-bottom: 4px;">Error</div>
        <div style="font-weight: 600;">${error.message}</div>
      </div>
    </div>`;
    
    detailsHtml += `<div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 8px; padding: 16px;">`;
    detailsHtml += `<div style="font-weight: 600; margin-bottom: 10px; color: var(--warning-color);">💡 Things to try:</div>`;
    detailsHtml += `<ul style="margin: 0; padding-left: 20px; line-height: 1.6;">`;
    detailsHtml += `<li>Check if the website name is spelled correctly</li>`;
    detailsHtml += `<li>Try a simple website like "google.com"</li>`;
    detailsHtml += `<li>Make sure your internet connection is working</li>`;
    detailsHtml += `<li>Try an IP address like "8.8.8.8"</li>`;
    detailsHtml += `</ul></div>`;
    
    if (detailsDiv) detailsDiv.innerHTML = detailsHtml;
    showNotification('❌ Connection test failed. Check the error details above.', 'error');
    
    // Hide loading after brief delay
    setTimeout(() => {
      if (loadingMessage) loadingMessage.style.display = 'none';
    }, 1000);
  } finally {
    clearInterval(progressInterval);
    loadingMessage.style.display = 'none';
  }
}

// Show advanced trace route
async function showAdvancedTrace() {
  if (!isNetworkAPIAvailable()) return;
  
  const traceResults = document.getElementById('traceResults');
  const advancedBtn = document.getElementById('advancedTraceBtn');
  
  if (!lastConnectivityResult || !lastConnectivityResult.success) {
    showNotification('Please run a successful connectivity test first.', 'error');
    return;
  }
  
  // Show loading state
  advancedBtn.disabled = true;
  advancedBtn.innerHTML = '<span class="btn-icon">⏳</span> Tracing Route...';
  traceResults.style.display = 'block';
  traceResults.innerHTML = '<div class="loading-message">Tracing route... This may take up to 60 seconds.</div>';
  
  try {
    const result = await window.networkAPI.traceRoute(lastConnectivityResult.target);
    
    // Display trace results
    let traceHtml = `<div style="text-align: center; margin-bottom: 20px;">
      <div style="font-size: 1.1em; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">
        🛤️ Route Trace to ${result.target}
      </div>
      <div style="font-size: 0.9em; color: var(--text-muted);">
        ${new Date(result.timestamp).toLocaleString()}
      </div>
    </div>`;
    
    if (result.success && result.hops && result.hops.length > 0) {
      traceHtml += '<div style="margin-bottom: 15px;"><strong style="color: var(--accent-primary);">🔗 Network Hops:</strong></div>';
      traceHtml += '<div style="display: grid; gap: 8px;">';
      
      result.hops.forEach((hop, index) => {
        // Add visual indicators for hop types
        let hopIcon = '🔄';
        if (index === 0) hopIcon = '🏠'; // First hop (router)
        if (index === result.hops.length - 1) hopIcon = '🎯'; // Last hop (destination)
        
        traceHtml += `<div class="trace-hop" style="display: flex; align-items: center; gap: 10px;">
          <div style="font-size: 1.2em; min-width: 30px; text-align: center;">${hopIcon}</div>
          <div style="min-width: 60px; font-weight: 600; color: var(--accent-primary);">Hop ${hop.hop}</div>
          <div style="flex: 1; font-family: 'Consolas', 'Monaco', monospace; font-size: 0.9em; word-break: break-all;">
            ${hop.details}
          </div>
        </div>`;
      });
      
      traceHtml += '</div>';
    } else {
      traceHtml += '<div style="margin-bottom: 15px;"><strong style="color: var(--accent-primary);">📄 Full Output:</strong></div>';
      traceHtml += `<div style="background: rgba(var(--text-primary), 0.05); border: 1px solid var(--border-light); border-radius: 8px; padding: 16px; font-family: 'Consolas', 'Monaco', monospace; font-size: 0.85em; line-height: 1.5; white-space: pre-wrap; word-break: break-all; max-height: 400px; overflow-y: auto;">
        ${result.output || 'No detailed output available'}
      </div>`;
    }
    
    traceResults.innerHTML = traceHtml;
    
    console.log('[Network] Trace route completed:', result);
    
  } catch (error) {
    console.error('[Network] Trace route error:', error);
    traceResults.innerHTML = `<strong>Error:</strong> ${error.message}`;
    showNotification('❌ Route trace failed. Check the error details above.', 'error');
  } finally {
    advancedBtn.disabled = false;
    advancedBtn.innerHTML = '<span class="btn-icon">🛤️</span> Show Route Trace';
  }
}

// DNS Lookup function
async function performDnsLookup() {
  console.log('[Network] performDnsLookup called');
  
  if (!isNetworkAPIAvailable()) return;
  
  const targetInput = document.getElementById('dnsTarget');
  const resultsContainer = document.getElementById('dnsResults');
  
  if (!targetInput) {
    showNotification('❌ Cannot find DNS input field', 'error');
    return;
  }
  
  const domain = targetInput.value.trim();
  
  if (!domain) {
    showNotification('Please enter a website name to look up (like google.com).', 'error');
    return;
  }
  
  // Basic validation for domain format
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-._]*[a-zA-Z0-9]$/.test(domain)) {
    showNotification('Please enter a valid website name (like google.com or example.org).', 'error');
    return;
  }
  
  // Show loading state
  if (resultsContainer) {
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = '<div class="loading-message">🔍 Looking up DNS records...</div>';
  }
  
  try {
    console.log('[Network] About to perform DNS lookup...');
    const result = await window.networkAPI.performDnsLookup(domain);
    console.log('[Network] DNS lookup result:', result);
    
    // Display results
    let resultsHtml = `<strong>🔍 DNS Lookup for ${result.domain}</strong><br><br>`;
    resultsHtml += `<strong>Completed at:</strong> ${new Date(result.timestamp).toLocaleString()}<br><br>`;
    
    if (result.success && result.records && result.records.length > 0) {
      resultsHtml += '<strong>✅ DNS Records Found:</strong><br><br>';
      result.records.forEach(record => {
        resultsHtml += `<div class="dns-record">
          <div class="dns-record-type">${record.type}</div>
          <div class="dns-record-value">${record.value}</div>
        </div>`;
      });
    } else {
      resultsHtml += '<strong>❌ No DNS records found or lookup failed</strong><br><br>';
      resultsHtml += `<div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 6px; padding: 15px;">`;
      resultsHtml += `<strong>💡 Things to check:</strong><br>`;
      resultsHtml += `• Make sure the website name is spelled correctly<br>`;
      resultsHtml += `• Try without "www" (just use "google.com" not "www.google.com")<br>`;
      resultsHtml += `• Check if your internet connection is working</div>`;
    }
    
    if (resultsContainer) resultsContainer.innerHTML = resultsHtml;
    
    console.log('[Network] DNS lookup completed successfully');
    
  } catch (error) {
    console.error('[Network] Error performing DNS lookup:', error);
    
    let resultsHtml = `<strong>❌ Lookup Failed</strong><br><br>`;
    resultsHtml += `We couldn't look up the address for "${domain}".<br><br>`;
    resultsHtml += `<strong>Error:</strong> ${error.message}<br><br>`;
    resultsHtml += `<div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 6px; padding: 15px;">`;
    resultsHtml += `<strong>💡 Things to check:</strong><br>`;
    resultsHtml += `• Make sure the website name is spelled correctly<br>`;
    resultsHtml += `• Try without "www" (just use "google.com" not "www.google.com")<br>`;
    resultsHtml += `• Check if your internet connection is working</div>`;
    
    if (resultsContainer) resultsContainer.innerHTML = resultsHtml;
    showNotification('❌ DNS lookup failed. Check the error details above.', 'error');
  }
}

// Clear DNS cache
async function flushDns() {
  console.log('[Network] flushDns called');
  
  if (!isNetworkAPIAvailable()) return;
  
  try {
    console.log('[Network] Calling flushDns...');
    showNotification('🔄 Clearing DNS cache...', 'info');
    
    const result = await window.networkAPI.flushDns();
    console.log('[Network] DNS flush result:', result);
    
    if (result.success) {
      showNotification('✅ DNS cache cleared successfully! This can help fix website loading issues.', 'success');
    } else {
      showNotification('❌ Failed to clear DNS cache. Try restarting your computer.', 'error');
    }
    
  } catch (error) {
    console.error('[Network] Error flushing DNS:', error);
    showNotification(`❌ Failed to clear DNS cache: ${error.message}`, 'error');
  }
}

// Renew IP address
async function renewIpConfig() {
  console.log('[Network] renewIpConfig called');
  
  if (!isNetworkAPIAvailable()) return;
  
  try {
    console.log('[Network] Calling renewIpConfig...');
    showNotification('🔄 Renewing IP address...', 'info');
    
    const result = await window.networkAPI.renewIpConfig();
    console.log('[Network] IP renewal result:', result);
    
    if (result.success) {
      showNotification('✅ IP address renewed successfully! This can help fix connection issues.', 'success');
    } else {
      showNotification('❌ Failed to renew IP address. Try restarting your router.', 'error');
    }
    
  } catch (error) {
    console.error('[Network] Error renewing IP:', error);
    showNotification(`❌ Failed to renew IP address: ${error.message}`, 'error');
  }
}

// Reset network stack
async function resetNetworkStack() {
  const confirmed = await showModal({
    type: 'warning',
    title: '⚠️ Reset Network Settings',
    message: `This will reset ALL of your Windows network settings to defaults.

⚠️ WARNING: This is an advanced operation that will:
• Reset all network adapters to default settings
• Clear all network configurations
• May temporarily disconnect your internet
• Requires a computer restart to complete

❓ When to use this:
• When basic fixes (Clear DNS, Renew IP) don't work
• If you're having persistent connection problems
• As a last resort for network issues

💡 RECOMMENDATION: Try "Clear DNS Cache" and "Renew IP Address" first.

Are you sure you want to reset your network settings?`,
    confirmText: 'Yes, Reset Network Settings',
    cancelText: 'Cancel - Go Back',
    showCancel: true
  });
  
  if (!confirmed) return;
  
  const resultsContainer = document.getElementById('diagnosticResults');
  const loadingEl = document.querySelector('#networkDiagnosticsCard .loadingMessage');
  const statusText = loadingEl.querySelector('.statusText');
  
  // Show loading state
  loadingEl.style.display = 'block';
  resultsContainer.style.display = 'none';
  statusText.textContent = 'Resetting Network Settings (Advanced)';
  
  try {
    const result = await window.networkAPI.resetNetworkStack();
    
    // Hide loading and show results
    loadingEl.style.display = 'none';
    resultsContainer.style.display = 'block';
    
    let resultsHtml = `<strong>✅ Network Settings Reset Complete</strong><br>`;
    resultsHtml += `<span style="color: var(--success-color);">${result.message}</span><br><br>`;
    
    resultsHtml += `<div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 6px; padding: 15px; margin: 15px 0;">
      <strong style="color: var(--warning-color);">🔄 Next Steps:</strong><br>
      <ol style="margin: 10px 0 0 20px; color: var(--text-secondary);">
        <li>Restart your computer for changes to take full effect</li>
        <li>After restart, your internet should work with default settings</li>
        <li>You may need to reconnect to Wi-Fi networks</li>
      </ol>
    </div>`;
    
    if (result.results) {
      resultsHtml += '<details style="margin-top: 15px;"><summary style="cursor: pointer; color: var(--accent-primary);">Technical Details (Click to expand)</summary>';
      result.results.forEach(cmdResult => {
        const status = cmdResult.success ? '✅' : '❌';
        const color = cmdResult.success ? 'var(--success-color)' : 'var(--danger-color)';
        resultsHtml += `<div style="margin: 10px 0;">
          <strong style="color: ${color};">${status} ${cmdResult.command}</strong><br>
          <pre style="margin-left: 20px; font-size: 12px;">${cmdResult.output}</pre>
        </div>`;
      });
      resultsHtml += '</details>';
    }
    
    resultsContainer.innerHTML = resultsHtml;
    
    showNotification('Network settings reset completed! Please restart your computer.', 'success');
    console.log('[Network] Network stack reset completed:', result);
    
  } catch (error) {
    console.error('[Network] Network stack reset error:', error);
    
    loadingEl.style.display = 'none';
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = `
      <strong style="color: var(--danger-color);">❌ Reset Failed</strong><br>
      <p>The network reset could not be completed.</p>
      <details style="margin-top: 10px;">
        <summary style="cursor: pointer; color: var(--accent-primary);">Error Details</summary>
        <pre style="margin-top: 10px; font-size: 12px; color: var(--danger-color);">${error.message}</pre>
      </details>
      <div style="background: rgba(13, 110, 253, 0.1); border: 1px solid rgba(13, 110, 253, 0.3); border-radius: 6px; padding: 10px; margin-top: 15px;">
        <strong>💡 What to try instead:</strong><br>
        <ol style="margin: 5px 0 0 20px; font-size: 0.9rem;">
          <li>Try "Clear DNS Cache" button</li>
          <li>Try "Renew IP Address" button</li>
          <li>Restart your router (unplug for 30 seconds)</li>
          <li>Contact your internet provider if problems persist</li>
        </ol>
      </div>
    `;
    
    showNotification('Failed to reset network settings. Try basic fixes first.', 'error');
  }
}

// Initialize network page event listeners
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Network] DOM loaded, setting up network page...');
  console.log('[Network] networkAPI available:', !!window.networkAPI);
  
  // Wait a bit for APIs to be fully loaded, then test
  setTimeout(() => {
    console.log('[Network] Testing API availability after delay...');
    console.log('[Network] networkAPI methods:', window.networkAPI ? Object.keys(window.networkAPI) : 'undefined');
    
    if (window.networkAPI) {
      console.log('[Network] Available methods:', Object.keys(window.networkAPI));
      // Test if we can call at least one method
      window.networkAPI.getNetworkInfo().then(() => {
        console.log('[Network] ✅ Network API is working properly');
      }).catch((error) => {
        console.warn('[Network] ⚠️ Network API test failed:', error.message);
      });
    } else {
      console.error('[Network] ❌ networkAPI is not available!');
    }
  }, 1000);
  
  const connectivityInput = document.getElementById('connectivityTarget');
  const dnsInput = document.getElementById('dnsTarget');
  
  if (connectivityInput) {
    connectivityInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        testConnectivity();
      }
    });
    console.log('[Network] Connectivity input listener added');
  }
  
  if (dnsInput) {
    dnsInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performDnsLookup();
      }
    });
    console.log('[Network] DNS input listener added');
  }
  
  // Add a global test function for debugging
  window.testNetworkAPI = async function() {
    console.log('[Network] Testing network API...');
    if (!window.networkAPI) {
      console.log('[Network] networkAPI is not available');
      return false;
    }
    
    try {
      console.log('[Network] Attempting to get network info...');
      const networkInfo = await window.networkAPI.getNetworkInfo();
      console.log('[Network] Network info received:', networkInfo);
      return true;
    } catch (error) {
      console.log('[Network] Network API test failed:', error);
      return false;
    }
  };
  
  // Add debug test button to network page (only in development)
  if (window.location.hostname === 'localhost' || window.location.href.includes('file://')) {
    const networkSection = document.getElementById('network');
    if (networkSection) {
      const debugButton = document.createElement('button');
      debugButton.innerHTML = '🔧 Debug Network API';
      debugButton.className = 'tool-btn secondary';
      debugButton.style.margin = '10px';
      debugButton.onclick = async () => {
        console.log('🔧 [DEBUG] Testing network API...');
        const result = await window.testNetworkAPI();
        showNotification(`🔧 Network API Test: ${result ? 'PASSED ✅' : 'FAILED ❌'}`, result ? 'success' : 'error');
      };
      networkSection.appendChild(debugButton);
    }
  }
  
  console.log('[Network] Test function added to window.testNetworkAPI()');
});

// Refresh network adapters information
async function refreshNetworkAdapters() {
  console.log('[Network] refreshNetworkAdapters called');
  
  if (!isNetworkAPIAvailable()) return;
  
  const networkAdaptersGrid = document.getElementById('networkAdaptersGrid');
  const refreshBtn = document.querySelector('#networkAdaptersCard .tool-btn.secondary');
  
  if (!networkAdaptersGrid) {
    console.log('[Network] No networkAdaptersGrid found, exiting');
    return;
  }
  
  // Show loading state
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<span class="btn-icon">🔄</span> Loading...';
  }
  
  networkAdaptersGrid.innerHTML = '<div class="loading-message">🔄 Loading network adapters...</div>';
  
  try {
    console.log('[Network] About to call getNetworkAdapters...');
    const adapters = await window.networkAPI.getNetworkAdapters();
    console.log('[Network] Network adapters received:', adapters);
    
    // Group adapters by type for better organization
    const adapterGroups = {
      'Physical': [],
      'Virtual': [],
      'System': []
    };
    
    console.log('[Network] Processing adapters...');
    adapters.forEach((adapter, index) => {
      console.log(`Processing Adapter ${index + 1}: ${adapter.name}`);
      
      try {
        const info = getAdapterInfo(adapter);
        
        const hasValidIPv4 = adapter.addresses.some(addr => 
          addr.family === 'IPv4' && 
          !addr.internal && 
          addr.address && 
          addr.address !== '0.0.0.0' &&
          !addr.address.startsWith('169.254.') // Exclude APIPA addresses
        );
        
        const hasValidIPv6 = adapter.addresses.some(addr => 
          addr.family === 'IPv6' && 
          !addr.internal && 
          addr.address && 
          !addr.address.startsWith('fe80:') // Exclude link-local addresses
        );
        
        // Determine final status
        let finalStatus = 'Disconnected'; // Default to disconnected
        
        if (adapter.status) {
          // Trust the system-provided status if available
          finalStatus = adapter.status;
        } else if (hasValidIPv4 || hasValidIPv6) {
          finalStatus = 'Connected';
        }
        
        // Get IP addresses
        const ipv4Address = adapter.addresses.find(addr => addr.family === 'IPv4' && !addr.internal);
        const ipv6Address = adapter.addresses.find(addr => addr.family === 'IPv6' && !addr.internal);
        const macAddress = adapter.addresses.find(addr => addr.mac && addr.mac !== '00:00:00:00:00:00')?.mac || 
                           adapter.addresses.find(addr => addr.mac)?.mac || 'Not available';
        
        // Create adapter object with enhanced info
        const adapterData = {
          originalName: adapter.name,
          friendlyName: info.friendlyName,
          type: info.type,
          icon: info.icon,
          description: info.description,
          isEnabled: finalStatus === 'Connected',
          status: finalStatus,
          ipv4: ipv4Address ? ipv4Address.address : null,
          ipv6: ipv6Address ? ipv6Address.address : null,
          mac: macAddress,
          addresses: adapter.addresses,
          addressCount: adapter.addresses.length,
          sortPriority: getSortPriority(info.type, finalStatus)
        };
        
        // Group adapters
        if (info.type === 'Wireless' || info.type === 'Wired' || info.type === 'Bluetooth' || info.type === 'Physical') {
          adapterGroups['Physical'].push(adapterData);
        } else if (info.type === 'Virtual' || info.type === 'VPN') {
          adapterGroups['Virtual'].push(adapterData);
        } else {
          adapterGroups['System'].push(adapterData);
        }
      } catch (error) {
        console.error(`Error processing adapter ${adapter.name}:`, error);
      }
    });
    
    // Build adapters grid HTML
    let adaptersHtml = '';
    
    // Display each group with connected adapters first
    Object.entries(adapterGroups).forEach(([groupName, groupAdapters]) => {
      if (groupAdapters.length > 0) {
        console.log(`\n🔄 SORTING ${groupName} group:`);
        console.log('Before sorting:', groupAdapters.map(a => `${a.friendlyName}: ${a.status} (priority: ${a.sortPriority})`));
        
        // Enhanced sorting: First by connection status, then by adapter type priority
        const sortedAdapters = groupAdapters.sort((a, b) => {
          // Primary sort: by sort priority (combines status and type)
          const priorityDiff = a.sortPriority - b.sortPriority;
          console.log(`  Comparing ${a.friendlyName}(${a.sortPriority}) vs ${b.friendlyName}(${b.sortPriority}) = ${priorityDiff}`);
          if (priorityDiff !== 0) return priorityDiff;
          
          // Secondary sort: by friendly name for consistent ordering
          const nameDiff = a.friendlyName.localeCompare(b.friendlyName);
          console.log(`  Name comparison: ${a.friendlyName} vs ${b.friendlyName} = ${nameDiff}`);
          return nameDiff;
        });
        
        console.log('After sorting:', sortedAdapters.map(a => `${a.friendlyName}: ${a.status} (priority: ${a.sortPriority})`));
        
        adaptersHtml += `<div class="adapter-group">
          <h4 class="adapter-group-title">${groupName} Network Adapters</h4>`;
        
        sortedAdapters.forEach(adapter => {
          const statusIcon = adapter.status === 'Connected' ? '✅' : 
                           adapter.status === 'Disabled' ? '⭕' : '🔴';
          const statusText = adapter.status || 'Unknown';
          const statusColor = adapter.status === 'Connected' ? 'var(--success-color)' : 
                            adapter.status === 'Disabled' ? 'var(--warning-color)' : 
                            'var(--danger-color)';
          
          adaptersHtml += `<div class="network-adapter-item" data-adapter="${adapter.originalName}">
            <div class="adapter-header">
              <div class="adapter-title">
                <span class="adapter-icon">${adapter.icon}</span>
                <div class="adapter-title-text">
                  <span class="adapter-name">${adapter.friendlyName}</span>
                  <span class="adapter-description">${adapter.description}</span>
                </div>
              </div>
              <div class="adapter-status" style="color: ${statusColor};">
                ${statusIcon} ${statusText}
              </div>
            </div>
            <div class="adapter-details">
              <div class="adapter-detail">
                <span class="detail-label">Device Name:</span>
                <span class="detail-value" title="${adapter.originalName}">${adapter.originalName}</span>
              </div>
              <div class="adapter-detail">
                <span class="detail-label">IPv4 Address:</span>
                <span class="detail-value">${adapter.ipv4 || (adapter.status === 'Connected' ? 'DHCP pending' : adapter.status === 'Disconnected' ? 'Not connected' : 'Not assigned')}</span>
              </div>
              ${adapter.ipv6 ? `<div class="adapter-detail">
                <span class="detail-label">IPv6 Address:</span>
                <span class="detail-value">${adapter.ipv6}</span>
              </div>` : ''}
              <div class="adapter-detail">
                <span class="detail-label">MAC Address:</span>
                <span class="detail-value">${adapter.mac}</span>
              </div>
              <div class="adapter-detail">
                <span class="detail-label">Type:</span>
                <span class="detail-value">${adapter.type}</span>
              </div>
            </div>
          </div>`;
        });
        
        adaptersHtml += '</div>';
      }
    });
    
    if (!adaptersHtml) {
      adaptersHtml = '<div class="error-message">No network adapters found</div>';
    }
    
    networkAdaptersGrid.innerHTML = adaptersHtml;
    console.log('[Network] Network adapters displayed successfully');
    
  } catch (error) {
    console.error('❌ [Network] Error getting network adapters:', error);
    console.error('Error stack:', error.stack);
    networkAdaptersGrid.innerHTML = `<div class="error-message">❌ Unable to Load Network Adapters<br><br>Error: ${error.message}</div>`;
  }
  
  // Reset button state
  if (refreshBtn) {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = '<span class="btn-icon">🔄</span> Refresh Network Adapters';
  }
}

// Debug function to show all raw network adapters
async function debugAllNetworkAdapters() {
  console.log('[Network Debug] Starting comprehensive adapter analysis...');
  
  if (!isNetworkAPIAvailable()) return;
  
  try {
    const adapters = await window.networkAPI.getNetworkAdapters();
    console.log('[Network Debug] Total adapters found:', adapters.length);
    console.log('[Network Debug] Raw adapter data:', adapters);
    
    console.log('\n=== DETAILED ADAPTER BREAKDOWN ===');
    adapters.forEach((adapter, index) => {
      console.log(`\n--- Adapter ${index + 1} ---`);
      console.log('Name:', adapter.name);
      console.log('Internal:', adapter.internal);
      console.log('Addresses:', adapter.addresses);
      console.log('Address count:', adapter.addresses.length);
      
      adapter.addresses.forEach((addr, addrIndex) => {
        console.log(`  Address ${addrIndex + 1}:`, {
          family: addr.family,
          address: addr.address,
          internal: addr.internal,
          mac: addr.mac
        });
      });
      
      // Show what our detection would classify this as
      try {
        const detection = getAdapterInfo(adapter);
        console.log('Our classification:', detection);
      } catch (error) {
        console.log('Classification error:', error.message);
        console.log('Raw adapter name for analysis:', adapter.name);
      }
      console.log('---');
    });
    
    console.log('\n=== SUMMARY ===');
    console.log('Looking for ethernet-like names containing:');
    console.log('- "ethernet", "lan", "realtek", "intel", "broadcom", "marvell", "killer"');
    console.log('- "local area connection", "adapter", "nic", "card", "connection"');
    
    // Show which adapters would be filtered out
    const filtered = adapters.filter(adapter => {
      const name = adapter.name.toLowerCase();
      return name.includes('loopback') || name.includes('pseudo');
    });
    
    console.log('\nAdapters that would be filtered OUT:');
    filtered.forEach(adapter => {
      console.log('- ' + adapter.name);
    });
    
    return adapters;
  } catch (error) {
    console.error('[Network Debug] Error getting adapters:', error);
    return [];
  }
}

// Make debug function available globally
window.debugNetworkAdapters = debugAllNetworkAdapters;

// Helper function to get sort priority for network adapters
function getSortPriority(adapterType, status) {
  // Lower numbers = higher priority (appear first)
  // Give HUGE gaps between status levels to ensure connected always beats disconnected
  
  const statusMultiplier = {
    'Connected': 0,        // Highest priority - active connections first
    'Disconnected': 10000, // Much much lower priority - inactive connections  
    'Disabled': 20000      // Lowest priority - disabled adapters last
  };
  
  // Adapter type priority within same status (tiny values for fine-tuning)
  const typePriority = {
    'Wireless': 1,      // Wi-Fi first within same status
    'Wired': 2,         // Ethernet second within same status
    'Bluetooth': 3,     // Bluetooth third within same status
    'Physical': 4,      // Other physical adapters
    'Virtual': 5,       // Virtual adapters
    'VPN': 6,          // VPN adapters
    'System': 7,       // System adapters last
    'Other': 8         // Unknown adapters last
  };
  
  const statusValue = (status in statusMultiplier) ? statusMultiplier[status] : 30000; // Default for unknown status (lowest priority)
  const typeValue = typePriority[adapterType] || 9;     // Default for unknown type
  
  const priority = statusValue + typeValue;
  console.log(`[Network] FINAL Priority calculation for ${adapterType} (${status})`);
  console.log(`[Network]   Status multiplier: ${statusValue}`);
  console.log(`[Network]   Type value: ${typeValue}`);
  console.log(`[Network]   TOTAL PRIORITY: ${priority}`);
  console.log(`[Network] Ranges: Connected (0-99) >> Disconnected (10000-10099) >> Disabled (20000-20099)`);
  
  return priority;
}
