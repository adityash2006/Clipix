const MaxRetries = 2;
export class WorkerPool {
  constructor(workerUrl, size = Math.min(navigator.hardwareConcurrency || 2, 4)) {
    this.queue = [];
    this.workers = Array.from({ length: size }, () => ({
      worker: new Worker(workerUrl, { type: 'module' }),
      busy: false,
      job: null,
    }));
    this.workers.forEach((slot) => {
      slot.worker.onmessage = (e) => this.#onMessage(slot, e.data);
      slot.worker.onerror = (err) => this.#onError(slot, err);
    });
  }

  run(payload, onProgress) {
    return new Promise((resolve, reject) => {
      this.queue.push({ payload, onProgress, resolve, reject, retries: 0 });
      this.#dispatch();
    });
  }

  #dispatch() {
    const slot = this.workers.find((w) => !w.busy);
    if (!slot || this.queue.length === 0) return;
    const job = this.queue.shift();
    slot.busy = true;
    slot.job = job;
    slot.worker.postMessage(job.payload);
    this.#dispatch();
  }
  #fail(slot, error) {
   const job = slot.job;
   slot.busy = false;
   slot.job = null;
   if (job.retries < MaxRetries) {
     job.retries++;
     this.queue.push(job);          
   } else {
    job.reject(error);             
   }
   this.#dispatch();
}

#onMessage(slot, msg) {
  if (msg.type === 'progress') return slot.job?.onProgress?.(msg.value);
  if (msg.type === 'error') return this.#fail(slot, new Error(msg.message));
  const job = slot.job;
  if (!job) return;
  slot.busy = false;
  slot.job = null;
  job.resolve(msg);
  this.#dispatch();
}

#onError(slot, err) {
  this.#fail(slot, err);
}
}