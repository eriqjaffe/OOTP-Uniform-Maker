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
const log = require('electron-log/main');
const { Resvg } = require('@resvg/resvg-js')
const PSD = require('psd');
const sizeOf = require("image-size")
const heicConvert = require("heic-convert")
const webp = require('webp-wasm');

const imageGen = require('./image-generators.js');

log.initialize();
log.transports.file.fileName = "uniform_maker.log"
log.eventLogger.startLogging

/* const { log } = console;
function proxiedLog(...args) {
  const line = (((new Error('log'))
    .stack.split('\n')[2] || '…')
    .match(/\(([^)]+)\)/) || [, 'not found'])[1];
  log.call(console, `${line}\n`, ...args);
}
console.info = proxiedLog;
console.log = proxiedLog; */

const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'
const tempDir = app.getPath('userData')
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
	log.info("Update Check: "+arg.type)
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
			log.info("Warning dialog '"+arg+"' returned "+result)
        })
})

ipcMain.on('drop-image', (event, arg) => {
	let dropCanvas = arg[0]
	let file = arg[1]
	let tab = arg[2]
	let json = {}

	readImage()

	async function readImage() {
		switch (getExtension(file).toLowerCase()) {
			case "heic":
				let inputBuffer = fs.readFileSync(file)
				let outputBuffer = await heicConvert({buffer: inputBuffer, format: 'PNG'})
				fs.promises.writeFileSync(os.tmpdir()+"/heicParse.png", outputBuffer)
				fileToRead = os.tmpdir()+"/heicParse.png"
				break;
			case "heif":
				let inputBuffer2 = fs.readFileSync(file)
				let outputBuffer2 = await heicConvert({buffer: inputBuffer2, format: 'PNG'})
				fs.promises.writeFileSync(os.tmpdir()+"/heifParse.png", outputBuffer2)
				fileToRead = os.tmpdir()+"/heifParse.png"
				break;
			case "webp":
				fileToRead = arg[3]
				break;
			case "gif":
				let tmpGIF = await Jimp.read(file)
				await tmpGIF.writeAsync(os.tmpdir()+"/gifParse.png")
				fileToRead = os.tmpdir()+"/gifParse.png"
				break;
			case "tiff":
				let tmpTIFF = await Jimp.read(file)
				await tmpTIFF.writeAsync(os.tmpdir()+"/tiffParse.png")
				fileToRead = os.tmpdir()+"/tiffParse.png"
				break;
			case "svg":
				const svg = fs.readFileSync(file)
				const opts = {
					background: 'rgba(255, 255, 255, 0)',
					fitTo: {
					mode: 'width',
					value: 512,
					}
				}
				const resvg = new Resvg(svg, opts)
				const pngData = resvg.render()
				fileToRead = pngData.asPng()
				break;
			case "psd":
				const psd = PSD.fromFile(file);
				psd.parse()
				await psd.image.saveAsPng(os.tmpdir()+"/psdParse.png")
				fileToRead = os.tmpdir()+"/psdParse.png"
				break;
			default:
				fileToRead = file;
				break;
		}
		const image = await Jimp.read(fileToRead)
		image.getBase64(Jimp.AUTO, (err, ret) => {
			json.filename = path.basename(file)
			json.image = ret
			json.canvas = dropCanvas
			json.tab = tab
		})
		event.sender.send('drop-image-response', json)
	}
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
			{ name: 'Images', extensions: ['jpg','png','gif','tiff','bmp','svg','psd','webp','heic','heif'] }
		]
	}

	readImage()

	async function readImage() {
		let json = {}
		const userFile = await dialog.showOpenDialog(null, options)
		if (userFile.canceled) {
			log.info("user cancelled uploading image")
			event.sender.send('hide-overlay', null)
		} else {
			store.set("uploadImagePath", path.dirname(userFile.filePaths[0]))
			switch (getExtension(userFile.filePaths[0]).toLowerCase()) {
				case "heic":
					let inputBuffer = fs.readFileSync(userFile.filePaths[0])
					let outputBuffer = await heicConvert({buffer: inputBuffer, format: 'PNG'})
					fs.promises.writeFileSync(os.tmpdir()+"/heicParse.png", outputBuffer)
					fileToRead = os.tmpdir()+"/heicParse.png"
					break;
				case "heif":
					let inputBuffer2 = fs.readFileSync(userFile.filePaths[0])
					let outputBuffer2 = await heicConvert({buffer: inputBuffer2, format: 'PNG'})
					fs.promises.writeFileSync(os.tmpdir()+"/heicParse.png", outputBuffer2)
					fileToRead = os.tmpdir()+"/heicParse.png"
					break;
				case "webp":
					const dimensions = sizeOf(userFile.filePaths[0])
					event.sender.send('webp-convert',{canvas: canvas, file: path.basename(userFile.filePaths[0]), path: userFile.filePaths[0], width: dimensions.width, height: dimensions.height})
					return false;
					break;
				case "gif":
					let tmpGIF = await Jimp.read(userFile.filePaths[0])
					await tmpGIF.writeAsync(os.tmpdir()+"/gifParse.png")
					fileToRead = os.tmpdir()+"/gifParse.png"
					break;
				case "tiff":
					let tmpTIFF = await Jimp.read(userFile.filePaths[0])
					await tmpTIFF.writeAsync(os.tmpdir()+"/tiffParse.png")
					fileToRead = os.tmpdir()+"/tiffParse.png"
					break;
				case "svg":
					const svg = fs.readFileSync(userFile.filePaths[0])
					const opts = {
						background: 'rgba(255, 255, 255, 0)',
						fitTo: {
							mode: 'width',
							value: 512,
						}
					}
					const resvg = new Resvg(svg, opts)
					const pngData = resvg.render()
					fileToRead = pngData.asPng()	
					break;
				case "psd":
					const psd = PSD.fromFile(userFile.filePaths[0]);
					psd.parse()
					await psd.image.saveAsPng(os.tmpdir()+"/psdParse.png")
					fileToRead = os.tmpdir()+"/psdParse.png"
					break;
				default:
					fileToRead = userFile.filePaths[0]
					break;
			}
			const image = await Jimp.read(fileToRead)
			try {
				if (type == "jersey") {
					const mask = await Jimp.read(__dirname+"/images/mask.png")
					image.mask(mask,0,0)
					image.getBase64(Jimp.AUTO, (err, ret) => {
						json.filename = path.basename(userFile.filePaths[0])
						json.image = ret
					})
				} else {
					image.getBase64(Jimp.AUTO, (err, ret) => {
						json.filename = path.basename(userFile.filePaths[0])
						json.image = ret
					})
				}
				// here's one
				json.type = type
				json.canvas = canvas
				json.imTop = imTop
				json.imLeft = imLeft
				json.moveBelow = moveBelow
				json
				event.sender.send('upload-image-response', [type, canvas, imTop, imLeft, moveBelow, json])
			} catch (err) {
				log.error(err)
			}
		}
	}
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
					log.error(err);
				} else {
					image.getBase64(Jimp.AUTO, (err, ret) => {
						json.filename = path.basename(result.filePaths[0])
						json.image = ret
						// here's one
						event.sender.send('upload-layer-response', [canvas, imLeft, imTop, canvasHeight, canvasWidth, span, id, loadButton, delButton, renderTarget, json])
					})
				}
			});
		  } else {
			  event.sender.send('hide-overlay', null)
			  res.end()
			  log.info("user cancelled uploading custom layer")
		  }
	  }).catch(err => {
		  log.error(err)
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
					log.error(err);
				} else {
					if (arg == "jersey") {
						Jimp.read(__dirname+"/images/mask.png", (err, mask) => {
							if (err) { log.error(err) }
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
			  log.info("user cancelled uploading custom texture")
			  event.sender.send('hide-overlay', null)
		  }
	  }).catch(err => {
		  log.error(err)
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
				log.error(error);
				event.sender.send('add-stroke-response', json)
			}
		}
	})
})

ipcMain.on('make-transparent', (event, arg) => {
	let imgdata = arg.imgdata
	let x = parseInt(arg.x);
	let y = parseInt(arg.y);
	let top = arg.pTop
	let left = arg.pLeft
	let scaleX = arg.pScaleX
	let scaleY = arg.pScaleY
	let pictureName = arg.pictureName
	let canvas = arg.canvas
	let path = arg.path
	let json = {}
	let buffer = Buffer.from(imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
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
					json.data = ret
					json.canvas = canvas
					json.x = x
					json.y = y
					json.pTop = top
					json.pLeft = left
					json.pScaleX = scaleX
					json.pScaleY = scaleY
					json.pictureName = pictureName
					json.path = path
					event.sender.send('imagemagick-response', json)
				})
			} catch (error) {
				json.status = 'error'
				json.message = error.message
				log.error(error);
				event.sender.send('imagemagick-response', json)
			}
		}
	})
})

ipcMain.on('remove-border', (event, arg) => {
	//[theImage, 1, 1, "removeBorder", null, null, fuzz, pictureName]
	let imgdata = arg.imgdata
	let pictureName = arg.name
	let filePath = arg.filePath
	let canvas = arg.canvas
	let top = arg.top
	let left = arg.left
	let json = {}
	let buffer = Buffer.from(imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	
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
					json.data = ret
					json.canvas = canvas
					json.x = 0
					json.y = 0
					json.pTop = top
					json.pLeft = left
					json.pScaleX = 1
					json.pScaleY = 1
					json.pictureName = pictureName
					json.path = filePath
					event.sender.send('imagemagick-response', json)
				})
			} catch (error) {
				json.status = 'error'
				json.message = error.message
				log.error(error);
				event.sender.send('imagemagick-response', json)
			}
		}
	})
})

ipcMain.on('replace-color', (event, arg) => {
	let imgdata = arg[0]
	let pLeft = arg[1]
	let pTop = arg[2]
	let pScaleX = arg[3]
	let pScaleY = arg[4]
	let pictureName = arg[9]
	let canvas = arg[10]
	let colorSquare = arg[13]
	let newColorSquare = arg[14]
	let json = {}
	let buffer = Buffer.from(imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');

	Jimp.read(buffer, (err, image) => {
		if (err) {
			json.status = 'error'
			json.message = err.message
			log.error(err);
			event.sender.send('replace-color-response', json)
		}
		image.getBase64(Jimp.AUTO, (err, ret) => {
			if (err) {
				json.status = 'error'
				json.message = err.message
				log.error(err);
				event.sender.send('replace-color-response', json)
			}
			json.result = "success"
			json.data = ret
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
		})
	})
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
			log.info("User cancelled custom font dialog")
		}
	}).catch(err => {
		log.error(err)
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
			log.info("User cancelled custom font dialog")
		}
	}).catch(err => {
		log.error(err)
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
			fs.promises.writeFile(result.filePath, JSON.stringify(req.body.json, null, 2), 'utf8', function(err) {
				log.error(err)
			})
			event.sender.send('save-font-position-response', 'success')
		} else {
			event.sender.send('save-font-position-response', 'success')
		}
	}).catch((err) => {
		log.error(err);
		event.sender.send('save-font-position-response', 'success')
	});
})

ipcMain.on('warp-text', (event, arg) => {
	let buffer = Buffer.from(arg.imgdata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');
	let amount = arg.amount;
	let deform = arg.deform;
	let json = {}
	try {
		switch (deform) {
			case "arch":
				arch()
				async function arch() {
					try {
						let image = await Jimp.read(buffer);
						const newImage = new Jimp(image.bitmap.width, image.bitmap.height);
						image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
							const radians = x / image.bitmap.width * 360 * Math.PI / 180;
							const offsetY = (amount * -1) * Math.cos(radians);
							const newY = y + offsetY;
						
							const yFloor = Math.floor(newY);
							const yCeil = Math.ceil(newY);
							const yWeight = newY - yFloor;
						
							const clampedYFloor = Math.max(0, Math.min(image.bitmap.height - 1, yFloor));
							const clampedYCeil = Math.max(0, Math.min(image.bitmap.height - 1, yCeil));
						
							const colorFloor = Jimp.intToRGBA(image.getPixelColor(x, clampedYFloor));
							const colorCeil = Jimp.intToRGBA(image.getPixelColor(x, clampedYCeil));
						
							const r = colorFloor.r * (1 - yWeight) + colorCeil.r * yWeight;
							const g = colorFloor.g * (1 - yWeight) + colorCeil.g * yWeight;
							const b = colorFloor.b * (1 - yWeight) + colorCeil.b * yWeight;
							const a = colorFloor.a * (1 - yWeight) + colorCeil.a * yWeight;
						
							const interpolatedColor = Jimp.rgbaToInt(r, g, b, a);
							newImage.setPixelColor(interpolatedColor, x, y);
						});
						newImage.autocrop()
						let b64 = await newImage.getBase64Async(Jimp.AUTO)
						json.status = 'success'
						json.data = b64
						event.sender.send('warp-text-response', json)
					} catch (error) {
						console.error('Error applying wave effect:', error);
						return null;
					}
				}
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
				archUp()
				async function archUp() {
					try {
						let image = await Jimp.read(buffer);
						const tempImage = new Jimp(image.bitmap.width * 2, image.bitmap.height)
						tempImage.blit(image, 0, 0, 0, 0, image.bitmap.width, image.bitmap.height);
						const newImage = new Jimp(image.bitmap.width, image.bitmap.height);
						tempImage.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
							const radians = (x * 180) / image.bitmap.width * Math.PI / 180;
							const offsetY = (amount * -1) * Math.cos(radians);
							const newY = y + offsetY;
						
							const yFloor = Math.floor(newY);
							const yCeil = Math.ceil(newY);
							const yWeight = newY - yFloor;
						
							const clampedYFloor = Math.max(0, Math.min(image.bitmap.height - 1, yFloor));
							const clampedYCeil = Math.max(0, Math.min(image.bitmap.height - 1, yCeil));
						
							const colorFloor = Jimp.intToRGBA(image.getPixelColor(x, clampedYFloor));
							const colorCeil = Jimp.intToRGBA(image.getPixelColor(x, clampedYCeil));
						
							const r = colorFloor.r * (1 - yWeight) + colorCeil.r * yWeight;
							const g = colorFloor.g * (1 - yWeight) + colorCeil.g * yWeight;
							const b = colorFloor.b * (1 - yWeight) + colorCeil.b * yWeight;
							const a = colorFloor.a * (1 - yWeight) + colorCeil.a * yWeight;
						
							const interpolatedColor = Jimp.rgbaToInt(r, g, b, a);
							newImage.setPixelColor(interpolatedColor, x, y);
						});
						
						newImage.autocrop();
						
						let b64 = await newImage.getBase64Async(Jimp.AUTO)
						json.status = 'success'
						json.data = b64
						event.sender.send('warp-text-response', json)
					} catch (error) {
						console.error('Error applying wave effect:', error);
						return null;
					}
				}
				break;
			case "archDown":
				archDown()
				async function archDown() {
					try {
						let image = await Jimp.read(buffer);
						const tempImage = new Jimp(image.bitmap.width * 2, image.bitmap.height)
						tempImage.blit(image, image.bitmap.width, 0, 0, 0, image.bitmap.width, image.bitmap.height);
						const newImage = new Jimp(image.bitmap.width, image.bitmap.height);
						tempImage.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
							const radians = (x * 180) / image.bitmap.width * Math.PI / 180;
							const offsetY = amount * Math.cos(radians);
							const newY = y + offsetY;
						
							const yFloor = Math.floor(newY);
							const yCeil = Math.ceil(newY);
							const yWeight = newY - yFloor;
						
							const clampedYFloor = Math.max(0, Math.min(image.bitmap.height - 1, yFloor));
							const clampedYCeil = Math.max(0, Math.min(image.bitmap.height - 1, yCeil));
						
							const colorFloor = Jimp.intToRGBA(image.getPixelColor(x, clampedYFloor));
							const colorCeil = Jimp.intToRGBA(image.getPixelColor(x, clampedYCeil));
						
							const r = colorFloor.r * (1 - yWeight) + colorCeil.r * yWeight;
							const g = colorFloor.g * (1 - yWeight) + colorCeil.g * yWeight;
							const b = colorFloor.b * (1 - yWeight) + colorCeil.b * yWeight;
							const a = colorFloor.a * (1 - yWeight) + colorCeil.a * yWeight;
						
							const interpolatedColor = Jimp.rgbaToInt(r, g, b, a);
							newImage.setPixelColor(interpolatedColor, x, y);
						});						
						newImage.autocrop()
						let b64 = await newImage.getBase64Async(Jimp.AUTO)
						json.status = 'success'
						json.data = b64
						event.sender.send('warp-text-response', json)
					} catch (error) {
						console.error('Error applying wave effect:', error);
						return null;
					}
				}
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
		log.error(err);
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
					log.error(err);
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
		log.error(err);
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
			fs.promises.writeFile(result.filePath, JSON.stringify(arg, null, 2), 'utf8', function(err) {
				log.error(err)
			})
			event.sender.send('hide-overlay', null)
		} else {
			event.sender.send('hide-overlay', null)
		}
	}).catch((err) => {
		log.error(err);
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
					log.info("user cancelled loading swatches")
				}
			}).catch(err => {
				jsonResponse.result = "error"
				jsonResponse.message = err
				log.error(err)
				event.sender.send('load-swatches-response', jsonResponse)
			})
		} else {
			event.sender.send('hide-overlay', null)
		}
	})	
	
})

ipcMain.on('save-pants', async (event, arg) => {
	try {
		let pantsTexturePath;
		if (arg.pantsTexture.startsWith("data:image")) {
            const base64Data = arg.pantsTexture.replace(/^data:image\/(png|gif|jpeg);base64,/, '');
            pantsTexturePath = path.join(tempDir, "tempCapTexture.png");
            await fs.promises.writeFile(pantsTexturePath, base64Data, 'base64');
        } else {
            pantsTexturePath = path.join(__dirname, "images", arg.pantsTexture);
        }

		const pantsData = {
			pantsLogoCanvas: Buffer.from(arg.pantsLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'),
			pantsBelow: Buffer.from(arg.pantsBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'),
			pantsTexture: pantsTexturePath,
			text: arg.text,
			watermarkColor: arg.pantsWatermarkColor
		}

		const pantsBuffer = await imageGen.generatePants(pantsData)

		const options = {
        	defaultPath: increment(store.get("downloadPath", app.getPath('downloads')) + '/' + arg.name+'.webp',{fs: true})
		}

		dialog.showSaveDialog(null, options).then((result) => {
			if (!result.canceled) {
				store.set("downloadPath", path.dirname(result.filePath))
				fs.promises.writeFile(result.filePath, pantsBuffer);
				event.sender.send('save-pants-response', arg)
			} else {
				event.sender.send('save-pants-response', arg)
			}
		}).catch((err) => {
			log.error(err);
			event.sender.send('save-pants-response', arg)
		});
	} catch (err) {
		log.error(err)
		event.sender.send('save-pants-response', err.message)
	}
})

ipcMain.on('save-socks', async (event, arg) => {
	try {
		const socksBuffer = await imageGen.generateSocks(Buffer.from(arg.sockCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'))

		const options = {
        	defaultPath: increment(store.get("downloadPath", app.getPath('downloads')) + '/' + arg.name+'.webp',{fs: true})
		}

		dialog.showSaveDialog(null, options).then((result) => {
			if (!result.canceled) {
				store.set("downloadPath", path.dirname(result.filePath))
				fs.promises.writeFile(result.filePath, socksBuffer);
				event.sender.send('save-socks-response', arg)
			} else {
				event.sender.send('save-socks-response', arg)
			}
		}).catch((err) => {
			log.error(err);
			event.sender.send('save-socks-response', arg)
		});

	} catch (err) {
		log.error(err)
		event.sender.send('save-socks-response', err.message)
	}
})

ipcMain.on('save-cap', async (event, arg) => {
	try {
		let capTexturePath;
        if (arg.capTexture.startsWith("data:image")) {
            const base64Data = arg.capTexture.replace(/^data:image\/(png|gif|jpeg);base64,/, '');
            capTexturePath = path.join(tempDir, "tempCapTexture.png");
            await fs.promises.writeFile(capTexturePath, base64Data, 'base64');
        } else {
            capTexturePath = path.join(__dirname, "images", arg.capTexture);
        }
	
		const capData = {
			capLogoCanvas: Buffer.from(arg.capLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'),
			capBelow: Buffer.from(arg.capBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'),
			capTexture: capTexturePath,
			text: arg.text,
			watermarkColor: arg.capWatermarkColor
		}
	
		const capBuffer = await imageGen.generateCap(capData);

		const options = {
        	defaultPath: increment(store.get("downloadPath", app.getPath('downloads')) + '/' + arg.name+'.webp',{fs: true})
		}

		dialog.showSaveDialog(null, options).then((result) => {
			if (!result.canceled) {
				store.set("downloadPath", path.dirname(result.filePath))
				fs.promises.writeFile(result.filePath, capBuffer);
				event.sender.send('save-cap-response', arg)
			} else {
				event.sender.send('save-cap-response', arg)
			}
		}).catch((err) => {
			log.error(err);
			event.sender.send('save-cap-response', arg)
		});
	} catch (err) {
        log.error(err);
        event.sender.send('save-cap-response', err.message);
    }
})

ipcMain.on('save-font', async (event, arg) => {
	try {
		const fontBuffer = await imageGen.generateFont(Buffer.from(arg.fontCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'))

		const options = {
        	defaultPath: increment(store.get("downloadPath", app.getPath('downloads')) + '/' + arg.name+'.webp',{fs: true})
		}

		dialog.showSaveDialog(null, options).then((result) => {
			if (!result.canceled) {
				store.set("downloadPath", path.dirname(result.filePath))
				fs.promises.writeFile(result.filePath, fontBuffer);
				event.sender.send('save-font-response', arg)
			} else {
				event.sender.send('save-font-response', arg)
			}
		}).catch((err) => {
			log.error(err);
			event.sender.send('save-font-response', arg)
		});
	} catch (err) {
		log.error(err)
		event.sender.send('save-font-response', err.message)
	}
})

ipcMain.on('generate-height-map', async (event, arg) => {
	try {
		log.info("Generating height map")
		
		const data = {
			jerseyLogoCanvas: Buffer.from(arg.jerseyLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'),
			showPlanket: arg.showPlanket,
			buttonPadSeams: arg.buttonPadSeams,
			buttonType: arg.buttonType,
			seamsVisible: arg.seamsVisible,
			seamsOption: arg.seamsOption,
			brightness: parseInt(arg.brightness)/100,
			seamOpacity: parseInt(arg.seamOpacity)/100
		}

		const heightMap = await imageGen.generateHeightMap(data)

		log.info("Height map generated")
			switch (arg.type) {
				case "jersey":
					event.sender.send('save-jersey-response', {status: "success", "image": heightMap, args: arg})
					break;
				case "uniform":
					event.sender.send('save-uniform-response', {status: "success", "image": heightMap, args: arg})
					break;
				case "install":
					event.sender.send('install-uniform-response', {status: "success", "image": heightMap, args: arg})
					break;
				case "preview":
					event.sender.send('generate-preview-response', {status: "success", "image": heightMap, args: arg})
					break;
			}

	} catch (err) {
		log.error(err)
		event.sender.send('error-response', {error: err})
	}
})

ipcMain.on('generate-preview-png', async (event, arg) => {
	try {
		let capTexturePath;
		let pantsTexturePath;
		let jerseyTexturePath;

		if (arg.capTexture.startsWith("data:image")) {
            const base64Data = arg.capTexture.replace(/^data:image\/(png|gif|jpeg);base64,/, '');
            capTexturePath = path.join(tempDir, "tempCapTexture.png");
            await fs.promises.writeFile(capTexturePath, base64Data, 'base64');
        } else {
            capTexturePath = path.join(__dirname, "images", arg.capTexture);
        }

		if (arg.pantsTexture.startsWith("data:image")) {
            const base64Data = arg.pantsTexture.replace(/^data:image\/(png|gif|jpeg);base64,/, '');
            pantsTexturePath = path.join(tempDir, "tempCapTexture.png");
            await fs.promises.writeFile(pantsTexturePath, base64Data, 'base64');
        } else {
            pantsTexturePath = path.join(__dirname, "images", arg.pantsTexture);
        }

		if (arg.jerseyTexture.startsWith("data:image")) {
            const base64Data = arg.jerseyTexture.replace(/^data:image\/(png|gif|jpeg);base64,/, '');
            jerseyTexturePath = path.join(tempDir, "tempJerseyTexture.png");
            await fs.promises.writeFile(jerseyTexturePath, base64Data, 'base64');
        } else {
            jerseyTexturePath = path.join(__dirname, "images", arg.jerseyTexture);
        }

		let [capLogoCanvas, capBelow, pantsLogoCanvas, pantsBelow, jerseyLogoCanvas, jerseyBelow, header] = await Promise.all([
			Buffer.from(arg.capLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'),
			Buffer.from(arg.capBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'),
			Buffer.from(arg.pantsLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'),
			Buffer.from(arg.pantsBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'),
			Buffer.from(arg.jerseyLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'),
			Buffer.from(arg.jerseyBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'),
			Buffer.from(arg.nameCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64')
		])

		const capData = {
			capLogoCanvas: capLogoCanvas,
			capBelow: capBelow,
			capTexture: capTexturePath,
			text: arg.text,
			watermarkColor: arg.capWatermarkColor
		}

		const pantsData = {
			pantsLogoCanvas: pantsLogoCanvas,
			pantsBelow: pantsBelow,
			pantsTexture: pantsTexturePath,
			text: arg.text,
			watermarkColor: arg.pantsWatermarkColor
		}

		const jerseyData = {
			jerseyLogoCanvas: jerseyLogoCanvas,
			jerseyBelow: jerseyBelow,
			jerseyTexture: jerseyTexturePath,
			seamsOnDiffuse: arg.seamsOnDiffuse,
			buttonType: arg.buttonType,
			seamsOption: arg.seamsOption,
			text: arg.text,
			watermarkColor: arg.jerseyWatermarkColor,
			nameCanvas: header
		}

		let [capPreview, pantsPreview, socks, font, jerseyPreview] = await Promise.all([
			imageGen.generateCap(capData, false),
			imageGen.generatePants(pantsData, false),
			imageGen.generateSocks(Buffer.from(arg.sockCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'), false),
			imageGen.generateFont(Buffer.from(arg.fontCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'), false),
			imageGen.generateBakedJersey(jerseyData, false)
		])

		let previewImage = await imageGen.generatePreview(jerseyPreview, capPreview, pantsPreview, socks, font, header)

		const options = {
        	defaultPath: increment(store.get("downloadPath", app.getPath('downloads')) + '/' + arg.name+'_preview.jpg',{fs: true})
		}

		dialog.showSaveDialog(null, options).then((result) => {
			if (!result.canceled) {
				store.set("downloadPath", path.dirname(result.filePath))
				fs.promises.writeFile(result.filePath, previewImage);
				event.sender.send('save-uniform-zip-response', arg)
			} else {
				event.sender.send('save-uniform-zip-response', arg)
			}
		}).catch((err) => {
			log.error(err);
			event.sender.send('save-uniform-zip-response', arg)
		});
	} catch (err) {
		log.error(err)
		event.sender.send('error-response', {error: err.message})
	}
})

ipcMain.on('save-jersey-zip', async (event, arg) => {
	try {
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
						log.error(err)
						return
					}
					})
					log.error(err)
					json.result = "error"
					json.errno = err.errno
					event.sender.send('save-jersey-zip-response', arg)
					//res.json({result: "error", errno: err.errno})
				} else {
					fs.unlink(tempDir + '/'+arg.name+'.zip', (err) => {
					if (err) {
						log.error(err)
						return
					}
					})
					event.sender.send('save-jersey-zip-response', arg)
				};
				})
			} else {
				fs.unlink(tempDir + '/'+arg.name+'.zip', (err) => {
				if (err) {
					log.error(err)
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
			//throw err;
			log.error(err)
			event.sender.send('error-response', {error: err})
		});

		archive.pipe(output)

		if (arg.jerseyTexture.startsWith("data:image")) {
			fs.promises.writeFileSync(tempDir+"/tempJerseyTexture.png", arg.jerseyTexture.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64')
			var jerseyTexture = tempDir+"/tempJerseyTexture.png"
		} else {
			var jerseyTexture = __dirname+"/images/"+arg.jerseyTexture
		}

		let [jerseyLogoCanvas, jerseyBelow, nameCanvas] = await Promise.all([
			Buffer.from(arg.jerseyLogoCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'),
			Buffer.from(arg.jerseyBelow.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'),
			Buffer.from(arg.nameCanvas.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64'),
		])

		const jerseyData = {
			jerseyLogoCanvas: jerseyLogoCanvas,
			jerseyBelow: jerseyBelow,
			jerseyTexture: jerseyTexture,
			seamsOnDiffuse: arg.seamsOnDiffuse,
			buttonType: arg.buttonType,
			seamsOption: arg.seamsOption,
			text: arg.text,
			watermarkColor: arg.jerseyWatermarkColor,
			nameCanvas: nameCanvas
		}

		let [heightMap, normalMap, diffuseMap, bakedJersey] = await Promise.all([
			Buffer.from(arg.heightMap.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.normalMap.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			imageGen.generateDiffuseMap(jerseyData),
			imageGen.generateBakedJersey(jerseyData, true)
		])

		archive.append(diffuseMap, {name: arg.name+".webp"})
		archive.append(heightMap, {name: arg.name+"_h.webp"})
		archive.append(normalMap, {name: arg.name+"_n.webp"})
		archive.append(bakedJersey, {name: arg.name+"_textured.webp"})
		archive.finalize()
	} catch (err) {
		event.sender.send('error-response', {error: err})
	}
})

ipcMain.on('save-uniform-zip', async (event, arg) => {
	try {
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
						log.error(err)
						return
					}
					})
					log.error(err)
					event.sender.send('save-uniform-zip-response', arg)
				} else {
					fs.unlink(tempDir + '/uniform_'+arg.name+'.zip', (err) => {
					if (err) {
						log.error(err)
						return
					}
					})
					event.sender.send('save-uniform-zip-response', arg)
				};
				})
			} else {
				fs.unlink(tempDir + '/uniform_'+arg.name+'.zip', (err) => {
				if (err) {
					log.error(err)
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
			//throw err;
			log.error(err)
			event.sender.send('error-response', {error: err})
		});

		archive.pipe(output)

		const from = (arg.from == null) ? "" : arg.from
		const to = (arg.to == null) ? "" : arg.to

		const swatchJSON = {
			name: arg.name,
			swatch1: arg.swatch1,
			swatch2: arg.swatch2,
			swatch3: arg.swatch3,
			swatch4: arg.swatch4,
			commonPalette: arg.commonPalette
		}

		const root = create({ version: '1.0', encoding: 'UTF-8' })
			.ele("COLORS", {fileversion: "OOTP Developments 2022-08-12 09:30:00"})
			.ele("TEAMCOLORS", {from: from, to: to, color1: arg.backgroundColor, color: arg.textColor})
			.ele("NOTES").txt(" current team colors ").up()
			.ele("UNIFORM", {name: arg.type, from: from, to: to, showname: arg.lettersVisible, shownumber: arg.numbersVisible, highsocks: 'n', font: arg.name})
			.ele("NOTES").txt(arg.type+" uniform").up()
			.ele("CAP", {color1: arg.capColor1, color2: arg.capColor2, color3: arg.capColor3, id: "", filname: "caps_"+arg.name+".png"}).up()
			.ele("JERSEY", {color1: arg.jerseyColor1, color2: arg.jerseyColor2, color3: arg.jerseyColor3, id: "", filname: "jerseys_"+arg.name+".png"}).up()
			.ele("PANTS", {color1: arg.pantsColor1, color2: arg.pantsColor2, color3: arg.pantsColor3, id: "", filname: "pants_"+arg.name+".png"}).up()


		const xml = root.end({prettyPrint:true})

		let capTexturePath;
		let pantsTexturePath;
		let jerseyTexturePath;

		if (arg.capTexture.startsWith("data:image")) {
            const base64Data = arg.capTexture.replace(/^data:image\/(png|gif|jpeg);base64,/, '');
            capTexturePath = path.join(tempDir, "tempCapTexture.png");
            await fs.promises.writeFile(capTexturePath, base64Data, 'base64');
        } else {
            capTexturePath = path.join(__dirname, "images", arg.capTexture);
        }

		if (arg.pantsTexture.startsWith("data:image")) {
            const base64Data = arg.pantsTexture.replace(/^data:image\/(png|gif|jpeg);base64,/, '');
            pantsTexturePath = path.join(tempDir, "tempCapTexture.png");
            await fs.promises.writeFile(pantsTexturePath, base64Data, 'base64');
        } else {
            pantsTexturePath = path.join(__dirname, "images", arg.pantsTexture);
        }

		if (arg.jerseyTexture.startsWith("data:image")) {
            const base64Data = arg.jerseyTexture.replace(/^data:image\/(png|gif|jpeg);base64,/, '');
            jerseyTexturePath = path.join(tempDir, "tempJerseyTexture.png");
            await fs.promises.writeFile(jerseyTexturePath, base64Data, 'base64');
        } else {
            jerseyTexturePath = path.join(__dirname, "images", arg.jerseyTexture);
        }

		let [capLogoCanvas, capBelow, pantsLogoCanvas, pantsBelow, jerseyLogoCanvas, jerseyBelow, nameCanvas, header, json, readme] = await Promise.all([
			Buffer.from(arg.capLogoCanvas.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.capBelow.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.pantsLogoCanvas.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.pantsBelow.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.jerseyLogoCanvas.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.jerseyBelow.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.nameCanvas.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.headerText.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.json, 'utf8'),
			fs.createReadStream(__dirname+"/images/README.pdf")
		])

		const capData = {
			capLogoCanvas: capLogoCanvas,
			capBelow: capBelow,
			capTexture: capTexturePath,
			text: arg.text,
			watermarkColor: arg.capWatermarkColor
		}

		const pantsData = {
			pantsLogoCanvas: pantsLogoCanvas,
			pantsBelow: pantsBelow,
			pantsTexture: pantsTexturePath,
			text: arg.text,
			watermarkColor: arg.pantsWatermarkColor
		}

		const jerseyData = {
			jerseyLogoCanvas: jerseyLogoCanvas,
			jerseyBelow: jerseyBelow,
			jerseyTexture: jerseyTexturePath,
			seamsOnDiffuse: arg.seamsOnDiffuse,
			buttonType: arg.buttonType,
			seamsOption: arg.seamsOption,
			text: arg.text,
			watermarkColor: arg.jerseyWatermarkColor,
			nameCanvas: nameCanvas
		}

		let [cap, capPreview, pants, pantsPreview, socks, socksPreview, font, fontPreview, heightMap, normalMap, diffuseMap, bakedJersey, jerseyPreview] = await Promise.all([
			imageGen.generateCap(capData, true),
			imageGen.generateCap(capData, false),
			imageGen.generatePants(pantsData, true),
			imageGen.generatePants(pantsData, false),
			imageGen.generateSocks(Buffer.from(arg.sockCanvas.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'), true),
			imageGen.generateSocks(Buffer.from(arg.sockCanvas.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'), false),
			imageGen.generateFont(Buffer.from(arg.fontCanvas.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'), true),
			imageGen.generateFont(Buffer.from(arg.fontCanvas.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'), false),
			Buffer.from(arg.heightMap.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.normalMap.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			imageGen.generateDiffuseMap(jerseyData),
			imageGen.generateBakedJersey(jerseyData, true),
			imageGen.generateBakedJersey(jerseyData, false)
		])

		let previewImage = await imageGen.generatePreview(jerseyPreview, capPreview, pantsPreview, socksPreview, fontPreview, header)

		archive.append(cap, {name: "caps_"+arg.name+".webp"})
		archive.append(pants, {name: "pants_"+arg.name+".webp"})
		archive.append(socks, {name: "socks_"+arg.name+".webp"})
		archive.append(font, {name: arg.name+".webp"})
		archive.append(diffuseMap, {name: "jerseys_"+arg.name+".webp"})
		archive.append(heightMap, {name: "jerseys_"+arg.name+"_h.webp"})
		archive.append(normalMap, {name: "jerseys_"+arg.name+"_n.webp"})
		archive.append(bakedJersey, {name: "jerseys_"+arg.name+"_textured.webp"})
		archive.append(previewImage, {name: arg.name+"_preview.jpg"})
		archive.append(xml, {name: arg.name+".xml"});
		archive.append(JSON.stringify(swatchJSON, null, 2), {name: arg.name+".pal"});
		archive.append(json, {name: "uniform_"+arg.name+".uni"})
		archive.append(readme, { name: 'README.pdf' });
		archive.finalize()

	} catch (err) {
		log.error(err)
		event.sender.send('error-response', {error: err})
	}
})

ipcMain.on('install-uniform-zip', async (event, arg) => {
	try {
		const options = {
			title: "Select OOTP Data Folder",
			defaultPath: store.get("OOTPDataPath", app.getPath('desktop')),
			properties: ['openDirectory']
		}

		let capTexturePath;
		let pantsTexturePath;
		let jerseyTexturePath;

		if (arg.capTexture.startsWith("data:image")) {
            const base64Data = arg.capTexture.replace(/^data:image\/(png|gif|jpeg);base64,/, '');
            capTexturePath = path.join(tempDir, "tempCapTexture.png");
            await fs.promises.writeFile(capTexturePath, base64Data, 'base64');
        } else {
            capTexturePath = path.join(__dirname, "images", arg.capTexture);
        }

		if (arg.pantsTexture.startsWith("data:image")) {
            const base64Data = arg.pantsTexture.replace(/^data:image\/(png|gif|jpeg);base64,/, '');
            pantsTexturePath = path.join(tempDir, "tempCapTexture.png");
            await fs.promises.writeFile(pantsTexturePath, base64Data, 'base64');
        } else {
            pantsTexturePath = path.join(__dirname, "images", arg.pantsTexture);
        }

		if (arg.jerseyTexture.startsWith("data:image")) {
            const base64Data = arg.jerseyTexture.replace(/^data:image\/(png|gif|jpeg);base64,/, '');
            jerseyTexturePath = path.join(tempDir, "tempJerseyTexture.png");
            await fs.promises.writeFile(jerseyTexturePath, base64Data, 'base64');
        } else {
            jerseyTexturePath = path.join(__dirname, "images", arg.jerseyTexture);
        }

		let [capLogoCanvas, capBelow, pantsLogoCanvas, pantsBelow, jerseyLogoCanvas, jerseyBelow, nameCanvas] = await Promise.all([
			Buffer.from(arg.capLogoCanvas.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.capBelow.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.pantsLogoCanvas.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.pantsBelow.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.jerseyLogoCanvas.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.jerseyBelow.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.nameCanvas.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64')
		])

		const capData = {
			capLogoCanvas: capLogoCanvas,
			capBelow: capBelow,
			capTexture: capTexturePath,
			text: arg.text,
			watermarkColor: arg.capWatermarkColor
		}

		const pantsData = {
			pantsLogoCanvas: pantsLogoCanvas,
			pantsBelow: pantsBelow,
			pantsTexture: pantsTexturePath,
			text: arg.text,
			watermarkColor: arg.pantsWatermarkColor
		}

		const jerseyData = {
			jerseyLogoCanvas: jerseyLogoCanvas,
			jerseyBelow: jerseyBelow,
			jerseyTexture: jerseyTexturePath,
			seamsOnDiffuse: arg.seamsOnDiffuse,
			buttonType: arg.buttonType,
			seamsOption: arg.seamsOption,
			text: arg.text,
			watermarkColor: arg.jerseyWatermarkColor,
			nameCanvas: nameCanvas
		}

		let [cap, pants, socks, font, heightMap, normalMap, diffuseMap, bakedJersey] = await Promise.all([
			imageGen.generateCap(capData, true),
			imageGen.generatePants(pantsData, true),
			imageGen.generateSocks(Buffer.from(arg.sockCanvas.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64')),
			imageGen.generateFont(Buffer.from(arg.fontCanvas.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64')),
			Buffer.from(arg.heightMap.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			Buffer.from(arg.normalMap.replace(/^data:image\/(png|gif|jpeg|webp);base64,/,''), 'base64'),
			imageGen.generateDiffuseMap(jerseyData),
			imageGen.generateBakedJersey(jerseyData, true),
		])

		dialog.showOpenDialog(null, options).then((result) => {
			if (!result.canceled) {
				store.set("OOTPDataPath", result.filePaths[0])
				fs.promises.writeFile(result.filePaths[0]+"//jerseys//jerseys_"+arg.name+"_h.webp", heightMap);
				fs.promises.writeFile(result.filePaths[0]+"//jerseys//jerseys_"+arg.name+"_n.webp", normalMap);
				fs.promises.writeFile(result.filePaths[0]+"//jerseys//jerseys_"+arg.name+".webp", diffuseMap)
				fs.promises.writeFile(result.filePaths[0]+"//ballcaps//caps_"+arg.name+".webp", cap)
				fs.promises.writeFile(result.filePaths[0]+"//pants//pants_"+arg.name+".webp", pants)
				fs.promises.writeFile(result.filePaths[0]+"//jersey_fonts//"+arg.name+".webp", font)
				fs.promises.writeFile(result.filePaths[0]+"//socks//socks_"+arg.name+".webp", socks)
				event.sender.send('save-uniform-zip-response', arg)
			} else {
				event.sender.send('save-uniform-zip-response', arg)
			}
		})
	} catch (err) {
		event.sender.send('save-uniform-zip-response', arg)
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
		log.error(err)
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

	log.errorHandler.startCatching({
		showDialog: false,
		onError({ createIssue, error, processType, versions }) {
			if (processType === 'renderer') {
				return;
			}
			dialog.showMessageBox({
				title: 'An error occurred',
				message: error.message,
				detail: error.stack,
				type: 'error'
			})
			.then((result) => {
				mainWindow.webContents.send('hide-overlay', null)
			});
		}
	});
    
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
		  {
			  click: () => mainWindow.webContents.send('generate-preview','click'),
			  accelerator: isMac ? 'Cmd+G' : 'Control+G',
			  label: 'Generate Preview',
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
          { role: 'togglefullscreen' },
		  /* {
			click: () => mainWindow.webContents.send('show-spinner','click'),
				label: 'Show the spinner',
		  },
		  {
			click: () => mainWindow.webContents.send('close-spinner','click'),
				label: 'Close the spinner',
		  } */
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
		  },
		  { type: 'separator' },
		  {
			click: () => shell.openExternal(tempDir+"/logs/"),
			label: 'Open Log Folder',
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
		log.info("Main process initialized")
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

function isColorWithinTolerance(pixelColor, targetColor, tolerance) {
	const dr = Math.abs(pixelColor.r - targetColor.r);
	const dg = Math.abs(pixelColor.g - targetColor.g);
	const db = Math.abs(pixelColor.b - targetColor.b);

	return (dr <= tolerance && dg <= tolerance && db <= tolerance);
}

function isColorMatch(pixels, index, baseColor, targetColor, tolerance) {
	const dr = Math.abs(baseColor.r - pixels[index]);
	const dg = Math.abs(baseColor.g - pixels[index + 1]);
	const db = Math.abs(baseColor.b - pixels[index + 2]);

	return (dr + dg + db) / 3 <= tolerance;
}

function isColorMatchAlpha(pixels, index, baseColor, targetColor, tolerance) {
	const dr = Math.abs(baseColor.r - pixels[index]);
	const dg = Math.abs(baseColor.g - pixels[index + 1]);
	const db = Math.abs(baseColor.b - pixels[index + 2]);
	const da = Math.abs(baseColor.a - pixels[index + 3]); // Include alpha channel difference

	return (dr + dg + db + da) / 4 <= tolerance
}

function hexToRgb(hex) {
	// Remove '#' if present
	hex = hex.replace(/^#/, '');

	// Parse hex values
	const bigint = parseInt(hex, 16);

	// Extract RGB components
	const r = (bigint >> 16) & 255;
	const g = (bigint >> 8) & 255;
	const b = bigint & 255;

	return { r, g, b };
}