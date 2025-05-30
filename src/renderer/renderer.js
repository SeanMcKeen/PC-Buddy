console.log('[renderer.js] loaded');
console.log('systemInfoAPI:', window.systemInfoAPI);

// Tool Action Handlers
const toolActions = {
  diskCleanup: () => promptDriveSelection(),
  systemRepair: () => window.electronAPI.runSystemRepair()
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

  let dotCount = 0;
  const baseText = button.innerText.includes('Repair') ? 'Repairing System' : 'Cleaning Disk';
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
    setTimeout(() => {
      resultEl.textContent = '';
      resultEl.classList.remove('success', 'error');
    }, 5000);
  });
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
  // Loading Screen Management
  // -------------------------
  const loadingScreen = document.getElementById('loadingScreen');
  const loadingText = document.querySelector('.loading-text');
  const progressDots = document.querySelectorAll('.progress-dots .dot');
  
  let currentDot = 0;
  const updateLoadingProgress = (text) => {
    loadingText.textContent = text;
    
    // Reset all dots
    progressDots.forEach(dot => dot.classList.remove('active'));
    
    // Activate current dot
    if (currentDot < progressDots.length) {
      progressDots[currentDot].classList.add('active');
      currentDot++;
    }
  };

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
  const sidebarItems = document.querySelectorAll('#sidebar li');
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

  const defaultSection = sidebarItems[0]?.dataset.section;
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
  updateLoadingProgress('Loading system information...');
  
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
  // Startup Section
  // -------------------------
  updateLoadingProgress('Loading startup programs...');
  
  const listEl = document.getElementById('startupList');
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

  const taskBtn = document.getElementById('openTaskManagerBtn');
  taskBtn?.addEventListener('click', () => {
    window.startupAPI.openTaskManager();
  });

  // Initialize masonry layout after all content is loaded
  updateLoadingProgress('Finalizing interface...');
  
  setTimeout(() => {
    initMasonryLayout();
    
    // Hide loading screen after everything is ready - extended duration for better UX
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
    }, 1500); // Extended from 500ms to 1500ms
  }, 500); // Extended from 200ms to 500ms

  // Handle window resize for masonry layout
  window.addEventListener('resize', () => {
    clearTimeout(window.masonryResizeTimeout);
    window.masonryResizeTimeout = setTimeout(() => {
      masonryInstances.forEach(masonry => {
        masonry.handleResize();
      });
    }, 150);
  });
});

// -------------------------
// Drive Selection and Cleanup
// -------------------------

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

// -------------------------
// Modal System
// -------------------------

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
      message: 'We could not detect any drives to clean.'
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
    const minCardWidth = window.innerWidth <= 768 ? 300 : 
                        window.innerWidth <= 1200 ? 320 :
                        window.innerWidth <= 1600 ? 350 : 380;
    
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
    
    // Cancel any pending animations
    if (this.resizeRAF) {
      cancelAnimationFrame(this.resizeRAF);
    }
    
    if (this.layoutRAF) {
      cancelAnimationFrame(this.layoutRAF);
    }
    
    // Clean up timeouts
    clearTimeout(this.observerTimeout);
    
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