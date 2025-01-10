import { app, BrowserWindow, dialog } from 'electron';
import * as path from 'path';
import { setupIPC, cleanup } from './ipc';

// 添加全局错误处理
process.on('uncaughtException', (error) => {
  // 不显示错误弹窗，只记录日志
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 775,
    minWidth: 1360,
    minHeight: 775,
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  setupIPC();

  win.on('close', () => {
    cleanup();
    app.quit();
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    win.loadURL('http://localhost:5173/');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    // 静默处理错误
  });
}

app.on('before-quit', () => {
  cleanup();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  cleanup();
  app.quit();
}); 