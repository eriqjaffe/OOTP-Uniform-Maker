const Jimp = require('jimp')
const fs = require('fs')

async function generateCap(data, watermark = true) {
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

    let capBuffer = await capBase.getBufferAsync(Jimp.MIME_PNG);
    return capBuffer;
}

async function generatePants(data, watermark = true) {
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

    let pantsBuffer = await pantsBase.getBufferAsync(Jimp.MIME_PNG)
    return pantsBuffer;
}

async function generateSocks(data) {
    let [socksBase, socksTexture] = await Promise.all([
        Jimp.read(data),
        Jimp.read(__dirname+"/images/socks_texture.png")
    ])

    socksBase.crop(256,0,512,1024).composite(socksTexture, 0, 0, {mode: Jimp.BLEND_MULTIPLY})

    let socksBuffer = await socksBase.getBufferAsync(Jimp.MIME_PNG)
    return socksBuffer;
}

async function generateFont(data) {
    let fontBase = await Jimp.read(data)
    let fontBuffer = await fontBase.getBufferAsync(Jimp.MIME_PNG)
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

    let heightMapBase64 = await jerseyHeightMap.getBase64Async(Jimp.AUTO)
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
            if (seamsOption == "seamsSixties") {
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

    let diffuseBuffer = await jerseyBase.getBufferAsync(Jimp.MIME_PNG)

    return diffuseBuffer;
}

async function generateBakedJersey(data, watermark = true) {
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
            if (seamsOption == "seamsSixties") {
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

    let bakedBuffer = await jerseyBase.getBufferAsync(Jimp.MIME_PNG)

    return bakedBuffer;
}

module.exports = { 
    generateCap, 
    generatePants, 
    generateSocks, 
    generateFont, 
    generateHeightMap,
    generateDiffuseMap,
    generateBakedJersey
 };