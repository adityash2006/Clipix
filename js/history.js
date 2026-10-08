import { addItem, getAll, deleteItem, clear } from './db/db.js';

async function makeThumb(blob, size = 200) {
  const bitmap = await createImageBitmap(blob);
  const scale = size / Math.max(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((thumb) => thumb ? resolve(thumb) : reject(new Error('Could not create a thumbnail.')), 'image/webp', 0.7);
  });
}

export async function saveDownload({ operation, sizes, format, result }) {
  await addItem({
    createdAt: Date.now(),
    operation,
    sizes,
    format,
    thumb: await makeThumb(result),
    result
  });
}

let urls = [];

async function renderHistory() {
  urls.forEach((url) => URL.revokeObjectURL(url));
  urls = [];

  const items = (await getAll()).sort((a, b) => b.createdAt - a.createdAt);
  const grid = document.getElementById('history-grid');
  const empty = document.getElementById('history-empty');
  grid.replaceChildren();
  empty.hidden = items.length > 0;

  for (const item of items) {
    const thumbUrl = URL.createObjectURL(item.thumb);
    urls.push(thumbUrl);
    const card = document.createElement('article');
    card.className = 'history-card';
    card.innerHTML = `
      <img class="history-thumb" alt="" />
      <div class="history-card-body">
        <div class="history-card-heading">
          <h2></h2>
          <time></time>
        </div>
        <p class="history-details"></p>
        <div class="history-actions">
          <button class="download-button history-download" type="button">Download again</button>
          <button class="history-delete" type="button">Delete</button>
        </div>
      </div>
    `;
    card.querySelector('.history-thumb').src = thumbUrl;
    card.querySelector('h2').textContent = item.operation === 'remove-background'
      ? 'Background removed'
      : item.operation.charAt(0).toUpperCase() + item.operation.slice(1);
    card.querySelector('time').dateTime = new Date(item.createdAt).toISOString();
    card.querySelector('time').textContent = new Date(item.createdAt).toLocaleString();
    card.querySelector('.history-details').textContent =
      `${item.format} · ${formatBytes(item.sizes.before)} → ${formatBytes(item.sizes.after)}`;
    card.querySelector('.history-download').addEventListener('click', () => download(item));
    card.querySelector('.history-delete').addEventListener('click', async () => {
      await deleteItem(item.id);
      await renderHistory();
    });
    grid.append(card);
  }
}

function download(item) {
  const url = URL.createObjectURL(item.result);
  const a = document.createElement('a');
  a.href = url;
  a.download = `result-${item.id}.${item.format.split('/')[1]}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

if (document.getElementById('history-grid')) {
  const clearButton = document.getElementById('clear-history');
  clearButton.addEventListener('click', async () => {
    await clear();
    await renderHistory();
  });

  renderHistory().catch((error) => {
    document.getElementById('history-error').textContent = 'History could not be loaded on this device.';
    document.getElementById('history-error').hidden = false;
    console.error('Could not load download history:', error);
  });
}