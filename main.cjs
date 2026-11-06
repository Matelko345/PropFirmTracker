const { app, BrowserWindow, shell, ipcMain } = require('electron')
const path = require('path')
const { readPrefs, writePrefs } = require('./prefs.cjs')

const isDev = !app.isPackaged
let mainWindow = null
let updateAvailable = null

function sendUpdateEvent(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:event', payload)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 860,
    minHeight: 600,
    title: 'PropFirm Tracker',
    backgroundColor: '#07080c',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

function setupUpdater() {
  if (isDev) return null

  let autoUpdater
  try {
    ;({ autoUpdater } = require('electron-updater'))
  } catch (err) {
    console.error('electron-updater missing', err)
    return null
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    sendUpdateEvent({ type: 'checking' })
  })
  autoUpdater.on('update-available', (info) => {
    updateAvailable = info
    sendUpdateEvent({ type: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', (info) => {
    sendUpdateEvent({ type: 'not-available', version: info?.version || app.getVersion() })
  })
  autoUpdater.on('error', (err) => {
    sendUpdateEvent({ type: 'error', message: String(err?.message || err) })
  })
  autoUpdater.on('download-progress', (p) => {
    sendUpdateEvent({
      type: 'progress',
      percent: p.percent,
      transferred: p.transferred,
      total: p.total,
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateEvent({ type: 'downloaded', version: info.version })
  })

  return autoUpdater
}

function maybeAutoCheck(autoUpdater) {
  if (!autoUpdater) return
  const prefs = readPrefs()
  if (prefs.autoUpdate === false) return
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      sendUpdateEvent({ type: 'error', message: String(err?.message || err) })
    })
  }, 2500)
}

app.whenReady().then(() => {
  // Keep userData path stable across updates (same appId → same folder).
  // localStorage / checklist / entries live here and are never wiped by electron-updater.
  createWindow()
  const autoUpdater = setupUpdater()

  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('update:getPrefs', () => readPrefs())
  ipcMain.handle('update:setPrefs', (_e, prefs) => writePrefs(prefs || {}))
  ipcMain.handle('update:check', async () => {
    if (!autoUpdater) return { ok: false, reason: 'dev' }
    try {
      const result = await autoUpdater.checkForUpdates()
      return { ok: true, updateInfo: result?.updateInfo || null }
    } catch (err) {
      return { ok: false, reason: String(err?.message || err) }
    }
  })
  ipcMain.handle('update:download', async () => {
    if (!autoUpdater) return { ok: false, reason: 'dev' }
    try {
      await autoUpdater.downloadUpdate()
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: String(err?.message || err) }
    }
  })
  ipcMain.handle('update:install', () => {
    if (!autoUpdater) return { ok: false, reason: 'dev' }
    // Replaces app binaries only — userData (your trades) stays intact.
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
    return { ok: true }
  })

  maybeAutoCheck(autoUpdater)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
