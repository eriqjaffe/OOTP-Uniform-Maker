const { ipcRenderer } = require('electron')

ipcRenderer.on('load-uniform', (event, data) => {
    $("#load").trigger("click")
});

ipcRenderer.on('save-uniform', (event, data) => {
    $("#save").trigger("click")
});

ipcRenderer.on('about', (event, data) => {
    $("#aboutUniformMaker").trigger("click")
});

ipcRenderer.on('copy', (event, data) => {
    $("#copy").trigger("click")
});

ipcRenderer.on('paste', (event, data) => {
    $("#paste").trigger("click")
});

ipcRenderer.on('prefs', (event, data) => {
    $("#prefsButton").trigger("click")
});

ipcRenderer.on('update', (event, data) => {
    $("#checkForUpdates").trigger("click")
});