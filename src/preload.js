const { contextBridge, ipcRenderer } = require('electron')


contextBridge.exposeInMainWorld('api', {
    onImport: (callback) => ipcRenderer.on('data-imported', (_event, value) => {
        console.log('...reciving data-imported');
        callback(value)
    }),
    onNavigateTo: (callback) => ipcRenderer.on('navigate-to', (_event, value) => {
        console.log('...reciving navigation');
        callback(value)
    }),
    onCheckProcess: (callback) => ipcRenderer.on('check-process', (_event, value) => {
        console.log('...reciving check-process');
        callback(value)
    }),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    getSanctionsById: (id) => ipcRenderer.invoke('get-sanctions', id),
    init: () => ipcRenderer.invoke('init')
})

