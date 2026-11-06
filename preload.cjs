const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('propfirm', {
  isElectron: true,
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getUpdatePrefs: () => ipcRenderer.invoke('update:getPrefs'),
  setUpdatePrefs: (prefs) => ipcRenderer.invoke('update:setPrefs', prefs),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateEvent: (handler) => {
    const channel = 'update:event'
    const listener = (_event, payload) => handler(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
})
