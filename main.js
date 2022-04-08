const { app, BrowserWindow, dialog, Menu, shell, webContents  } = require('electron')
const path = require('path')
const os = require('os');
const fs = require('fs')
const url = require('url');
const express = require('express')
const sharp = require('sharp')
const Jimp = require('jimp')
const imagemagickCli = require('imagemagick-cli')

const isMac = process.platform === 'darwin'
const tempDir = os.tmpdir()
const app2 = express();

const server = app2.listen(0, () => {
	console.log(`Server running on port ${server.address().port}`);
});

const preferredColorFormat = "hex"
const preferredTexture = "tbd"

app2.use(express.urlencoded({limit: '50mb', extended: true, parameterLimit: 50000}));

app2.get("/uploadImage", (req, res) => {
	dialog.showOpenDialog(null, {
		properties: ['openFile'],
		filters: [
			{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }
		]
	  }).then(result => {
		  if(!result.canceled) {
			Jimp.read(result.filePaths[0], (err, image) => {
				if (err) {
					console.log(err);
				} else {
					image.getBase64(Jimp.AUTO, (err, ret) => {
            res.json({
              "filename": path.basename(result.filePaths[0]),
              "image": ret
              });
					})
				}
			});
		  }
	  }).catch(err => {
		  console.log(err)
	  })
})

app2.post("/removeBorder", (req, res) => {
	var buffer = Buffer.from(req.body.imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	var fuzz = parseInt(req.body.fuzz);
	Jimp.read(buffer, (err, image) => {
		if (err) {
			console.log(err);
		} else {
			image.write(tempDir+"/temp.png");
			imagemagickCli.exec('magick convert -trim -fuzz '+fuzz+'% '+tempDir+'/temp.png '+tempDir+'/temp.png').then(({ stdout, stderr }) => {
				Jimp.read(tempDir+"/temp.png", (err, image) => {
					if (err) {
						console.log(err);
					} else {
						image.getBase64(Jimp.AUTO, (err, ret) => {
							res.end(ret);
						})
					}
				})
			})
		}
	})
})

app2.post("/replaceColor", (req, res) => {
	var buffer = Buffer.from(req.body.imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	var x = parseInt(req.body.x);
	var y = parseInt(req.body.y);
	var color = req.body.color;
	var newcolor = req.body.newcolor;
	var action = req.body.action;
	var fuzz = parseInt(req.body.fuzz);
	var cmdString;
	Jimp.read(buffer, (err, image) => {
		if (err) {
			console.log(err);
		} else {
			image.write(tempDir+"/temp.png");
      if (action.slice(-17) == "ReplaceColorRange") {
				cmdString = 'magick convert '+tempDir+'/temp.png -fuzz '+fuzz+'% -fill '+newcolor+' -draw "color '+x+','+y+' floodfill" '+tempDir+'/temp.png';		
			} else {
				cmdString = 'magick convert '+tempDir+'/temp.png -fuzz '+fuzz+'% -fill '+newcolor+' -opaque '+color+' '+tempDir+'/temp.png';	
			}
			imagemagickCli.exec(cmdString).then(({ stdout, stderr }) => {
				Jimp.read(tempDir+"/temp.png", (err, image) => {
					if (err) {
						console.log(err);
					} else {
						image.getBase64(Jimp.AUTO, (err, ret) => {
							res.end(ret);
						})
					}
				})
			})
		}
	})
})

app2.post("/removeColorRange", (req, res) => {
	var buffer = Buffer.from(req.body.imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	var x = parseInt(req.body.x);
	var y = parseInt(req.body.y);
	var fuzz = parseInt(req.body.fuzz);
	Jimp.read(buffer, (err, image) => {
		if (err) {
			console.log(err);
		} else {
			image.write(tempDir+"/temp.png", (err) => {
				imagemagickCli.exec('magick convert '+tempDir+'/temp.png -fuzz '+fuzz+'% -fill none -draw "color '+x+','+y+' floodfill" '+tempDir+'/temp.png')
				.then(({ stdout, stderr }) => {
					Jimp.read(tempDir+"/temp.png", (err, image) => {
						if (err) {
							console.log(err);
						} else {
							image.getBase64(Jimp.AUTO, (err, ret) => {
								res.end(ret);
							})
						}
					})
				})
			})
		}
 	})
})

app2.post('/removeAllColor', (req, res) => {
	var buffer = Buffer.from(req.body.imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	var x = parseInt(req.body.x);
	var y = parseInt(req.body.y);
	var color = req.body.color;
	var fuzz = parseInt(req.body.fuzz);
	Jimp.read(buffer, (err, image) => {
		if (err) {
			console.log(err);		
		} else {
			image.write(tempDir+"/temp.png", (err) => {
				var cmdString = 'magick convert '+tempDir+'/temp.png -fuzz '+fuzz+'% -transparent '+color+' '+tempDir+'/temp.png';
				imagemagickCli.exec(cmdString).then(({ stdout, stderr }) => {
					Jimp.read(tempDir+"/temp.png", (err, image) => {
						if (err) {
							console.log(err);
						} else {
							image.getBase64(Jimp.AUTO, (err, ret) => {
								res.end(ret);
							})
						}
					})
				})
			})
		}
	})
});

app2.post('/saveUniform', (req, res) => {
	const jerseyLogoCanvas = Buffer.from(req.body.jerseyLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const jerseyBelow = Buffer.from(req.body.jerseyBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const pantsLogoCanvas = Buffer.from(req.body.pantsLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const pantsBelow = Buffer.from(req.body.pantsBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const capLogoCanvas = Buffer.from(req.body.capLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const capBelow = Buffer.from(req.body.capBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');

	sharp(capBelow)
		.composite([
			{ input: __dirname+"/images/texture_cap_default.png", blend: 'multiply' },
			{ input: capLogoCanvas }
		])
		.toFile(tempDir+'/caps_'+req.body.name+".png")
	
	sharp(pantsBelow)
		.composite([
			{ input: pantsLogoCanvas }
		])
		.toFile(tempDir+'/pants_'+req.body.name+"_d.png")

	sharp(jerseyBelow)
		.composite([
			{ input: jerseyLogoCanvas }
		])
		.toFile(tempDir+'/jersey_'+req.body.name+"_d.png")
	res.end()
})

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
    mainWindow.maximize()
    mainWindow.webContents.openDevTools()
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