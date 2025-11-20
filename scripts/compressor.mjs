import imagemin from "imagemin";
import imageminJpegoptim from "imagemin-jpegoptim";

export async function compressToSize(buffer, sizeKB = 512) {
  return imagemin.buffer(buffer, {
    plugins: [
      imageminJpegoptim({ size: sizeKB })
    ]
  });
}