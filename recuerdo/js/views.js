// Pantallas de la app.

import { ICONS, KIND_ICON, esc, h, fmt, toast, avatar, haptic, parseLocal } from './util.js';
import { hydrateImages, openSheet, photoSrc } from './ui.js';
import { listTrips, getTrip, tripPhotos, tripStats, groupDays, buildStory, importFiles, deleteTrip, saveTrip, tripProgress, photosWithoutLocation } from './trips.js';
import { openLocateSheet } from './locate.js';
import { exportBackup, saveBackupFile, importBackup } from './backup.js';
import { track, localMetrics } from './analytics.js';
import { openViewer } from './viewer.js';
import { playStory } from './story.js';
import { placeLine, mainSubject } from './identify.js';
import { KIND_LABEL, isFood } from './places.js';
import { kv } from './store.js';
import { seedDemo } from './demo.js';
import { ai } from './ai.js';

const view = () => document.getElementById('view');
// Para pantallas que escuchan clics en el propio contenedor: nodo nuevo en cada repintado.
function freshView() {
  const old = view();
  const v = old.cloneNode(false);
  old.replaceWith(v);
  return v;
}
const byId = (photos) => new Map(photos.map((p) => [p.id, p]));

// ======================= INICIO =======================
export async function homeView() {
  const trips = await listTrips();
  const all = await Promise.all(trips.map(async (t) => ({ trip: t, photos: await tripPhotos(t.id) })));
  const seen = new Set(await kv.get('storiesSeen', []));
  const covers = new Map();
  all.forEach(({ trip, photos }) => covers.set(trip.id, photos.find((p) => p.id === trip.coverId) || photos[0]));
  const photoMap = new Map(all.flatMap(({ photos }) => photos.map((p) => [p.id, p])));

  const v = view();
  v.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="brand-mark">${ICONS.logo}</span><span class="brand-name">Recuerdo</span></div>
      <a class="icon-btn" href="#/importar" aria-label="Añadir fotos">${ICONS.camera}</a>
    </header>
    <div class="stories" aria-label="Historias de tus viajes">
      <a class="story-ring add" href="#/importar"><div class="ring"><div><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></div></div><span>Nuevo viaje</span></a>
      ${all.map(({ trip }) => `<button class="story-ring ${seen.has(trip.id) ? 'seen' : ''}" data-story="${trip.id}">
        <div class="ring"><div><img data-photo="${covers.get(trip.id)?.id || ''}" alt=""></div></div><span>${esc(trip.title)}</span></button>`).join('')}
    </div>
    ${all.length ? '' : emptyHome()}
    ${await onThisDay(all)}
    <section class="section">
      ${all.length ? '<div class="section-head"><h2>Tus viajes</h2></div>' : ''}
      ${all.map(({ trip, photos }) => {
        const s = tripStats(trip, photos);
        return `<a class="trip-card" href="#/viaje/${trip.id}">
          <img class="cover" data-photo="${covers.get(trip.id)?.id || ''}" data-size="full" alt="">
          <div class="shade"></div>
          ${trip.demo ? '<span class="chip glass badge">Viaje de ejemplo</span>' : ''}
          <div class="meta">
            <p class="eyebrow">${esc(fmt.range(trip.start, trip.end))}</p>
            <h3>${esc(trip.title)}</h3>
            <div class="stats"><span>${s.photos} fotos</span><span>${s.places} lugares</span><span>${s.days} ${s.days === 1 ? 'día' : 'días'}</span></div>
          </div></a>`;
      }).join('')}
    </section>`;
  hydrateImages(v, photoMap);
  v.querySelectorAll('[data-story]').forEach((b) => b.addEventListener('click', () => startTripStory(b.dataset.story)));
}

function emptyHome() {
  return `<div class="empty">
    <div class="drop-icon" style="margin:0 auto">${ICONS.images}</div>
    <h2>Tus viajes, con nombre e historia</h2>
    <p>Sube las fotos de un viaje y Recuerdo te dirá dónde estabas, qué monumento es cada uno y te montará la historia.</p>
    <div style="display:grid;gap:10px;margin-top:20px">
      <a class="btn btn-primary" href="#/importar">${ICONS.images}Añadir fotos</a>
      <button class="btn btn-ghost" data-demo onclick="window.__seedDemo()">Ver un viaje de ejemplo</button>
    </div></div>`;
}
window.__seedDemo = async () => { await seedDemo(true); homeView(); };

// "Tal día como hoy": el gancho de retención de Google Fotos / Facebook Recuerdos.
async function onThisDay(all) {
  const today = new Date();
  const hits = [];
  for (const { trip, photos } of all) {
    const p = photos.find((x) => { const d = parseLocal(x.takenAt); return d && d.getMonth() === today.getMonth() && Math.abs(d.getDate() - today.getDate()) <= 3 && d.getFullYear() < today.getFullYear(); });
    if (p) hits.push({ trip, p });
  }
  if (!hits.length) return '';
  const { trip, p } = hits[0];
  const years = today.getFullYear() - parseLocal(p.takenAt).getFullYear();
  return `<section class="section"><a class="memory-card" href="#/viaje/${trip.id}">
    <img data-photo="${p.id}" alt=""><div><p class="eyebrow">Hace ${years} ${years === 1 ? 'año' : 'años'}</p><b>${esc(mainSubject(p) || trip.title)}</b><small>${esc(fmt.longDate(p.takenAt))}</small></div></a></section>`;
}

export async function startTripStory(tripId, startAt = 0) {
  const trip = await getTrip(tripId);
  const photos = await tripPhotos(tripId);
  if (!photos.length) return;
  let slides = buildStory(trip, photos);
  if (trip.aiStory?.slides?.length) slides = mergeAIStory(slides, trip.aiStory, photos);
  const seen = new Set(await kv.get('storiesSeen', []));
  seen.add(tripId);
  kv.set('storiesSeen', [...seen]);
  playStory(trip, slides, { startAt, onClose: () => document.querySelector(`[data-story="${tripId}"]`)?.classList.add('seen') });
}

function mergeAIStory(local, aiStory, photos) {
  const map = byId(photos);
  const out = [];
  for (const s of aiStory.slides) {
    const photo = s.photo_id ? map.get(s.photo_id) : null;
    const base = local.find((l) => l.photo?.id === s.photo_id);
    out.push({ type: s.type === 'chapter' ? 'chapter' : 'photo', photo, eyebrow: s.eyebrow || base?.eyebrow || '', title: s.title, text: s.text, tag: base?.tag || null, speech: s.text });
  }
  return out.length ? out : local;
}

// ======================= VIAJE =======================
let tripMode = 'fotos';
export async function tripView(id) {
  const trip = await getTrip(id);
  if (!trip) { location.hash = '#/'; return; }
  let photos = await tripPhotos(id);
  let map = byId(photos);
  const stats = tripStats(trip, photos);
  const cover = map.get(trip.coverId) || photos[0];
  let days = groupDays(photos);
  const v = freshView();
  v.innerHTML = `
    <div class="trip-hero">
      <img data-photo="${cover?.id || ''}" data-size="full" alt="">
      <div class="shade"></div>
      <div class="hero-top">
        <a class="icon-btn" href="#/" aria-label="Volver">${ICONS.back}</a>
        <button class="icon-btn" data-act="more" aria-label="Opciones">${ICONS.edit}</button>
      </div>
      <div class="hero-meta">
        <p class="eyebrow">${esc(fmt.range(trip.start, trip.end))}</p>
        <h1 data-title>${esc(trip.title)}</h1>
        <div class="chips" data-stats>${statChips(stats)}</div>
      </div>
    </div>
    <div class="companions">
      ${trip.companions?.length ? trip.companions.map(avatar).join('') + `<span class="place-sub" style="margin-left:4px">Con ${esc(fmt.list(trip.companions))}</span>` : ''}
      <button class="chip" data-act="who">${ICONS.people}${trip.companions?.length ? 'Editar' : '¿Con quién viajaste?'}</button>
    </div>
    <div data-status></div>
    <div class="trip-actions">
      <button class="btn btn-primary" data-act="story">${ICONS.play}Ver historia</button>
      <button class="btn btn-ghost" data-act="share">${ICONS.share}Compartir</button>
    </div>
    <div class="segmented" role="tablist">
      <button class="${tripMode === 'fotos' ? 'on' : ''}" data-mode="fotos">Días</button>
      <button class="${tripMode === 'lugares' ? 'on' : ''}" data-mode="lugares">Lugares</button>
      <button class="${tripMode === 'mapa' ? 'on' : ''}" data-mode="mapa">Mapa</button>
    </div>
    <div data-body></div>`;

  const body = v.querySelector('[data-body]');
  const renderBody = () => {
    if (tripMode === 'fotos') body.innerHTML = days.map((d, di) => `
      <section class="day">
        <div class="day-head"><h3>Día ${di + 1} · ${esc(fmt.dayTitle(d.date))}</h3><p>${esc([...new Set(d.stops.map((s) => s.hood).filter(Boolean))].slice(0, 4).join(' · '))}</p></div>
        ${d.stops.map((s) => `<div class="stop">
          <div class="stop-title">${ICONS.pin}<span>${esc(s.name)}</span><span style="color:var(--faint);font-weight:500">· ${esc(fmt.time(s.time))}</span></div>
          <div class="grid ${s.photos.length >= 3 ? 'wide-first' : ''}">${s.photos.map((p) => tile(p)).join('')}</div>
        </div>`).join('')}
      </section>`).join('');
    if (tripMode === 'lugares') body.innerHTML = placesList(photos);
    if (tripMode === 'mapa') { body.innerHTML = '<div class="map-box" id="trip-map" style="height:60vh"></div>'; setTimeout(() => drawTripMap(body.querySelector('#trip-map'), photos, map, trip), 50); }
    hydrateImages(body, map);
  };
  // Estado del viaje: reconocimiento en curso o fotos que necesitan ubicación.
  const statusBox = v.querySelector('[data-status]');
  const renderStatus = () => {
    const prog = tripProgress(id);
    const missing = photosWithoutLocation(photos);
    if (prog) {
      statusBox.innerHTML = `<div class="proc-banner" role="status"><div class="row">${ICONS.sparkle}<span>Reconociendo lugares…</span><span>${prog.done} de ${prog.total}</span></div><div class="bar"><i style="width:${Math.round((prog.done / prog.total) * 100)}%"></i></div></div>`;
    } else if (missing.length) {
      statusBox.innerHTML = `<div class="alert-card">${ICONS.pin}<div class="grow"><b>${missing.length === 1 ? '1 foto sin ubicación' : `${missing.length} fotos sin ubicación`}</b><small>Dinos dónde fue y la colocamos en tu viaje</small></div><button class="btn btn-primary" data-act="locate">Indicar</button></div>`;
    } else statusBox.innerHTML = '';
  };
  renderStatus();
  renderBody();
  hydrateImages(v.querySelector('.trip-hero'), map);

  // Mientras se reconocen las fotos en segundo plano, la pantalla se actualiza sola.
  let timer = null;
  const refresh = async () => {
    if (!v.isConnected) return;
    const fresh = await getTrip(id);
    photos = await tripPhotos(id); map = byId(photos); days = groupDays(photos);
    v.querySelector('[data-title]').textContent = fresh.title;
    v.querySelector('[data-stats]').innerHTML = statChips(tripStats(fresh, photos));
    Object.assign(trip, fresh);
    renderStatus();
    renderBody();
  };
  const onPhoto = (e) => { if (e.detail.photo.tripId === id) { clearTimeout(timer); timer = setTimeout(refresh, 700); } };
  const onProgress = (e) => {
    if (e.detail.tripId !== id) return;
    if (!v.isConnected) return cleanup();
    if (e.detail.finished) {
      clearTimeout(timer);
      refresh().then(() => {
        const places = tripStats(trip, photos).places;
        toast(places ? `¡Listo! ${places} ${places === 1 ? 'lugar reconocido' : 'lugares reconocidos'}` : 'Fotos ordenadas');
        maybeAskLocation();
      });
    } else renderStatus();
  };
  const cleanup = () => { window.removeEventListener('recuerdo:photo', onPhoto); window.removeEventListener('recuerdo:progress', onProgress); };
  activeTripCleanup?.(); activeTripCleanup = cleanup;
  window.addEventListener('recuerdo:photo', onPhoto);
  window.addEventListener('recuerdo:progress', onProgress);

  // Si todas las fotos llegaron sin ubicación (típico del iPhone), lo resolvemos en el momento.
  const maybeAskLocation = () => {
    if (askLocationFor !== id) return;
    const missing = photosWithoutLocation(photos);
    if (!missing.length) { askLocationFor = null; return; }
    askLocationFor = null;
    openLocateSheet(missing, { allMissing: missing.length === photos.length, onDone: refresh });
  };
  if (!tripProgress(id)) maybeAskLocation();

  const reopen = (p) => { const i = photos.indexOf(p); openViewer(photos, i, { trip, onChange: () => { renderBody(); } }); };
  v.addEventListener('click', async (e) => {
    const tileEl = e.target.closest('[data-open]');
    if (tileEl) return reopen(map.get(tileEl.dataset.open));
    const mode = e.target.closest('[data-mode]')?.dataset.mode;
    if (mode) { tripMode = mode; v.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode)); haptic(4); return renderBody(); }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'story') startTripStory(id);
    if (act === 'locate') openLocateSheet(photosWithoutLocation(photos), { onDone: refresh });
    if (act === 'share') shareTrip(trip, photos);
    if (act === 'who') editCompanions(trip, () => tripView(id));
    if (act === 'more') tripOptions(trip, photos);
  });
}

let activeTripCleanup = null;
let askLocationFor = null;

function statChips(s) {
  return `<span class="chip glass">${s.photos} fotos</span><span class="chip glass">${s.places} lugares</span><span class="chip glass">${s.days} ${s.days === 1 ? 'día' : 'días'}</span>`;
}

async function shareTrip(trip, photos) {
  track('share', { what: 'trip' });
  const places = [...new Set(photos.flatMap((p) => (p.hotspots || []).map((h) => h.name)))];
  const text = `${trip.title} · ${fmt.range(trip.start, trip.end)}\n${places.slice(0, 8).join(' · ')}\n\nRecordado con Recuerdo`;
  try {
    if (navigator.share) await navigator.share({ title: trip.title, text });
    else { await navigator.clipboard.writeText(text); toast('Resumen del viaje copiado'); }
  } catch { /* cancelado */ }
}

function tile(p) {
  return `<button class="tile ${p.status === 'pending' ? 'pending' : ''}" data-open="${p.id}" aria-label="${esc(mainSubject(p) || 'Foto')}">
    <img data-photo="${p.id}" alt="" loading="lazy">
    ${p.fav ? `<span class="tile-fav">${ICONS.heart}</span>` : ''}
    ${p.hotspots?.length ? `<span class="tile-badge">${ICONS.sparkle}</span>` : ''}
  </button>`;
}

function placesList(photos) {
  const places = new Map();
  for (const p of photos) for (const hs of p.hotspots || []) {
    if (!places.has(hs.name)) places.set(hs.name, { hs, p, count: 0, cand: p.candidates?.find((c) => c.id === hs.candidateId) });
    places.get(hs.name).count++;
  }
  const groups = { Monumentos: [], 'Comer y beber': [] };
  for (const v of places.values()) (isFood(v.hs.kind) ? groups['Comer y beber'] : groups.Monumentos).push(v);
  if (!places.size) return '<div class="empty"><p>Aún no hay lugares identificados en este viaje.</p></div>';
  return Object.entries(groups).filter(([, a]) => a.length).map(([g, arr]) => `
    <section class="section"><div class="section-head"><h2>${g}</h2><span class="place-sub">${arr.length}</span></div>
      <div class="list">${arr.map(({ hs, p, count, cand }) => `<button class="list-item" data-open="${p.id}">
        <img class="thumb" data-photo="${p.id}" alt="">
        <span class="grow"><b>${esc(hs.name)}</b><small>${esc(KIND_LABEL[hs.kind] || 'Lugar')} · ${esc(fmt.shortDate(p.takenAt))} · ${count} ${count === 1 ? 'foto' : 'fotos'}</small>
        ${cand?.extract ? `<small style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:2px">${esc(cand.extract)}</small>` : ''}</span>
      </button>`).join('')}</div></section>`).join('');
}

function drawTripMap(el, photos, map, trip) {
  if (!window.L || !el) return;
  const geo = photos.filter((p) => p.lat != null);
  if (!geo.length) { el.outerHTML = '<div class="empty"><p>Las fotos de este viaje no tienen ubicación.</p></div>'; return; }
  const m = L.map(el, { zoomControl: false, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  L.polyline(geo.map((p) => [p.lat, p.lon]), { color: '#ff6b4a', weight: 3, opacity: 0.8, dashArray: '6 8' }).addTo(m);
  const days = groupDays(geo);
  let n = 0;
  days.forEach((d) => d.stops.forEach((s) => {
    n++;
    const p = s.photos[0];
    const mk = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: '', html: `<div class="photo-pin"><img data-photo="${p.id}" alt=""></div>`, iconSize: [46, 46], iconAnchor: [23, 46] }) }).addTo(m);
    mk.on('click', () => openViewer(photos, photos.indexOf(p), { trip }));
  }));
  m.fitBounds(L.latLngBounds(geo.map((p) => [p.lat, p.lon])), { padding: [40, 40] });
  setTimeout(() => hydrateImages(el, map), 60);
}

function editCompanions(trip, done) {
  const { body, close } = openSheet(`
    <p class="eyebrow">Compañeros de viaje</p>
    <h2 class="place-name" style="font-size:24px">¿Con quién viajaste?</h2>
    <p class="place-sub">Los nombraremos en la narración: «a las 11:42 estabais frente a…».</p>
    <label class="field"><span>Nombres separados por comas</span><input class="input" value="${esc((trip.companions || []).join(', '))}" placeholder="Marta, Luis"></label>
    <label class="field" style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-default style="width:20px;height:20px"><span style="margin:0">Usar también en mis próximos viajes</span></label>
    <button class="btn btn-primary btn-block" data-save>${ICONS.check}Guardar</button>`);
  const input = body.querySelector('input.input');
  setTimeout(() => input.focus(), 300);
  body.querySelector('[data-save]').addEventListener('click', async () => {
    trip.companions = input.value.split(',').map((s) => s.trim()).filter(Boolean);
    await saveTrip(trip);
    if (body.querySelector('[data-default]').checked) await kv.set('defaultCompanions', trip.companions);
    close(); done();
  });
}

function tripOptions(trip, photos) {
  const { body, close } = openSheet(`
    <p class="eyebrow">Viaje</p>
    <label class="field"><span>Título</span><input class="input" data-title value="${esc(trip.title)}"></label>
    <button class="btn btn-primary btn-block" data-save>${ICONS.check}Guardar título</button>
    <div class="list" style="margin-top:14px">
      <a class="list-item" href="#/importar/${trip.id}"><span class="thumb">${ICONS.images}</span><span class="grow"><b>Añadir fotos a este viaje</b><small>Las tuyas o las de tus acompañantes</small></span></a>
      <button class="list-item" data-backup><span class="thumb">${ICONS.share}</span><span class="grow"><b>Guardar una copia del viaje</b><small>Un archivo con fotos, notas y lugares, para guardarlo o pasarlo a otro móvil</small></span></button>
      <button class="list-item" data-ai><span class="thumb">${ICONS.sparkle}</span><span class="grow"><b>Escribir la historia con IA</b><small>Narración más rica, por capítulos</small></span></button>
      <button class="list-item" data-del><span class="thumb">${ICONS.trash}</span><span class="grow"><b>Eliminar viaje</b><small>Se borran las fotos de este dispositivo</small></span></button>
    </div>`);
  body.querySelector('[data-save]').addEventListener('click', async () => {
    trip.title = body.querySelector('[data-title]').value.trim() || trip.title;
    trip.titleAuto = false;
    await saveTrip(trip); close(); tripView(trip.id);
  });
  body.querySelector('[data-backup]').addEventListener('click', async () => {
    close(); toast('Preparando la copia…');
    const res = await exportBackup([trip.id]);
    const how = await saveBackupFile(res);
    if (how !== 'cancelled') { toast('Copia lista'); track('backup_export', { trips: 1, photos: res.photos }); }
  });
  body.querySelector('[data-del]').addEventListener('click', async () => {
    if (!confirm(`¿Eliminar «${trip.title}»? Esta acción no se puede deshacer.`)) return;
    await deleteTrip(trip.id); close(); location.hash = '#/'; toast('Viaje eliminado');
  });
  body.querySelector('[data-ai]').addEventListener('click', async () => {
    if (!(await ai.available())) { toast('La IA avanzada no está activa en este servidor'); return; }
    close();
    toast('Escribiendo tu historia…', 6000);
    try {
      const res = await ai.story({
        title: trip.title, companions: trip.companions || [], start: trip.start, end: trip.end,
        photos: photos.map((p) => ({ id: p.id, takenAt: p.takenAt, where: placeLine(p), subject: mainSubject(p),
          kind: p.hotspots?.[0]?.kind || null, fav: !!p.fav, note: p.note?.text || null,
          about: (p.candidates?.find((c) => c.id === p.hotspots?.[0]?.candidateId)?.extract || '').slice(0, 400) })),
      });
      trip.aiStory = res;
      await saveTrip(trip);
      toast('¡Historia lista!');
      startTripStory(trip.id);
    } catch { toast('No se pudo escribir la historia ahora'); }
  });
}

// ======================= MAPA GLOBAL =======================
export async function mapView() {
  const trips = await listTrips();
  const all = (await Promise.all(trips.map((t) => tripPhotos(t.id)))).flat();
  const v = view();
  v.innerHTML = `<div class="map-full"><header class="topbar"><h1>Tu mapa</h1><span class="chip">${all.filter((p) => p.lat != null).length} fotos</span></header><div id="bigmap"></div></div>`;
  const geo = all.filter((p) => p.lat != null);
  const tripById = new Map(trips.map((t) => [t.id, t]));
  const wait = () => new Promise((r) => (window.L ? r() : setTimeout(() => r(wait()), 100)));
  await wait();
  const m = L.map('bigmap', { zoomControl: false }).setView([40.4, -3.7], 5);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  const map = byId(all);
  for (const p of geo) {
    const mk = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: '', html: `<div class="photo-pin"><img data-photo="${p.id}" alt=""></div>`, iconSize: [46, 46], iconAnchor: [23, 46] }) }).addTo(m);
    mk.on('click', async () => {
      const ps = all.filter((x) => x.tripId === p.tripId);
      openViewer(ps, ps.indexOf(p), { trip: tripById.get(p.tripId) });
    });
  }
  if (geo.length) m.fitBounds(L.latLngBounds(geo.map((p) => [p.lat, p.lon])), { padding: [60, 60], maxZoom: 15 });
  m.on('zoomend moveend', () => hydrateImages(v, map));
  setTimeout(() => hydrateImages(v, map), 80);
}

// ======================= IMPORTAR =======================
export async function importView(tripId = null) {
  const target = tripId ? await getTrip(tripId) : null;
  const v = view();
  v.innerHTML = `
    <header class="topbar"><a class="icon-btn" href="${target ? `#/viaje/${target.id}` : '#/'}" aria-label="Volver">${ICONS.back}</a><h1>${target ? 'Añadir fotos' : 'Nuevo viaje'}</h1></header>
    <div data-stage>
      <label class="drop" data-drop>
        <div class="drop-icon">${ICONS.images}</div>
        <h2>${target ? `Más fotos de ${esc(target.title)}` : 'Elige las fotos del viaje'}</h2>
        <p>Pueden ser cientos. Las ordenamos por días y lugares, y reconocemos cada sitio.</p>
        <span class="btn btn-primary">${ICONS.images}Seleccionar fotos</span>
        <input type="file" accept="image/*,.heic,.heif" multiple hidden>
      </label>
      <div class="how">
        <div class="how-item"><span class="n">1</span><div><b>Leemos dónde y cuándo</b><p>Cada foto del móvil guarda la ubicación, la hora y hacia dónde apuntaba la cámara.</p></div></div>
        <div class="how-item"><span class="n">2</span><div><b>Reconocemos los lugares</b><p>Iglesias, monumentos, plazas, calles y restaurantes, con su historia.</p></div></div>
        <div class="how-item"><span class="n">3</span><div><b>Te contamos tu viaje</b><p>Fotos interactivas, mapa del recorrido e historia narrada para revivirlo y compartirlo.</p></div></div>
      </div>
      <div class="callout"><b>Privado por defecto</b>Tus fotos se quedan en este dispositivo. Solo consultamos mapas y enciclopedias abiertas con la ubicación.</div>
    </div>`;
  // Lo más importante para iPhone va arriba, antes de elegir, con los pasos exactos.
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    v.querySelector('[data-drop]').insertAdjacentHTML('afterend', `<div class="callout"><b>Importante en iPhone: activa la ubicación</b>Al elegir las fotos, toca <b>Opciones</b> arriba y activa <b>Ubicación</b>. Sin eso, las fotos llegan sin saber dónde se hicieron.</div>`);
  } else {
    v.querySelector('.how').insertAdjacentHTML('afterend', `<div class="callout"><b>¿Desde el iPhone?</b>Al elegir fotos, toca «Opciones» y activa «Ubicación» para que cada foto conserve dónde se hizo.</div>`);
  }
  const drop = v.querySelector('[data-drop]');
  const input = drop.querySelector('input');
  input.addEventListener('change', () => input.files.length && runImport(input.files, tripId));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => e.dataTransfer.files.length && runImport(e.dataTransfer.files, tripId));
}

async function runImport(files, tripId = null) {
  track('import_start', { photos: files.length, add: !!tripId });
  const stage = view().querySelector('[data-stage]');
  const C = 2 * Math.PI * 52;
  stage.innerHTML = `<div class="progress-wrap">
    <div class="progress-ring"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" cx="60" cy="60" r="52" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg><b>0%</b></div>
    <p class="progress-step">Preparando…</p><p class="progress-sub"></p>
    <div class="progress-thumbs"></div></div>`;
  const ring = stage.querySelector('.fg'), pct = stage.querySelector('.progress-ring b');
  const step = stage.querySelector('.progress-step'), sub = stage.querySelector('.progress-sub'), thumbs = stage.querySelector('.progress-thumbs');
  try {
    // Aquí solo se leen las fotos (segundos). El reconocimiento sigue en segundo plano dentro del viaje.
    const res = await importFiles(files, (e) => {
      const frac = e.done / e.total;
      ring.style.strokeDashoffset = C * (1 - frac);
      pct.textContent = `${Math.round(frac * 100)}%`;
      step.textContent = 'Leyendo tus fotos';
      sub.textContent = `${e.done} de ${e.total}`;
      if (e.thumb && thumbs.children.length < 18) thumbs.append(Object.assign(new Image(), { src: e.thumb, alt: '' }));
    }, { tripId });
    haptic(30);
    if (!res.total) { toast('No encontramos fotos en la selección'); importView(tripId); return; }
    if (res.withGps < res.total) askLocationFor = res.trips[0].id;
    if (res.undrawable) toast(`${res.undrawable} fotos en formato HEIC: este navegador no puede mostrarlas, pero sí reconocemos dónde se hicieron`, 5000);
    location.hash = `#/viaje/${res.trips[0].id}`;
  } catch (err) {
    console.error(err);
    toast('Algo falló al leer las fotos. Inténtalo de nuevo.');
    importView(tripId);
  }
}

// ======================= RECUERDOS =======================
export async function memoriesView() {
  const trips = await listTrips();
  const all = (await Promise.all(trips.map(async (t) => (await tripPhotos(t.id)).map((p) => ({ ...p, trip: t }))))).flat();
  const favs = all.filter((p) => p.fav);
  const notes = all.filter((p) => p.note?.text);
  const places = new Map();
  for (const p of all) for (const hs of p.hotspots || []) if (!places.has(hs.name)) places.set(hs.name, { hs, p });
  const food = [...places.values()].filter(({ hs }) => isFood(hs.kind));
  const map = byId(all);
  const v = freshView();
  v.innerHTML = `
    <header class="topbar"><h1>Recuerdos</h1></header>
    <section class="section">
      <div class="chips scroll">
        <span class="chip accent">${ICONS.heart}${favs.length} favoritas</span>
        <span class="chip">${ICONS.pin}${places.size} lugares</span>
        <span class="chip">${ICONS.mic}${notes.length} notas</span>
        <span class="chip">${ICONS.fork}${food.length} para comer</span>
      </div>
    </section>
    ${favs.length ? `<section class="section"><div class="section-head"><h2>Favoritas</h2></div><div class="grid">${favs.map(tile).join('')}</div></section>` : ''}
    ${notes.length ? `<section class="section"><div class="section-head"><h2>Lo que contaste</h2></div>${notes.map((p) => `<button class="memory-card" style="width:100%;text-align:left" data-open="${p.id}"><img data-photo="${p.id}" alt=""><div><p class="eyebrow">${esc(p.trip.title)} · ${esc(fmt.shortDate(p.takenAt))}</p><b>${esc(mainSubject(p) || placeLine(p))}</b><small style="font-style:italic">«${esc(p.note.text)}»</small></div></button>`).join('')}</section>` : ''}
    ${food.length ? `<section class="section"><div class="section-head"><h2>Dónde comiste</h2></div><div class="list">${food.map(({ hs, p }) => `<button class="list-item" data-open="${p.id}"><span class="thumb">${KIND_ICON(hs.kind)}</span><span class="grow"><b>${esc(hs.name)}</b><small>${esc(KIND_LABEL[hs.kind])} · ${esc(placeLine(p))} · ${esc(fmt.shortDate(p.takenAt))}</small></span></button>`).join('')}</div></section>` : ''}
    ${!all.length ? '<div class="empty"><h2>Aún no hay recuerdos</h2><p>Marca fotos con doble toque y graba notas de voz: aparecerán aquí.</p></div>' : ''}`;
  hydrateImages(v, map);
  v.addEventListener('click', (e) => {
    const id = e.target.closest('[data-open]')?.dataset.open;
    if (!id) return;
    const p = map.get(id);
    const ps = all.filter((x) => x.tripId === p.tripId);
    openViewer(ps, ps.findIndex((x) => x.id === id), { trip: p.trip, onChange: () => memoriesView() });
  });
}

// ======================= AJUSTES =======================
export async function settingsView() {
  const status = await ai.status();
  let aiOff = false, theme = 'auto';
  try { aiOff = localStorage.getItem('recuerdo.ai') === 'off'; theme = localStorage.getItem('recuerdo.theme') || 'auto'; } catch { /* sin almacenamiento */ }
  const companions = await kv.get('defaultCompanions', []);
  const v = view();
  v.innerHTML = `
    <header class="topbar"><h1>Tú</h1></header>
    <p class="eyebrow" style="padding:0 18px 8px">Experiencia</p>
    <div class="settings-group">
      <div class="settings-row"><span class="grow"><b>Tema</b><small>Las fotos lucen más en oscuro</small></span>
        <select data-theme><option value="auto">Automático</option><option value="dark">Oscuro</option><option value="light">Claro</option></select></div>
      <button class="settings-row" data-who><span class="grow"><b>Con quién viajo normalmente</b><small>${esc(companions.length ? fmt.list(companions) : 'Nadie configurado')}</small></span>${ICONS.edit}</button>
      <button class="settings-row" data-demo><span class="grow"><b>Volver a cargar el viaje de ejemplo</b><small>Sevilla, dos días</small></span>${ICONS.images}</button>
    </div>
    <p class="eyebrow" style="padding:0 18px 8px">Inteligencia</p>
    <div class="settings-group">
      <div class="settings-row"><span class="status-dot ${status.ai && !aiOff ? 'on' : ''}"></span><span class="grow"><b>IA de visión</b><small>${status.ai ? (aiOff ? 'Disponible, desactivada por ti' : 'Activa: confirma monumentos mirando la foto') : 'No disponible en este servidor: se identifica por ubicación'}</small></span>
        ${status.ai ? `<select data-ai><option value="on">Activa</option><option value="off">Desactivada</option></select>` : ''}</div>
      <div class="settings-row"><span class="status-dot on"></span><span class="grow"><b>Ubicación y orientación</b><small>OpenStreetMap + Wikipedia, gratis y abiertas</small></span></div>
    </div>
    <p class="eyebrow" style="padding:0 18px 8px">Tus viajes a salvo</p>
    <div class="settings-group">
      <button class="settings-row" data-export><span class="grow"><b>Guardar copia de seguridad</b><small>Todos tus viajes en un archivo, para guardarlo en iCloud, Drive o pasarlo a otro móvil</small></span>${ICONS.share}</button>
      <label class="settings-row" style="cursor:pointer"><span class="grow"><b>Restaurar una copia</b><small>Abre un archivo .recuerdo</small></span>${ICONS.images}<input id="restore-file" type="file" accept=".recuerdo,application/octet-stream" hidden></label>
    </div>
    <p class="eyebrow" style="padding:0 18px 8px">Privacidad</p>
    <div class="settings-group">
      <div class="settings-row"><span class="grow"><b>Tus fotos no salen del dispositivo</b><small>Se guardan en este navegador. Con la IA activa, se envía una copia reducida solo para analizarla.</small></span></div>
      <div class="settings-row"><span class="grow"><b>Estadísticas de uso anónimas</b><small data-metrics>Solo contamos acciones (abrir una foto, ver una historia), nunca lugares, fotos ni datos personales.</small></span></div>
    </div>
    <p style="text-align:center;color:var(--faint);font-size:12px;padding:10px 0 20px">Recuerdo · beta 0.2<br>Datos de lugares © colaboradores de OpenStreetMap y Wikipedia</p>`;
  v.querySelector('[data-theme]').value = theme;
  v.querySelector('[data-export]').addEventListener('click', async () => {
    toast('Preparando la copia…');
    const res = await exportBackup();
    if (!res.trips) { toast('Aún no hay viajes que guardar'); return; }
    const how = await saveBackupFile(res);
    if (how !== 'cancelled') { toast(`Copia lista: ${res.trips} ${res.trips === 1 ? 'viaje' : 'viajes'}, ${res.photos} fotos`); track('backup_export', { trips: res.trips, photos: res.photos }); }
  });
  v.querySelector('#restore-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const r = await importBackup(f);
      toast(`Restaurados ${r.trips} ${r.trips === 1 ? 'viaje' : 'viajes'} y ${r.photos} fotos`);
      track('backup_restore', { trips: r.trips });
      location.hash = '#/';
    } catch (err) { toast(err.message || 'No se pudo leer la copia'); }
  });
  localMetrics().then((m) => {
    const n = Object.values(m).reduce((a, b) => a + b, 0);
    if (n) v.querySelector('[data-metrics]').textContent += ` En este móvil: ${n} acciones registradas.`;
  });
  v.querySelector('[data-theme]').addEventListener('change', (e) => { applyTheme(e.target.value); try { localStorage.setItem('recuerdo.theme', e.target.value); } catch { /* */ } });
  v.querySelector('[data-ai]')?.addEventListener('change', (e) => { try { localStorage.setItem('recuerdo.ai', e.target.value); } catch { /* */ } settingsView(); });
  if (v.querySelector('[data-ai]')) v.querySelector('[data-ai]').value = aiOff ? 'off' : 'on';
  v.querySelector('[data-demo]').addEventListener('click', async () => { await seedDemo(true); toast('Viaje de ejemplo listo'); location.hash = '#/viaje/demo-sevilla'; });
  v.querySelector('[data-who]').addEventListener('click', () => {
    const { body, close } = openSheet(`<p class="eyebrow">Compañeros habituales</p>
      <label class="field"><span>Nombres separados por comas</span><input class="input" value="${esc(companions.join(', '))}" placeholder="Marta, Luis"></label>
      <button class="btn btn-primary btn-block" data-save>${ICONS.check}Guardar</button>`);
    body.querySelector('[data-save]').addEventListener('click', async () => {
      await kv.set('defaultCompanions', body.querySelector('input').value.split(',').map((s) => s.trim()).filter(Boolean));
      close(); settingsView();
    });
  });
}

export function applyTheme(t) {
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

export { photoSrc };
