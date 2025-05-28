console.log('[renderer.js] loaded');
console.log('systemInfoAPI:', window.systemInfoAPI);

// Tool Action Handlers
const toolActions = {
  diskCleanup: () => window.electronAPI.runDiskCleanup(),
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

// Sidebar Collapsing Toggle
document.getElementById('toggleSidebar').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});

// Section Switching
document.querySelectorAll('#sidebar li').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('#sidebar li').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    const sectionId = item.getAttribute('data-section');
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
  });
});

// Populate System Info
window.addEventListener('DOMContentLoaded', () => {
  const info = window.systemInfoAPI.getSystemInfo();
  const list = document.getElementById('systemInfoList');

  for (const [key, value] of Object.entries(info)) {
    const item = document.createElement('li');
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    item.textContent = `${label}: ${value}`;
    list.appendChild(item);
  }
});

// Populate Startup Programs
window.addEventListener('DOMContentLoaded', async () => {
  const listEl = document.getElementById('startupList');
  const entries = await window.startupAPI.getStartupPrograms();

  if (!entries.length) {
    listEl.textContent = 'No startup entries found.';
    return;
  }

  entries.forEach(program => {
    const container = document.createElement('div');
    container.classList.add('startup-item');

    const rawCommand = program.command || 'Unknown';
    const exeName = extractExeName(rawCommand);

    const label = document.createElement('span');
    label.className = 'startup-label';
    label.textContent = exeName;
    label.title = rawCommand;

    const badge = document.createElement('span');
    badge.className = `safety-badge ${program.safety}`;
    badge.textContent =
        program.safety === 'safe' ? 'Safe' :
        program.safety === 'caution' ? 'Caution' : 'Unknown';

    badge.title =
        program.safety === 'safe'
        ? 'This is safe to disable.'
        : program.safety === 'caution'
        ? 'Caution advised before disabling.'
        : 'Disabling this may be risky.';

    const toggle = document.createElement('button');
    toggle.textContent = 'Disable';
    toggle.className = 'toggle-btn';
    toggle.onclick = async () => {
        const isDisabling = toggle.textContent === 'Disable';
        toggle.disabled = true;

        try {
        const result = await window.startupAPI.toggleStartup(program.name, !isDisabling);
        toggle.textContent = isDisabling ? 'Enable' : 'Disable';
        toggle.classList.toggle('disabled', isDisabling);
        console.log(result);
        } catch (err) {
        console.error('Toggle failed:', err);
        alert('Could not toggle this startup item. Try running as administrator.');
        } finally {
        toggle.disabled = false;
        }
    };

    const controls = document.createElement('div');
    controls.className = 'startup-controls-horizontal';
    controls.append(badge, toggle);

    container.append(label, controls);
    listEl.appendChild(container);
    });
});

function extractExeName(commandLine) {
  if (!commandLine) return 'Unknown';

  // Match .exe or .lnk from quoted string or entire command
  const quotedMatch = commandLine.match(/"(.*?)"/);
  const quotedTarget = quotedMatch ? quotedMatch[1] : commandLine;

  const exeMatch = quotedTarget.match(/([a-zA-Z0-9._-]+\.exe)/i);
  const lnkMatch = quotedTarget.match(/([a-zA-Z0-9 _-]+\.lnk)/i);

  let fileName = exeMatch ? exeMatch[1] : (lnkMatch ? lnkMatch[1] : 'Unknown');

  return fileName.trim(); // Remove .lnk for cleaner display
}

document.getElementById('openTaskManagerBtn').addEventListener('click', () => {
  window.startupAPI.openTaskManager();
});
