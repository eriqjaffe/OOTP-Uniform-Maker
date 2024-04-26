const { app, BrowserWindow, dialog, Menu, shell, ipcMain } = require('electron')
const path = require('path')
const os = require('os');
const fs = require('fs')
const url = require('url');
const Jimp = require('jimp')
const { distortUnwrap } = require('@alxcube/lens')
require('@alxcube/lens-jimp');
const archiver = require('archiver');
const Store = require("electron-store")
const versionCheck = require('github-version-checker');
const pkg = require('./package.json');
const chokidar = require('chokidar')
const { create } = require('xmlbuilder2')
const increment = require('add-filename-increment');
const fontname = require('fontname')
const { createWorker } = require('tesseract.js');
const replaceColor = require('replace-color');
const admzip = require('adm-zip');
const semver = require('semver')
const { Magick, MagickCore } = require('magickwand.js');

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
const isWin = process.platform === 'win32'
const tempDir = os.tmpdir()
const store = new Store();
const userFontsFolder = path.join(app.getPath('userData'),"fonts")

const preferredColorFormat = store.get("preferredColorFormat", "hex")
const preferredJerseyTexture = store.get("preferredJerseyTexture", "jersey_texture_default.png")
const preferredPantsTexture = store.get("preferredPantsTexture", "pants_texture_default.png")
const preferredCapTexture = store.get("preferredCapTexture", "cap_texture_wool.png")
const preferredJerseyFont = store.get("preferredJerseyFont", "./fonts/LeckerliOne-Regular.ttf")
const preferredCapFont = store.get("preferredCapFont", "./fonts/Graduate-Regular.ttf")
const preferredNameFont = store.get("preferredNameFont", "./fonts/MLBBlock.ttf")
const preferredNumberFont = store.get("preferredNumberFont", "./fonts/MLBBlock.ttf")
const preferredHeightMapBrightness = store.get("preferredHeightMapBrightness", "85") 
const preferredSeamOpacity = store.get("preferredSeamOpacity", "33")
const gridsVisible = store.get("gridsVisible", true)
const checkForUpdates = store.get("checkForUpdates", true)
const seamsVisibleOnDiffuse = store.get("seamsVisibleOnDiffuse", false)

if (!fs.existsSync(userFontsFolder)) {
    fs.mkdirSync(userFontsFolder);
}

if (!fs.existsSync(userFontsFolder+"/README.txt")) {
	var writeStream = fs.createWriteStream(userFontsFolder+"/README.txt");
	writeStream.write("TTF and OTF fonts dropped into this folder will automatically be imported into the Uniform Maker!\r\n\r\nFonts removed from this folder will still be available in the Uniform Maker until you quit the app, and they will not reload after that.  Of course, that may cause uniforms that you load into the app to misbehave.")
	writeStream.end()
}

const watcher = chokidar.watch(userFontsFolder, {
	ignored: /(^|[\/\\])\../, // ignore dotfiles
	persistent: true
});

watcher.on('ready', () => {})

const options = {
	repo: 'OOTP-Uniform-Maker',
	owner: 'eriqjaffe',
	currentVersion: pkg.version
};

ipcMain.on('check-for-update', (event, arg) => {
	console.log(arg.type)
	versionCheck(options, function (error, update) { // callback function
		if (error) {
			dialog.showMessageBox(null, {
				type: 'error',
				message: 'An error occurred checking for updates:\r\n\r\n'+error.message
			});	
		}
		if (update) { // print some update info if an update is available
			dialog.showMessageBox(null, {
				type: 'question',
				message: "Current version: "+pkg.version+"\r\n\r\nVersion "+update.name+" is now availble.  Click 'OK' to go to the releases page.",
				buttons: ['OK', 'Cancel'],
			}).then(result => {
				if (result.response === 0) {
					shell.openExternal(update.url)
				}
			})	
		} else {
			if (arg.type == "manual") {
				dialog.showMessageBox(null, {
					type: 'info',
					message: "Current version: "+pkg.version+"\r\n\r\nThere is no update available at this time."
				});	
			}
		}
	});
})
 
ipcMain.on('show-alert', (event, arg) => {
	dialog.showMessageBox(null, {
		type: 'info',
		message: arg
	})
})

ipcMain.on('show-warning', (event, arg) => {
	dialog.showMessageBox(null, {
        type: 'warning',
        title: 'WARNING',
        message: arg,
        buttons: [
            'No, Thanks',
            'Sure, Go Ahead'
        ],
		defaultId: 0,
    })
        // Dialog returns a promise so let's handle it correctly
        .then((result) => {
			console.log(result)
        })
})

ipcMain.on('drop-image', (event, arg) => {
	let dropCanvas = arg[0]
	let file = arg[1]
	let tab = arg[2]
	let json = {}
	Jimp.read(file, (err, image) => {
		if (err) {
			json.filename = "error not an image"
			json.image = "error not an image"
		} else {
			image.getBase64(Jimp.AUTO, (err, ret) => {
				json.filename = path.basename(file)
				json.image = ret
			})
		}
		event.sender.send('drop-image-response', [dropCanvas, json, tab])
	})
})

ipcMain.on('drop-font-image', (event, file) => {
	recognizeText()

	async function recognizeText() {
		let image = await Jimp.read(file)
		let border = image.getPixelColor(1, 1)

		const rgba = Jimp.intToRGBA(border)
		const hex = rgbToHex(rgba.r, rgba.g, rgba.b)

		const worker = await createWorker();

		const jsonOBJ = []

		const base = await replaceColor({
			image: file,
			colors: {
				type: 'hex',
				targetColor: hex,
				replaceColor: "#00000000"
			}
		})
		let buffer = await base.getBufferAsync(Jimp.MIME_PNG)
		
		await worker.loadLanguage('eng');
		await worker.initialize('eng');
		const { data: { words } } = await worker.recognize(buffer);
		for (let i = 0; i < words.length; i++) {
			const word = words[i];
			for (let j = 0; j < word.symbols.length; j++) {
				const json = {}
				const baseImg = await Jimp.read(buffer)
				const chr = word.symbols[j]
				const x = chr.bbox.x0
				const y = chr.bbox.y0
				const w = chr.bbox.x1 - chr.bbox.x0
				const h = chr.bbox.y1 - chr.bbox.y0
				await baseImg.crop(x, y, w, h)
				//await baseImg.write(tempDir+"/"+word.symbols[j].text+".png");
				baseImg.getBase64(Jimp.AUTO, (err, image) => {
					json.char = word.symbols[j].text
					json.image = image
					json.height = baseImg.bitmap.height
					json.width = baseImg.bitmap.width
					json.confidence = word.symbols[j].confidence
					jsonOBJ.push(json)
				})
				
			}
		}
		await worker.terminate();
		
		const resultObj = []; // array to store the filtered result
		const temp = {}; // object to store the seen "char" values

		jsonOBJ.forEach(obj => {
			if (temp[obj.char]) {
				// if the "char" value is already seen, compare the "confidence" values
				if (obj.confidence > temp[obj.char].confidence) {
				temp[obj.char] = obj; // replace the lower "confidence" value with the new one
				}
			} else {
				temp[obj.char] = obj; // add the new "char" value to the object
			}
		});

		Object.keys(temp).forEach(char => {
			resultObj.push(temp[char]);
		});

		event.sender.send('font-image-response', resultObj)
	}
})

ipcMain.on('upload-font-image', (event, arg) => {
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
			recognizeText()

			async function recognizeText() {
				let image = await Jimp.read(result.filePaths[0])
				let border = image.getPixelColor(1, 1)

				const rgba = Jimp.intToRGBA(border)
				const hex = rgbToHex(rgba.r, rgba.g, rgba.b)

				const worker = await createWorker();

				const jsonOBJ = []

				const base = await replaceColor({
					image: result.filePaths[0],
					colors: {
						type: 'hex',
						targetColor: hex,
						replaceColor: "#00000000"
					}
				})
				let buffer = await base.getBufferAsync(Jimp.MIME_PNG)
				
				await worker.loadLanguage('eng');
				await worker.initialize('eng');
				const { data: { words } } = await worker.recognize(buffer);
				for (let i = 0; i < words.length; i++) {
					const word = words[i];
					for (let j = 0; j < word.symbols.length; j++) {
						const json = {}
						const baseImg = await Jimp.read(buffer)
						const chr = word.symbols[j]
						const x = chr.bbox.x0
						const y = chr.bbox.y0
						const w = chr.bbox.x1 - chr.bbox.x0
						const h = chr.bbox.y1 - chr.bbox.y0
						await baseImg.crop(x, y, w, h)
						//await baseImg.write(tempDir+"/"+word.symbols[j].text+".png");
						baseImg.getBase64(Jimp.AUTO, (err, image) => {
							json.char = word.symbols[j].text
							json.image = image
							json.height = baseImg.bitmap.height
							json.width = baseImg.bitmap.width
							json.confidence = word.symbols[j].confidence
							jsonOBJ.push(json)
						})
						
					}
				}
				await worker.terminate();
				
				const resultObj = []; // array to store the filtered result
				const temp = {}; // object to store the seen "char" values

				jsonOBJ.forEach(obj => {
					if (temp[obj.char]) {
						// if the "char" value is already seen, compare the "confidence" values
						if (obj.confidence > temp[obj.char].confidence) {
						temp[obj.char] = obj; // replace the lower "confidence" value with the new one
						}
					} else {
						temp[obj.char] = obj; // add the new "char" value to the object
					}
				});

				Object.keys(temp).forEach(char => {
					resultObj.push(temp[char]);
				});

				event.sender.send('font-image-response', resultObj)
			}
		} else {
			event.sender.send('font-image-response', {"status":"cancelled"})
		}
	})
})

ipcMain.on('upload-image', (event, arg) => {
	let type = arg[0]
	let canvas = arg[1]
	let imLeft = arg[2]
	let imTop = arg[3]
	let moveBelow = arg[4]
	let json = {}

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
					if (type == "jersey") {
						Jimp.read(__dirname+"/images/mask.png", (err, mask) => {
							image.mask(mask,0,0)
							image.getBase64(Jimp.AUTO, (err, ret) => {
								json.filename = path.basename(result.filePaths[0])
								json.image = ret
							})
						})
					} else {
						image.getBase64(Jimp.AUTO, (err, ret) => {
							json.filename = path.basename(result.filePaths[0])
							json.image = ret
						})
					}
					event.sender.send('upload-image-response', [type, canvas, imTop, imLeft, moveBelow, json])
				}
			});
		  } else {
			  //res.end()
			  console.log("cancelled")
		  }
	  }).catch(err => {
		  console.log(err)
	  })
})

ipcMain.on('upload-layer', (event, arg) => {
	let canvas = arg[0]
	let imLeft = arg[1]
	let imTop = arg[2]
	let canvasHeight = arg[3]
	let canvasWidth = arg[4]
	let span = arg[5]
	let id = arg[6]
	let loadButton = arg[7]
	let delButton = arg[8]
	let renderTarget = arg[9]
	let json = {}

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
					image.getBase64(Jimp.AUTO, (err, ret) => {
						json.filename = path.basename(result.filePaths[0])
						json.image = ret
						event.sender.send('upload-layer-response', [canvas, imLeft, imTop, canvasHeight, canvasWidth, span, id, loadButton, delButton, renderTarget, json])
					})
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

ipcMain.on('upload-texture', (event, arg) => {
	let json = {}
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
					if (arg == "jersey") {
						Jimp.read(__dirname+"/images/mask.png", (err, mask) => {
							if (err) { console.log(err) }
							image.mask(mask,0,0)
							image.getBase64(Jimp.AUTO, (err, ret) => {
								json.type = arg
								json.filename = path.basename(result.filePaths[0])
								json.image = ret
								event.sender.send('upload-texture-response', json)
							})
							
						})
					} else {
						image.getBase64(Jimp.AUTO, (err, ret) => {
							json.type = arg
							json.filename = path.basename(result.filePaths[0])
							json.image = ret
							event.sender.send('upload-texture-response', json)
						})
					}
					
				}
			});
		  } else {
			  console.log("cancelled")
		  }
	  }).catch(err => {
		  console.log(err)
	  })
})

ipcMain.on('add-stroke', (event, arg) => {
	let imgdata = arg.imgdata
	let canvas = arg.canvas
	let left = arg.left
	let top = arg.top
	let scaleX = arg.scaleX
	let scaleY = arg.scaleY
	let path = arg.path
	let pictureName = arg.pictureName
	let buffer = Buffer.from(imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	let json = {}

	Jimp.read(buffer, (err, image) => {
		if (err) {
			json.status = 'error'
			json.message = err.message
			event.sender.send('add-stroke-response', json)
		} else {
			try {
				image.autocrop()
				image.getBase64(Jimp.AUTO, (err, ret) => {
					json.status = 'success'
					json.canvas = canvas
					json.image = ret
					json.imgTop = top
					json.imgLeft = left
					json.pictureName = pictureName
					json.path = path
					json.pScaleX = scaleX
					json.pScaleY = scaleY
					event.sender.send('add-stroke-response', json)
				})
			} catch (error) {
				json.status = 'error'
				json.message = error.message
				console.log(error);
				event.sender.send('add-stroke-response', json)
			}
		}
	})
})

ipcMain.on('make-transparent', (event, arg) => {
	let imgdata = arg.imgdata
	let x = parseInt(arg.x);
	let y = parseInt(arg.y);
	let pTop = arg.pTop
	let pLeft = arg.pLeft
	let pScaleX = arg.pScaleX
	let pScaleY = arg.pScaleY
	let pictureName = arg.pictureName
	let fuzz = parseInt(arg.fuzz);
	let canvas = arg.canvas
	let path = arg.path
	let json = {}
	try {
		let im = new Magick.Image()
		let inBlob = new Magick.Blob
		let outBlob = new Magick.Blob
		let fillColor = new Magick.Color("none")
		inBlob.base64(imgdata)
		im.read(inBlob)
		let px = im.pixelColor(1,1);
		im.colorFuzz((fuzz/100)*65535)
		im.borderColor(px)
		im.border("20x20+0+0")
		im.floodFillColor(1,1,fillColor)
		im.trim()
		im.magick("PNG")
		im.write(outBlob)
		let b64 = outBlob.base64()
		json.status = 'success'
		json.data = "data:image/png;base64,"+b64
		json.canvas = canvas
		json.x = x
		json.y = y
		json.pTop = pTop
		json.pLeft = pLeft
		json.pScaleX = pScaleX
		json.pScaleY = pScaleY
		json.pictureName = pictureName
		json.path = path
		event.sender.send('imagemagick-response', json)
	} catch (err) {
		json.status = 'error'
		json.message = err.message
		console.log(err);
		event.sender.send('imagemagick-response', json)
	}
})

ipcMain.on('remove-border', (event, arg) => {
	//[theImage, 1, 1, "removeBorder", null, null, fuzz, pictureName]
	let imgdata = arg[0]
	let fuzz = parseInt(arg[6]);
	let pictureName = arg[7]
	let canvas = arg[8]
	let imgLeft = arg[9]
	let imgTop = arg[10]
	let json = {}
	try {
		let im = new Magick.Image()
		let inBlob = new Magick.Blob
		let outBlob = new Magick.Blob
		inBlob.base64(imgdata)
		im.read(inBlob)
		im.colorFuzz((fuzz/100)*65535)
		im.trim()
		im.magick("PNG")
		im.write(outBlob)
		let b64 = outBlob.base64()
		json.status = 'success'
		json.image = "data:image/png;base64,"+b64
		json.canvas = canvas
		json.imgTop = imgTop
		json.imgLeft = imgLeft
		json.pictureName = pictureName
		event.sender.send('remove-border-response', json)
	} catch (err) {
		json.status = 'error'
		json.message = err.message
		console.log(err);
		event.sender.send('remove-border-response', json)
	}
})

ipcMain.on('replace-color', (event, arg) => {
	let imgdata = arg[0]
	let pLeft = arg[1]
	let pTop = arg[2]
	let pScaleX = arg[3]
	let pScaleY = arg[4]
	let action = arg[5]
	let color = arg[6]
	let newcolor = arg[7]
	let fuzz = arg[8]
	let pictureName = arg[9]
	let canvas = arg[10]
	let x = arg[11]
	let y = arg[12]
	let colorSquare = arg[13]
	let newColorSquare = arg[14]
	let json = {}	
	try {
		let im = new Magick.Image()
		let inBlob = new Magick.Blob
		let outBlob = new Magick.Blob
		let oldColor = new Magick.Color(color) // or whatever the outgoing color is
		let fillColor = new Magick.Color(newcolor) // or whatever the replacement color is
		inBlob.base64(imgdata)
		im.read(inBlob)
		im.colorFuzz((fuzz/100)*65535)
		if (action.slice(-17) == "ReplaceColorRange") {
			im.floodFillColor(x,y,fillColor)
		} else {
			im.fillColor(fillColor)
			im.opaque(oldColor, fillColor);
		}
		im.magick("PNG")
		im.write(outBlob)
		let b64 = outBlob.base64()
		json.result = "success"
		json.data = "data:image/png;base64,"+b64
		json.pTop = pTop
		json.pLeft = pLeft
		json.x = pScaleX
		json.y = pScaleY
		json.pictureName = pictureName
		json.canvas = canvas
		json.colorSquare = colorSquare
		json.newColorSquare = newColorSquare
		json.pScaleX = pScaleX
		json.pScaleY = pScaleY
		event.sender.send('replace-color-response', json)
	} catch (err) {
		json.status = 'error'
		json.message = err.message
		console.log(err);
		event.sender.send('remove-border-response', json)
	}
})

ipcMain.on('remove-color-range', (event, arg) => {
	let imgdata = arg.imgdata;
	let x = parseInt(arg.x);
	let y = parseInt(arg.y);
	let pTop = arg.pTop
	let pLeft = arg.pLeft
	let pScaleX = arg.pScaleX
	let pScaleY = arg.pScaleY
	let pictureName = arg.pictureName
	let colorSquare = arg.colorSquare
	let fuzz = parseInt(arg.fuzz);
	let canvas = arg.canvas
	let json = {}
	try {
		let im = new Magick.Image()
		let inBlob = new Magick.Blob
		let outBlob = new Magick.Blob
		let fillColor = new Magick.Color("none") // or whatever the replacement color is
		inBlob.base64(imgdata)
		im.read(inBlob)
		im.colorFuzz((fuzz/100)*65535)
		im.floodFillColor(x,y,fillColor)
		im.magick("PNG")
		im.write(outBlob)
		let b64 = outBlob.base64()
		json.status = 'success'
		json.data = "data:image/png;base64,"+b64
		json.canvas = canvas
		json.x = x
		json.y = y
		json.pTop = pTop
		json.pLeft = pLeft
		json.pScaleX = pScaleX
		json.pScaleY = pScaleY
		json.pictureName = pictureName
		json.colorSquare = colorSquare
		event.sender.send('remove-color-range-response', json)
	} catch (err) {
		json.status = 'error'
		json.message = err.message
		console.log(err);
		event.sender.send('remove-color-range-response', json)
	}
})

ipcMain.on('remove-all-color', (event, arg) => {
	let imgdata = arg.imgdata;
	let x = parseInt(arg.x);
	let y = parseInt(arg.y);
	let pTop = arg.pTop
	let pLeft = arg.pLeft
	let pScaleX = arg.pScaleX
	let pScaleY = arg.pScaleY
	let pictureName = arg.pictureName
	let colorSquare = arg.colorSquare
	let fuzz = parseInt(arg.fuzz);
	let canvas = arg.canvas
	let color = arg.color
	let json = {}
	try {
		let im = new Magick.Image()
		let inBlob = new Magick.Blob
		let outBlob = new Magick.Blob
		inBlob.base64(imgdata)
		im.read(inBlob)
		im.colorFuzz((fuzz/100)*65535)
		let oldColor = new Magick.Color(color)
		im.transparent(oldColor)
		im.magick("PNG")
		im.write(outBlob)
		let b64 = outBlob.base64()
		json.status = 'success'
		json.data = "data:image/png;base64,"+b64
		json.canvas = canvas
		json.x = x
		json.y = y
		json.pTop = pTop
		json.pLeft = pLeft
		json.pScaleX = pScaleX
		json.pScaleY = pScaleY
		json.pictureName = pictureName
		json.colorSquare = colorSquare
		event.sender.send('remove-all-color-response', json)
	} catch (err) {
		json.status = 'error'
		json.message = err.message
		console.log(err);
		event.sender.send('remove-all-color-response', json)
	}
})

ipcMain.on('custom-font', (event, arg) => {
	let json = {}
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
			const filePath = path.join(userFontsFolder,path.basename(result.filePaths[0]))
			try {
				const fontMeta = fontname.parse(fs.readFileSync(result.filePaths[0]))[0];
				var ext = getExtension(result.filePaths[0])
				var fontPath = url.pathToFileURL(result.filePaths[0])
				json.status = "ok"
				json.fontName = fontMeta.fullName
				json.fontStyle = fontMeta.fontSubfamily
				json.familyName = fontMeta.fontFamily
				json.fontFormat = ext
				json.fontMimetype = 'font/' + ext
				json.fontData = fontPath.href
				json.fontPath = filePath
				fs.copyFileSync(result.filePaths[0], filePath)
				event.sender.send('custom-font-response', json)
			} catch (err) {
				json.status = "error"
				json.fontName = path.basename(result.filePaths[0])
				json.fontPath = result.filePaths[0]
				json.message = err
				event.sender.send('custom-font-response', json)
				fs.unlinkSync(result.filePaths[0])
			}
		} else {
			json.status = "cancelled"
			event.sender.send('custom-font-response', json)
			console.log("cancelled")
		}
	}).catch(err => {
		console.log(err)
		json.status = "error",
		json.message = err
		event.sender.send('custom-font-response', json)
	})
})

ipcMain.on('local-font', (event, arg) => {
	let json = {}
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
			const filePath = path.join(userFontsFolder,path.basename(result.filePaths[0]))
			try {
				const fontMeta = fontname.parse(fs.readFileSync(result.filePaths[0]))[0];
				var ext = getExtension(result.filePaths[0])
				var fontPath = url.pathToFileURL(result.filePaths[0])
				json.status = "ok"
				json.fontName = fontMeta.fullName
				json.fontStyle = fontMeta.fontSubfamily
				json.familyName = fontMeta.fontFamily
				json.fontFormat = ext
				json.fontMimetype = 'font/' + ext
				json.fontData = fontPath.href
				json.fontPath = filePath
				json.type = arg
				fs.copyFileSync(result.filePaths[0], filePath)
				event.sender.send('local-font-response', json)
			} catch (err) {
				json.status = "error"
				json.fontName = path.basename(result.filePaths[0])
				json.fontPath = result.filePaths[0]
				json.message = err
				event.sender.send('local-font-response', json)
				fs.unlinkSync(result.filePaths[0])
			}
		} else {
			json.status = "cancelled"
			event.sender.send('local-font-response', json)
			console.log("cancelled")
		}
	}).catch(err => {
		console.log(err)
		json.status = "error",
		json.message = err
		event.sender.send('local-font-response', json)
	})
})

ipcMain.on('drop-font', (event, arg) => {
	let file = arg[0]
	let tab = arg[1]
	let json = {}
	try {
	    const filePath = path.join(userFontsFolder,path.basename(file))
		const fontMeta = fontname.parse(fs.readFileSync(file))[0];
		var ext = getExtension(file)
		var fontPath = url.pathToFileURL(file)
		json.status = "ok"
		json.fontName = fontMeta.fullName
		json.fontStyle = fontMeta.fontSubfamily
		json.familyName = fontMeta.fontFamily
		json.fontFormat = ext
		json.fontMimetype = 'font/' + ext
		json.fontData = fontPath.href
		json.fontPath = filePath
		json.tab = tab
		fs.copyFileSync(file, filePath)
		event.sender.send('drop-font-response', json)
	} catch (err) {
		json.status = "error"
		json.fontName = path.basename(file)
		json.fontPath = file
		json.message = err
		fs.unlinkSync(file)
		event.sender.send('drop-font-response', json)
	}
})

ipcMain.on('save-font-position', (event, arg) => {
	const options = {
		defaultPath: increment(store.get("downloadPositionPath", app.getPath('downloads'))+'/'+req.body.filename+'.json',{fs: true})
	}
	dialog.showSaveDialog(null, options).then((result) => {
		if (!result.canceled) {
			store.set("downloadPositionPath", path.dirname(result.filePath))
			fs.writeFile(result.filePath, JSON.stringify(req.body.json, null, 2), 'utf8', function(err) {
				console.log(err)
			})
			event.sender.send('save-font-position-response', 'success')
		} else {
			event.sender.send('save-font-position-response', 'success')
		}
	}).catch((err) => {
		console.log(err);
		event.sender.send('save-font-position-response', 'success')
	});
})

ipcMain.on('warp-text', (event, arg) => {
	let buffer = Buffer.from(arg.imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	let imgdata = arg.imgdata;
	let amount = arg.amount;
	let deform = arg.deform;
	let width;
	let height;
	let cmdLine;
	let json = {}
	try {
		let im = new Magick.Image()
		let inBlob = new Magick.Blob
		let outBlob = new Magick.Blob
		inBlob.base64(imgdata)
		im.read(inBlob)
		switch (deform) {
			case "arch":
				im.trim()
				im.backgroundColor("transparent");
				im.wave((amount*-1),im.size().width()*2);
				im.trim();
				im.page(im.size())
				im.magick("PNG")
				im.write(outBlob)
				var b64 = outBlob.base64()
				json.status = 'success'
				json.data = "data:image/png;base64,"+b64
				event.sender.send('warp-text-response', json)
				break;
			case "arc":
				arc()
				async function arc() {
					let image = await Jimp.read(buffer)
					image.autocrop()
					let result = await distortUnwrap(image, "Arc", [parseInt(amount)])
					let tempImg = await new Jimp(result.bitmap.width*4, result.bitmap.height*4)
					await tempImg.blit(result, 5, 5)
					await tempImg.autocrop()
					let b64 = await tempImg.getBase64Async(Jimp.AUTO)
					json.status = 'success'
					json.data = b64
					event.sender.send('warp-text-response', json)
				}
				break;
			case "bilinearUp":
				bilinearUp()
				async function bilinearUp() {
					let image = await Jimp.read(buffer)
					await image.autocrop()
					const y2=image.bitmap.height*((100-amount)*0.01)
					const controlPoints = [1.5,0,0,0,0,0,image.bitmap.height,0,image.bitmap.height,image.bitmap.width,0,image.bitmap.width,0,image.bitmap.width,image.bitmap.height,image.bitmap.width,y2]
					const result = await distortUnwrap(image, "Polynomial", controlPoints)
					const tempImg = await new Jimp(result.bitmap.width*4, result.bitmap.height*4)
					await tempImg.blit(result, 5, 5)
					await tempImg.autocrop()
					let b64 = await tempImg.getBase64Async(Jimp.AUTO)
					json.status = 'success'
					json.data = b64
					event.sender.send('warp-text-response', json)
				}
				break;
			case "bilinearDown":
				bilinearDown()
				async function bilinearDown() {
					let image = await Jimp.read(buffer)
					await image.autocrop()
					const y2=image.bitmap.height*((100-amount)*0.01)
					const controlPoints = [1.5,0,0,0,0,0,image.bitmap.height,0,y2,image.bitmap.width,0,image.bitmap.width,0,image.bitmap.width,image.bitmap.height,image.bitmap.width,image.bitmap.height]
					const result = await distortUnwrap(image, "Polynomial", controlPoints)
					const tempImg = await new Jimp(result.bitmap.width*4, result.bitmap.height*4)
					await tempImg.blit(result, 5, 5)
					await tempImg.autocrop()
					let b64 = await tempImg.getBase64Async(Jimp.AUTO)
					json.status = 'success'
					json.data = b64
					event.sender.send('warp-text-response', json)
				}
				break;
			case "archUp":
				im.trim()
				im.backgroundColor("transparent")
				im.extent(im.size().width()+"x"+im.size().height(), MagickCore.WestGravity)
				im.wave((amount*-1)*2,im.size().width()*4)
				im.trim()
				im.page(im.size())
				im.magick("PNG")
				im.write(outBlob)
				var b64 = outBlob.base64()
				json.status = 'success'
				json.data = "data:image/png;base64,"+b64
				event.sender.send('warp-text-response', json)
				break;
			case "archDown":
				im.trim()
				im.backgroundColor("transparent")
				im.extent((im.size().width()*2)+"x"+im.size().height(), MagickCore.EastGravity)
				im.wave(-15,im.size().width()*2)
				im.trim()
				im.page(im.size())
				im.magick("PNG")
				im.write(outBlob)
				var b64 = outBlob.base64()
				json.status = 'success'
				json.data = "data:image/png;base64,"+b64
				event.sender.send('warp-text-response', json)
				break;		
			default:
				Jimp.read(buffer, (err, image) => {
					image.getBase64(Jimp.AUTO, (err, ret) => {
						json.status = 'success'
						json.data = ret
						event.sender.send('warp-text-response', json)
					})
				})
				break;		
		}
	} catch (err) {
		json.status = 'error'
		json.message = err.message
		console.log(err);
		event.sender.send('warp-text-response', json)
	}
})

ipcMain.on('save-wordmark', (event, arg) => {
	const buffer = Buffer.from(arg.image.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');

    const options = {
        defaultPath: increment(store.get("downloadPath", app.getPath('downloads')) + '/wordmark_' + arg.name+'.png',{fs: true})
	}
	
	dialog.showSaveDialog(null, options).then((result) => {
		if (!result.canceled) {
			store.set("downloadPath", path.dirname(result.filePath))
			Jimp.read(buffer, (err, image) => {
				if (err) {
					console.log(err);
				} else {
					image.autocrop();
					image.write(result.filePath);
				}
			})
			event.sender.send('hide-overlay', null)
		} else {
			event.sender.send('hide-overlay', null)
		}
	}).catch((err) => {
		console.log(err);
		event.sender.send('hide-overlay', null)
	});
})

ipcMain.on('save-swatches', (event, arg) => {
	const options = {
		//defaultPath: store.get("downloadSwatchPath", app.getPath('downloads')) + '/' + req.body.name+'.pal'
		defaultPath: increment(store.get("downloadSwatchPath", app.getPath('downloads')) + '/' + arg.name+'.pal',{fs: true})
	}

	dialog.showSaveDialog(null, options).then((result) => {
		if (!result.canceled) {
			store.set("downloadSwatchPath", path.dirname(result.filePath))
			fs.writeFile(result.filePath, JSON.stringify(arg, null, 2), 'utf8', function(err) {
				console.log(err)
			})
			event.sender.send('hide-overlay', null)
		} else {
			event.sender.send('hide-overlay', null)
		}
	}).catch((err) => {
		console.log(err);
		event.sender.send('hide-overlay', null)
	});
})

ipcMain.on('confirm-ocr-resize', (event, arg) => {
	dialog.showMessageBox(null, {
		type: 'question',
		message: "Do you want to resize characters to fit?  This may result in some poor quality results.",
		buttons: ['OK', 'Cancel'],
	}).then(result => {
		event.sender.send('ocr-resize-response', {response: result.response, numMax: arg.numMax, numScaleMod: arg.numScaleMod, letMax: arg.letMax, letScaleMod: arg.letScaleMod, data: arg.data})
	})
})

ipcMain.on('load-swatches', (event, arg) => {
	dialog.showMessageBox(null, {
		type: 'question',
		message: "Are you sure?\r\n\r\nThis will overwrite any non-default colors in the color picker palettes.",
		buttons: ['OK', 'Cancel'],
	}).then(result => {
		if (result.response === 0) {
			let jsonResponse = {}
			const options = {
				defaultPath: store.get("downloadSwatchPath", app.getPath('downloads')),
				properties: ['openFile'],
				filters: [
					{ name: 'Palette Files', extensions: ['pal', 'uni', 'zip'] }
				]
			}
			dialog.showOpenDialog(null, options).then(result => {
				if(!result.canceled) {
					store.set("downloadSwatchPath", path.dirname(result.filePaths[0]))
					switch (getExtension(result.filePaths[0])) {
						case "pal":
							jsonResponse.result = "success"
							jsonResponse.json = JSON.stringify(JSON.parse(fs.readFileSync(result.filePaths[0]).toString()))
							event.sender.send('load-swatches-response', jsonResponse)
							break;
						case "uni":
							var json = JSON.parse(fs.readFileSync(result.filePaths[0]))
							console.log(json.swatchSelectors)
							var palette = {};
							var commonPalette = []
							palette.name = json.team.replace(/ /g, "_");
							palette.swatch1 = json.swatchSelectors.swatch1Color.val
							palette.swatch2 = json.swatchSelectors.swatch2Color.val
							palette.swatch3 = json.swatchSelectors.swatch3Color.val
							palette.swatch4 = json.swatchSelectors.swatch4Color.val
							commonPalette.push(json.swatchSelectors.swatch1Color.val)
							commonPalette.push(json.swatchSelectors.swatch2Color.val)
							commonPalette.push(json.swatchSelectors.swatch3Color.val)
							commonPalette.push(json.swatchSelectors.swatch4Color.val)
							palette.commonPalette = commonPalette
							jsonResponse.result = "success",
							jsonResponse.json = JSON.stringify(palette)
							event.sender.send('load-swatches-response', jsonResponse)
							break;
						case "zip":
							var palFile = null;
							var zip = new admzip(result.filePaths[0]);
							var zipEntries = zip.getEntries()
							zipEntries.forEach(function (zipEntry) {
								if (zipEntry.entryName.slice(-4).toLowerCase() == '.pal') {
									palFile = zipEntry
								}
							});
							if (palFile != null) {
								jsonResponse.result = "success"
								jsonResponse.json = JSON.stringify(JSON.parse(palFile.getData().toString("utf8")))
								event.sender.send('load-swatches-response', jsonResponse)
							} else {
								jsonResponse.result = "error",
								jsonResponse.message = "No valid palette file was found in "+path.basename(result.filePaths[0])
								event.sender.send('load-swatches-response', jsonResponse)
							}
							break;
						default:
							jsonResponse.result = "error"
							jsonResponse.message = "Invalid file type: "+path.basename(result.filePaths[0])
							event.sender.send('load-swatches-response', jsonResponse)
					}
					event.sender.send('hide-overlay', null)
				} else {
					event.sender.send('hide-overlay', null)
					console.log("cancelled")
				}
			}).catch(err => {
				jsonResponse.result = "error"
				jsonResponse.message = err
				console.log(err)
				event.sender.send('load-swatches-response', jsonResponse)
			})
		} else {
			event.sender.send('hide-overlay', null)
		}
	})	
	
})

ipcMain.on('save-pants', (event, arg) => {
	const pantsLogoCanvas = Buffer.from(arg.pantsLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const pantsBelow = Buffer.from(arg.pantsBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const text = arg.text
	const tmpPantsTexture = arg.pantsTexture

	const options = {
		defaultPath: increment(store.get("downloadPath", app.getPath('downloads')) + '/' + arg.name+'.png',{fs: true})
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
		await blankImage.color([{ apply: "mix", params: [arg.pantsWatermarkColor, 100] }]);
		await pantsBase.composite(pantsTextureFile, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		await pantsBase.composite(pantsOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let pantsWM = await Jimp.read(__dirname+"/images/pants_watermark.png")
		await pantsWM.color([{ apply: "mix", params: [arg.pantsWatermarkColor, 100] }]);
		await pantsBase.composite(pantsWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await pantsBase.blit(blankImage, 256-(blankImage.bitmap.width/2), 12.5-(blankImage.bitmap.height/2))
		let pantsBuffer = await pantsBase.getBufferAsync(Jimp.MIME_PNG)
		let finalImage = Buffer.from(pantsBuffer).toString('base64');
		dialog.showSaveDialog(null, options).then((result) => {
			if (!result.canceled) {
				fs.writeFile(result.filePath, finalImage, 'base64', function(err) {
					console.log(err)
				})
				event.sender.send('save-pants-response', null)
			} else {
				event.sender.send('save-pants-response', null)
			}
		}).catch((err) => {
			console.log(err);
			event.sender.send('save-pants-response', null)
		});
	}
})

ipcMain.on('save-socks', (event, arg) => {
	const buffer = Buffer.from(arg.sockCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');

    const options = {
        defaultPath: increment(store.get("downloadPath", app.getPath('downloads')) + '/' + arg.name+'.png',{fs: true})
	}
            
	prepareImages()

	async function prepareImages() {
		let socks = await Jimp.read(buffer)
		let socksTexture = await Jimp.read(__dirname+"/images/socks_texture.png")
		await socks.crop(256,0,512,1024).composite(socksTexture, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		event.sender.send('save-socks-response', arg)
 		dialog.showSaveDialog(null, options).then((result) => {
			if (!result.canceled) {
				store.set("downloadPath", path.dirname(result.filePath))
				socks.write(result.filePath)
				event.sender.send('save-socks-response', arg)
			} else {
				event.sender.send('save-socks-response', arg)
			}
		}).catch((err) => {
			console.log(err);
			event.sender.send('save-socks-response', arg)
		});
	}
})

ipcMain.on('save-cap', (event, arg) => {
	const capLogoCanvas = Buffer.from(arg.capLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const capBelow = Buffer.from(arg.capBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const text = arg.text
	const tmpCapTexture = arg.capTexture

	const options = {
		defaultPath: increment(store.get("downloadPath", app.getPath('downloads')) + '/' + arg.name+'.png',{fs: true})
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
		await blankImage.color([{ apply: "mix", params: [arg.capWatermarkColor, 100] }]);
		let capWM = await Jimp.read(__dirname+"/images/cap_watermark.png")
		await capWM.color([{ apply: "mix", params: [arg.capWatermarkColor, 100] }]);
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
				event.sender.send('save-cap-response', null)
			} else {
				event.sender.send('save-cap-response', null)
			}
		}).catch((err) => {
			console.log(err);
			event.sender.send('save-cap-response', null)
		});
	}
})

ipcMain.on('save-font', (event, arg) => {
	const fontCanvas = Buffer.from(arg.fontCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');

    const options = {
        defaultPath: increment(store.get("downloadPath", app.getPath('downloads')) + '/' + arg.name+'.png',{fs: true})
	}
            
	prepareImages()

	async function prepareImages() {
		dialog.showSaveDialog(null, options).then((result) => {
			if (!result.canceled) {
				store.set("downloadPath", path.dirname(result.filePath))
				fs.writeFile(result.filePath, fontCanvas, 'base64', function(err) {
					console.log(err)
				})
				event.sender.send('save-font-response', null)
			} else {
				event.sender.send('save-font-response', null)
			}
		}).catch((err) => {
			console.log(err);
			event.sender.send('save-font-response', null)
		});
	}
})

ipcMain.on('generate-height-map', (event, arg) => {
	const jerseyLogoCanvas = Buffer.from(arg.jerseyLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const showPlanket = arg.showPlanket
	const buttonPadSeams = arg.buttonPadSeams
	const buttonType = arg.buttonType
	const seamsVisible = arg.seamsVisible
	const seamsOption = arg.seamsOption
	const brightness = parseInt(arg.brightness)/100
	const seamOpacity = parseInt(arg.seamOpacity)/100

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
		switch (arg.type) {
			case "jersey":
				event.sender.send('save-jersey-response', {status: "success", "image": base64, args: arg})
				break;
			case "uniform":
				event.sender.send('save-uniform-response', {status: "success", "image": base64, args: arg})
				break;
			case "install":
				event.sender.send('install-uniform-response', {status: "success", "image": base64, args: arg})
				break;
		}
/* 		if (arg.type == "jersey") {
			event.sender.send('save-jersey-response', {status: "success", "image": base64, args: arg})
		} else {
			event.sender.send('save-uniform-response', {status: "success", "image": base64, args: arg})
		} */
	}
})

ipcMain.on('save-jersey-zip', (event, arg) => {
	const jerseyLogoCanvas = Buffer.from(arg.jerseyLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const jerseyBelow = Buffer.from(arg.jerseyBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const nameCanvas = Buffer.from(arg.nameCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const heightMap = Buffer.from(arg.heightMap.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const normalMap = Buffer.from(arg.normalMap.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const tmpJerseyTexture = arg.jerseyTexture
	const buttonPadSeams = arg.buttonPadSeams
	const buttonType = arg.buttonType
	const seamsVisible = arg.seamsVisible
	const seamsOption = arg.seamsOption
	const seamsOnDiffuse = arg.seamsOnDiffuse
	let json = {}

	if (tmpJerseyTexture.startsWith("data:image")) {
		fs.writeFileSync(tempDir+"/tempJerseyTexture.png", tmpJerseyTexture.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64')
		var jerseyTexture = tempDir+"/tempJerseyTexture.png"
	} else {
		var jerseyTexture = __dirname+"/images/"+tmpJerseyTexture
	}

	const output = fs.createWriteStream(tempDir + '/'+arg.name+'.zip');

	output.on('close', function() {
		var data = fs.readFileSync(tempDir + '/'+arg.name+'.zip');
		var saveOptions = {
		  defaultPath: increment(store.get("downloadPath", app.getPath('downloads')) + '/' + arg.name+'.zip',{fs: true})
		}
		dialog.showSaveDialog(null, saveOptions).then((result) => { 
		  if (!result.canceled) {
			store.set("downloadPath", path.dirname(result.filePath))
			fs.writeFile(result.filePath, data, function(err) {
			  if (err) {
				fs.unlink(tempDir + '/'+arg.name+'.zip', (err) => {
				  if (err) {
					console.log(err)
					return
				  }
				})
				console.log(err)
				json.result = "error"
				json.errno = err.errno
				event.sender.send('save-jersey-zip-response', arg)
				//res.json({result: "error", errno: err.errno})
			  } else {
				fs.unlink(tempDir + '/'+arg.name+'.zip', (err) => {
				  if (err) {
					console.log(err)
					return
				  }
				})
				event.sender.send('save-jersey-zip-response', arg)
			  };
			})
		  } else {
			fs.unlink(tempDir + '/'+arg.name+'.zip', (err) => {
			  if (err) {
				console.log(err)
				return
			  }
			})
			event.sender.send('save-jersey-zip-response', arg)
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
		await jerseyWM.color([{ apply: "mix", params: [arg.jerseyWatermarkColor, 100] }]);
		await jerseyBase.composite(jerseyWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await jerseyBase.composite(nameImage, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let jerseyBuffer = await jerseyBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyBuffer, {name: arg.name+".png"})
		//await jerseyBase.write(app.getPath('downloads') + '/jerseys_' + arg.name+'.png')
		
		// jersey height map
		let jerseyHeightMap = await Jimp.read(heightMap)
		let jerseyHMBuffer = await jerseyHeightMap.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyHMBuffer, {name: arg.name+"_h.png"})
		//await jerseyHeightMap.write(tempDir+"/temp_height_map.jpg")

		// jersey normal map
		let jerseyNormalMap = await Jimp.read(normalMap)
		let jerseyNMBUffer = await jerseyNormalMap.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyNMBUffer, {name: arg.name+"_n.png"})
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
		await jerseyBakedWM.color([{ apply: "mix", params: [arg.jerseyWatermarkColor, 100] }]);
		await jerseyBakedBase.composite(jerseyBakedWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await jerseyBakedBase.composite(bakedNameImage, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let jerseyBakedBuffer = await jerseyBakedBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyBakedBuffer, {name: arg.name+"_textured.png"})
		//await jerseyBakedBase.write(app.getPath('downloads') + '/jerseys_' + arg.name+'_textured.png')

		archive.append(fs.createReadStream(__dirname+"/images/README.pdf"), { name: 'README.pdf' });
		archive.finalize()
	}
})

ipcMain.on('save-uniform-zip', (event, arg) => {
	const jerseyLogoCanvas = Buffer.from(arg.jerseyLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const jerseyBelow = Buffer.from(arg.jerseyBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const pantsLogoCanvas = Buffer.from(arg.pantsLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const pantsBelow = Buffer.from(arg.pantsBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const capLogoCanvas = Buffer.from(arg.capLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const capBelow = Buffer.from(arg.capBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const nameCanvas = Buffer.from(arg.nameCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const heightMap = Buffer.from(arg.heightMap.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const normalMap = Buffer.from(arg.normalMap.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const fontCanvas = Buffer.from(arg.fontCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const sockCanvas = Buffer.from(arg.sockCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const text = arg.text;
	const tmpCapTexture = arg.capTexture
	const tmpJerseyTexture = arg.jerseyTexture
	const tmpPantsTexture = arg.pantsTexture
	const buttonPadSeams = arg.buttonPadSeams
	const buttonType = arg.buttonType
	const seamsVisible = arg.seamsVisible
	const seamsOption = arg.seamsOption
	const seamsOnDiffuse = arg.seamsOnDiffuse
	const commonPalette = arg.commonPalette
	const json = Buffer.from(arg.json, 'utf8')
	const from = (arg.from == null) ? "" : arg.from
	const to = (arg.to == null) ? "" : arg.to
	const lettersVisible = arg.lettersVisible
	const numbersVisible = arg.numbersVisible

	const swatchJSON = {
		name: arg.name,
		swatch1: arg.swatch1,
		swatch2: arg.swatch2,
		swatch3: arg.swatch3,
		swatch4: arg.swatch4,
		commonPalette: commonPalette
	}

	const root = create({ version: '1.0', encoding: 'UTF-8' })
		.ele("COLORS", {fileversion: "OOTP Developments 2022-08-12 09:30:00"})
		.ele("TEAMCOLORS", {from: from, to: to, color1: arg.backgroundColor, color: arg.textColor})
		.ele("NOTES").txt(" current team colors ").up()
		.ele("UNIFORM", {name: arg.type, from: from, to: to, showname: lettersVisible, shownumber: numbersVisible, highsocks: 'n', font: arg.name})
		.ele("NOTES").txt(arg.type+" uniform").up()
		.ele("CAP", {color1: arg.capColor1, color2: arg.capColor2, color3: arg.capColor3, id: "", filname: "caps_"+arg.name+".png"}).up()
		.ele("JERSEY", {color1: arg.jerseyColor1, color2: arg.jerseyColor2, color3: arg.jerseyColor3, id: "", filname: "jerseys_"+arg.name+".png"}).up()
		.ele("PANTS", {color1: arg.pantsColor1, color2: arg.pantsColor2, color3: arg.pantsColor3, id: "", filname: "pants_"+arg.name+".png"}).up()


	const xml = root.end({prettyPrint:true})

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

	const output = fs.createWriteStream(tempDir + '/uniform_'+arg.name+'.zip');

	output.on('close', function() {
		var data = fs.readFileSync(tempDir + '/uniform_'+arg.name+'.zip');
		var saveOptions = {
		  defaultPath: increment(store.get("downloadPath", app.getPath('downloads')) + '/uniform_' + arg.name+'.zip',{fs: true})
		}
		dialog.showSaveDialog(null, saveOptions).then((result) => { 
		  if (!result.canceled) {
			store.set("downloadPath", path.dirname(result.filePath))
			fs.writeFile(result.filePath, data, function(err) {
			  if (err) {
				fs.unlink(tempDir + '/uniform_'+arg.name+'.zip', (err) => {
				  if (err) {
					console.log(err)
					return
				  }
				})
				console.log(err)
				event.sender.send('save-uniform-zip-response', arg)
			  } else {
				fs.unlink(tempDir + '/uniform_'+arg.name+'.zip', (err) => {
				  if (err) {
					console.log(err)
					return
				  }
				})
				event.sender.send('save-uniform-zip-response', arg)
			  };
			})
		  } else {
			fs.unlink(tempDir + '/uniform_'+arg.name+'.zip', (err) => {
			  if (err) {
				console.log(err)
				return
			  }
			})
			event.sender.send('save-uniform-zip-response', arg)
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
		await blankCapImage.color([{ apply: "mix", params: [arg.capWatermarkColor, 100] }]);
		let capWM = await Jimp.read(__dirname+"/images/cap_watermark.png")
		await capWM.color([{ apply: "mix", params: [arg.capWatermarkColor, 100] }]);
		await capBase.composite(capTextureFile, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		await capBase.composite(capOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await capBase.composite(capWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await capBase.blit(blankCapImage, 357-(blankCapImage.bitmap.width/2), 120-(blankCapImage.bitmap.height/2))
		let capBuffer = await capBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(capBuffer, {name: "caps_"+arg.name+".png"})
		//await capBase.write(app.getPath('desktop') + '/uniform_Unknown_Team_Home/caps_' + arg.name+'.png')

		// pants
		let pantsBase = await Jimp.read(pantsBelow)
		let pantsTextureFile = await Jimp.read(pantsTexture)
		let pantsOverlay = await Jimp.read(pantsLogoCanvas)
		let blankPantsImage = new Jimp(3000, 500)
		await blankPantsImage.print(font, 10, 10, text)
		await blankPantsImage.autocrop()
		await blankPantsImage.scaleToFit(500,15)
		await blankPantsImage.color([{ apply: "mix", params: [arg.pantsWatermarkColor, 100] }]);
		await pantsBase.composite(pantsTextureFile, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		await pantsBase.composite(pantsOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let pantsWM = await Jimp.read(__dirname+"/images/pants_watermark.png")
		await pantsWM.color([{ apply: "mix", params: [arg.pantsWatermarkColor, 100] }]);
		await pantsBase.composite(pantsWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await pantsBase.blit(blankPantsImage, 256-(blankPantsImage.bitmap.width/2), 12.5-(blankPantsImage.bitmap.height/2))
		let pantsBuffer = await pantsBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(pantsBuffer, {name: "pants_"+arg.name+".png"})
		//await pantsBase.write(app.getPath('downloads') + '/pants_' + arg.name+'.png')

		// socks
		let socks = await Jimp.read(sockCanvas)
		let socksTexture = await Jimp.read(__dirname+"/images/socks_texture.png")
		await socks.crop(256,0,512,1024).composite(socksTexture, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		let socksBuffer = await socks.getBufferAsync(Jimp.MIME_PNG)
		archive.append(socksBuffer, {name: "socks_"+arg.name+".png"})

		// font
		let fontBase = await Jimp.read(fontCanvas)
		let fontBuffer = await fontBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(fontBuffer, {name: arg.name+".png"})

		// jersey diffuse map
		let jerseyBase = await Jimp.read(jerseyBelow)
		let jerseyTextureFile = await Jimp.read(jerseyTexture)
		let jerseyOverlay = await Jimp.read(jerseyLogoCanvas)
		if (seamsOnDiffuse == "true" || seamsOnDiffuse == true) {
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
		await jerseyWM.color([{ apply: "mix", params: [arg.jerseyWatermarkColor, 100] }]);
		await jerseyBase.composite(jerseyWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let nameImage = await Jimp.read(nameCanvas)
		await jerseyBase.composite(nameImage, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let jerseyBuffer = await jerseyBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyBuffer, {name: "jerseys_"+arg.name+".png"})
		//await jerseyBase.write(app.getPath('downloads') + '/jerseys_' + arg.name+'.png')
		
		// jersey height map
		let jerseyHeightMap = await Jimp.read(heightMap)
		let jerseyHMBuffer = await jerseyHeightMap.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyHMBuffer, {name: "jerseys_"+arg.name+"_h.png"})
		//await jerseyHeightMap.write(tempDir+"/temp_height_map.jpg")

		// jersey normal map
		let jerseyNormalMap = await Jimp.read(normalMap)
		let jerseyNMBUffer = await jerseyNormalMap.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyNMBUffer, {name: "jerseys_"+arg.name+"_n.png"})
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
		await jerseyBakedWM.color([{ apply: "mix", params: [arg.jerseyWatermarkColor, 100] }]);
		await jerseyBakedBase.composite(jerseyBakedWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let nameImageBaked = await Jimp.read(nameCanvas)
		await jerseyBakedBase.composite(nameImageBaked, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let jerseyBakedBuffer = await jerseyBakedBase.getBufferAsync(Jimp.MIME_PNG)
		archive.append(jerseyBakedBuffer, {name: "jerseys_"+arg.name+"_textured.png"})
		//await jerseyBakedBase.write(app.getPath('downloads') + '/jerseys_' + arg.name+'_textured.png')
		
		archive.append(xml, {name: arg.name+".xml"});
		archive.append(JSON.stringify(swatchJSON, null, 2), {name: arg.name+".pal"});
		archive.append(json, {name: "uniform_"+arg.name+".uni"})
		archive.append(fs.createReadStream(__dirname+"/images/README.pdf"), { name: 'README.pdf' });
		//archive.append(fs.createReadStream(__dirname+"/images/"+normalMap), { name: "jerseys_"+arg.name+"_n.png" });
	    archive.finalize()
	}
})

ipcMain.on('install-uniform-zip', (event, arg) => {
	const options = {
		title: "Select OOTP Data Folder",
		defaultPath: store.get("OOTPDataPath", app.getPath('desktop')),
		properties: ['openDirectory']
	}

	const jerseyLogoCanvas = Buffer.from(arg.jerseyLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const jerseyBelow = Buffer.from(arg.jerseyBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const pantsLogoCanvas = Buffer.from(arg.pantsLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const pantsBelow = Buffer.from(arg.pantsBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const capLogoCanvas = Buffer.from(arg.capLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const capBelow = Buffer.from(arg.capBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const nameCanvas = Buffer.from(arg.nameCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const heightMap = Buffer.from(arg.heightMap.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const normalMap = Buffer.from(arg.normalMap.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const fontCanvas = Buffer.from(arg.fontCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const sockCanvas = Buffer.from(arg.sockCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	const text = arg.text;
	const tmpCapTexture = arg.capTexture
	const tmpJerseyTexture = arg.jerseyTexture
	const tmpPantsTexture = arg.pantsTexture
	const buttonType = arg.buttonType
	const seamsOption = arg.seamsOption
	const seamsOnDiffuse = arg.seamsOnDiffuse

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
		await blankCapImage.color([{ apply: "mix", params: [arg.capWatermarkColor, 100] }]);
		let capWM = await Jimp.read(__dirname+"/images/cap_watermark.png")
		await capWM.color([{ apply: "mix", params: [arg.capWatermarkColor, 100] }]);
		await capBase.composite(capTextureFile, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		await capBase.composite(capOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await capBase.composite(capWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await capBase.blit(blankCapImage, 357-(blankCapImage.bitmap.width/2), 120-(blankCapImage.bitmap.height/2))
		
		// pants
		let pantsBase = await Jimp.read(pantsBelow)
		let pantsTextureFile = await Jimp.read(pantsTexture)
		let pantsOverlay = await Jimp.read(pantsLogoCanvas)
		let blankPantsImage = new Jimp(3000, 500)
		await blankPantsImage.print(font, 10, 10, text)
		await blankPantsImage.autocrop()
		await blankPantsImage.scaleToFit(500,15)
		await blankPantsImage.color([{ apply: "mix", params: [arg.pantsWatermarkColor, 100] }]);
		await pantsBase.composite(pantsTextureFile, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		await pantsBase.composite(pantsOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let pantsWM = await Jimp.read(__dirname+"/images/pants_watermark.png")
		await pantsWM.color([{ apply: "mix", params: [arg.pantsWatermarkColor, 100] }]);
		await pantsBase.composite(pantsWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		await pantsBase.blit(blankPantsImage, 256-(blankPantsImage.bitmap.width/2), 12.5-(blankPantsImage.bitmap.height/2))
		
		// socks
		let socks = await Jimp.read(sockCanvas)
		let socksTexture = await Jimp.read(__dirname+"/images/socks_texture.png")
		await socks.crop(256,0,512,1024).composite(socksTexture, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
		
		// font
		let fontBase = await Jimp.read(fontCanvas)
		
		// jersey diffuse map
		let jerseyBase = await Jimp.read(jerseyBelow)
		let jerseyTextureFile = await Jimp.read(jerseyTexture)
		let jerseyOverlay = await Jimp.read(jerseyLogoCanvas)
		if (seamsOnDiffuse == "true" || seamsOnDiffuse == true) {
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
		await jerseyWM.color([{ apply: "mix", params: [arg.jerseyWatermarkColor, 100] }]);
		await jerseyBase.composite(jerseyWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		let nameImage = await Jimp.read(nameCanvas)
		await jerseyBase.composite(nameImage, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
		
		// jersey height map
		let jerseyHeightMap = await Jimp.read(heightMap)
		
		// jersey normal map
		let jerseyNormalMap = await Jimp.read(normalMap)
		
		dialog.showOpenDialog(null, options).then((result) => {
			if (!result.canceled) {
				store.set("OOTPDataPath", result.filePaths[0])
				jerseyHeightMap.write(result.filePaths[0]+"//jerseys//jerseys_"+arg.name+"_h.png")
				jerseyNormalMap.write(result.filePaths[0]+"//jerseys//jerseys_"+arg.name+"_n.png")
				jerseyBase.write(result.filePaths[0]+"//jerseys//jerseys_"+arg.name+".png")
				capBase.write(result.filePaths[0]+"//ballcaps//caps_"+arg.name+".png")
				pantsBase.write(result.filePaths[0]+"//pants//pants_"+arg.name+".png")
				fontBase.write(result.filePaths[0]+"//jersey_fonts//"+arg.name+".png")
				socks.write(result.filePaths[0]+"//socks//socks_"+arg.name+".png")
				event.sender.send('save-uniform-zip-response', arg)
			} else {
				event.sender.send('save-uniform-zip-response', arg)
			}
			
		})
	}
})

ipcMain.on('load-uniform', (event, arg) => {
	let json = {}
	const options = {
		defaultPath: store.get("uploadUniformPath", app.getPath('downloads')),
		properties: ['openFile'],
		filters: [
			{ name: 'Uniform Files', extensions: ['uni', 'zip'] }
		]
	}
	dialog.showOpenDialog(null, options).then(result => {
		if(!result.canceled) {
			store.set("uploadUniformPath", path.dirname(result.filePaths[0]))
			switch (getExtension(result.filePaths[0])) {
				case "uni":
					json.result = "success",
					json.json = JSON.stringify(JSON.parse(fs.readFileSync(result.filePaths[0]).toString()))
					event.sender.send('load-uniform-response', json)
					break;
				case "zip":
					var uniFile = null;
					var zip = new admzip(result.filePaths[0]);
					var zipEntries = zip.getEntries()
					zipEntries.forEach(function (zipEntry) {
						if (zipEntry.entryName.slice(-4).toLowerCase() == '.uni') {
							uniFile = zipEntry
						}
					});
					if (uniFile != null) {
						let exportMeta = JSON.parse(uniFile.getData().toString("utf8"))
						if (exportMeta.version == undefined || !semver.eq(pkg.version, exportMeta.version)) {
							dialog.showMessageBox(null, {
								noLink: true,
								type: 'question',
								message: "This save file appears to have been generated with a different version of Uniform Maker.  Some elements may not be load properly.\r\n\r\nContinue?",
							    buttons: ['OK', 'Cancel'],
							}).then(result => {
								if (result.response === 0) {
									json.result = "success"
									json.json = JSON.stringify(exportMeta)
									event.sender.send('load-uniform-response', json)
								} else {
									event.sender.send('hide-overlay', null)
								}
							})	
						} else {
							json.result = "success"
							json.json = JSON.stringify(exportMeta)
							event.sender.send('load-uniform-response', json)
						}
					} else {
						json.result = "error",
						json.message = "No valid uniform file was found in "+path.basename(result.filePaths[0])
						event.sender.send('load-uniform-response', json)
					}
					break;
				default:
					json.result = "error",
					json.message = "Invalid file type: "+path.basename(result.filePaths[0])
					event.sender.send('load-uniform-response', json)
			}
			//event.sender.send('hide-overlay', null)
		} else {
			event.sender.send('hide-overlay', null)
		}
	}).catch(err => {
		json.result = "error",
		json.message = err
		event.sender.send('load-uniform-response', json)
		console.log(err)
	})
})

ipcMain.on('local-font-folder', (event, arg) => {
	const jsonObj = {}
	const jsonArr = []

	filenames = fs.readdirSync(userFontsFolder);
	for (i=0; i<filenames.length; i++) {
		if (path.extname(filenames[i]).toLowerCase() == ".ttf" || path.extname(filenames[i]).toLowerCase() == ".otf") {
			const filePath = path.join(userFontsFolder,filenames[i])
			try {
				const fontMeta = fontname.parse(fs.readFileSync(filePath))[0];
				var ext = getExtension(filePath)
				var fontPath = url.pathToFileURL(filePath)
				var json = {
					"status": "ok",
					"fontName": fontMeta.fullName,
					"fontStyle": fontMeta.fontSubfamily,
					"familyName": fontMeta.fontFamily,
					"fontFormat": ext,
					"fontMimetype": 'font/' + ext,
					"fontData": fontPath.href,
					"fontPath": filePath,
				};
				jsonArr.push(json)
			} catch (err) {
				const json = {
					"status": "error",
					"fontName": path.basename(filePath),
					"fontPath": filePath,
					"message": err
				}
				jsonArr.push(json)
				fs.unlinkSync(filePath)
			}
		}
	}
	jsonObj.result = "success"
	jsonObj.fonts = jsonArr
	event.sender.send('local-font-folder-response', jsonObj)
})

ipcMain.on('set-preference', (event, arg) => {
	store.set(arg.pref, arg.val)
})

ipcMain.on('open-font-folder', (event, arg) => {
	shell.openPath(userFontsFolder)
})

function createWindow () {
    const mainWindow = new BrowserWindow({
      width: 1400,
      height: 1020,
      icon: (__dirname + '/images/icon.ico'),
      webPreferences: {
          nodeIntegration: true,
            contextIsolation: false 
      }
    })

	watcher.on('add', (path, stats) => {
		mainWindow.webContents.send('updateFonts','click')
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
			  click: () => mainWindow.webContents.send('save-socks','click'),
			  accelerator: isMac ? 'Cmd+O' : 'Control+O',
			  label: 'Save Socks Only',
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
		  {
			  click: () => dialog.showMessageBox(null, {
				type: 'warning',
				title: 'WARNING',
				message: "Are you sure?\r\n\r\nThis will overwrite files with the same name without warning!",
				buttons: [
					'No, Thanks',
					'Sure, Go Ahead'
				],
				defaultId: 0,
			  })
				.then((result) => {
					if (result.response == 1) {
						mainWindow.webContents.send('install-uniform','click')
					}
			  }),
			  accelerator: 'Control+I',
			  label: 'Install Uniform',
			  visible: isWin
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
          {
              click: () => mainWindow.webContents.send('updateFonts','click'),
              label: 'Refresh User Fonts',
          },
		  {
			click: () => mainWindow.webContents.send('openFontFolder','click'),
			label: 'Open User Fonts Folder',
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
  
	mainWindow.loadURL(`file://${__dirname}/index.html?&appVersion=${pkg.version}&preferredColorFormat=${preferredColorFormat}&preferredJerseyTexture=${preferredJerseyTexture}&preferredPantsTexture=${preferredPantsTexture}&preferredCapTexture=${preferredCapTexture}&gridsVisible=${gridsVisible}&checkForUpdates=${checkForUpdates}&preferredNameFont=${preferredNameFont}&preferredNumberFont=${preferredNumberFont}&preferredCapFont=${preferredCapFont}&preferredJerseyFont=${preferredJerseyFont}&seamsVisibleOnDiffuse=${seamsVisibleOnDiffuse}&preferredHeightMapBrightness=${preferredHeightMapBrightness}&preferredSeamOpacity=${preferredSeamOpacity}`);
    
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

function rgbToHex(r, g, b) {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function componentToHex(c) {
	var hex = c.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
}