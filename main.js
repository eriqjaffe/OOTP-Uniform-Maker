const { app, BrowserWindow, dialog, Menu, shell, webContents  } = require('electron')
const path = require('path')
const os = require('os');
const fs = require('fs')
const url = require('url');
const express = require('express')

const isMac = process.platform === 'darwin'
const tempDir = os.tmpdir()
const app2 = express();

const server = app2.listen(0, () => {
	console.log(`Server running on port ${server.address().port}`);
});

const preferredColorFormat = "hex"
const preferredTexture = "tbd"

app2.use(express.urlencoded({limit: '50mb', extended: true, parameterLimit: 50000}));

function createWindow () {
    const mainWindow = new BrowserWindow({
      width: 1400,
      height: 1000,
      icon: (__dirname + '/images/ballcap.png'),
      webPreferences: {
          nodeIntegration: true,
            contextIsolation: false 
      }
    })
    
    const template = [
      ...(isMac ? [{
          label: app.name,
          submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
          ]
      }] : []),
      {
          label: 'File',
          submenu: [
          {
              click: () => mainWindow.webContents.send('load-cap','click'),
              accelerator: process.platform === 'darwin' ? 'Cmd+L' : 'Control+L',
              label: 'Load Cap',
          },
          {
              click: () => mainWindow.webContents.send('save-cap','click'),
              accelerator: process.platform === 'darwin' ? 'Cmd+S' : 'Control+S',
              label: 'Save Cap',
          },
          isMac ? { role: 'close' } : { role: 'quit' }
          ]
      },
      {
          label: 'View',
          submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
          ]
      },
      {
          label: 'About',
          submenu: [
          {
              click: () => mainWindow.webContents.send('about','click'),
                  label: 'About the OOTP23 Uniform Maker',
          },
          {
              label: 'About OOTP Baseball',
              click: async () => {    
              await shell.openExternal('https://www.ootpdevelopments.com/out-of-the-park-baseball-home/')
              }
          },
          {
              label: 'About Node.js',
              click: async () => {    
              await shell.openExternal('https://nodejs.org/en/about/')
              }
          },
          {
              label: 'About Electron',
              click: async () => {
              await shell.openExternal('https://electronjs.org')
              }
          },
          {
              label: 'View project on GitHub',
              click: async () => {
              await shell.openExternal('https://github.com/eriqjaffe/OOTP-Uniform-Maker')
              }
          }
          ]
      }
      ]
      
      const menu = Menu.buildFromTemplate(template)
      Menu.setApplicationMenu(menu)
  
    //mainWindow.loadURL(`file://${__dirname}/index.html?port=${server.address().port}&preferredColorFormat=${preferredColorFormat}&preferredTexture=${preferredTexture}`);
    mainWindow.loadURL(`file://${__dirname}/index.html?port=${server.address().port}`);
  
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  
    // Open the DevTools.
    // mainWindow.maximize()
    // mainWindow.webContents.openDevTools()
  }
  
  app.whenReady().then(() => {
        createWindow()
  
        app.on('activate', function () {
          if (BrowserWindow.getAllWindows().length === 0) createWindow()
        })
  })
  
  app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
  })