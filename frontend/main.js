const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let win;
let pythonProcess;

function startBackend() {
  const isWin = process.platform === 'win32';
  const dataDir = app.isPackaged
    ? path.join(app.getPath('userData'), 'data')
    : path.join(__dirname, '..', 'backend');

  fs.mkdirSync(dataDir, { recursive: true });



  const env = { ...process.env, SPEECHDETECT_DATA_DIR: dataDir };

  let backendExe, args;
  if (app.isPackaged) {
    backendExe = path.join(process.resourcesPath, 'backend', isWin ? 'server.exe' : 'server');
    args = [];
  } else {
    backendExe = path.join(__dirname, '..', '.venv', isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python3');
    args = [path.join(__dirname, '..', 'backend', 'server.py')];
  }

  pythonProcess = spawn(backendExe, args, {
    cwd: dataDir,
    env: env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[backend] ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.log(`[backend] ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`[backend] exited with code ${code}`);
  });
}

function stopBackend() {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 550,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 16 } }
      : {}),
  });

  win.loadFile('index.html');
}

ipcMain.handle('save-file', async (event, { defaultName, filters }) => {
  const result = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('desktop'), defaultName),
    filters: filters,
  });
  return result;
});

app.whenReady().then(() => {
  startBackend();
  setTimeout(createWindow, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});