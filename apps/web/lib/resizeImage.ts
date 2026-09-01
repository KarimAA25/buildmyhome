// Vercel Functions cap request/response bodies at 4.5MB (hard platform limit,
// same across all plans). Raw camera photos routinely exceed that before even
// base64-encoding, so every image entering the app gets downscaled here first.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

function drawResized(source: CanvasImageSource, sourceWidth: number, sourceHeight: number): string {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export function resizeVideoFrame(video: HTMLVideoElement): string {
  return drawResized(video, video.videoWidth, video.videoHeight);
}

export function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        resolve(drawResized(img, img.naturalWidth, img.naturalHeight));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}
