// Almacenamiento local (IndexedDB). Las fotos nunca salen del dispositivo salvo que el
// usuario active la IA avanzada: privacidad por defecto, y la app funciona sin conexión.

const DB_NAME = 'recuerdo';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('trips')) db.createObjectStore('trips', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('photos')) {
        const s = db.createObjectStore('photos', { keyPath: 'id' });
        s.createIndex('tripId', 'tripId');
      }
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const db = {
  async get(store, key) { return tx(store, 'readonly', (s) => req2p(s.get(key))); },
  async put(store, value, key) { return tx(store, 'readwrite', (s) => req2p(key === undefined ? s.put(value) : s.put(value, key))); },
  async del(store, key) { return tx(store, 'readwrite', (s) => req2p(s.delete(key))); },
  async all(store) { return tx(store, 'readonly', (s) => req2p(s.getAll())); },
  async byIndex(store, index, value) { return tx(store, 'readonly', (s) => req2p(s.index(index).getAll(value))); },
  async clear(store) { return tx(store, 'readwrite', (s) => req2p(s.clear())); },
};

// Caché con caducidad para respuestas de servicios externos (geocodificación, Wikipedia...).
// Es la semilla del "banco de monumentos": lo que ya se identificó no se vuelve a pedir.
export async function cached(key, ttlDays, loader) {
  try {
    const hit = await db.get('cache', key);
    if (hit && Date.now() - hit.t < ttlDays * 864e5) return hit.v;
  } catch { /* sin IndexedDB: seguimos sin caché */ }
  const v = await loader();
  if (v != null) db.put('cache', { t: Date.now(), v }, key).catch(() => {});
  return v;
}

export const kv = {
  async get(key, fallback = null) { try { const v = await db.get('kv', key); return v ?? fallback; } catch { return fallback; } },
  async set(key, value) { try { await db.put('kv', value, key); } catch { /* ignorar */ } },
};

// URLs de objeto para blobs guardados, reutilizadas para no fugar memoria.
const urlCache = new Map();
export async function blobURL(key) {
  if (!key) return null;
  if (urlCache.has(key)) return urlCache.get(key);
  const blob = await db.get('blobs', key);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}
export function forgetBlobURL(key) {
  const u = urlCache.get(key);
  if (u) { URL.revokeObjectURL(u); urlCache.delete(key); }
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
