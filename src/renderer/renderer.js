document.getElementById('repairBtn').addEventListener('click', async () => {
  const loadingEl = document.getElementById('loadingMessage');
  const resultEl = document.getElementById('repairResult');
  const progressBar = document.getElementById('progressBar');
  const statusText = document.getElementById('animatedText');

  // Reset progress bar animation
  progressBar.style.animation = 'none';
  progressBar.offsetHeight; // Force reflow
  progressBar.style.animation = null;

  loadingEl.style.display = 'block';
  resultEl.textContent = '';

  // ⬇️ Rotating status text
  const statusLines = [
    'Checking system integrity...',
    'Verifying protected files...',
    'Validating Windows components...',
    'Almost there...'
  ];
  let i = 0;
  statusText.textContent = statusLines[i];
  const statusInterval = setInterval(() => {
    i++;
    statusText.textContent = statusLines[i % statusLines.length];
  }, 6000);

  try {
    const result = await window.electronAPI.runSystemRepair();
    resultEl.textContent = result;
  } catch (err) {
    resultEl.textContent = 'Error: ' + err;
  } finally {
    clearInterval(statusInterval);  // ⬅️ Important: stop rotating messages
    loadingEl.style.display = 'none';
  }
});
