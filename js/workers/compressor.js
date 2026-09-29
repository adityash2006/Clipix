self.onmessage = async (event) =>{
  try {
    const { file, quality, maxWidth, outputFormat } = event.data;
    const bitmap = await createImageBitmap(file);
    const scale = maxWidth ? Math.min(1, maxWidth / bitmap.width) : 1;
    const canvas = new OffscreenCanvas(bitmap.width * scale, bitmap.height * scale);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: `image/${outputFormat}`, quality });
    self.postMessage({ blob });
  } catch (error) {
    self.postMessage({ error: error.message || 'The image could not be processed.' });
  }

}