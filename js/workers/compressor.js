self.onmessage = async (event) =>{
  try {
    const { file, quality, maxWidth, outputFormat, requestId } = event.data;
    self.postMessage({ type: 'progress', value: 0.1, requestId });
    const bitmap = await createImageBitmap(file);
    const scale = maxWidth ? Math.min(1, maxWidth / bitmap.width) : 1;
    const canvas = new OffscreenCanvas(bitmap.width * scale, bitmap.height * scale);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    self.postMessage({ type: 'progress', value: 0.7, requestId });
    const blob = await canvas.convertToBlob({ type: `image/${outputFormat}`, quality });
    self.postMessage({ type: 'complete', blob, width: canvas.width, height: canvas.height, requestId });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || 'The image could not be processed.', requestId: event.data.requestId });
  }

}