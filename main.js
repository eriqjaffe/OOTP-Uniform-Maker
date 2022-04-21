const { app, BrowserWindow, dialog, Menu, shell, webContents  } = require('electron')
const path = require('path')
const os = require('os');
const fs = require('fs')
const url = require('url');
const express = require('express')
const Jimp = require('jimp')
const archiver = require('archiver');
const imagemagickCli = require('imagemagick-cli')
const ttfInfo = require('ttfinfo')
const font2base64 = require("node-font2base64")

const isMac = process.platform === 'darwin'
const tempDir = os.tmpdir()
const app2 = express();

const server = app2.listen(0, () => {
	console.log(`Server running on port ${server.address().port}`);
});

const preferredColorFormat = "hex"
const preferredTexture = "tbd"

app2.use(express.urlencoded({limit: '200mb', extended: true, parameterLimit: 500000}));

app2.get("/uploadImage", (req, res) => {
	dialog.showOpenDialog(null, {
		properties: ['openFile'],
		filters: [
			{ name: 'Images', extensions: ['jpg', 'png'] }
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
		  } else {
			  console.log("cancelled")
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

app2.get("/customFont", (req, res) => {
	dialog.showOpenDialog(null, {
		properties: ['openFile'],
		filters: [
			{ name: 'Fonts', extensions: ['ttf', 'otf'] }
		]
	}).then(result => {
		if(!result.canceled) {
			ttfInfo(result.filePaths[0], function(err, info) {
			var ext = getExtension(result.filePaths[0])
				const dataUrl = font2base64.encodeToDataUrlSync(result.filePaths[0])
				var fontPath = url.pathToFileURL(tempDir + '/'+path.basename(result.filePaths[0]))
				fs.copyFile(result.filePaths[0], tempDir + '/'+path.basename(result.filePaths[0]), (err) => {
					if (err) {
						console.log(err)
					} else {
						res.json({
							"fontName": info.tables.name[1],
							"fontStyle": info.tables.name[2],
							"familyName": info.tables.name[6],
							"fontFormat": ext,
							"fontMimetype": 'font/' + ext,
							"fontData": fontPath.href,
							'fontBase64': dataUrl
						});
						res.end()
					}
				})
			});
		}
	}).catch(err => {
		console.log(err)
	})
})

app2.post('/warpText', (req, res)=> {
	var buffer = Buffer.from(req.body.imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	var amount = req.body.amount;
	var deform = req.body.deform;
	var width;
	var height;
	var cmdLine;
	Jimp.read(buffer, (err, image) => {
		if (err) {
			console.log(err);
		} else {
			image.autocrop();
			image.write(tempDir+"/temp.png");
			width = image.bitmap.width;
			height = image.bitmap.height;
			switch (deform) {
				case "arch":
					cmdLine = 'magick convert -background transparent -wave -'+amount+'x'+width*2+' -trim +repage '+tempDir+'/temp.png '+tempDir+'/'+deform+'.png'
					break;
				case "arc":
					cmdLine = 'magick convert '+tempDir+'/temp.png -virtual-pixel Background -background transparent -distort Arc '+amount+' -trim +repage '+tempDir+'/'+deform+'.png'
					break;
				case "bilinearUp":
					var y2=height*((100-amount)*0.01)
					cmdLine = 'magick convert '+tempDir+'/temp.png -virtual-pixel transparent -interpolate Spline -distort BilinearForward "0,0 0,0 0,'+height+' 0,'+height+' '+width+',0 '+width+',0 '+width+','+height+' '+width+','+y2+'" '+tempDir+'/'+deform+'.png'
					break;
				case "bilinearDown":
					var y2=height*((100-amount)*0.01)
					cmdLine = 'magick convert '+tempDir+'/temp.png -virtual-pixel transparent -interpolate Spline -distort BilinearForward "0,0 0,0 0,'+height+' 0,'+y2+' '+width+',0 '+width+',0 '+width+','+height+' '+width+','+height+'" '+tempDir+'/'+deform+'.png'
					break;
				case "archUp":
					imagemagickCli.exec('magick convert '+tempDir+'/temp.png -gravity west -background transparent -extent '+width*2+'x'+height+' '+tempDir+'/temp.png').then(({stdout, stderr }) => {
						imagemagickCli.exec('magick convert -background transparent -wave -'+amount*2+'x'+width*4+' -trim +repage '+tempDir+'/temp.png '+tempDir+'/'+deform+'.png').then(({ stdout, stderr }) => {
							Jimp.read(tempDir+'/'+deform+'.png', (err, image) => {
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
					break;
				case "archDown":
					imagemagickCli.exec('magick convert '+tempDir+'/temp.png -gravity east -background transparent -extent '+width*2+'x'+height+' '+tempDir+'/temp.png').then(({stdout, stderr }) => {
						imagemagickCli.exec('magick convert -background transparent -wave -'+amount*2+'x'+width*4+' -trim +repage '+tempDir+'/temp.png '+tempDir+'/'+deform+'.png').then(({ stdout, stderr }) => {
							Jimp.read(tempDir+'/'+deform+'.png', (err, image) => {
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
					break;
				default:
					image.getBase64(Jimp.AUTO, (err, ret) => {
						res.end(ret);
					})
					break;
			}
			imagemagickCli.exec(cmdLine).then(({ stdout, stderr }) => {
				Jimp.read(tempDir+'/'+deform+'.png', (err, image) => {
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

app2.post('/saveUniform', (req, res) => {
	const jerseyLogoCanvas = Buffer.from(req.body.jerseyLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const jerseyBelow = Buffer.from(req.body.jerseyBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const pantsLogoCanvas = Buffer.from(req.body.pantsLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const pantsBelow = Buffer.from(req.body.pantsBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const capLogoCanvas = Buffer.from(req.body.capLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const capBelow = Buffer.from(req.body.capBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const showPlanket = req.body.showPlanket
	const buttonPadSeams = req.body.buttonPadSeams
	const seamsVisible = req.body.seamsVisible
	const seamsOption = req.body.seamsOption
	const json = Buffer.from(req.body.json, 'utf8')

	fs.writeFileSync(app.getPath('downloads') + '/uniform_Unknown_Team_Home/uniform_' + req.body.name+'.uni', json)

	const output = fs.createWriteStream(tempDir + '/uniform_'+req.body.name+'.zip');

	output.on('close', function() {
		var data = fs.readFileSync(tempDir + '/uniform_'+req.body.name+'.zip');
		var saveOptions = {
		  defaultPath: app.getPath('downloads') + '/uniform_' + req.body.name+'.zip',
		}
		dialog.showSaveDialog(null, saveOptions).then((result) => { 
		  if (!result.canceled) {
			fs.writeFile(result.filePath, data, function(err) {
			  if (err) {
				fs.unlink(tempDir + '/uniform_'+req.body.name+'.zip', (err) => {
				  if (err) {
					console.log(err)
					return
				  }
				})
				console.log(err)
				res.json({result: "error", errno: err.errno})
			  } else {
				fs.unlink(tempDir + '/uniform_'+req.body.name+'.zip', (err) => {
				  if (err) {
					console.log(err)
					return
				  }
				})
				res.json({result: "success"})
			  };
			})
		  } else {
			fs.unlink(tempDir + '/uniform_'+req.body.name+'.zip', (err) => {
			  if (err) {
				console.log(err)
				return
			  }
			})
			res.json({result: "success"})
		  }
		})
	});

	const archive = archiver('zip', {
		lib: { level: 9 } // Sets the compression level.
	});
		
	archive.on('error', function(err) {
		throw err;
	});

	archive.pipe(output)

	prepareImages()

	async function prepareImages() {
		// cap
		let capBase = await Jimp.read(capBelow)
		let capOverlay = await Jimp.read(capLogoCanvas)
		let texture = await Jimp.read(__dirname+"/images/texture_cap_default.png")
		let capWM = await Jimp.read(__dirname+"/images/cap_watermark.png")
		await capWM.color([{ apply: "mix", params: [req.body.capWatermarkColor, 100] }]);
		await capBase.composite(texture, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		await capBase.composite(capOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await capBase.composite(capWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let capBuffer = await capBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(capBuffer, {name: "cap_"+req.body.name+".png"})
		await capBase.write(app.getPath('downloads') + '/uniform_Unknown_Team_Home/cap_' + req.body.name+'.png')

		// pants
		let pantsBase = await Jimp.read(pantsBelow)
		let pantsOverlay = await Jimp.read(pantsLogoCanvas)
		await pantsBase.composite(pantsOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let pantsWM = await Jimp.read(__dirname+"/images/pants_watermark.png")
		await pantsWM.color([{ apply: "mix", params: [req.body.pantsWatermarkColor, 100] }]);
		await pantsBase.composite(pantsWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let pantsBuffer = await pantsBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(pantsBuffer, {name: "pants_"+req.body.name+".png"})
		await pantsBase.write(app.getPath('downloads') + '/uniform_Unknown_Team_Home/pants_' + req.body.name+'.png')

		// jersey diffuse map
		let jerseyBase = await Jimp.read(jerseyBelow)
		let jerseyOverlay = await Jimp.read(jerseyLogoCanvas)
		console.log(buttonPadSeams)
		if (buttonPadSeams == "true") {
			console.log("button pad seams are visible")
			let bpSeamImg = await Jimp.read(__dirname+"/images/seams/seams_button_pad.png")
			await bpSeamImg.opacity(.25)
			await jerseyBase.composite(bpSeamImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		}
		if (seamsVisible == "true") {
			switch (seamsOption) {
				case "seamsStandardToPiping":
					var seamSrc = __dirname+"/images/seams/seams_standard_to_piping.png"
					break;
				case "seamsStandardToCollar":
					var seamSrc = __dirname+"/images/seams/seams_standard_to_collar.png"
					break;
				case "seamsRaglanToPiping":
					var seamSrc = __dirname+"/images/seams/seams_raglan_to_piping.png"
					break;
				case "seamsRaglanToCollar":
					var seamSrc = __dirname+"/images/seams/seams_raglan_to_collar.png"
					break;
			}
			let seamsImg = await Jimp.read(seamSrc)
			await seamsImg.opacity(.25)
			await jerseyBase.composite(seamsImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		}
		await jerseyBase.composite(jerseyOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let jerseyWM = await Jimp.read(__dirname+"/images/jersey_watermark.png")
		await jerseyWM.color([{ apply: "mix", params: [req.body.jerseyWatermarkColor, 100] }]);
		await jerseyBase.composite(jerseyWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let jerseyBuffer = await jerseyBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyBuffer, {name: "jersey_"+req.body.name+"_d.png"})
		await jerseyBase.write(app.getPath('downloads') + '/uniform_Unknown_Team_Home/jersey_' + req.body.name+'_d.png')
		
		// jersey height map
		let jerseyHeightMap = await Jimp.read(__dirname+"/images/jersey_height_map.png")
		await jerseyOverlay.grayscale()
		await jerseyOverlay.brightness(.5)
		if (buttonPadSeams == "true") {
			console.log("button pad seams are visible")
			let bpHMSeamImg = await Jimp.read(__dirname+"/images/seams/seams_button_pad.png")
			await bpHMSeamImg.brightness(.33)
			await jerseyHeightMap.composite(bpHMSeamImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		}
		if (seamsVisible == "true") {
			switch (seamsOption) {
				case "seamsStandardToPiping":
					var seamHMSrc = __dirname+"/images/seams/seams_standard_to_piping.png"
					break;
				case "seamsStandardToCollar":
					var seamHMSrc = __dirname+"/images/seams/seams_standard_to_collar.png"
					break;
				case "seamsRaglanToPiping":
					var seamHMSrc = __dirname+"/images/seams/seams_raglan_to_piping.png"
					break;
				case "seamsRaglanToCollar":
					var seamHMSrc = __dirname+"/images/seams/seams_raglan_to_collar.png"
					break;
			}
			let seamsHMImg = await Jimp.read(seamHMSrc)
			await seamsHMImg.brightness(.33)
			await jerseyHeightMap.composite(seamsHMImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		}
		if (showPlanket == "true") {
			console.log("showing planket")
			let planket = await Jimp.read(__dirname+"/images/planket.png")
			await jerseyHeightMap.composite(planket, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		}
		await jerseyHeightMap.composite(jerseyOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let jerseyHMBuffer = await jerseyHeightMap.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyHMBuffer, {name: "jersey_"+req.body.name+"_h.png"})
		await jerseyHeightMap.write(app.getPath('downloads') + '/uniform_Unknown_Team_Home/jersey_' + req.body.name+'_h.png')

		// jersey with baked texture
		let jerseyBakedBase = await Jimp.read(jerseyBelow)
		let jerseyBakedOverlay = await Jimp.read(jerseyLogoCanvas)
		let jerseyTexture = await Jimp.read(__dirname+"/images/texture_jersey_default.png")
		if (buttonPadSeams == "true") {
			let bpBakedSeamImg = await Jimp.read(__dirname+"/images/seams/seams_button_pad.png")
			await bpBakedSeamImg.opacity(.25)
			await jerseyBakedBase.composite(bpBakedSeamImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		}
		if (seamsVisible == "true") {
			switch (seamsOption) {
				case "seamsStandardToPiping":
					var seamSrc = __dirname+"/images/seams/seams_standard_to_piping.png"
					break;
				case "seamsStandardToCollar":
					var seamSrc = __dirname+"/images/seams/seams_standard_to_collar.png"
					break;
				case "seamsRaglanToPiping":
					var seamSrc = __dirname+"/images/seams/seams_raglan_to_piping.png"
					break;
				case "seamsRaglanToCollar":
					var seamSrc = __dirname+"/images/seams/seams_raglan_to_collar.png"
					break;
			}
			let seamsBakedImg = await Jimp.read(seamSrc)
			await seamsBakedImg.opacity(.25)
			await jerseyBakedBase.composite(seamsBakedImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		}
		await jerseyBakedBase.composite(jerseyTexture, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		await jerseyBakedBase.composite(jerseyBakedOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let jerseyBakedBuffer = await jerseyBakedBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyBakedBuffer, {name: "jersey_"+req.body.name+".png"})
		await jerseyBakedBase.write(app.getPath('downloads') + '/uniform_Unknown_Team_Home/jersey_' + req.body.name+'.png')

		archive.append(json, {name: "uniform_"+req.body.name+".uni"})
		archive.append(fs.createReadStream(__dirname+"/images/README.pdf"), { name: 'README.pdf' });
		
	    archive.finalize()
	}
})

app2.get("/loadUniform", (req, res) => {
	const file = dialog.showOpenDialogSync(null, {
		properties: ['openFile'],
		filters: [
			{ name: 'Uniform Files', extensions: ['uni'] }
		]
	})
	//res.end(JSON.stringify(JSONC.unpack(fs.readFileSync(file[0]).toString())))
	res.end(JSON.stringify(JSON.parse(fs.readFileSync(file[0]).toString())))
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
              click: () => mainWindow.webContents.send('load-uniform','click'),
              accelerator: isMac ? 'Cmd+L' : 'Control+L',
              label: 'Load Uniform',
          },
          {
              click: () => mainWindow.webContents.send('save-uniform','click'),
              accelerator: isMac ? 'Cmd+S' : 'Control+S',
              label: 'Save Uniform',
          },
          isMac ? { role: 'close' } : { role: 'quit' }
          ]
      },
	  {
		  label: 'Edit',
		  submenu: [
			{
				click: () => mainWindow.webContents.send('copy','click'),
				accelerator: isMac ? 'Cmd+C' : 'Control+C',
				label: 'Copy',
			},
			{
				click: () => mainWindow.webContents.send('paste','click'),
				accelerator: isMac ? 'Cmd+V' : 'Control+V',
				label: 'Paste',
			}
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
                  label: 'About the OOTP Uniform Maker',
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

function getExtension(filename) {
	var ext = path.extname(filename||'').split('.');
	return ext[ext.length - 1];
}
