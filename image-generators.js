const Jimp = require('jimp')

async function generateCap(data) {
    let [capBase, capOverlay, capTextureFile, capWM, font] = await Promise.all([
        Jimp.read(data.capBelow),
        Jimp.read(data.capLogoCanvas),
        Jimp.read(data.capTexture),
        Jimp.read(__dirname + "/images/cap_watermark.png"),
		Jimp.loadFont(__dirname+"/fonts/rowdies.fnt")
    ]);

    let blankCapImage = new Jimp(3000, 500);
    blankCapImage.print(font, 10, 10, data.text)
				 .autocrop()
				 .scaleToFit(500, 15)
				 .color([{ apply: "mix", params: [data.watermarkColor, 100] }]);

    capWM.color([{ apply: "mix", params: [data.watermarkColor, 100] }]);

    capBase.composite(capTextureFile, 0, 0, { mode: Jimp.BLEND_MULTIPLY })
           .composite(capOverlay, 0, 0, { mode: Jimp.BLEND_SOURCE_OVER })
    	   .composite(capWM, 0, 0, { mode: Jimp.BLEND_SOURCE_OVER })
    	   .blit(blankCapImage, 357 - (blankCapImage.bitmap.width / 2), 120 - (blankCapImage.bitmap.height / 2)
    );

    let capBuffer = await capBase.getBufferAsync(Jimp.MIME_PNG);
    return capBuffer;
}

async function generatePants(data) {
    let [pantsBase, pantsTextureFile, pantsOverlay, pantsWM, font] = await Promise.all([
        Jimp.read(data.pantsBelow),
        Jimp.read(data.pantsTexture),
        Jimp.read(data.pantsLogoCanvas),
        Jimp.read(__dirname+"/images/pants_watermark.png"),
        Jimp.loadFont(__dirname+"/fonts/rowdies.fnt")
    ])

    let blankImage = new Jimp(3000, 500)
    blankImage.print(font, 10, 10, data.text)
              .autocrop()
              .scaleToFit(500,15)
              .color([{ apply: "mix", params: [data.watermarkColor, 100] }]);

    pantsWM.color([{ apply: "mix", params: [data.watermarkColor, 100] }]);

    pantsBase.composite(pantsTextureFile, 0, 0, {mode: Jimp.BLEND_MULTIPLY})
             .composite(pantsOverlay, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})
             .composite(pantsWM, 0, 0, {mode:Jimp.BLEND_SOURCE_OVER})  
             .blit(blankImage, 256-(blankImage.bitmap.width/2), 12.5-(blankImage.bitmap.height/2))

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

module.exports = { generateCap, generatePants, generateSocks, generateFont };