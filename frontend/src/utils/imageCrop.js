export function renderImageCropBlob({ image, crop, rotation, flipX, flipY, zoom, panX, panY, imageWidth, imageHeight }) {
  const isQuarterTurn = Math.abs(rotation || 0) % 180 === 90;
  const orientedWidth = isQuarterTurn ? imageHeight : imageWidth;
  const orientedHeight = isQuarterTurn ? imageWidth : imageHeight;
  const outputWidth = Math.max(1, Math.round(orientedWidth * crop.width));
  const outputHeight = Math.max(1, Math.round(orientedHeight * crop.height));
  const orientedCanvas = document.createElement('canvas');
  orientedCanvas.width = orientedWidth;
  orientedCanvas.height = orientedHeight;
  const orientedContext = orientedCanvas.getContext('2d');
  orientedContext.translate(orientedWidth / 2, orientedHeight / 2);
  orientedContext.translate(panX * orientedWidth, panY * orientedHeight);
  orientedContext.rotate((rotation * Math.PI) / 180);
  orientedContext.scale((flipX ? -1 : 1) * (zoom || 1), (flipY ? -1 : 1) * (zoom || 1));
  orientedContext.drawImage(image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d');
  context.drawImage(orientedCanvas, crop.x * orientedWidth, crop.y * orientedHeight, outputWidth, outputHeight, 0, 0, outputWidth, outputHeight);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
