const LIB_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';

let libPromise;

function loadLib() {
  if (!libPromise) {
    libPromise = import(LIB_URL).catch((error) => {
      libPromise = null;
      throw error;
    });
  }
  return libPromise;
}

function makeProgressAggregator(requestId) {
  const files = new Map();
  return (key, current, total) => {
    if (key.startsWith('fetch')) {
      files.set(key, { current, total });
      let completed = 0;
      let size = 0;
      for (const file of files.values()) {
        completed += file.current;
        size += file.total;
      }
      self.postMessage({
        type: 'progress',
        requestId,
        progress: { phase: 'download', fraction: size ? completed / size : 0, key }
      });
    } else {
      self.postMessage({
        type: 'progress',
        requestId,
        progress: { phase: 'compute', fraction: total ? current / total : 0, key }
      });
    }
  };
}

self.addEventListener('message', async ({ data }) => {
  const { requestId, type, image } = data;
  try {
    if (type === 'preload') {
      await loadLib();
      self.postMessage({ type: 'result', requestId, blob: null });
      return;
    }

    const lib = await loadLib();
    const removeBackground = lib.removeBackground ?? lib.default;
    const blob = await removeBackground(image, {
      progress: makeProgressAggregator(requestId),
      model: 'isnet_fp16',
      output: { format: 'image/png' }
    });
    self.postMessage({ type: 'result', requestId, blob });
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId,
      name: error instanceof Error ? error.name : 'BackgroundRemovalError',
      message: error instanceof Error ? error.message : 'Could not remove the image background.'
    });
  }
});
