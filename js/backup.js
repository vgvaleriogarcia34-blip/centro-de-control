// Copia de seguridad: todos los viajes (fotos, notas de voz, correcciones) en un único archivo
// .recuerdo, para guardarlo en iCloud/Drive o pasarlo a otro móvil. Hasta que haya cuentas,
// es la garantía de que un viaje nunca se pierde.
//
// Formato: "RCD1" + longitud de la cabecera (12 dígitos) + cabecera JSON + los archivos seguidos.

import { db } from './store.js';
import { listTrips, tripPhotos } from './trips.js';

const MAGIC = 'RCD1';

export async function exportBackup(tripIds = null) {
  const trips = (await listTrips()).filter((t) => !tripIds || tripIds.includes(t.id));
  const photos = (await Promise.all(trips.map((t) => tripPhotos(t.id)))).flat();
  const files = [];
  let offset = 0;
  const addBlob = async (key) => {
    if (!key) return;
    const blob = await db.get('blobs', key);
    if (!blob) return;
    files.push({ key, type: blob.type || 'application/octet-stream', size: blob.size, offset, blob });
    offset += blob.size;
  };
  for (const p of photos) {
    await addBlob(p.blobKey);
    await addBlob(p.thumbKey);
    await addBlob(p.note?.audioKey);
  }
  const header = JSON.stringify({
    version: 1, createdAt: new Date().toISOString(), trips, photos,
    files: files.map(({ key, type, size, offset: o }) => ({ key, type, size, offset: o })),
  });
  const headerBytes = new TextEncoder().encode(header);
  const prefix = MAGIC + String(headerBytes.length).padStart(12, '0');
  const blob = new Blob([prefix, headerBytes, ...files.map((f) => f.blob)], { type: 'application/octet-stream' });
  const stamp = new Date().toISOString().slice(0, 10);
  const name = trips.length === 1
    ? `recuerdo-${trips[0].title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')}-${stamp}.recuerdo`
    : `recuerdo-copia-${stamp}.recuerdo`;
  return { blob, name, trips: trips.length, photos: photos.length };
}

// Entrega el archivo: en el móvil, la hoja de compartir (Guardar en Archivos, Drive...); si no, descarga.
export async function saveBackupFile({ blob, name }) {
  const file = new File([blob], name, { type: 'application/octet-stream' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}

export async function importBackup(file) {
  const head = await file.slice(0, 16).text();
  if (!head.startsWith(MAGIC)) throw new Error('Este archivo no es una copia de Recuerdo');
  const len = parseInt(head.slice(4), 10);
  const header = JSON.parse(await file.slice(16, 16 + len).text());
  const base = 16 + len;
  for (const f of header.files) await db.put('blobs', file.slice(base + f.offset, base + f.offset + f.size, f.type), f.key);
  for (const p of header.photos) await db.put('photos', p);
  for (const t of header.trips) await db.put('trips', t);
  return { trips: header.trips.length, photos: header.photos.length };
}
