const { ipcRenderer } = require('electron')

ipcRenderer.on('load-uniform', (event, data) => {
    $("#load").click()
});

ipcRenderer.on('save-uniform', (event, data) => {
    $("#save").click()
});

ipcRenderer.on('about', (event, data) => {
    $("#aboutUniformMaker").click()
});

ipcRenderer.on('copy', (event, data) => {
    $("#copy").click()
});

ipcRenderer.on('paste', (event, data) => {
    $("#paste").click()
});