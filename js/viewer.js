// Visor de foto inmersivo — el corazón de Recuerdo.
//  · Toca un punto → ficha del lugar (nombre, historia, curiosidad, cuándo estuviste).
//  · Toca la foto   → dónde estabas (calle, barrio, pueblo, mapa, qué había cerca).
//  · Doble toque    → favorita (como Instagram).  · Desliza ← → para pasar, ↓ para cerrar.

import { ICONS, KIND_ICON, esc, h, fmt, toast, haptic } from './util.js';
import { photoSrc, openSheet, closeSheet, sheetOpen } from './ui.js';
import { KIND_LABEL, isFood, wikiDetails, pickFact, splitParagraphs } from './places.js';
import { placeLine, mainSubject, identifyPhoto } from './identify.js';
import { formatDistance } from './geo.js';
import { savePhoto } from './trips.js';
import { db, kv, blobURL, forgetBlobURL } from './store.js';
import { speak, stopSpeaking, canRecord, startNote } from './voice.js';

let active = null;

export async function openViewer(photos, index, { trip, onChange } = {}) {
  closeViewer();
  const root = document.getElementById('overlay-root');
  const el = h(`<div class="viewer labels" role="dialog" aria-label="Foto">
      <div class="viewer-top">
        <button class="icon-btn" data-act="close" aria-label="Cerrar">${ICONS.back}</button>
        <div class="viewer-title"><b></b><small></small></div>
        <button class="icon-btn" data-act="labels" aria-label="Mostrar u ocultar nombres">${ICONS.labels}</button>
        <button class="icon-btn" data-act="info" aria-label="Dónde estaba">${ICONS.info}</button>
      </div>
      <div class="stage"><div class="frame"><img alt=""></div></div>
      <div class="viewer-bottom">
        <div class="hint-pill" hidden>${ICONS.sparkle}<span>Toca los puntos para descubrir qué es</span></div>
        <div class="viewer-actions">
          <button data-act="listen">${ICONS.speaker}<span>Escuchar</span></button>
          <button data-act="note">${ICONS.mic}<span>Nota de voz</span></button>
          <button data-act="fav">${ICONS.heart}<span>Favorita</span></button>
          <button data-act="share">${ICONS.share}<span>Compartir</span></button>
        </div>
      </div>
    </div>`);
  root.append(el);
  document.getElementById('app').classList.add('immersive');
  document.body.style.overflow = 'hidden';

  active = { el, photos, index, trip, onChange, recording: null, stopVoice: null };
  await render(0);
  bindGestures(el);
  el.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);

  if (!(await kv.get('hintSeen'))) {
    const hint = el.querySelector('.hint-pill');
    hint.hidden = false;
    setTimeout(() => { hint.hidden = true; kv.set('hintSeen', true); }, 6000);
  }
}

export function closeViewer() {
  if (!active) return;
  stopSpeaking();
  active.recording?.stop().catch(() => {});
  closeSheet(true);
  document.removeEventListener('keydown', onKey);
  active.el.remove();
  document.getElementById('app').classList.remove('immersive');
  document.body.style.overflow = '';
  active = null;
}

const cur = () => active.photos[active.index];

async function render(dir) {
  const { el } = active;
  const p = cur();
  stopSpeaking();
  const frame = el.querySelector('.frame');
  const img = frame.querySelector('img');
  frame.querySelectorAll('.hotspot').forEach((n) => n.remove());
  frame.classList.remove('slide-l', 'slide-r');
  void frame.offsetWidth;
  if (dir) frame.classList.add(dir > 0 ? 'slide-l' : 'slide-r');

  el.querySelector('.viewer-title b').textContent = mainSubject(p) || placeLine(p);
  el.querySelector('.viewer-title small').textContent = `${fmt.dayTitle(p.takenAt)} · ${fmt.time(p.takenAt)}`;
  el.querySelector('[data-act="fav"]').classList.toggle('on', !!p.fav);

  frame.querySelector('.placeholder-img')?.remove();
  img.hidden = false;
  img.removeAttribute('src');
  img.alt = mainSubject(p) || 'Foto del viaje';
  // Sin imagen (sin conexión, formato no soportado): un lienzo con el nombre, y los puntos siguen funcionando.
  const showPlaceholder = () => {
    if (cur() !== p || frame.querySelector('.placeholder-img')) return;
    img.hidden = true;
    const ph = h(`<div class="placeholder-img viewer-ph" style="aspect-ratio:${p.w && p.h ? `${p.w}/${p.h}` : '3/4'}">${esc(mainSubject(p) || placeLine(p))}</div>`);
    frame.prepend(ph);
  };
  img.onerror = showPlaceholder;
  const thumb = await photoSrc(p, 'thumb');
  if (thumb) img.src = thumb; // aparece al instante con la miniatura...
  else showPlaceholder();
  const full = await photoSrc(p, 'full');
  if (full && full !== thumb) {
    const pre = new Image();
    pre.onload = () => { if (cur() === p) { frame.querySelector('.placeholder-img')?.remove(); img.hidden = false; img.src = full; } }; // ...y se cambia por la buena al cargar
    pre.src = full;
  }
  drawHotspots(p);

  if (p.status === 'new' && !p.demo) reidentify(p);
}

function drawHotspots(p) {
  const frame = active.el.querySelector('.frame');
  frame.querySelectorAll('.hotspot').forEach((n) => n.remove());
  (p.hotspots || []).forEach((hs) => {
    const b = h(`<button class="hotspot ${isFood(hs.kind) ? 'food' : ''}" style="left:${hs.x * 100}%;top:${hs.y * 100}%" data-hs="${esc(hs.id)}" aria-label="${esc(hs.name)}">
        <span class="dot"></span><span class="label">${esc(hs.name)}</span></button>`);
    frame.append(b);
  });
}

async function reidentify(p) {
  const pill = h(`<div class="chip glass processing">${ICONS.sparkle}<span>Identificando…</span></div>`);
  active.el.append(pill);
  try {
    const blob = p.blobKey ? await db.get('blobs', p.blobKey) : null;
    await identifyPhoto(p, { imageBlob: blob, onStep: (s) => { pill.querySelector('span').textContent = { place: 'Buscando dónde estabas…', pois: 'Reconociendo el lugar…', ai: 'Mirando la foto con IA…' }[s] || 'Identificando…'; } });
    await savePhoto(p);
    if (active && cur() === p) { drawHotspots(p); render(0); }
    active?.onChange?.(p);
  } catch {
    toast('No se pudo identificar ahora. Revisa la conexión.');
  } finally { pill.remove(); }
}

// ---------- Interacción ----------
let tapTimer = null, lastTap = 0;

function onClick(e) {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act) return handleAction(act);
  const hsBtn = e.target.closest('.hotspot');
  if (hsBtn) {
    haptic(10);
    const hs = cur().hotspots.find((x) => x.id === hsBtn.dataset.hs);
    return openSpotSheet(cur(), hs);
  }
  if (e.target.closest('.stage')) {
    // Un toque: ficha del sitio. Dos toques: favorita.
    const now = Date.now();
    if (now - lastTap < 280) {
      clearTimeout(tapTimer); lastTap = 0;
      return toggleFav(true);
    }
    lastTap = now;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      if (e.target.tagName === 'IMG' || e.target.classList.contains('viewer-ph')) openPlaceSheet(cur());
      else active.el.classList.toggle('clean');
    }, 280);
  }
}

function onKey(e) {
  if (sheetOpen()) return;
  if (e.key === 'Escape') closeViewer();
  if (e.key === 'ArrowRight') go(1);
  if (e.key === 'ArrowLeft') go(-1);
}

function go(d) {
  const n = active.index + d;
  if (n < 0 || n >= active.photos.length) { haptic(4); return; }
  active.index = n;
  render(d);
}

function bindGestures(el) {
  const stage = el.querySelector('.stage');
  let sx = 0, sy = 0, tracking = false;
  stage.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { tracking = false; return; }
    tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) { clearTimeout(tapTimer); go(dx < 0 ? 1 : -1); }
    else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) { clearTimeout(tapTimer); closeViewer(); }
  });
}

async function handleAction(act) {
  const p = cur();
  if (act === 'close') return closeViewer();
  if (act === 'labels') return active.el.classList.toggle('labels');
  if (act === 'info') return openPlaceSheet(p);
  if (act === 'fav') return toggleFav();
  if (act === 'listen') return listen(p);
  if (act === 'note') return recordNote(p);
  if (act === 'share') return sharePhoto(p);
}

async function toggleFav(fromDoubleTap = false) {
  const p = cur();
  if (fromDoubleTap && p.fav) { burst(); return; }
  p.fav = !p.fav;
  await savePhoto(p);
  active.el.querySelector('[data-act="fav"]').classList.toggle('on', p.fav);
  if (p.fav) burst();
  haptic(p.fav ? 14 : 6);
  active.onChange?.(p);
}

function burst() {
  const b = h(`<div class="heart-burst">${ICONS.heart}</div>`);
  active.el.querySelector('.stage').append(b);
  setTimeout(() => b.remove(), 850);
}

// ---------- Narración de una foto ----------
export function narratePhoto(p, trip) {
  const plural = trip?.companions?.length;
  const hs = p.hotspots?.[0];
  const cand = hs && p.candidates?.find((c) => c.id === hs.candidateId);
  let t = `Esta foto ${plural ? 'la hicisteis' : 'la hiciste'} el ${fmt.longDate(p.takenAt).toLowerCase()}, a las ${fmt.time(p.takenAt)}`;
  if (p.place?.street || p.place?.city) t += `, en ${[p.place.street, p.place.neighbourhood, p.place.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`;
  t += '. ';
  if (plural) t += `${plural === 1 ? 'Ibas' : 'Ibais'} con ${fmt.list(trip.companions)}. `;
  if (hs) {
    t += `${isFood(hs.kind) ? 'Estabais en' : 'Delante tienes'} ${hs.name}. `;
    if (p.aiCaption) t += p.aiCaption + ' ';
    else if (cand?.extract) t += cand.extract.split(/(?<=[.!?])\s/).slice(0, 2).join(' ') + ' ';
  }
  if (p.note?.text) t += `Tu nota de aquel momento: ${p.note.text}`;
  return t.trim();
}

function listen(p) {
  const btn = active.el.querySelector('[data-act="listen"]');
  if (btn.classList.contains('on')) { stopSpeaking(); btn.classList.remove('on'); return; }
  btn.classList.add('on');
  speak(narratePhoto(p, active.trip), { onend: () => btn.classList.remove('on') });
}

async function recordNote(p) {
  const btn = active.el.querySelector('[data-act="note"]');
  if (active.recording) {
    const r = active.recording; active.recording = null;
    btn.classList.remove('rec'); btn.querySelector('span').textContent = 'Nota de voz';
    const { blob, text } = await r.stop();
    if (p.note?.audioKey) { await db.del('blobs', p.note.audioKey); forgetBlobURL(p.note.audioKey); }
    const audioKey = `a:${p.id}:${Date.now()}`;
    await db.put('blobs', blob, audioKey);
    p.note = { text: text || p.note?.text || '', audioKey, at: new Date().toISOString() };
    await savePhoto(p);
    active.onChange?.(p);
    toast(text ? 'Nota guardada y transcrita' : 'Nota de voz guardada');
    if (!text) openNoteEditor(p);
    return;
  }
  if (!canRecord()) return openNoteEditor(p);
  try {
    active.recording = await startNote({ onText: (t) => { btn.querySelector('span').textContent = t.slice(-18) || 'Grabando…'; } });
    btn.classList.add('rec'); btn.querySelector('span').textContent = 'Grabando…';
    haptic(20);
  } catch {
    toast('Sin acceso al micrófono: escribe la nota');
    openNoteEditor(p);
  }
}

function openNoteEditor(p) {
  const { body, close } = openSheet(`
    <p class="eyebrow">Tu recuerdo de este momento</p>
    <h2 class="place-name" style="font-size:24px">¿Qué pasó aquí?</h2>
    <p class="place-sub">Con quién estabas, qué comisteis, una anécdota… Aparecerá en la historia del viaje.</p>
    <label class="field"><span>Nota</span><textarea class="input" rows="4" placeholder="Ej.: Aquí Marta se perdió buscando el baño y acabamos en una boda.">${esc(p.note?.text || '')}</textarea></label>
    <button class="btn btn-primary btn-block" data-save>${ICONS.check}Guardar nota</button>`);
  const ta = body.querySelector('textarea');
  setTimeout(() => ta.focus(), 300);
  body.querySelector('[data-save]').addEventListener('click', async () => {
    p.note = { ...(p.note || {}), text: ta.value.trim() };
    await savePhoto(p);
    active?.onChange?.(p);
    close();
    toast('Nota guardada');
  });
}

async function sharePhoto(p) {
  const title = mainSubject(p) || placeLine(p);
  const text = `${title} · ${fmt.longDate(p.takenAt)} — recordado con Recuerdo`;
  try {
    const blob = p.blobKey ? await db.get('blobs', p.blobKey) : null;
    const files = blob ? [new File([blob], p.name || 'foto.jpg', { type: blob.type || 'image/jpeg' })] : [];
    if (navigator.canShare?.({ files }) && files.length) await navigator.share({ files, title, text });
    else if (navigator.share) await navigator.share({ title, text });
    else { await navigator.clipboard.writeText(text); toast('Texto copiado'); }
  } catch { /* el usuario canceló */ }
}

// ---------- Ficha de un lugar (al tocar un punto) ----------
export async function openSpotSheet(p, hs, { trip } = {}) {
  trip ||= active?.trip;
  const cand = p.candidates?.find((c) => c.id === hs.candidateId) || { name: hs.name, kind: hs.kind };
  const food = isFood(hs.kind);
  const subParts = [cand.description, cand.distance != null ? `a ${formatDistance(cand.distance)} de donde hiciste la foto` : null].filter(Boolean);
  const html = `
    <div class="place-media" ${cand.image ? '' : 'hidden'}><img alt="" src="${esc(cand.image || '')}"></div>
    <div class="place-kind">${KIND_ICON(hs.kind)}${esc(KIND_LABEL[hs.kind] || 'Lugar')}</div>
    <h2 class="place-name">${esc(hs.name)}</h2>
    <p class="place-sub">${esc(subParts.join(' · '))}</p>
    ${cand.cuisine ? `<div class="chips" style="margin-top:10px">${cand.cuisine.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>` : ''}
    <div class="when-card">${ICONS.clock}<div><b>Estuviste aquí el ${esc(fmt.longDate(p.takenAt).toLowerCase())}</b><span>A las ${esc(fmt.time(p.takenAt))} · ${esc(placeLine(p))}</span></div></div>
    <div data-text>${hs.fact ? `<div class="fact"><b>En tu foto</b>${esc(hs.fact)}</div>` : ''}${cand.extract ? `<p class="place-text">${esc(cand.extract)}</p>` : '<p class="place-text skeleton" style="height:70px;border-radius:10px"></p>'}</div>
    <div class="sheet-actions">
      <button data-a="listen">${ICONS.speaker}Escuchar</button>
      <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hs.name} ${p.place?.city || ''}`)}" target="_blank" rel="noopener">${ICONS.map}Mapa</a>
      ${cand.url ? `<a href="${esc(cand.url)}" target="_blank" rel="noopener">${ICONS.external}${cand.source === 'wikipedia' || cand.wikiTitle ? 'Wikipedia' : 'Ficha'}</a>` : `<button data-a="note">${ICONS.edit}Nota</button>`}
      <button data-a="share">${ICONS.share}Compartir</button>
    </div>
    ${food && cand.website ? `<a class="btn btn-ghost btn-block" href="${esc(cand.website)}" target="_blank" rel="noopener" style="margin-top:6px">${ICONS.external}Web del local</a>` : ''}
    <div class="confidence" style="--c:${Math.round((hs.confidence || 0.5) * 100)}%"><i></i>${hs.source === 'ai' ? 'Confirmado con IA' : 'Identificado por ubicación y orientación'} · <button class="link" data-a="fix">¿No es esto?</button></div>`;
  const { body, close } = openSheet(html);
  let stop = null;
  body.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'listen') {
      const btn = e.target.closest('[data-a]');
      if (btn.classList.contains('on')) { stop?.(); btn.classList.remove('on'); return; }
      btn.classList.add('on');
      const text = `${hs.name}. ${body.querySelector('[data-text]').innerText}`;
      stop = speak(text, { onend: () => btn.classList.remove('on') });
    }
    if (a === 'share') {
      const text = `${hs.name} — ${fmt.longDate(p.takenAt)}`;
      try { if (navigator.share) await navigator.share({ title: hs.name, text, url: cand.url }); else { await navigator.clipboard.writeText(`${text} ${cand.url || ''}`); toast('Copiado'); } } catch { /* cancelado */ }
    }
    if (a === 'note') { close(); setTimeout(() => openNoteEditor(p), 280); }
    if (a === 'fix') { close(); setTimeout(() => openFixSheet(p, hs), 280); }
  });

  // Ampliamos con el artículo completo de Wikipedia (introducción) si existe.
  if (cand.wikiTitle) {
    const det = await wikiDetails(cand.wikiTitle);
    if (det && body.isConnected) {
      const paras = splitParagraphs(det.extract, 3);
      const fact = pickFact(det.extract);
      const box = body.querySelector('[data-text]');
      box.innerHTML = `${hs.fact ? `<div class="fact"><b>En tu foto</b>${esc(hs.fact)}</div>` : ''}${paras.map((t) => `<p class="place-text">${esc(t)}</p>`).join('')}${fact && !paras.join(' ').slice(0, 400).includes(fact.slice(0, 40)) ? `<div class="fact"><b>¿Sabías que…?</b>${esc(fact)}</div>` : ''}`;
      if (!paras.length && cand.extract) box.innerHTML += `<p class="place-text">${esc(cand.extract)}</p>`;
      const media = body.querySelector('.place-media');
      if (det.image) { media.hidden = false; media.querySelector('img').src = det.image; }
    } else if (body.isConnected && !cand.extract) {
      body.querySelector('[data-text]').innerHTML = '';
    }
  } else if (!cand.extract) {
    body.querySelector('[data-text]').innerHTML = food
      ? '<p class="place-text">Local registrado en OpenStreetMap junto al punto donde hiciste la foto.</p>'
      : '';
  }
}

// Corrección con un toque: elegir otro candidato real. Cada corrección mejora el banco de lugares.
function openFixSheet(p, hs) {
  const others = (p.candidates || []).filter((c) => c.id !== hs.candidateId).slice(0, 8);
  const { body, close } = openSheet(`
    <p class="eyebrow">Corregir</p>
    <h2 class="place-name" style="font-size:24px">¿Qué es realmente?</h2>
    <p class="place-sub">Estos son los lugares que había cerca cuando hiciste la foto.</p>
    <div class="list" style="margin-top:10px">
      ${others.map((c) => `<button class="list-item" data-id="${esc(c.id)}"><span class="thumb">${KIND_ICON(c.kind)}</span><span class="grow"><b>${esc(c.name)}</b><small>${esc(KIND_LABEL[c.kind] || 'Lugar')} · ${formatDistance(c.distance)}</small></span></button>`).join('') || '<p class="place-sub">No hay más lugares cerca.</p>'}
      <button class="list-item" data-del><span class="thumb">${ICONS.trash}</span><span class="grow"><b>Quitar este punto</b><small>No es ningún lugar concreto</small></span></button>
    </div>`);
  body.addEventListener('click', async (e) => {
    const item = e.target.closest('.list-item');
    if (!item) return;
    if (item.hasAttribute('data-del')) p.hotspots = p.hotspots.filter((x) => x.id !== hs.id);
    else {
      const c = p.candidates.find((k) => k.id === item.dataset.id);
      Object.assign(hs, { candidateId: c.id, name: c.name, kind: c.kind, confidence: 1, source: 'user', fact: null });
    }
    await savePhoto(p);
    close();
    if (active) { drawHotspots(p); render(0); }
    active?.onChange?.(p);
    toast('¡Gracias! Corregido');
  });
}

// ---------- Ficha de "dónde estabas" (toque en la foto) ----------
export async function openPlaceSheet(p) {
  const pl = p.place || {};
  const title = pl.neighbourhood || pl.street || pl.city || (p.lat != null ? 'Ubicación guardada' : 'Sin ubicación');
  const sub = [pl.city !== title ? pl.city : null, pl.state, pl.country].filter(Boolean).join(', ');
  const inPhoto = p.hotspots || [];
  const nearby = (p.candidates || []).filter((c) => !inPhoto.some((s) => s.candidateId === c.id)).slice(0, 6);
  const audio = p.note?.audioKey ? await blobURL(p.note.audioKey) : null;
  const html = `
    <div class="place-kind">${ICONS.pin}Dónde estabas</div>
    <h2 class="place-name">${esc(title)}</h2>
    <p class="place-sub">${esc(sub)}</p>
    <div class="when-card">${ICONS.clock}<div><b>${esc(fmt.longDate(p.takenAt))}</b><span>${esc(fmt.time(p.takenAt))} · ${esc(fmt.momentOfDay(p.takenAt))}${p.camera ? ` · ${esc(p.camera)}` : ''}${p.dateFromFile ? ' · fecha aproximada' : ''}</span></div></div>
    ${pl.street ? `<div class="when-card">${ICONS.pin}<div><b>${esc(pl.street)}${pl.number ? ` ${esc(pl.number)}` : ''}</b><span>${esc([pl.neighbourhood, pl.city].filter(Boolean).join(', '))}${p.approx ? ' · ubicación estimada' : ''}</span></div></div>` : ''}
    ${p.lat == null ? `<div class="callout"><b>Esta foto no guarda la ubicación</b>Suele pasar con fotos recibidas por WhatsApp o capturas. Si tienes el original de la cámara, impórtalo y la reconoceremos.</div>` : ''}
    ${p.note?.text || audio ? `<div class="note-card">${ICONS.mic}<div style="flex:1">${p.note?.text ? `<p>«${esc(p.note.text)}»</p>` : ''}${audio ? `<audio controls src="${audio}" style="width:100%;margin-top:8px"></audio>` : ''}</div></div>` : ''}
    ${p.aiScene ? `<p class="place-text" style="margin:12px 0">${esc(p.aiScene)}</p>` : ''}
    ${p.lat != null ? '<div class="map-box" id="mini-map" style="height:180px;margin:14px 0"></div>' : ''}
    ${inPhoto.length ? `<div class="section-head" style="margin-top:6px"><h2>En esta foto</h2></div><div class="list">${inPhoto.map((s) => `<button class="list-item" data-hs="${esc(s.id)}"><span class="thumb">${KIND_ICON(s.kind)}</span><span class="grow"><b>${esc(s.name)}</b><small>${esc(KIND_LABEL[s.kind] || 'Lugar')}</small></span></button>`).join('')}</div>` : ''}
    ${nearby.length ? `<div class="section-head" style="margin-top:14px"><h2>Cerca de aquí</h2></div><div class="list">${nearby.map((c) => `<button class="list-item" data-cand="${esc(c.id)}">${c.image ? `<img class="thumb" src="${esc(c.image)}" alt="">` : `<span class="thumb">${KIND_ICON(c.kind)}</span>`}<span class="grow"><b>${esc(c.name)}</b><small>${esc(KIND_LABEL[c.kind] || 'Lugar')} · ${formatDistance(c.distance)}</small></span></button>`).join('')}</div>` : ''}
    <div class="sheet-actions" style="grid-template-columns:repeat(3,1fr)">
      <button data-a="listen">${ICONS.speaker}Escuchar</button>
      <button data-a="note">${ICONS.edit}${p.note?.text ? 'Editar nota' : 'Añadir nota'}</button>
      ${p.lat != null ? `<a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}" target="_blank" rel="noopener">${ICONS.map}Abrir mapa</a>` : `<button data-a="reid">${ICONS.sparkle}Reintentar</button>`}
    </div>
    ${!p.demo && p.lat != null ? `<button class="btn btn-ghost btn-block" data-a="reid" style="margin-top:6px">${ICONS.sparkle}Volver a identificar</button>` : ''}`;
  const { body, close } = openSheet(html);

  if (p.lat != null && window.L) {
    setTimeout(() => {
      const m = L.map(body.querySelector('#mini-map'), { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false }).setView([p.lat, p.lon], 17);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m);
      L.marker([p.lat, p.lon], { icon: L.divIcon({ className: '', html: '<div class="num-pin">●</div>', iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(m);
      for (const c of inPhoto.map((s) => p.candidates?.find((k) => k.id === s.candidateId)).filter((c) => c?.lat)) {
        L.circleMarker([c.lat, c.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#ff6b4a', fillOpacity: 1 }).addTo(m);
      }
    }, 120);
  }

  body.addEventListener('click', (e) => {
    const hsId = e.target.closest('[data-hs]')?.dataset.hs;
    const candId = e.target.closest('[data-cand]')?.dataset.cand;
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (hsId) { close(); setTimeout(() => openSpotSheet(p, p.hotspots.find((s) => s.id === hsId)), 280); }
    if (candId) {
      const c = p.candidates.find((k) => k.id === candId);
      close(); setTimeout(() => openSpotSheet(p, { id: 'tmp', candidateId: c.id, name: c.name, kind: c.kind, confidence: 0.4, source: 'geo' }), 280);
    }
    if (a === 'listen') speak(narratePhoto(p, active?.trip));
    if (a === 'note') { close(); setTimeout(() => openNoteEditor(p), 280); }
    if (a === 'reid') { close(); p.status = 'new'; if (active) reidentify(p); }
  });
}
