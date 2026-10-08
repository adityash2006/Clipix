const DB_NAME = 'imageToolHistory';
const STORE = 'history';
const MAX_ITEMS = 25;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = () => {
      const db = req.result;
      const store = db.createObjectStore(STORE, {
        keyPath: 'id',
        autoIncrement: true,
      });
      store.createIndex('createdAt', 'createdAt');
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Helper: run one request in a transaction and resolve with its result
async function run(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(request?.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function addItem(item) {
  await run('readwrite', store => store.add(item));
  await trimToLimit();
}

export function getAll() {
  return run('readonly', store => store.getAll());
}

export function deleteItem(id) {
  return run('readwrite', store => store.delete(id));
}

export function clear() {
  return run('readwrite', store => store.clear());
}

async function trimToLimit() {
  const items = await getAll();
  if (items.length <= MAX_ITEMS) return;
  items.sort((a, b) => a.createdAt - b.createdAt);
  const excess = items.slice(0, items.length - MAX_ITEMS);
  for (const it of excess) await deleteItem(it.id);
}