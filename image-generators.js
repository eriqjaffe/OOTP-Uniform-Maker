const Jimp = require('jimp')
const webp = require('webp-wasm');

async function generateCap(data, watermark = true) {
    let capBuffer;

    let [capBase, capOverlay, capTextureFile, capWM, font] = await Promise.all([
        Jimp.read(data.capBelow),
        Jimp.read(data.capLogoCanvas),
        Jimp.read(data.capTexture),
        Jimp.read(__dirname + "/images/cap_watermark.png"),
		Jimp.loadFont(__dirname+"/fonts/rowdies.fnt")
    ]);

    let blankCapImage = new Jimp(3000, 500);

    if (watermark) {
        blankCapImage.print(font, 10, 10, data.text)
            .autocrop()
            .scaleToFit(500, 15)
            .color([{ apply: "mix", params: [data.watermarkColor, 100] }]);
    } else {
        blankCapImage.autocrop()
            .scaleToFit(500, 15)
    }
    
    capWM.color([{ apply: "mix", params: [data.watermarkColor, 100] }]);

    capBase.composite(capTextureFile, 0, 0, { mode: Jimp.BLEND_MULTIPLY })
           .composite(capOverlay, 0, 0, { mode: Jimp.BLEND_SOURCE_OVER })

    if (watermark) {
        capBase.composite(capWM, 0, 0, { mode: Jimp.BLEND_SOURCE_OVER })
    }

    capBase.blit(blankCapImage, 357 - (blankCapImage.bitmap.width / 2), 120 - (blankCapImage.bitmap.height / 2));

    capBuffer = await capBase.getBufferAsync(Jimp.MIME_PNG)

    if (watermark) {
        const rawImageData = {
            data: capBase.bitmap.data,         // Jimp's raw RGBA pixel buffer
            width: capBase.bitmap.width,       // Image width
            height: capBase.bitmap.height      // Image height
        };

        const webpArrayBuffer = await webp.encode(rawImageData, {
            lossless: 1, // Turns on lossless WebP (matches PNG clarity)
            exact: 1,    // Preserves exact RGB values in transparent areas
            quality: 100 // Effort level for lossless (100 = max compression effort)
        });

        capBuffer = Buffer.from(webpArrayBuffer)
    }
    
    return capBuffer;
}

async function generatePants(data, watermark = true) {
    let pantsBuffer;
    let [pantsBase, pantsTextureFile, pantsOverlay, pantsWM, font, defaultTexture] = await Promise.all([
        Jimp.read(data.pantsBelow),
        Jimp.read(data.pantsTexture),
        Jimp.read(data.pantsLogoCanvas),
        Jimp.read(__dirname+"/images/pants_watermark.png"),
        Jimp.loadFont(__dirname+"/fonts/rowdies.fnt"),
        Jimp.read(__dirname+"/images/texture_pants_default.png")
    ])

    let blankImage = new Jimp(3000, 500)
    
    if (watermark) {
        blankImage.print(font, 10, 10, data.text)
              .autocrop()
              .scaleToFit(500,15)
              .color([{ apply: "mix", params: [data.watermarkColor, 100] }]);
    } else {
        blankImage.autocrop()
              .scaleToFit(500,15)
    }
    

    pantsWM.color([{ apply: "mix", params: [data.watermarkColor, 100] }]);

    pantsBase.composite(pantsTextureFile, 0, 0, {mode: Jimp.BLEND_MULTIPLY})

    if (!watermark) {
        pantsBase.composite(defaultTexture, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
    }
    
    pantsBase.composite(pantsOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})

    if (watermark) {
        pantsBase.composite(pantsWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})  
    }
             
    pantsBase.blit(blankImage, 256-(blankImage.bitmap.width/2), 12.5-(blankImage.bitmap.height/2))

    pantsBuffer = await pantsBase.getBufferAsync(Jimp.MIME_PNG)

    if (watermark) {
        const rawImageData = {
            data: pantsBase.bitmap.data,         // Jimp's raw RGBA pixel buffer
            width: pantsBase.bitmap.width,       // Image width
            height: pantsBase.bitmap.height      // Image height
        };

        const webpArrayBuffer = await webp.encode(rawImageData, {
            lossless: 1, // Turns on lossless WebP (matches PNG clarity)
            exact: 1,    // Preserves exact RGB values in transparent areas
            quality: 100 // Effort level for lossless (100 = max compression effort)
        });

        pantsBuffer = Buffer.from(webpArrayBuffer)
    }

    return pantsBuffer;
}

async function generateSocks(data, watermark = true) {
    let socksBuffer;
    let [socksBase, socksTexture] = await Promise.all([
        Jimp.read(data),
        Jimp.read(__dirname+"/images/socks_texture.png")
    ])

    socksBase.crop(256,0,512,1024).composite(socksTexture, 0, 0, {mode: Jimp.BLEND_MULTIPLY})

    socksBuffer = await socksBase.getBufferAsync(Jimp.MIME_PNG)

    if (watermark) {
        const rawImageData = {
            data: socksBase.bitmap.data,         // Jimp's raw RGBA pixel buffer
            width: socksBase.bitmap.width,       // Image width
            height: socksBase.bitmap.height      // Image height
        };

        const webpArrayBuffer = await webp.encode(rawImageData, {
            lossless: 1, // Turns on lossless WebP (matches PNG clarity)
            exact: 1,    // Preserves exact RGB values in transparent areas
            quality: 100 // Effort level for lossless (100 = max compression effort)
        });

        socksBuffer = Buffer.from(webpArrayBuffer)
    }

    return socksBuffer;
}

async function generateFont(data, watermark = true) {
    let fontBuffer;
    let fontBase = await Jimp.read(data)
    
    fontBuffer = await fontBase.getBufferAsync(Jimp.MIME_PNG)

    if (watermark) {
        const rawImageData = {
            data: fontBase.bitmap.data,         // Jimp's raw RGBA pixel buffer
            width: fontBase.bitmap.width,       // Image width
            height: fontBase.bitmap.height      // Image height
        };

        const webpArrayBuffer = await webp.encode(rawImageData, {
            lossless: 1, // Turns on lossless WebP (matches PNG clarity)
            exact: 1,    // Preserves exact RGB values in transparent areas
            quality: 100 // Effort level for lossless (100 = max compression effort)
        });

        fontBuffer = Buffer.from(webpArrayBuffer)
    }

    return fontBuffer
}

async function generateHeightMap(data) {
    let seamsSrc = null;
    let seamHMSrc = null;
    let planketSrc = null;

    if (data.buttonPadSeams == true) {
        if (data.buttonType != "buttonsHenley") {
            if (data.seamsOption == "seamsSixties") {
                seamsSrc = __dirname+"/images/seams/seams_button_pad_sixties.png"
            } else {
                seamsSrc = __dirname+"/images/seams/seams_button_pad.png"
            }
        } else {
            if (data.seamsOption == "seamsSixties") {
                seamsSrc = __dirname+"/images/seams/seams_button_pad_henley_sixties.png"
            } else {
                seamsSrc = __dirname+"/images/seams/seams_button_pad_henley.png"
            }
        }
    }

    if (data.seamsVisible == true) {
        switch (data.seamsOption) {
            case "seamsStandardToPiping":
                seamHMSrc = __dirname+"/images/seams/seams_standard_to_piping.png"
                break;
            case "seamsStandardToCollar":
                seamHMSrc = __dirname+"/images/seams/seams_standard_to_collar.png"
                break;
            case "seamsRaglanToPiping":
                seamHMSrc = __dirname+"/images/seams/seams_raglan_to_piping.png"
                break;
            case "seamsRaglanToCollar":
                seamHMSrc = __dirname+"/images/seams/seams_raglan_to_collar.png"
                break;
            case "seamsSixties":
                seamHMSrc = __dirname+"/images/seams/seams_sixties.png"
                break;
        }
    }

    if (data.showPlanket == true) {
        if (data.buttonType != "buttonsHenley") {
            planketSrc = __dirname+"/images/planket.png"
        } else {
            planketSrc = __dirname+"/images/planket_henley.png"
        }
    }

    let [jerseyHeightMap, jerseyOverlay, bpHMSeamImg, seamsHMImg, planket] = await Promise.all([
        Jimp.read(__dirname+"/images/jersey_height_map.png"),
        Jimp.read(data.jerseyLogoCanvas),
        seamsSrc ? Jimp.read(seamsSrc) : Promise.resolve(null),
        seamHMSrc ? Jimp.read(seamHMSrc) : Promise.resolve(null),
        planketSrc ? Jimp.read(planketSrc) : Promise.resolve(null)
    ])

    if (bpHMSeamImg) { 
        bpHMSeamImg.opacity(data.seamOpacity)
        jerseyHeightMap.composite(bpHMSeamImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
    }
    if (seamsHMImg) { 
        seamsHMImg.opacity(data.seamOpacity)
        jerseyHeightMap.composite(seamsHMImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER}) 
    
    }
    if (planket) { 
        jerseyHeightMap.composite(planket, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER}) 
    }

    jerseyOverlay.grayscale()
    jerseyOverlay.brightness(data.brightness)

    jerseyHeightMap.composite(jerseyOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})

    const rawImageData = {
        data: jerseyHeightMap.bitmap.data,
        width: jerseyHeightMap.bitmap.width,
        height: jerseyHeightMap.bitmap.height
    };

    // 2. Encode to lossless WebP buffer
    const webpBuffer = await webp.encode(rawImageData, {
        lossless: 1,
        exact: 1,
        quality: 100
    });

    // 3. Convert the buffer to a base64 data URL string
    const heightMapBase64 = `data:image/webp;base64,${webpBuffer.toString('base64')}`;

    //let heightMapBase64 = await jerseyHeightMap.getBase64Async(Jimp.AUTO)
    return heightMapBase64
}

async function generateDiffuseMap(data) {
    let diffuseSeamsSrc = null;
    let diffuseSeamSrc = null;

    let [jerseyBase, jerseyOverlay, jerseyTextureFile, jerseyWM, nameImage] = await Promise.all([
        Jimp.read(data.jerseyBelow),
        Jimp.read(data.jerseyLogoCanvas),
        Jimp.read(data.jerseyTexture),
        await Jimp.read(__dirname+"/images/jersey_watermark.png"),
        await Jimp.read(data.nameCanvas)
    ]);

    if (data.seamsOnDiffuse == true) {
        if (data.buttonType != "buttonsHenley") {
            if (data.seamsOption == "seamsSixties") {
                diffuseSeamsSrc = __dirname+"/images/seams/seams_button_pad_sixties.png"
            } else {
                diffuseSeamsSrc = __dirname+"/images/seams/seams_button_pad.png"
            }	
        } else {
            if (data.seamsOption == "seamsSixties") {
                diffuseSeamsSrc = __dirname+"/images/seams/seams_button_pad_henley_sixties.png"
            } else {
                diffuseSeamsSrc = __dirname+"/images/seams/seams_button_pad_henley.png"
            }
        }
        
        switch (data.seamsOption) {
            case "seamsStandardToPiping":
                diffuseSeamSrc = __dirname+"/images/seams/seams_standard_to_piping.png"
                break;
            case "seamsStandardToCollar":
                diffuseSeamSrc = __dirname+"/images/seams/seams_standard_to_collar.png"
                break;
            case "seamsRaglanToPiping":
                diffuseSeamSrc = __dirname+"/images/seams/seams_raglan_to_piping.png"
                break;
            case "seamsRaglanToCollar":
                diffuseSeamSrc = __dirname+"/images/seams/seams_raglan_to_collar.png"
                break;
            case "seamsSixties":
                diffuseSeamSrc = __dirname+"/images/seams/seams_sixties.png"
                break;
        }

        if (diffuseSeamsSrc) {
            let diffuseSeamImg = await Jimp.read(diffuseSeamsSrc)
            await diffuseSeamImg.opacity(.1)
            await jerseyBase.composite(diffuseSeamImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
        }

        if (diffuseSeamSrc) {
            let seamsDiffuseImg = await Jimp.read(diffuseSeamSrc)
            await seamsDiffuseImg.opacity(.1)
            await jerseyBase.composite(seamsDiffuseImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
        }
    }

    await jerseyWM.color([{ apply: "mix", params: [data.jerseyWatermarkColor, 100] }]);
        
    await jerseyBase.composite(jerseyTextureFile, 0, 0, {mode: Jimp.BLEND_MULTIPLY})	
                    .composite(jerseyOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
                    .composite(jerseyWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
                    .composite(nameImage, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})

    const rawImageData = {
        data: jerseyBase.bitmap.data,         // Jimp's raw RGBA pixel buffer
        width: jerseyBase.bitmap.width,       // Image width
        height: jerseyBase.bitmap.height      // Image height
    };

    const webpArrayBuffer = await webp.encode(rawImageData, {
        lossless: 1, // Turns on lossless WebP (matches PNG clarity)
        exact: 1,    // Preserves exact RGB values in transparent areas
        quality: 100 // Effort level for lossless (100 = max compression effort)
    });

    const diffuseBuffer = Buffer.from(webpArrayBuffer);

    //let diffuseBuffer = await jerseyBase.getBufferAsync(Jimp.MIME_PNG)

    return diffuseBuffer;
}

async function generateBakedJersey(data, watermark = true) {
    let bakedBuffer;
    let diffuseSeamsSrc = null;
    let diffuseSeamSrc = null;

    let [jerseyBase, jerseyOverlay, jerseyTextureFile, jerseyWM, nameImage, shading] = await Promise.all([
        Jimp.read(data.jerseyBelow),
        Jimp.read(data.jerseyLogoCanvas),
        Jimp.read(data.jerseyTexture),
        await Jimp.read(__dirname+"/images/jersey_watermark.png"),
        await Jimp.read(data.nameCanvas),
        Jimp.read(__dirname+"/images/texture_jersey_default.png")
    ]);

    if (data.seamsOnDiffuse == true) {
        if (data.buttonType != "buttonsHenley") {
            if (data.seamsOption == "seamsSixties") {
                diffuseSeamsSrc = __dirname+"/images/seams/seams_button_pad_sixties.png"
            } else {
                diffuseSeamsSrc = __dirname+"/images/seams/seams_button_pad.png"
            }	
        } else {
            if (data.seamsOption == "seamsSixties") {
                diffuseSeamsSrc = __dirname+"/images/seams/seams_button_pad_henley_sixties.png"
            } else {
                diffuseSeamsSrc = __dirname+"/images/seams/seams_button_pad_henley.png"
            }
        }
        
        switch (data.seamsOption) {
            case "seamsStandardToPiping":
                diffuseSeamSrc = __dirname+"/images/seams/seams_standard_to_piping.png"
                break;
            case "seamsStandardToCollar":
                diffuseSeamSrc = __dirname+"/images/seams/seams_standard_to_collar.png"
                break;
            case "seamsRaglanToPiping":
                diffuseSeamSrc = __dirname+"/images/seams/seams_raglan_to_piping.png"
                break;
            case "seamsRaglanToCollar":
                diffuseSeamSrc = __dirname+"/images/seams/seams_raglan_to_collar.png"
                break;
            case "seamsSixties":
                diffuseSeamSrc = __dirname+"/images/seams/seams_sixties.png"
                break;
        }

        if (diffuseSeamsSrc) {
            let diffuseSeamImg = await Jimp.read(diffuseSeamsSrc)
            await diffuseSeamImg.opacity(.1)
            await jerseyBase.composite(diffuseSeamImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
        }

        if (diffuseSeamSrc) {
            let seamsDiffuseImg = await Jimp.read(diffuseSeamSrc)
            await seamsDiffuseImg.opacity(.1)
            await jerseyBase.composite(seamsDiffuseImg, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
        }
    }

    await jerseyWM.color([{ apply: "mix", params: [data.jerseyWatermarkColor, 100] }]);
        
    await jerseyBase.composite(jerseyTextureFile, 0, 0, {mode: Jimp.BLEND_MULTIPLY})	
                    .composite(shading, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
                    .composite(jerseyOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})

    if (watermark) {
        jerseyBase.composite(jerseyWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
                  .composite(nameImage, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
    }         

    bakedBuffer = await jerseyBase.getBufferAsync(Jimp.MIME_PNG)

    if (watermark) {
        const rawImageData = {
            data: jerseyBase.bitmap.data,         // Jimp's raw RGBA pixel buffer
            width: jerseyBase.bitmap.width,       // Image width
            height: jerseyBase.bitmap.height      // Image height
        };

        const webpArrayBuffer = await webp.encode(rawImageData, {
            lossless: 1, // Turns on lossless WebP (matches PNG clarity)
            exact: 1,    // Preserves exact RGB values in transparent areas
            quality: 100 // Effort level for lossless (100 = max compression effort)
        });

        bakedBuffer = Buffer.from(webpArrayBuffer)
    }

    return bakedBuffer;
}

async function generatePreview(jerseyPreview, capPreview, pantsPreview, socksPreview, fontPreview, header) {
    let [jersey, cap, pants, socks, font, checkerboard, headerImg, watermark, fontfile] = await Promise.all([
        Jimp.read(jerseyPreview),
        Jimp.read(capPreview),
        Jimp.read(pantsPreview),
        Jimp.read(socksPreview),
        Jimp.read(fontPreview),
        makeCheckerboard(),
        Jimp.read(header),
        Jimp.read(__dirname+"/images/preview_watermark.jpg"),
        Jimp.loadFont(__dirname+"/fonts/rowdies.fnt")
    ])

    let previewImage = new Jimp(1536, 1224, "white")

    font.resize(512, 512)

    previewImage.blit(headerImg, 0, 0)
                .blit(watermark, 0, 1124)
                .blit(cap, 0, 100)
                .blit(pants, 0, 612)
                .blit(socks, 1024, 100)
                .blit(checkerboard, 1024, 612)
                .blit(font, 1024, 612)
                .blit(jersey, 512, 100)

    let previewBuffer = await previewImage.getBufferAsync(Jimp.MIME_JPEG);

    const finalPreview = await compressToSize(previewBuffer, 495);

    return finalPreview;
}

async function makeCheckerboard(size = 512, square = 32) {
	const img = new Jimp(size, size);
  
	const light = Jimp.rgbaToInt(0xCC, 0xCC, 0xCC, 255); // #CCCCCC
	const dark  = Jimp.rgbaToInt(0x99, 0x99, 0x99, 255); // #999999
  
	for (let y = 0; y < size; y += square) {
	  for (let x = 0; x < size; x += square) {
		const isDark = ((x / square) + (y / square)) % 2 === 0;
		const color = isDark ? dark : light;
  
		img.scan(x, y, square, square, function(px, py, idx) {
		  this.bitmap.data.writeUInt32BE(color, idx);
		});
	  }
	}
  
	return img;
  }

async function compressToSize(inputBuffer, maxKB = 495) {
	const maxBytes = maxKB * 1024;
  
	const baseImage = await Jimp.read(inputBuffer);
  
	// Attempt binary search for JPEG quality
	let low = 1;
	let high = 100;
	let bestBuffer = null;
  
	while (low <= high) {
	  const mid = Math.floor((low + high) / 2);
  
	  const buf = await baseImage
		.clone()
		.quality(mid)
		.getBufferAsync(Jimp.MIME_JPEG);
  
	  if (buf.length <= maxBytes) {
		bestBuffer = buf;
		low = mid + 1;       // try higher quality
	  } else {
		high = mid - 1;      // reduce quality
	  }
	}
  
	// If we never got under the size, return the original JPEG buffer
	return bestBuffer || inputBuffer;
}

module.exports = { 
    generateCap, 
    generatePants, 
    generateSocks, 
    generateFont, 
    generateHeightMap,
    generateDiffuseMap,
    generateBakedJersey,
    generatePreview
 };