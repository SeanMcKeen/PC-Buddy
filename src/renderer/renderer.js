// Repair button behavior
document.getElementById('repairBtn').addEventListener('click', async () => {
  const loadingEl = document.getElementById('loadingMessage');
  const resultEl = document.getElementById('repairResult');
  const statusText = document.getElementById('animatedText');

  loadingEl.style.display = 'block';
  resultEl.textContent = '';

  const statusLines = [
    'Checking system integrity...',
    'Verifying protected files...',
    'Validating Windows components...',
    'Finalizing...'
  ];
  let i = 0;
  statusText.textContent = statusLines[i];
  const statusInterval = setInterval(() => {
    i++;
    statusText.textContent = statusLines[i % statusLines.length];
  }, 5000);

  try {
    const result = await window.electronAPI.runSystemRepair();
    resultEl.textContent = result;
  } catch (err) {
    resultEl.textContent = 'Error: ' + err.message;
  } finally {
    clearInterval(statusInterval);
    loadingEl.style.display = 'none';
  }
});

// Sidebar toggle
document.getElementById('toggleSidebar').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});

// Sidebar section switching
document.querySelectorAll('#sidebar li').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('#sidebar li').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    const sectionId = item.getAttribute('data-section');
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
  });
});
