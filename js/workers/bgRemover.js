let worker;
let nextRequestId = 0;
const pending = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./bgRemover-worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', ({ data }) => {
      const request = pending.get(data.requestId);
      if (!request) return;

      if (data.type === 'progress') {
        request.onProgress?.(data.progress);
        return;
      }

      pending.delete(data.requestId);
      if (data.type === 'result') {
        request.resolve(data.blob);
      } else {
        const error = new Error(data.message || 'Background removal failed.');
        error.name = data.name || 'BackgroundRemovalError';
        request.reject(error);
      }
    });
    worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'Background removal worker failed.');
      pending.forEach((request) => request.reject(error));
      pending.clear();
      worker = null;
    });
  }
  return worker;
}

function requestWorker(type, image, onProgress) {
  const requestId = ++nextRequestId;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject, onProgress });
    getWorker().postMessage({ type, image, requestId });
  });
}

export function preload() {
  return requestWorker('preload');
}

export function removeBg(image, onProgress) {
  return requestWorker('remove', image, onProgress);
}
