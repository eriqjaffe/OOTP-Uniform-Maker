function pensioner() {

  this.greyScale = function(selector, algorithm) {
    var pixels = selector.childNodes;

    // gimp coefficients
    // slower method (about ~10% slower measured with performance.now())
    //var max = 255;
    //var white = max*3;
    //var rco = white*0.3;
    //var gco = white*0.59;
    //var bco = white*0.11;

    for (var i=0; i<pixels.length; i++) {
      var rgba = pixels[i].style.backgroundColor.match(/[0-9\.]+/g);

      if (rgba) {
        var sum = 0;

        switch (algorithm) {
          case 'avg': // averaging
            sum += parseInt(rgba[0]);
            sum += parseInt(rgba[1]);
            sum += parseInt(rgba[2]);
            break;

          case 'gimp': // gimp
            sum += parseFloat(rgba[0]*0.89);
            sum += parseFloat(rgba[1]*1.77);
            sum += parseFloat(rgba[2]*0.33);
            // slower method (about ~10% slower measured with performance.now())
            //sum += parseFloat(rgba[0]/255*rco);
            //sum += parseFloat(rgba[1]/255*gco);
            //sum += parseFloat(rgba[2]/255*bco);
            break;
        }

        var g = Math.ceil(sum/3);

        var gray = 'rgb('+g+','+g+','+g;

        if (rgba[3]) {
          gray += ','+rgba[3];
        }

        gray += ')';

        pixels[i].style.backgroundColor = gray;
      }
    }
  }

  this.divPixels = function(srcselector, pixelsize, targetselector, colormatrix) {
    var srcstyle = window.getComputedStyle(srcselector, null);
    var height_unscaled = parseInt(srcstyle.height);
    var width_unscaled = parseInt(srcstyle.width);
    var height_scaled = height_unscaled * pixelsize;
    var width_scaled = width_unscaled * pixelsize;

    targetselector.style.height = height_scaled+'px';
    targetselector.style.position = 'relative';
    targetselector.style.width = width_scaled+'px';

    var pxcolumn = 0;
    var pxrow = 0;

    for (let i=0; i<colormatrix.length; i++) {

      if (i !== 0) {

        if (i%width_unscaled === 0) {
          pxcolumn = 0;
          pxrow += 1;
        }
        else {
          pxcolumn ++;
        }
      }

      var px = document.createElement('div');
      px.style.backgroundColor = colormatrix[i];
      px.style.height = pixelsize+'px';
      px.style.left = (pxcolumn*pixelsize)+'px';
      px.style.position = 'absolute';
      px.style.top = (pxrow*pixelsize)+'px';
      px.style.width = pixelsize+'px';
      targetselector.appendChild(px);
    }
  }

  this.colorMatrix = function(selector, quality=100) {
    quality = 255 - Math.floor(255/100*quality);

    var style = window.getComputedStyle(selector, null);
    var canvas = document.createElement('canvas');
    canvas.width = parseInt(style.width);
    canvas.height = parseInt(style.height);

    var canvascontext = canvas.getContext('2d');
    canvascontext.drawImage(selector, 0, 0, canvas.width, canvas.height);
    // playing with width & height args is pretty!
    var imgdata = canvascontext.getImageData(0, 0, canvas.width, canvas.height);

    var colormatrix = [];
    var id = imgdata.data;

    for (var i=0; i<imgdata.data.length; i+=4) {
      var r = Math.round(id[i]/quality) * quality;
      var g = Math.round(id[i+1]/quality) * quality;
      var b = Math.round(id[i+2]/quality) * quality;
      var a = Math.round(id[i+3]/quality) * quality;
      a = (a/255).toFixed(2);

      colormatrix.push('rgba('+r+','+g+','+b+','+a+')');
    }

    return colormatrix;
  }

}
