const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const pathModule = require('path');

const API_BASE = 'http://127.0.0.1:8765';

contextBridge.exposeInMainWorld('api', {
  async upload(arrayBuffer, originalName) {
    const ext = pathModule.extname(originalName).toLowerCase();

    const mimeTypes = {
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac',
      '.m4a': 'audio/mp4',
    };

    const blob = new Blob([arrayBuffer], { type: mimeTypes[ext] || 'audio/wav' });
    const formData = new FormData();
    formData.append('file', blob, originalName);

    const resp = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json();
  },

  async transcribe(recordId) {
    const resp = await fetch(`${API_BASE}/api/transcribe/${recordId}`, {
      method: 'POST',
    });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json();
  },

  async getHistory() {
    const resp = await fetch(`${API_BASE}/api/history`);
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json();
  },

  async deleteRecord(recordId) {
    const resp = await fetch(`${API_BASE}/api/history/${recordId}`, {
      method: 'DELETE',
    });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json();
  },

  async exportPdf(recordId) {
    const { canceled, filePath } = await ipcRenderer.invoke('save-file', {
      defaultName: 'transcription.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return false;

    const resp = await fetch(`${API_BASE}/api/export/pdf/${recordId}`);
    if (!resp.ok) throw new Error(await resp.text());
    const buffer = await resp.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return true;
  },

  async exportDocx(recordId) {
    const { canceled, filePath } = await ipcRenderer.invoke('save-file', {
      defaultName: 'transcription.docx',
      filters: [{ name: 'Word Document', extensions: ['docx'] }],
    });
    if (canceled || !filePath) return false;

    const resp = await fetch(`${API_BASE}/api/export/docx/${recordId}`);
    if (!resp.ok) throw new Error(await resp.text());
    const buffer = await resp.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return true;
  },

  async getProgress(recordId) {
    try {
      const resp = await fetch(`${API_BASE}/api/progress/${recordId}`);
      if (!resp.ok) return { progress: 0, status: 'unknown' };
      return resp.json();
    } catch {
      return { progress: 0, status: 'unknown' };
    }
  },

  async healthCheck() {
    try {
      const resp = await fetch(`${API_BASE}/api/health`);
      if (!resp.ok) return { ok: false, model_status: 'not_loaded' };
      const data = await resp.json();
      return { ok: true, model_status: data.model_status };
    } catch {
      return { ok: false, model_status: 'not_loaded' };
    }
  },
});