const { app, shell, ipcRenderer } = require('electron')

ipcRenderer.on('load-uniform', (event, data) => {
    $("#load").trigger("click")
});

ipcRenderer.on('save-uniform', (event, data) => {
    $("#save").trigger("click")
});

ipcRenderer.on('save-cap', (event, data) => {
    $("#saveCap").trigger("click")
});

ipcRenderer.on('save-pants', (event, data) => {
    $("#savePants").trigger("click")
});

ipcRenderer.on('save-socks', (event, data) => {
    $("#saveSocks").trigger("click")
});

ipcRenderer.on('save-jersey', (event, data) => {
    $("#saveJersey").trigger("click")
});

ipcRenderer.on('save-font', (event, data) => {
    $("#saveFont").trigger("click")
});

ipcRenderer.on('save-swatches', (event, data) => {
    $("#saveSwatches").trigger("click")
})

ipcRenderer.on('load-swatches', (event, data) => {
    $("#loadSwatches").trigger("click")
})

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

ipcRenderer.on('updateFonts', (event, data) => {
    $("#localFontFolder").trigger("click")
})

ipcRenderer.on('openFontFolder', (event, data) => {
    $("#openFontFolder").trigger("click")
})

ipcRenderer.on('install-uniform', (event, data) => {
    $("#installUniform").trigger("click")
})

ipcRenderer.on('show-spinner', (event, data) => {
    showOverlay("TESTING 123")
})

ipcRenderer.on('close-spinner', (event, data) => {
    hideOverlay()
})

ipcRenderer.on('error-message', (event, data) => {
    hideOverlay()
})