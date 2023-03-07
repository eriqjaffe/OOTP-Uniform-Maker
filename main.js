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
const Store = require("electron-store")
const { exec } = require('child_process')
const { SVG, registerWindow } = require('@svgdotjs/svg.js')
const { createSVGWindow } = require('svgdom')
const versionCheck = require('github-version-checker');
const pkg = require('./package.json');
const e = require('express');

const { log } = console;
function proxiedLog(...args) {
  const line = (((new Error('log'))
    .stack.split('\n')[2] || '…')
    .match(/\(([^)]+)\)/) || [, 'not found'])[1];
  log.call(console, `${line}\n`, ...args);
}
console.info = proxiedLog;
console.log = proxiedLog;

const isMac = process.platform === 'darwin'
const tempDir = os.tmpdir()
const app2 = express();
const store = new Store();
const window = createSVGWindow()
const document = window.document

const server = app2.listen(0, () => {
	console.log(`Server running on port ${server.address().port}`);
});

const preferredColorFormat = store.get("preferredColorFormat", "hex")
const preferredJerseyTexture = store.get("preferredJerseyTexture", "jersey_texture_default.png")
const preferredPantsTexture = store.get("preferredPantsTexture", "pants_texture_default.png")
const preferredCapTexture = store.get("preferredCapTexture", "cap_texture_wool.png")
const preferredPlayerName = store.get("preferredPlayerName", "PLAYER")
const preferredPlayerNumber = store.get("preferredPlayerNumber", "23")
const preferredJerseyFont = store.get("preferredJerseyFont", "./fonts/LeckerliOne-Regular.ttf")
const preferredCapFont = store.get("preferredCapFont", "./fonts/Graduate-Regular.ttf")
const preferredNameFont = store.get("preferredNameFont", "./fonts/MLBBlock.ttf")
const preferredNumberFont = store.get("preferredNumberFont", "./fonts/MLBBlock.ttf")
const preferredHeightMapBrightness = store.get("preferredHeightMapBrightness", "85") 
const preferredSeamOpacity = store.get("preferredSeamOpacity", "33")
const gridsVisible = store.get("gridsVisible", true)
const checkForUpdates = store.get("checkForUpdates", true)
const seamsVisibleOnDiffuse = store.get("seamsVisibleOnDiffuse", false)

/* for (const dependency of ['chrome', 'node', 'electron']) {
    console.log(dependency+", "+process.versions[dependency])
} */

const fontArray = {"Acme": "Acme-Regular.ttf", "athletic_gothicregular": "athletic_gothic-webfont.ttf", "athletic_gothic_shadowregular": "athletic_gothic_shadow-webfont.ttf", "beaverton_scriptregular": "beaverton_script-webfont.ttf", "BerkshireSwash": "BerkshireSwash-Regular.ttf", "CantoraOne": "CantoraOne-Regular.ttf", "caxton_romanregular": "caxton_roman-webfont.ttf", "ChelaOne": "ChelaOne-Regular.ttf", "russell_circusregular": "circus-webfont.ttf", "Condiment": "Condiment-Regular.ttf", "Cookie": "Cookie-Regular.ttf", "Courgette": "Courgette-Regular.ttf", "CroissantOne": "CroissantOne-Regular.ttf", "Damion": "Damion-Regular.ttf", "Engagement": "Engagement-Regular.ttf", "rawlings_fancy_blockregular": "rawlingsfancyblock-regular-webfont.ttf", "GermaniaOne": "GermaniaOne-Regular.ttf", "Graduate": "Graduate-Regular.ttf", "GrandHotel": "GrandHotel-Regular.ttf", "JockeyOne": "JockeyOne-Regular.ttf", "kansasregular": "tuscan-webfont.ttf", "KaushanScript": "KaushanScript-Regular.ttf", "LeckerliOne": "LeckerliOne-Regular.ttf", "LilyScriptOne": "LilyScriptOne-Regular.ttf", "Lobster": "Lobster-Regular.ttf", "LobsterTwo": "LobsterTwo-Regular.ttf", "MetalMania": "MetalMania-Regular.ttf", "Miniver": "Miniver-Regular.ttf", "Molle,italic": "Molle-Regular.ttf", "NewRocker": "NewRocker-Regular.ttf", "Norican": "Norican-Regular.ttf", "rawlings_old_englishmedium": "rawlingsoldenglish-webfont.ttf", "OleoScript": "OleoScript-Regular.ttf", "OleoScriptSwashCaps": "OleoScriptSwashCaps-Regular.ttf", "Pacifico": "Pacifico.ttf", "PirataOne": "PirataOne-Regular.ttf", "Playball": "Playball-Regular.ttf", "pro_full_blockregular": "pro_full_block-webfont.ttf", "richardson_fancy_blockregular": "richardson_fancy_block-webfont.ttf", "RubikOne": "RubikOne-Regular.ttf", "RumRaisin": "RumRaisin-Regular.ttf", "Satisfy": "Satisfy-Regular.ttf", "SeymourOne": "SeymourOne-Regular.ttf", "spl28scriptregular": "spl28script-webfont.ttf", "ua_tiffanyregular": "tiffany-webfont.ttf", "TradeWinds": "TradeWinds-Regular.ttf", "mlb_tuscan_newmedium": "mlb_tuscan_new-webfont.ttf", "UnifrakturCook": "UnifrakturCook-Bold.ttf", "UnifrakturMaguntia": "UnifrakturMaguntia-Book.ttf", "Vibur": "Vibur-Regular.ttf", "Viga": "Viga-Regular.ttf", "Wellfleet": "Wellfleet-Regular.ttf", "WendyOne": "WendyOne-Regular.ttf", "Yellowtail": "Yellowtail-Regular.ttf"};

const options = {
	repo: 'OOTP-Uniform-Maker',
	owner: 'eriqjaffe',
	currentVersion: pkg.version
};

var imInstalled = true;

/* exec("magick -version", (error, stdout, stderr) => {
	if (error) {
		console.log(`error: ${error.message}`);
		imInstalled = false;
		return;
	}
	if (stderr) {
		console.log(`stderr: ${stderr}`);
		imInstalled = false;
		return;
	} 
	console.log(`stdout: ${stdout}`);
	imInstalled = true;
}) */

app2.use(express.urlencoded({limit: '200mb', extended: true, parameterLimit: 500000}));

app2.get("/checkForUpdate", (req,res) => {
	versionCheck(options, function (error, update) { // callback function
		if (error) throw error;
		if (update) { // print some update info if an update is available
			res.json({
				"update": true,
				"currentVersion": pkg.version,
				"name": update.name,
				"url": update.url
			})
		} else {
			res.json({
				"update": false,
				"currentVersion": pkg.version,
			})
		}
	});
})

app2.get("/dropImage", (req, res) => {
	Jimp.read(req.query.file, (err, image) => {
		if (err) {
			res.json({
				"filename": "error not an image",
				"image": "error not an image"
			})
		} else {
			image.getBase64(Jimp.AUTO, (err, ret) => {
				res.json({
					"filename": path.basename(req.query.file),
					"image": ret
				});
			})
		}
	})
})

app2.get("/uploadImage", (req, res) => {
	const options = {
		defaultPath: store.get("uploadImagePath", app.getPath('pictures')),
		properties: ['openFile'],
		filters: [
			{ name: 'Images', extensions: ['jpg', 'png'] }
		]
	}
	dialog.showOpenDialog(null, options).then(result => {
		  if(!result.canceled) {
			store.set("uploadImagePath", path.dirname(result.filePaths[0]))
			Jimp.read(result.filePaths[0], (err, image) => {
				if (err) {
					console.log(err);
				} else {
					if (req.query.type == "jersey") {
						Jimp.read(__dirname+"/images/mask.png", (err, mask) => {
							image.mask(mask,0,0)
							image.getBase64(Jimp.AUTO, (err, ret) => {
								res.json({
									"filename": path.basename(result.filePaths[0]),
									"image": ret
								});
							})
						})
					} else {
						image.getBase64(Jimp.AUTO, (err, ret) => {
							res.json({
								"filename": path.basename(result.filePaths[0]),
								"image": ret
							});
						})
					}
				}
			});
		  } else {
			  res.end()
			  console.log("cancelled")
		  }
	  }).catch(err => {
		  console.log(err)
	  })
})

app2.post("/removeBorder", (req, res) => {
/* 	if (imInstalled == false) {
		res.end("NOT INSTALLED")
	}  */
	var buffer = Buffer.from(req.body.imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	var fuzz = parseInt(req.body.fuzz);
	Jimp.read(buffer, (err, image) => {
		if (err) {
			console.log(err);
		} else {
			try {
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
			} catch (error) {
				res.end("NOT INSTALLED")
			}
		}
	})
})

app2.post("/replaceColor", (req, res) => {
/* 	if (imInstalled == false) {
		res.end("NOT INSTALLED")
	} */
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
/* 	if (imInstalled == false) {
		res.end("NOT INSTALLED")
	} */
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
/* 	if (imInstalled == false) {
		res.end("NOT INSTALLED")
	} */
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
	const options = {
		defaultPath: store.get("uploadFontPath", app.getPath('desktop')),
		properties: ['openFile'],
		filters: [
			{ name: 'Fonts', extensions: ['ttf', 'otf'] }
		]
	}
	dialog.showOpenDialog(null, options).then(result => {
		if(!result.canceled) {
			store.set("uploadFontPath", path.dirname(result.filePaths[0]))
			try {
				ttfInfo(result.filePaths[0], function(err, info) {
				var ext = getExtension(result.filePaths[0])
					const dataUrl = font2base64.encodeToDataUrlSync(result.filePaths[0])
					var fontPath = url.pathToFileURL(result.filePaths[0])
					res.json({
						"status": "ok",
						"fontName": info.tables.name[1],
						"fontStyle": info.tables.name[2],
						"familyName": info.tables.name[6],
						"fontFormat": ext,
						"fontMimetype": 'font/' + ext,
						"fontData": fontPath.href,
						'fontBase64': dataUrl
					});
					res.end()
				});
			} catch (err) {
				res.json({
					"status":"error",
					"message": err
				})
				res.end()
			}
		} else {
			res.json({"status":"cancelled"})
			res.end()
			console.log("cancelled")
		}
	}).catch(err => {
		console.log(err)
		res.json({
			"status":"error",
			"message": err
		})
		res.end()
	})
})


app2.post('/warpText', (req, res)=> {
/* 	if (imInstalled == false) {
		res.end("NOT INSTALLED")
	} */
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

app2.post('/jitterText', (req, res) => {
	var text = req.body.text;
	var diag = text.split("");
	var fill = req.body.fill;
	var stroke1 = req.body.stroke1Color;
	var stroke2 = req.body.stroke2Color;
	var font = fontArray[req.body.font];
	var size = req.body.size;
	var h = parseInt(req.body.hSpacing);
	var v = parseInt(req.body.vSpacing);
	var stroke1Visible = (req.body.stroke1Visible === 'true');
	var stroke2Visible = (req.body.stroke2Visible === 'true');
	var fillVisible = (req.body.fillVisible === 'true');
	var x = 10;
	var y = 10;
	var cmd;

	var font_name = 'custom';
	var font_format = 'woff2'; // best compression
	var font_mimetype = 'font/ttf';
	if (req.body.font.substring(0,5) === "file:") {
		var buff = fs.readFileSync(url.fileURLToPath(req.body.font));
	} else {
		var buff = fs.readFileSync(__dirname+'\\fonts\\'+font);
	}
	var font_data = 'data:'+font_mimetype+';charset=ascii;base64,' + buff.toString('base64')

	registerWindow(window, document)

	const canvas = SVG(document.documentElement).size(2048, 2048)

	canvas.clear()

	canvas.defs().element('style').words(
		"@font-face {" +
		"  font-family: 'temp';" +
		"  src: url('"+font_data+"')" +
		"    format('"+font_format+"')" +
		"  ;" +
		"}"
	)

	var group = canvas.group();

	if (stroke2Visible) {
		for (var i=0; i<diag.length; i++) {
			var text = group.text(diag[i]).font({
				size: size*2,
				fill: stroke2,
				family: 'temp'
			})
			//text.x(x)
			text.cx(x)
			text.y(y)
			text.stroke({ color: stroke2, width: 10 })
			x += h*2;
			y += v*2;
		}
	}
	x = 10;
	y = 10;

	if (stroke1Visible) {
		for (var i=0; i<diag.length; i++) {
			var text = group.text(diag[i])
			text.font({
				size: size*2,
				fill: stroke1,
				family: 'temp'
			})
			//text.x(x)
			text.cx(x)
			text.y(y)
			text.stroke({ color: stroke1, width: 6 })
			x += h*2;
			y += v*2;
		}
	}
	x = 10;
	y = 10;

	if (fillVisible) {
		for (var i=0; i<diag.length; i++) {
			var text = group.text(diag[i])
			text.font({
				size: size*2,
				fill: fill,
				family: 'temp'
			})
			//text.x(x)
			text.cx(x)
			text.y(y)
			x += h*2;
			y += v*2;
		}
	}
	group.x(10)
	group.y(10)
	canvas.height(group.bbox().height+20);
	canvas.width(group.bbox().width+20)
	var buff2 = Buffer.from(canvas.svg());
	res.end('data:image/svg+xml;base64,'+buff2.toString('base64'))
})

app2.post('/saveSwatches', (req, res) => {
	const options = {
		defaultPath: store.get("downloadSwatchPath", app.getPath('downloads')) + '/' + req.body.name+'.pal'
	}

	dialog.showSaveDialog(null, options).then((result) => {
		if (!result.canceled) {
			store.set("downloadSwatchPath", path.dirname(result.filePath))
			fs.writeFile(result.filePath, JSON.stringify(req.body, null, 2), 'utf8', function(err) {
				console.log(err)
			})
			res.json({result: "success"})
		} else {
			res.json({result: "success"})
		}
	}).catch((err) => {
		console.log(err);
		res.json({result: "success"})
	});
})

app2.get("/loadSwatches", (req, res) => {
	const options = {
		defaultPath: store.get("downloadSwatchPath", app.getPath('downloads')),
		properties: ['openFile'],
		filters: [
			{ name: 'Palette Files', extensions: ['pal'] }
		]
	}
	dialog.showOpenDialog(null, options).then(result => {
		if(!result.canceled) {
			res.json({
				"result": "success",
				"json": JSON.stringify(JSON.parse(fs.readFileSync(result.filePaths[0]).toString()))
			})
			res.end()
		} else {
			res.json({
				"result": "cancelled"
			})
			res.end()
			console.log("cancelled")
		}
	}).catch(err => {
		res.json({
			"result": "error"
		})
		console.log(err)
		res.end()
	})
})

app2.post('/savePants', (req, res) => {
	const pantsLogoCanvas = Buffer.from(req.body.pantsLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const pantsBelow = Buffer.from(req.body.pantsBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const text = req.body.text
	const tmpPantsTexture = req.body.pantsTexture

	const options = {
		defaultPath: store.get("downloadPath", app.getPath('downloads')) + '/' + req.body.name+'.png'
	}

	if (tmpPantsTexture.startsWith("data:image")) {
		fs.writeFileSync(tempDir+"/tempPantsTexture.png", tmpPantsTexture.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64')
		var pantsTexture = tempDir+"/tempPantsTexture.png"
	} else {
		var pantsTexture = __dirname+"/images/"+tmpPantsTexture
	}

	prepareImages()

	async function prepareImages() {
		let pantsBase = await Jimp.read(pantsBelow)
		let pantsTextureFile = await Jimp.read(pantsTexture)
		let pantsOverlay = await Jimp.read(pantsLogoCanvas)
		let font = await Jimp.loadFont(__dirname+"/fonts/rowdies.fnt")
		let blankImage = new Jimp(3000, 500)
		await blankImage.print(font, 10, 10, text)
		await blankImage.autocrop()
		await blankImage.scaleToFit(500,15)
		await blankImage.color([{ apply: "mix", params: [req.body.pantsWatermarkColor, 100] }]);
		await pantsBase.composite(pantsTextureFile, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		await pantsBase.composite(pantsOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let pantsWM = await Jimp.read(__dirname+"/images/pants_watermark.png")
		await pantsWM.color([{ apply: "mix", params: [req.body.pantsWatermarkColor, 100] }]);
		await pantsBase.composite(pantsWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await pantsBase.blit(blankImage, 256-(blankImage.bitmap.width/2), 12.5-(blankImage.bitmap.height/2))
		let pantsBuffer = await pantsBase.getBufferAsync(Jimp.MIME_PNG)
		let finalImage = Buffer.from(pantsBuffer).toString('base64');
		dialog.showSaveDialog(null, options).then((result) => {
			if (!result.canceled) {
				fs.writeFile(result.filePath, finalImage, 'base64', function(err) {
					console.log(err)
				})
				res.json({result: "success"})
			} else {
				res.json({result: "success"})
			}
		}).catch((err) => {
			console.log(err);
			res.json({result: "success"})
		});
	}
})

app2.post('/saveCap', (req, res) => {
	const capLogoCanvas = Buffer.from(req.body.capLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const capBelow = Buffer.from(req.body.capBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const text = req.body.text
	const tmpCapTexture = req.body.capTexture

	const options = {
		defaultPath: store.get("downloadPath", app.getPath('downloads')) + '/' + req.body.name+'.png'
	}

	if (tmpCapTexture.startsWith("data:image")) {
		fs.writeFileSync(tempDir+"/tempCapTexture.png", tmpCapTexture.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64')
		var capTexture = tempDir+"/tempCapTexture.png"
	} else {
		var capTexture = __dirname+"/images/"+tmpCapTexture
	}

	prepareImages()

	async function prepareImages() {
		let capBase = await Jimp.read(capBelow)
		let capOverlay = await Jimp.read(capLogoCanvas)
		let capTextureFile = await Jimp.read(capTexture)
		let font = await Jimp.loadFont(__dirname+"/fonts/rowdies.fnt")
		let blankImage = new Jimp(3000, 500)
		await blankImage.print(font, 10, 10, text)
		await blankImage.autocrop()
		await blankImage.scaleToFit(290,15)
		await blankImage.color([{ apply: "mix", params: [req.body.capWatermarkColor, 100] }]);
		let capWM = await Jimp.read(__dirname+"/images/cap_watermark.png")
		await capWM.color([{ apply: "mix", params: [req.body.capWatermarkColor, 100] }]);
		await capBase.composite(capTextureFile, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		await capBase.composite(capOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await capBase.composite(capWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await capBase.blit(blankImage, 357-(blankImage.bitmap.width/2), 120-(blankImage.bitmap.height/2))
		let capBuffer = await capBase.getBufferAsync(Jimp.MIME_PNG)
		let finalImage = Buffer.from(capBuffer).toString('base64');
		dialog.showSaveDialog(null, options).then((result) => {
			if (!result.canceled) {
				fs.writeFile(result.filePath, finalImage, 'base64', function(err) {
					console.log(err)
				})
				res.json({result: "success"})
			} else {
				res.json({result: "success"})
			}
		}).catch((err) => {
			console.log(err);
			res.json({result: "success"})
		});
	}
})

app2.post("/saveFont", (req, res) => {
    const fontCanvas = Buffer.from(req.body.fontCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');

    const options = {
        defaultPath: store.get("downloadPath", app.getPath('downloads')) + '/' + req.body.name+'.png'
	}
            
	prepareImages()

	async function prepareImages() {
		let finalImage = Buffer.from(fontCanvas).toString('base64');
		dialog.showSaveDialog(null, options).then((result) => {
			if (!result.canceled) {
				store.set("downloadPath", path.dirname(result.filePath))
				fs.writeFile(result.filePath, finalImage, 'base64', function(err) {
					console.log(err)
				})
				res.json({result: "success"})
			} else {
				res.json({result: "success"})
			}
		}).catch((err) => {
			console.log(err);
			res.json({result: "success"})
		});
	}
})

app2.post("/generateHeightMap", (req, res) => {
	const jerseyLogoCanvas = Buffer.from(req.body.jerseyLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const showPlanket = req.body.showPlanket
	const buttonPadSeams = req.body.buttonPadSeams
	const buttonType = req.body.buttonType
	const seamsVisible = req.body.seamsVisible
	const seamsOption = req.body.seamsOption
	const brightness = parseInt(req.body.brightness)/100
	const seamOpacity = parseInt(req.body.seamOpacity)/100

	prepareImages()

	async function prepareImages() {
		let jerseyHeightMap = await Jimp.read(__dirname+"/images/jersey_height_map.png")
		let jerseyOverlay = await Jimp.read(jerseyLogoCanvas)
		await jerseyOverlay.grayscale()
		await jerseyOverlay.brightness(brightness)
		if (buttonPadSeams == "true") {
			if (buttonType != "buttonsHenley") {
				if (seamsOption == "seamsSixties") {
					var seamsSrc = __dirname+"/images/seams/seams_button_pad_sixties.png"
				} else {
					var seamsSrc = __dirname+"/images/seams/seams_button_pad.png"
				}
			} else {
				if (seamsOption == "seamsSixties") {
					var seamsSrc = __dirname+"/images/seams/seams_button_pad_henley_sixties.png"
				} else {
					var seamsSrc = __dirname+"/images/seams/seams_button_pad_henley.png"
				}
			}
			let bpHMSeamImg = await Jimp.read(seamsSrc)
			await bpHMSeamImg.brightness(seamOpacity)
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
				case "seamsSixties":
					var seamHMSrc = __dirname+"/images/seams/seams_sixties.png"
					break;
			}
			let seamsHMImg = await Jimp.read(seamHMSrc)
			await seamsHMImg.brightness(seamOpacity)
			await jerseyHeightMap.composite(seamsHMImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		}
		if (showPlanket == "true") {
			if (buttonType != "buttonsHenley") {
				var planketSrc = __dirname+"/images/planket.png"
			} else {
				var planketSrc = __dirname+"/images/planket_henley.png"
			}
			let planket = await Jimp.read(planketSrc)
			await jerseyHeightMap.composite(planket, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		}
		await jerseyHeightMap.composite(jerseyOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await jerseyHeightMap.write(tempDir+"/temp_height_map.jpg")
		let base64 = await jerseyHeightMap.getBase64Async(Jimp.AUTO)
		res.json({
			"status": "success",
			"image": base64
		})
	}
})

app2.post('/saveJersey', (req, res) => {
	const jerseyLogoCanvas = Buffer.from(req.body.jerseyLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const jerseyBelow = Buffer.from(req.body.jerseyBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const nameCanvas = Buffer.from(req.body.nameCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const heightMap = Buffer.from(req.body.heightMap.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const normalMap = Buffer.from(req.body.normalMap.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const tmpJerseyTexture = req.body.jerseyTexture
	const buttonPadSeams = req.body.buttonPadSeams
	const buttonType = req.body.buttonType
	const seamsVisible = req.body.seamsVisible
	const seamsOption = req.body.seamsOption
	const seamsOnDiffuse = req.body.seamsOnDiffuse

	if (tmpJerseyTexture.startsWith("data:image")) {
		fs.writeFileSync(tempDir+"/tempJerseyTexture.png", tmpJerseyTexture.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64')
		var jerseyTexture = tempDir+"/tempJerseyTexture.png"
	} else {
		var jerseyTexture = __dirname+"/images/"+tmpJerseyTexture
	}

	const output = fs.createWriteStream(tempDir + '/'+req.body.name+'.zip');

	output.on('close', function() {
		var data = fs.readFileSync(tempDir + '/'+req.body.name+'.zip');
		var saveOptions = {
		  defaultPath: store.get("downloadPath", app.getPath('downloads')) + '/' + req.body.name+'.zip'
		}
		dialog.showSaveDialog(null, saveOptions).then((result) => { 
		  if (!result.canceled) {
			store.set("downloadPath", path.dirname(result.filePath))
			fs.writeFile(result.filePath, data, function(err) {
			  if (err) {
				fs.unlink(tempDir + '/'+req.body.name+'.zip', (err) => {
				  if (err) {
					console.log(err)
					return
				  }
				})
				console.log(err)
				res.json({result: "error", errno: err.errno})
			  } else {
				fs.unlink(tempDir + '/'+req.body.name+'.zip', (err) => {
				  if (err) {
					console.log(err)
					return
				  }
				})
				res.json({result: "success"})
			  };
			})
		  } else {
			fs.unlink(tempDir + '/'+req.body.name+'.zip', (err) => {
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
		// jersey diffuse map
		let jerseyBase = await Jimp.read(jerseyBelow)
		let jerseyTextureFile = await Jimp.read(jerseyTexture)
		let jerseyOverlay = await Jimp.read(jerseyLogoCanvas)
		let nameImage = await Jimp.read(nameCanvas)
		if (seamsOnDiffuse == "true") {
			if (buttonType != "buttonsHenley") {
				if (seamsOption == "seamsSixties") {
					var diffuseSeamsSrc = __dirname+"/images/seams/seams_button_pad_sixties.png"
				} else {
					var diffuseSeamsSrc = __dirname+"/images/seams/seams_button_pad.png"
				}
			} else {
				if (seamsOption == "seamsSixties") {
					var diffuseSeamsSrc = __dirname+"/images/seams/seams_button_pad_henley_sixties.png"
				} else {
					var diffuseSeamsSrc = __dirname+"/images/seams/seams_button_pad_henley.png"
				}
			}
			let diffuseSeamImg = await Jimp.read(diffuseSeamsSrc)
			await diffuseSeamImg.opacity(.1)
			await jerseyBase.composite(diffuseSeamImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
			switch (seamsOption) {
				case "seamsStandardToPiping":
					var diffuseSeamSrc = __dirname+"/images/seams/seams_standard_to_piping.png"
					break;
				case "seamsStandardToCollar":
					var diffuseSeamSrc = __dirname+"/images/seams/seams_standard_to_collar.png"
					break;
				case "seamsRaglanToPiping":
					var diffuseSeamSrc = __dirname+"/images/seams/seams_raglan_to_piping.png"
					break;
				case "seamsRaglanToCollar":
					var diffuseSeamSrc = __dirname+"/images/seams/seams_raglan_to_collar.png"
					break;
				case "seamsSixties":
					var diffuseSeamSrc = __dirname+"/images/seams/seams_sixties.png"
					break;
			}
			let seamsDiffuseImg = await Jimp.read(diffuseSeamSrc)
			await seamsDiffuseImg.opacity(.1)
			await jerseyBase.composite(seamsDiffuseImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		}
		await jerseyBase.composite(jerseyTextureFile, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		await jerseyBase.composite(jerseyOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let jerseyWM = await Jimp.read(__dirname+"/images/jersey_watermark.png")
		await jerseyWM.color([{ apply: "mix", params: [req.body.jerseyWatermarkColor, 100] }]);
		await jerseyBase.composite(jerseyWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await jerseyBase.composite(nameImage, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let jerseyBuffer = await jerseyBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyBuffer, {name: req.body.name+".png"})
		//await jerseyBase.write(app.getPath('downloads') + '/jerseys_' + req.body.name+'.png')
		
		// jersey height map
		let jerseyHeightMap = await Jimp.read(heightMap)
		let jerseyHMBuffer = await jerseyHeightMap.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyHMBuffer, {name: req.body.name+"_h.png"})
		//await jerseyHeightMap.write(tempDir+"/temp_height_map.jpg")

		// jersey normal map
		let jerseyNormalMap = await Jimp.read(normalMap)
		let jerseyNMBUffer = await jerseyNormalMap.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyNMBUffer, {name: req.body.name+"_n.png"})
		//await jerseyNormalMap.write(tempDir+"/temp_normal_map.jpg")
		
		// jersey with baked texture
		let jerseyBakedBase = await Jimp.read(jerseyBelow)
		let jerseyBakedOverlay = await Jimp.read(jerseyLogoCanvas)
		let jerseyBakedTexture = await Jimp.read(jerseyTexture)
		let jerseyBakedTexture2 = await Jimp.read(__dirname+"/images/texture_jersey_default.png")
		let bakedNameImage = await Jimp.read(nameCanvas)
		if (buttonPadSeams == "true") {
			if (buttonType != "buttonsHenley") {
				if (seamsOption == "seamsSixties") {
					var bakedSeamsSrc = __dirname+"/images/seams/seams_button_pad_sixties.png"
				} else {
					var bakedSeamsSrc = __dirname+"/images/seams/seams_button_pad.png"
				}
			} else {
				if (seamsOption == "seamsSixties") {
					var bakedSeamsSrc = __dirname+"/images/seams/seams_button_pad_henley_sixties.png"
				} else {
					var bakedSeamsSrc = __dirname+"/images/seams/seams_button_pad_henley.png"
				}
			}
			let bpBakedSeamImg = await Jimp.read(bakedSeamsSrc)
			await bpBakedSeamImg.opacity(.1)
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
				case "seamsSixties":
					var seamSrc = __dirname+"/images/seams/seams_sixties.png"
					break;
			}
			let seamsBakedImg = await Jimp.read(seamSrc)
			await seamsBakedImg.opacity(.1)
			await jerseyBakedBase.composite(seamsBakedImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		}
		await jerseyBakedBase.composite(jerseyBakedTexture, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		await jerseyBakedBase.composite(jerseyBakedTexture2, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		await jerseyBakedBase.composite(jerseyBakedOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let jerseyBakedWM = await Jimp.read(__dirname+"/images/jersey_watermark.png")
		await jerseyBakedWM.color([{ apply: "mix", params: [req.body.jerseyWatermarkColor, 100] }]);
		await jerseyBakedBase.composite(jerseyBakedWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await jerseyBakedBase.composite(bakedNameImage, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let jerseyBakedBuffer = await jerseyBakedBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyBakedBuffer, {name: req.body.name+"_textured.png"})
		//await jerseyBakedBase.write(app.getPath('downloads') + '/jerseys_' + req.body.name+'_textured.png')

		archive.append(fs.createReadStream(__dirname+"/images/README.pdf"), { name: 'README.pdf' });
		archive.finalize()
	}
})

app2.post('/saveUniform', (req, res) => {
	const jerseyLogoCanvas = Buffer.from(req.body.jerseyLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const jerseyBelow = Buffer.from(req.body.jerseyBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const pantsLogoCanvas = Buffer.from(req.body.pantsLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const pantsBelow = Buffer.from(req.body.pantsBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const capLogoCanvas = Buffer.from(req.body.capLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const capBelow = Buffer.from(req.body.capBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const nameCanvas = Buffer.from(req.body.nameCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const heightMap = Buffer.from(req.body.heightMap.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const normalMap = Buffer.from(req.body.normalMap.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const fontCanvas = Buffer.from(req.body.fontCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const text = req.body.text;
	const tmpCapTexture = req.body.capTexture
	const tmpJerseyTexture = req.body.jerseyTexture
	const tmpPantsTexture = req.body.pantsTexture
	const buttonPadSeams = req.body.buttonPadSeams
	const buttonType = req.body.buttonType
	const seamsVisible = req.body.seamsVisible
	const seamsOption = req.body.seamsOption
	const seamsOnDiffuse = req.body.seamsOnDiffuse
	const commonPalette = req.body.commonPalette
	const json = Buffer.from(req.body.json, 'utf8')

	const swatchJSON = {
		name: req.body.name,
		swatch1: req.body.swatch1,
		swatch2: req.body.swatch2,
		swatch3: req.body.swatch3,
		swatch4: req.body.swatch4,
		commonPalette: commonPalette
	}

	if (tmpCapTexture.startsWith("data:image")) {
		fs.writeFileSync(tempDir+"/tempCapTexture.png", tmpCapTexture.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64')
		var capTexture = tempDir+"/tempCapTexture.png"
	} else {
		var capTexture = __dirname+"/images/"+tmpCapTexture
	}

	if (tmpJerseyTexture.startsWith("data:image")) {
		fs.writeFileSync(tempDir+"/tempJerseyTexture.png", tmpJerseyTexture.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64')
		var jerseyTexture = tempDir+"/tempJerseyTexture.png"
	} else {
		var jerseyTexture = __dirname+"/images/"+tmpJerseyTexture
	}

	if (tmpPantsTexture.startsWith("data:image")) {
		fs.writeFileSync(tempDir+"/tempPantsTexture.png", tmpPantsTexture.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64')
		var pantsTexture = tempDir+"/tempPantsTexture.png"
	} else {
		var pantsTexture = __dirname+"/images/"+tmpPantsTexture
	}

	fs.writeFileSync(app.getPath('downloads') + '/uniform_' + req.body.name+'.uni', json)

	const output = fs.createWriteStream(tempDir + '/uniform_'+req.body.name+'.zip');

	output.on('close', function() {
		var data = fs.readFileSync(tempDir + '/uniform_'+req.body.name+'.zip');
		var saveOptions = {
		  defaultPath: store.get("downloadPath", app.getPath('downloads')) + '/uniform_' + req.body.name+'.zip'
		}
		dialog.showSaveDialog(null, saveOptions).then((result) => { 
		  if (!result.canceled) {
			store.set("downloadPath", path.dirname(result.filePath))
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
		let font = await Jimp.loadFont(__dirname+"/fonts/rowdies.fnt")

		// cap
		let capBase = await Jimp.read(capBelow)
		let capOverlay = await Jimp.read(capLogoCanvas)
		let capTextureFile = await Jimp.read(capTexture)
		let blankCapImage = new Jimp(3000, 500)
		await blankCapImage.print(font, 10, 10, text)
		await blankCapImage.autocrop()
		await blankCapImage.scaleToFit(500,15)
		await blankCapImage.color([{ apply: "mix", params: [req.body.capWatermarkColor, 100] }]);
		let capWM = await Jimp.read(__dirname+"/images/cap_watermark.png")
		await capWM.color([{ apply: "mix", params: [req.body.capWatermarkColor, 100] }]);
		await capBase.composite(capTextureFile, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		await capBase.composite(capOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await capBase.composite(capWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await capBase.blit(blankCapImage, 357-(blankCapImage.bitmap.width/2), 120-(blankCapImage.bitmap.height/2))
		let capBuffer = await capBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(capBuffer, {name: "caps_"+req.body.name+".png"})
		//await capBase.write(app.getPath('desktop') + '/uniform_Unknown_Team_Home/caps_' + req.body.name+'.png')

		// pants
		let pantsBase = await Jimp.read(pantsBelow)
		let pantsTextureFile = await Jimp.read(pantsTexture)
		let pantsOverlay = await Jimp.read(pantsLogoCanvas)
		let blankPantsImage = new Jimp(3000, 500)
		await blankPantsImage.print(font, 10, 10, text)
		await blankPantsImage.autocrop()
		await blankPantsImage.scaleToFit(500,15)
		await blankPantsImage.color([{ apply: "mix", params: [req.body.pantsWatermarkColor, 100] }]);
		await pantsBase.composite(pantsTextureFile, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		await pantsBase.composite(pantsOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let pantsWM = await Jimp.read(__dirname+"/images/pants_watermark.png")
		await pantsWM.color([{ apply: "mix", params: [req.body.pantsWatermarkColor, 100] }]);
		await pantsBase.composite(pantsWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await pantsBase.blit(blankPantsImage, 256-(blankPantsImage.bitmap.width/2), 12.5-(blankPantsImage.bitmap.height/2))
		let pantsBuffer = await pantsBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(pantsBuffer, {name: "pants_"+req.body.name+".png"})
		//await pantsBase.write(app.getPath('downloads') + '/pants_' + req.body.name+'.png')

		// font
		let fontBase = await Jimp.read(fontCanvas)
		let fontBuffer = await fontBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(fontBuffer, {name: "font_"+req.body.name+".png"})

		// jersey diffuse map
		let jerseyBase = await Jimp.read(jerseyBelow)
		let jerseyTextureFile = await Jimp.read(jerseyTexture)
		let jerseyOverlay = await Jimp.read(jerseyLogoCanvas)
		if (seamsOnDiffuse == "true") {
			if (buttonType != "buttonsHenley") {
				if (seamsOption == "seamsSixties") {
					var diffuseSeamsSrc = __dirname+"/images/seams/seams_button_pad_sixties.png"
				} else {
					var diffuseSeamsSrc = __dirname+"/images/seams/seams_button_pad.png"
				}	
			} else {
				if (seamsOption == "seamsSixties") {
					var diffuseSeamsSrc = __dirname+"/images/seams/seams_button_pad_henley_sixties.png"
				} else {
					var diffuseSeamsSrc = __dirname+"/images/seams/seams_button_pad_henley.png"
				}
			}
			let diffuseSeamImg = await Jimp.read(diffuseSeamsSrc)
			await diffuseSeamImg.opacity(.1)
			await jerseyBase.composite(diffuseSeamImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
			switch (seamsOption) {
				case "seamsStandardToPiping":
					var diffuseSeamSrc = __dirname+"/images/seams/seams_standard_to_piping.png"
					break;
				case "seamsStandardToCollar":
					var diffuseSeamSrc = __dirname+"/images/seams/seams_standard_to_collar.png"
					break;
				case "seamsRaglanToPiping":
					var diffuseSeamSrc = __dirname+"/images/seams/seams_raglan_to_piping.png"
					break;
				case "seamsRaglanToCollar":
					var diffuseSeamSrc = __dirname+"/images/seams/seams_raglan_to_collar.png"
					break;
				case "seamsSixties":
					var diffuseSeamSrc = __dirname+"/images/seams/seams_sixties.png"
					break;
			}
			let seamsDiffuseImg = await Jimp.read(diffuseSeamSrc)
			await seamsDiffuseImg.opacity(.1)
			await jerseyBase.composite(seamsDiffuseImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		}
		await jerseyBase.composite(jerseyTextureFile, 0, 0, {mode: Jimp.BLEND_MULTIPLY})	
		await jerseyBase.composite(jerseyOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let jerseyWM = await Jimp.read(__dirname+"/images/jersey_watermark.png")
		await jerseyWM.color([{ apply: "mix", params: [req.body.jerseyWatermarkColor, 100] }]);
		await jerseyBase.composite(jerseyWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let nameImage = await Jimp.read(nameCanvas)
		await jerseyBase.composite(nameImage, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let jerseyBuffer = await jerseyBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyBuffer, {name: "jerseys_"+req.body.name+".png"})
		//await jerseyBase.write(app.getPath('downloads') + '/jerseys_' + req.body.name+'.png')
		
		// jersey height map
		let jerseyHeightMap = await Jimp.read(heightMap)
		let jerseyHMBuffer = await jerseyHeightMap.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyHMBuffer, {name: "jerseys_"+req.body.name+"_h.png"})
		//await jerseyHeightMap.write(tempDir+"/temp_height_map.jpg")

		// jersey normal map
		let jerseyNormalMap = await Jimp.read(normalMap)
		let jerseyNMBUffer = await jerseyNormalMap.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyNMBUffer, {name: "jerseys_"+req.body.name+"_n.png"})
		//await jerseyNormalMap.write(tempDir+"/temp_normal_map.jpg")

		// jersey with baked texture
		let jerseyBakedBase = await Jimp.read(jerseyBelow)
		let jerseyBakedOverlay = await Jimp.read(jerseyLogoCanvas)
		let jerseyBakedTexture = await Jimp.read(jerseyTexture)
		let jerseyBakedTexture2 = await Jimp.read(__dirname+"/images/texture_jersey_default.png")
		if (buttonPadSeams == "true") {
			if (buttonType != "buttonsHenley") {
				if (seamsOption == "seamsSixties") {
					var bakedSeamsSrc = __dirname+"/images/seams/seams_button_pad_sixties.png"
				} else {
					var bakedSeamsSrc = __dirname+"/images/seams/seams_button_pad.png"
				}
			} else {
				if (seamsOption == "seamsSixties") {
					var bakedSeamsSrc = __dirname+"/images/seams/seams_button_pad_henley_sixties.png"
				} else {
					var bakedSeamsSrc = __dirname+"/images/seams/seams_button_pad_henley.png"
				}
			}
			let bpBakedSeamImg = await Jimp.read(bakedSeamsSrc)
			await bpBakedSeamImg.opacity(.1)
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
				case "seamsSixties":
					var seamSrc = __dirname+"/images/seams/seams_sixties.png"
					break;
			}
			let seamsBakedImg = await Jimp.read(seamSrc)
			await seamsBakedImg.opacity(.1)
			await jerseyBakedBase.composite(seamsBakedImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		}
		await jerseyBakedBase.composite(jerseyBakedTexture, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		await jerseyBakedBase.composite(jerseyBakedTexture2, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		await jerseyBakedBase.composite(jerseyBakedOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let jerseyBakedWM = await Jimp.read(__dirname+"/images/jersey_watermark.png")
		await jerseyBakedWM.color([{ apply: "mix", params: [req.body.jerseyWatermarkColor, 100] }]);
		await jerseyBakedBase.composite(jerseyBakedWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let nameImageBaked = await Jimp.read(nameCanvas)
		await jerseyBakedBase.composite(nameImageBaked, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let jerseyBakedBuffer = await jerseyBakedBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyBakedBuffer, {name: "jerseys_"+req.body.name+"_textured.png"})
		//await jerseyBakedBase.write(app.getPath('downloads') + '/jerseys_' + req.body.name+'_textured.png')

		archive.append(JSON.stringify(swatchJSON, null, 2), {name: req.body.name+".pal"});
		archive.append(json, {name: "uniform_"+req.body.name+".uni"})
		archive.append(fs.createReadStream(__dirname+"/images/README.pdf"), { name: 'README.pdf' });
		//archive.append(fs.createReadStream(__dirname+"/images/"+normalMap), { name: "jerseys_"+req.body.name+"_n.png" });
	    archive.finalize()
	}
})

app2.get("/loadUniform", (req, res) => {
	const options = {
		defaultPath: store.get("uploadUniformPath", app.getPath('downloads')),
		properties: ['openFile'],
		filters: [
			{ name: 'Uniform Files', extensions: ['uni'] }
		]
	}
	dialog.showOpenDialog(null, options).then(result => {
		if(!result.canceled) {
			store.set("uploadUniformPath", path.dirname(result.filePaths[0]))
			res.json({
				"result": "success",
				"json": JSON.stringify(JSON.parse(fs.readFileSync(result.filePaths[0]).toString()))
			})
			res.end()
		} else {
			res.json({
				"result": "cancelled"
			})
			res.end()
			console.log("cancelled")
		}
	}).catch(err => {
		res.json({
			"result": "error"
		})
		console.log(err)
		res.end()
	})
})

app2.post('/setPreference', (req, res) => {
	const pref = req.body.pref;
	const val = req.body.val;
	store.set(pref, val)
	res.end()
});

function createWindow () {
    const mainWindow = new BrowserWindow({
      width: 1400,
      height: 1020,
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
		  { type: 'separator' },
          {
              click: () => mainWindow.webContents.send('save-uniform','click'),
              accelerator: isMac ? 'Cmd+S' : 'Control+S',
              label: 'Save Uniform',
          },
          {
              click: () => mainWindow.webContents.send('save-cap','click'),
              accelerator: isMac ? 'Cmd+B' : 'Control+B',
              label: 'Save Cap Only',
          },
          {
              click: () => mainWindow.webContents.send('save-pants','click'),
              accelerator: isMac ? 'Cmd+P' : 'Control+P',
              label: 'Save Pants Only',
          },
          {
              click: () => mainWindow.webContents.send('save-jersey','click'),
              accelerator: isMac ? 'Cmd+J' : 'Control+J',
              label: 'Save Jersey Only',
          },
          {
              click: () => mainWindow.webContents.send('save-font','click'),
              accelerator: isMac ? 'Cmd+F' : 'Control+F',
              label: 'Save Font Only',
          },
		  { type: 'separator' },
          {
              click: () => mainWindow.webContents.send('save-swatches','click'),
              accelerator: isMac ? 'Cmd+Shift+S' : 'Control+Shift+S',
              label: 'Save Palette',
          },
          {
              click: () => mainWindow.webContents.send('load-swatches','click'),
              accelerator: isMac ? 'Cmd+Shift+L' : 'Control+Shift+L',
              label: 'Load Palette',
          },
		  { type: 'separator' },
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
			},
			{ type: 'separator' },
			{
				click: () => mainWindow.webContents.send('prefs','click'),
				accelerator: isMac ? 'Cmd+Shift+P' : 'Control+Shift+P',
				label: 'Edit Preferences',
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
          { role: 'zoomin', accelerator: 'CommandOrControl+=' },
          { role: 'zoomout', accelerator: 'CommandOrControl+-' },
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
		  { type: 'separator' },
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
			  label: 'About fabric.js',
			  click: async () => {
			  await shell.openExternal('http://fabricjs.com/')
			  }
		  },
		  { type: 'separator' },
          {
              label: 'View project on GitHub',
              click: async () => {
              await shell.openExternal('https://github.com/eriqjaffe/OOTP-Uniform-Maker')
              }
          },
		  {
			  click: () => mainWindow.webContents.send('update','click'),
			  label: 'Check For Updates',
		  }
          ]
      }
      ]
      
      const menu = Menu.buildFromTemplate(template)
      Menu.setApplicationMenu(menu)
  
    mainWindow.loadURL(`file://${__dirname}/index.html?port=${server.address().port}&appVersion=${pkg.version}&preferredColorFormat=${preferredColorFormat}&preferredJerseyTexture=${preferredJerseyTexture}&preferredPantsTexture=${preferredPantsTexture}&preferredCapTexture=${preferredCapTexture}&gridsVisible=${gridsVisible}&checkForUpdates=${checkForUpdates}&preferredNameFont=${preferredNameFont}&preferredNumberFont=${preferredNumberFont}&preferredCapFont=${preferredCapFont}&preferredJerseyFont=${preferredJerseyFont}&seamsVisibleOnDiffuse=${seamsVisibleOnDiffuse}&preferredHeightMapBrightness=${preferredHeightMapBrightness}&preferredSeamOpacity=${preferredSeamOpacity}`);
    //mainWindow.loadURL(`file://${__dirname}/index.html?port=${server.address().port}`);
	
  
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
