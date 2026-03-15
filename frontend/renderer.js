// --- DOM ---
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileCard = document.getElementById('fileCard');
const fileName = document.getElementById('fileName');
const fileMeta = document.getElementById('fileMeta');
const btnRemove = document.getElementById('btnRemove');
const btnAnalyze = document.getElementById('btnAnalyze');
const actions = document.getElementById('actions');
const waveformBars = document.getElementById('waveformBars');
const resultCard = document.getElementById('resultCard');
const resultText = document.getElementById('resultText');
const btnExportPdf = document.getElementById('btnExportPdf');
const btnExportDocx = document.getElementById('btnExportDocx');
const loading = document.getElementById('loading');
const progressBarFill = document.getElementById('progressBarFill');
const progressPercent = document.getElementById('progressPercent');
const loadingText = document.getElementById('loadingText');
const historyList = document.getElementById('historyList');
const emptyHistory = document.getElementById('emptyHistory');
const serverStatus = document.getElementById('serverStatus');

let currentFile = null;
let currentRecordId = null;

// --- Tabs ---
document.querySelectorAll('.nav-item[data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item[data-tab]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
    const tab = document.getElementById('tab' + capitalize(btn.dataset.tab));
    tab.classList.add('active');

    if (btn.dataset.tab === 'history') loadHistory();
  });
});

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Server status ---
let currentModelStatus = 'not_loaded';

async function checkServer() {
  const dot = serverStatus.querySelector('.status-dot');
  const text = serverStatus.querySelector('.status-text');
  const health = await window.api.healthCheck();
  currentModelStatus = health.model_status;

  if (!health.ok) {
    dot.classList.remove('online', 'loading');
    dot.classList.add('offline');
    text.textContent = 'Сервер недоступен';
  } else {
    dot.classList.remove('offline', 'loading');
    dot.classList.add('online');
    text.textContent = 'Сервер активен';
  }
}

checkServer();
setInterval(checkServer, 2000);

// --- Dropzone ---
dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragging');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragging');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragging');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) handleFile(file);
});

// --- File handling ---
async function handleFile(file) {
  const allowedTypes = ['.wav', '.mp3', '.ogg', '.flac', '.m4a'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!allowedTypes.includes(ext)) return;

  currentFile = file;
  fileName.textContent = file.name;
  fileMeta.textContent = formatSize(file.size) + '  \u00B7  ' + ext.replace('.', '').toUpperCase();

  generateWaveform();

  dropzone.classList.add('hidden');
  fileCard.classList.remove('hidden');
  actions.classList.remove('hidden');
  resultCard.classList.add('hidden');
  loading.classList.add('hidden');

  // Upload to backend
  try {
    const buffer = await file.arrayBuffer();
    const result = await window.api.upload(buffer, file.name);
    currentRecordId = result.id;
  } catch (err) {
    console.error('Upload error:', err);
    fileName.textContent = 'Ошибка загрузки: ' + err.message;
  }
}

function removeFile() {
  currentFile = null;
  currentRecordId = null;
  fileInput.value = '';
  fileCard.classList.add('hidden');
  actions.classList.add('hidden');
  resultCard.classList.add('hidden');
  loading.classList.add('hidden');
  dropzone.classList.remove('hidden');
}

btnRemove.addEventListener('click', removeFile);

// --- Waveform ---
function generateWaveform() {
  waveformBars.innerHTML = '';
  const count = 80;
  for (let i = 0; i < count; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    const h = 8 + Math.random() * 44;
    bar.style.height = h + 'px';
    waveformBars.appendChild(bar);
  }
}

// --- Analyze ---
btnAnalyze.addEventListener('click', async () => {
  if (!currentRecordId) {
    resultText.textContent = 'Ошибка: файл не загружен на сервер. Попробуйте выбрать файл заново.';
    resultCard.classList.remove('hidden');
    return;
  }

  actions.classList.add('hidden');
  loading.classList.remove('hidden');
  resultCard.classList.add('hidden');

  // Сброс прогресс-бара
  progressBarFill.style.width = '0%';
  progressPercent.textContent = '0%';
  loadingText.textContent = 'Распознаём речь...';

  // Поллинг прогресса и статуса модели
  const pollId = setInterval(async () => {
    const [info, health] = await Promise.all([
      window.api.getProgress(currentRecordId),
      window.api.healthCheck(),
    ]);

    if (info.status === 'processing') {
      loadingText.textContent = 'Распознаём речь...';
      const pct = Math.round(info.progress * 100);
      progressBarFill.style.width = pct + '%';
      progressPercent.textContent = pct + '%';
    }
  }, 500);

  try {
    const result = await window.api.transcribe(currentRecordId);
    clearInterval(pollId);
    progressBarFill.style.width = '100%';
    progressPercent.textContent = '100%';
    resultText.textContent = result.transcript || '(пустой результат)';
    resultCard.classList.remove('hidden');
  } catch (err) {
    clearInterval(pollId);
    resultText.textContent = 'Ошибка: ' + err.message;
    resultCard.classList.remove('hidden');
  } finally {
    loading.classList.add('hidden');
    actions.classList.remove('hidden');
  }
});

// --- Export ---
btnExportPdf.addEventListener('click', async () => {
  if (!currentRecordId) return;
  try {
    const saved = await window.api.exportPdf(currentRecordId);
    if (saved) resultText.dataset.status = 'Файл сохранён';
  } catch (err) {
    console.error('PDF export error:', err);
    alert('Ошибка экспорта PDF: ' + err.message);
  }
});

btnExportDocx.addEventListener('click', async () => {
  if (!currentRecordId) return;
  try {
    const saved = await window.api.exportDocx(currentRecordId);
    if (saved) resultText.dataset.status = 'Файл сохранён';
  } catch (err) {
    console.error('DOCX export error:', err);
    alert('Ошибка экспорта DOCX: ' + err.message);
  }
});

// --- History ---
async function loadHistory() {
  try {
    const records = await window.api.getHistory();
    historyList.innerHTML = '';

    if (records.length === 0) {
      historyList.innerHTML = '<p class="empty-state">Пока нет записей</p>';
      return;
    }

    records.forEach((rec) => {
      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <div class="history-card-top">
          <div class="file-icon small">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
          <div class="history-info">
            <p class="history-name">${escapeHtml(rec.filename)}</p>
            <p class="history-meta">${formatSize(rec.filesize)} \u00B7 ${formatDate(rec.created_at)}</p>
          </div>
          <button class="btn-remove" data-id="${rec.id}" title="Удалить">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        ${rec.transcript ? `<div class="history-transcript">${escapeHtml(rec.transcript)}</div>` : '<div class="history-transcript empty">Не распознано</div>'}
      `;
      historyList.appendChild(card);
    });

    // Delete buttons
    historyList.querySelectorAll('.btn-remove[data-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await window.api.deleteRecord(parseInt(btn.dataset.id));
        loadHistory();
      });
    });
  } catch (err) {
    historyList.innerHTML = '<p class="empty-state">Ошибка загрузки истории</p>';
  }
}

// --- Helpers ---
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}