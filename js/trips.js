// Viajes: importar fotos, agruparlas en viajes → días → paradas, y contar la historia.

import { db, uid, kv } from './store.js';
import { readExif } from './exif.js';
import { identifyPhoto, gatherContext, placeLine, mainSubject } from './identify.js';
import { track } from './analytics.js';
import { distance } from './geo.js';
import { parseLocal, fmt, daysBetween } from './util.js';
import { KIND_LABEL, isFood } from './places.js';

// ---------- Lectura ----------
export async function listTrips() {
  const trips = await db.all('trips');
  return trips.sort((a, b) => (b.start || '').localeCompare(a.start || ''));
}
export const getTrip = (id) => db.get('trips', id);
export async function tripPhotos(tripId) {
  const ps = await db.byIndex('photos', 'tripId', tripId);
  return ps.sort((a, b) => (a.takenAt || '').localeCompare(b.takenAt || ''));
}
export const savePhoto = (p) => db.put('photos', p);
export const saveTrip = (t) => db.put('trips', t);

export async function deleteTrip(id) {
  const ps = await tripPhotos(id);
  for (const p of ps) {
    if (p.blobKey) await db.del('blobs', p.blobKey);
    if (p.thumbKey) await db.del('blobs', p.thumbKey);
    if (p.note?.audioKey) await db.del('blobs', p.note.audioKey);
    await db.del('photos', p.id);
  }
  await db.del('trips', id);
}

// ---------- Importación ----------
const STEPS = {
  read: 'Leyendo fecha y ubicación',
  place: 'Buscando dónde estabas',
  pois: 'Reconociendo monumentos y sitios',
  ai: 'Mirando la foto con IA',
  story: 'Montando tu historia',
};

async function makeThumb(file, max = 520) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const dims = { w: bmp.width, h: bmp.height };
    bmp.close?.();
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
    return { blob, ...dims };
  } catch {
    return null; // formato que este navegador no sabe dibujar (p. ej. HEIC fuera de Safari)
  }
}

// Importación en dos tiempos:
//  1. Lectura local (segundos): metadatos, miniaturas, viajes creados. El usuario ya ve su viaje.
//  2. Reconocimiento en segundo plano (processPending): una consulta por parada, no por foto.
// Con { tripId } las fotos se añaden a un viaje que ya existe.
export async function importFiles(files, onProgress, { tripId } = {}) {
  const images = [...files].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|heic|heif|png|webp)$/i.test(f.name));
  const photos = [];
  let undrawable = 0, heic = 0;
  navigator.storage?.persist?.().catch(() => {}); // pide al navegador que no borre las fotos por falta de espacio

  for (let i = 0; i < images.length; i++) {
    const f = images[i];
    onProgress?.({ phase: 'read', step: STEPS.read, done: i, total: images.length, name: f.name });
    const exif = await readExif(f);
    // App nativa: la fototeca nos da ubicación y fecha aunque el EXIF venga sin ellas.
    const nm = f.nativeMeta;
    if (nm) {
      if (exif.lat == null && nm.lat != null) { exif.lat = nm.lat; exif.lon = nm.lon; }
      if (!exif.takenAt && nm.takenAt) exif.takenAt = isoLocal(new Date(nm.takenAt));
    }
    const thumb = await makeThumb(f);
    if (!thumb) undrawable++;
    if (/\.hei[cf]$/i.test(f.name) || /hei[cf]/i.test(f.type)) heic++;
    const id = uid();
    const blobKey = `b:${id}`, thumbKey = thumb ? `t:${id}` : null;
    await db.put('blobs', f, blobKey);
    if (thumb) await db.put('blobs', thumb.blob, thumbKey);
    photos.push({
      id, name: f.name, blobKey, thumbKey,
      takenAt: exif.takenAt || isoLocal(new Date(f.lastModified)),
      dateFromFile: !exif.takenAt,
      lat: exif.lat ?? null, lon: exif.lon ?? null, heading: exif.heading ?? null,
      hadGps: exif.lat != null,
      focal35: exif.focal35, camera: [exif.make, exif.model].filter(Boolean).join(' ') || null,
      w: thumb?.w, h: thumb?.h, fav: false, status: 'pending',
    });
    onProgress?.({ phase: 'read', step: STEPS.read, done: i + 1, total: images.length, thumb: thumb ? URL.createObjectURL(thumb.blob) : null });
  }
  photos.sort((a, b) => a.takenAt.localeCompare(b.takenAt));

  const created = [];
  if (tripId) {
    const trip = await getTrip(tripId);
    const existing = await tripPhotos(tripId);
    // Sin fecha propia, una foto añadida se coloca al final del viaje, no en el día de hoy.
    for (const p of photos) if (p.dateFromFile && existing.length) p.takenAt = existing[existing.length - 1].takenAt;
    inferMissingLocations([...existing, ...photos].sort((a, b) => a.takenAt.localeCompare(b.takenAt)));
    for (const p of photos) { p.tripId = tripId; await savePhoto(p); }
    const all = [...existing, ...photos].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    trip.start = all[0].takenAt; trip.end = all[all.length - 1].takenAt;
    await saveTrip(trip);
    created.push(trip);
  } else {
    inferMissingLocations(photos);
    const companions = await kv.get('defaultCompanions', []);
    // Fotos sin fecha ni GPS (WhatsApp, capturas): su fecha es la del archivo y no dice nada del viaje.
    // No deben partir el viaje: van con el grupo más grande de esta importación.
    const loose = photos.filter((p) => p.dateFromFile && p.lat == null);
    const groups = splitIntoTrips(photos.filter((p) => !loose.includes(p)));
    if (!groups.length) groups.push([]);
    groups.sort((a, b) => b.length - a.length)[0].push(...loose);
    for (const group of groups) {
      const dated = group.filter((p) => !p.dateFromFile);
      if (dated.length) for (const p of group) if (p.dateFromFile) p.takenAt = dated[dated.length - 1].takenAt;
      group.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
      const trip = describeTrip(group, { companions, fields: { titleAuto: true } });
      await saveTrip(trip);
      for (const p of group) { p.tripId = trip.id; await savePhoto(p); }
      created.push(trip);
    }
  }
  const withGps = photos.filter((p) => p.hadGps).length;
  track('import_done', { photos: photos.length, gps: withGps, heic, undrawable, add: !!tripId });
  for (const t of created) processPending(t.id);
  return { trips: created, total: photos.length, withGps, undrawable, heic };
}

// ---------- Reconocimiento en segundo plano ----------
// Una sola cola para toda la app. Avisa con eventos para que las pantallas se repinten solas:
//  'recuerdo:photo'    → { photo }               una foto acaba de identificarse
//  'recuerdo:progress' → { tripId, done, total }  avance del viaje
const queue = [];
let running = false;
const progress = new Map();
export const tripProgress = (tripId) => progress.get(tripId) || null;
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

export function processPending(tripId) {
  if (!queue.includes(tripId)) queue.push(tripId);
  if (!running) runQueue();
}

async function runQueue() {
  running = true;
  while (queue.length) {
    const tripId = queue[0];
    try { await processTrip(tripId); } catch (e) { console.warn('Reconocimiento interrumpido', e); }
    queue.shift();
  }
  running = false;
}

async function processTrip(tripId) {
  const photos = await tripPhotos(tripId);
  const pending = photos.filter((p) => p.status === 'pending');
  if (!pending.length) return;
  const total = pending.length;
  let done = 0;
  progress.set(tripId, { done, total });
  emit('recuerdo:progress', { tripId, done, total });
  let ctx = null;
  for (const p of pending) {
    if (p.lat != null && p.approx !== 'manual') {
      if (!ctx || distance(ctx, p) > 60) ctx = await gatherContext(p.lat, p.lon).catch(() => null);
    }
    const imageBlob = p.thumbKey && !p.approx ? await db.get('blobs', p.blobKey) : null;
    try {
      await identifyPhoto(p, { imageBlob, context: ctx });
    } catch {
      p.status = 'pending'; // sin conexión: se reintentará al volver a abrir la app
      break;
    }
    await savePhoto(p);
    done++;
    progress.set(tripId, { done, total });
    emit('recuerdo:photo', { photo: p });
    emit('recuerdo:progress', { tripId, done, total });
  }
  // Con los lugares ya reconocidos, el viaje recibe su nombre y su portada.
  const trip = await getTrip(tripId);
  if (trip) {
    const all = await tripPhotos(tripId);
    const fresh = describeTrip(all);
    if (trip.titleAuto) trip.title = fresh.title;
    trip.cities = fresh.cities; trip.country = fresh.country;
    if (!trip.coverPinned) trip.coverId = fresh.coverId;
    await saveTrip(trip);
  }
  progress.delete(tripId);
  emit('recuerdo:progress', { tripId, done, total, finished: true });
}

// Al abrir la app, retoma lo que quedó a medias (p. ej. si se cerró durante la importación).
export async function resumePending() {
  for (const t of await listTrips()) {
    const ps = await tripPhotos(t.id);
    if (ps.some((p) => p.status === 'pending')) processPending(t.id);
  }
}

// «¿Dónde fue esto?»: el usuario indica el sitio de las fotos que llegaron sin GPS.
export async function assignLocation(photos, result) {
  for (const p of photos) {
    p.lat = result.lat; p.lon = result.lon; p.heading = null;
    p.approx = 'manual'; p.place = result.place; p.status = 'geo'; p.hotspots = [];
    p.candidates = [];
    await savePhoto(p);
    emit('recuerdo:photo', { photo: p });
  }
  const tripId = photos[0]?.tripId;
  if (tripId) {
    const trip = await getTrip(tripId);
    const fresh = describeTrip(await tripPhotos(tripId));
    if (trip.titleAuto) trip.title = fresh.title;
    trip.cities = fresh.cities; trip.country = fresh.country;
    await saveTrip(trip);
  }
  track('location_assigned', { photos: photos.length });
}

export const photosWithoutLocation = (photos) => photos.filter((p) => p.lat == null);

// Fotos sin GPS (recibidas por WhatsApp, cámara réflex...): si hay otra con GPS a menos de
// 90 minutos, asumimos que estaba cerca. Se marca como aproximada y no se ponen puntos.
function inferMissingLocations(photos) {
  const geo = photos.filter((p) => p.lat != null && !p.approx);
  if (!geo.length) return;
  for (const p of photos) {
    if (p.lat != null) continue;
    const t = parseLocal(p.takenAt).getTime();
    let best = null, bestDt = Infinity;
    for (const g of geo) {
      const dt = Math.abs(parseLocal(g.takenAt).getTime() - t);
      if (dt < bestDt) { bestDt = dt; best = g; }
    }
    if (best && bestDt < 90 * 60e3) {
      p.lat = best.lat; p.lon = best.lon; p.approx = 'time'; p.heading = null;
    }
  }
}

function splitIntoTrips(photos) {
  const groups = [];
  let cur = [];
  for (const p of photos) {
    const prev = cur[cur.length - 1];
    const gapDays = prev ? (parseLocal(p.takenAt) - parseLocal(prev.takenAt)) / 864e5 : 0;
    const far = prev && prev.lat != null && p.lat != null && distance(prev, p) > 800e3 && gapDays > 0.5;
    if (prev && (gapDays > 3 || far)) { groups.push(cur); cur = []; }
    cur.push(p);
  }
  if (cur.length) groups.push(cur);
  return groups;
}

function topCounts(values) {
  const m = new Map();
  for (const v of values) if (v) m.set(v, (m.get(v) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

export function describeTrip(photos, extra = {}) {
  const cities = topCounts(photos.map((p) => p.place?.city));
  const states = topCounts(photos.map((p) => p.place?.state));
  const countries = topCounts(photos.map((p) => p.place?.country));
  let title = cities[0] || states[0] || countries[0] || 'Tu nuevo viaje';
  if (cities.length === 2) title = `${cities[0]} y ${cities[1]}`;
  else if (cities.length > 2) title = states.length === 1 ? states[0] : countries[0] || title;
  const cover = photos.find((p) => p.hotspots?.length && p.thumbKey) || photos.find((p) => p.thumbKey || p.src) || photos[0];
  return {
    id: uid(),
    title,
    cities, country: countries[0] || null,
    start: photos[0]?.takenAt, end: photos[photos.length - 1]?.takenAt,
    coverId: cover?.id || null,
    companions: extra.companions || [],
    createdAt: new Date().toISOString(),
    ...extra.fields,
  };
}

export function tripStats(trip, photos) {
  const places = new Set(photos.flatMap((p) => (p.hotspots || []).map((h) => h.name)));
  const days = trip.start ? daysBetween(trip.start, trip.end) + 1 : 1;
  return { photos: photos.length, places: places.size, days };
}

// ---------- Días y paradas ----------
export function groupDays(photos) {
  const days = [];
  for (const p of photos) {
    const key = (p.takenAt || '').slice(0, 10);
    let d = days[days.length - 1];
    if (!d || d.key !== key) { d = { key, date: p.takenAt, photos: [] }; days.push(d); }
    d.photos.push(p);
  }
  for (const d of days) d.stops = groupStops(d.photos);
  return days;
}

function groupStops(photos) {
  const stops = [];
  for (const p of photos) {
    const s = stops[stops.length - 1];
    const last = s?.photos[s.photos.length - 1];
    const near = last && last.lat != null && p.lat != null ? distance(last, p) < 180 : !!last && p.lat == null;
    const soon = last && (parseLocal(p.takenAt) - parseLocal(last.takenAt)) < 50 * 60e3;
    if (s && near && soon) s.photos.push(p);
    else stops.push({ photos: [p] });
  }
  for (const s of stops) {
    s.name = topCounts(s.photos.map(mainSubject))[0] || placeLine(s.photos[0]);
    s.where = placeLine(s.photos[0]);
    s.hood = s.photos[0].place?.neighbourhood || s.photos[0].place?.city || null;
    s.time = s.photos[0].takenAt;
  }
  return stops;
}

// ---------- Narración (local, sin IA) ----------
// Texto cálido en segunda persona; si viajaste acompañado, en plural.
export function buildStory(trip, photos) {
  const days = groupDays(photos);
  const withWho = trip.companions?.length ? trip.companions : null;
  const vos = withWho ? { estar: 'estabais', empezar: 'Empezasteis', ver: 'visteis', acabar: 'terminasteis', pasar: 'pasasteis' }
                      : { estar: 'estabas', empezar: 'Empezaste', ver: 'viste', acabar: 'terminaste', pasar: 'pasaste' };
  const slides = [];
  const cover = photos.find((p) => p.id === trip.coverId) || photos[0];
  const stats = tripStats(trip, photos);
  slides.push({
    type: 'chapter', eyebrow: fmt.range(trip.start, trip.end),
    title: trip.title,
    text: `${stats.days} ${stats.days === 1 ? 'día' : 'días'}, ${stats.places} ${stats.places === 1 ? 'lugar' : 'lugares'} y ${stats.photos} fotos${withWho ? `, con ${fmt.list(withWho)}` : ''}.`,
    photo: cover,
  });

  days.forEach((d, di) => {
    const firstStop = d.stops[0];
    const lastStop = d.stops[d.stops.length - 1];
    let intro = `${vos.empezar} ${fmt.momentOfDay(firstStop.time)} en ${articled({ name: firstStop.name })}`;
    if (d.stops.length > 1) intro += ` y ${vos.acabar} ${fmt.momentOfDay(lastStop.time)} en ${articled({ name: lastStop.name })}`;
    intro += '.';
    if (days.length > 1) {
      slides.push({ type: 'chapter', eyebrow: `Día ${di + 1}`, title: fmt.dayTitle(d.date), text: intro });
    }
    for (const s of d.stops) {
      const picks = pickHighlights(s.photos);
      picks.forEach((p, pi) => {
        const hs = p.hotspots?.[0];
        const cand = hs && p.candidates?.find((c) => c.id === hs.candidateId);
        let text;
        if (p.aiCaption && pi === 0) text = p.aiCaption;
        else if (hs) {
          const food = isFood(hs.kind);
          text = food
            ? `A las ${fmt.time(p.takenAt)} os sentasteis en ${hs.name}${p.place?.street ? `, en ${p.place.street}` : ''}.`
            : `A las ${fmt.time(p.takenAt)} ${vos.estar} frente a ${articled(hs)}${p.place?.neighbourhood ? `, en ${p.place.neighbourhood}` : ''}.`;
          if (!withWho && food) text = text.replace('os sentasteis', 'te sentaste');
          const fact = cand?.extract ? shortFact(cand.extract) : null;
          // Una diapositiva se lee en 6-8 s: si hay nota del viajero, manda la nota y no el dato.
          if (fact && pi === 0 && !p.note?.text) text += ` ${fact}`;
        } else {
          text = `${fmt.time(p.takenAt)} · ${placeLine(p)}.`;
        }
        if (p.note?.text) text += ` «${p.note.text}»`;
        slides.push({
          type: 'photo', photo: p,
          eyebrow: hs ? KIND_LABEL[hs.kind] || 'Lugar' : fmt.dayTitle(p.takenAt),
          title: hs?.name || placeLine(p),
          text, tag: hs && pi === 0 ? { x: hs.x, y: hs.y, name: hs.name } : null,
        });
      });
    }
  });
  return slides.map((s) => ({ ...s, speech: speechFor(s) }));
}

function pickHighlights(photos) {
  const favs = photos.filter((p) => p.fav);
  const withSpots = photos.filter((p) => p.hotspots?.length && !p.fav);
  const rest = photos.filter((p) => !p.fav && !p.hotspots?.length);
  return [...favs, ...withSpots, ...rest].slice(0, Math.max(2, Math.min(4, favs.length)));
}

export function articled(hs) {
  const n = hs.name;
  if (/^(el|la|los|las|the)\s/i.test(n)) return n.replace(/^El /, 'el ').replace(/^La /, 'la ').replace(/^Los /, 'los ').replace(/^Las /, 'las ');
  const fem = ['catedral', 'iglesia', 'capilla', 'plaza', 'calle', 'torre', 'puerta', 'fuente', 'basílica', 'ermita', 'muralla', 'giralda', 'alhambra', 'mezquita', 'casa', 'puente'];
  const first = n.split(/\s/)[0].toLowerCase();
  if (fem.includes(first) && first !== 'puente') return `la ${n}`;
  if (['palacio', 'puente', 'monasterio', 'convento', 'museo', 'castillo', 'teatro', 'mercado', 'parque', 'arco', 'real', 'alcázar'].includes(first)) return `el ${n}`;
  return n;
}

function shortFact(extract) {
  const s = (extract.replace(/\s*\([^)]*\)/g, '').match(/[^.!?]+[.!?]/) || [])[0];
  if (!s) return null;
  return s.length > 150 ? s.slice(0, 147).replace(/\s+\S*$/, '') + '…' : s.trim();
}

function speechFor(s) {
  if (s.type === 'chapter') return `${s.eyebrow ? s.eyebrow + '. ' : ''}${s.title}. ${s.text}`;
  return s.text;
}

function isoLocal(d) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
}
