const { app, BrowserWindow, Menu, nativeTheme, shell } = require('electron');
const path = require('node:path');

const isExternal = (url) => /^https:\/\//i.test(url);

function createWindow() {
  const win = new BrowserWindow({
    width: 1240,
    height: 880,
    minWidth: 860,
    minHeight: 620,
    title: 'Kalkulator czynszu – automaty vendingowe w szkołach',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1419' : '#f4f5f7',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Linki do źródeł otwieramy w domyślnej przeglądarce, nie w oknie aplikacji.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url === win.webContents.getURL()) return;
    event.preventDefault();
    if (isExternal(url)) shell.openExternal(url);
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
