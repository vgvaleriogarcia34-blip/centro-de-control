// «Crear»: convertir el viaje en algo que se comparte o se imprime.
//  · Vídeo-recuerdo (gratis, con marca de agua; Premium sin ella)
//  · Álbum en PDF para imprimir (Premium)
//  · Resumen en texto

import { openSheet, closeSheet } from './ui.js';
import { ICONS, esc, h, toast, fmt } from './util.js';
import { buildStory, tripPhotos } from './trips.js';
import { recordStoryVideo, canRecordVideo } from './video.js';
import { buildAlbum } from './album.js';
import { isPremium, requirePremium } from './plans.js';
import { track } from './analytics.js';

export async function openCreateSheet(trip) {
  const premium = await isPremium();
  const { body, close } = openSheet(`
    <p class="eyebrow">Crear con este viaje</p>
    <h2 class="place-name" style="font-size:26px">${esc(trip.title)}</h2>
    <div class="list" style="margin-top:8px">
      <button class="list-item" data-make="video"><span class="thumb">${ICONS.stories}</span><span class="grow"><b>Vídeo-recuerdo</b><small>Vertical, con música, listo para Reels, TikTok o WhatsApp${premium ? '' : ' · gratis con marca de agua'}</small></span></button>
      <button class="list-item" data-make="album"><span class="thumb">${ICONS.images}</span><span class="grow"><b>Álbum para imprimir</b><small>PDF de 21 × 21 cm con tus fotos, lugares y notas${premium ? '' : ' · Premium'}</small></span></button>
      <button class="list-item" data-make="text"><span class="thumb">${ICONS.share}</span><span class="grow"><b>Resumen en texto</b><small>Fechas y lugares, para mandarlo por mensaje</small></span></button>
    </div>`);
  body.addEventListener('click', async (e) => {
    const what = e.target.closest('[data-make]')?.dataset.make;
    if (!what) return;
    close();
    await new Promise((r) => setTimeout(r, 280));
    if (what === 'video') makeVideo(trip);
    if (what === 'album') makeAlbum(trip);
    if (what === 'text') shareText(trip);
  });
}

// ---------- Estudio: pantalla de producción con vista previa ----------
function studio(title) {
  const el = h(`<div class="studio" role="dialog" aria-label="${esc(title)}">
    <div class="studio-top"><button class="icon-btn" data-close aria-label="Cerrar">${ICONS.close}</button><b>${esc(title)}</b></div>
    <div class="studio-stage"></div>
    <div class="studio-bottom">
      <p class="progress-step" data-step>Preparando…</p>
      <div class="proc-banner" style="margin:0"><div class="bar"><i data-bar></i></div></div>
      <div class="studio-actions" hidden></div>
    </div></div>`);
  document.getElementById('overlay-root').append(el);
  document.body.style.overflow = 'hidden';
  const ctrl = new AbortController();
  const closeStudio = () => { ctrl.abort(); el.remove(); document.body.style.overflow = ''; };
  el.querySelector('[data-close]').addEventListener('click', closeStudio);
  return {
    el, signal: ctrl.signal, close: closeStudio,
    stage: el.querySelector('.studio-stage'),
    step: (t) => { el.querySelector('[data-step]').textContent = t; },
    progress: (f) => { el.querySelector('[data-bar]').style.width = `${Math.round(f * 100)}%`; },
    done: (html) => {
      el.querySelector('.proc-banner').hidden = true;
      const a = el.querySelector('.studio-actions');
      a.innerHTML = html; a.hidden = false;
      return a;
    },
  };
}

async function deliver(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'downloaded';
}

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function makeVideo(trip) {
  if (!canRecordVideo()) { toast('Este navegador no puede crear vídeos. Prueba con Chrome o Safari actualizados.'); return; }
  const premium = await isPremium();
  const photos = await tripPhotos(trip.id);
  const slides = buildStory(trip, photos);
  const s = studio('Vídeo-recuerdo');
  const canvas = document.createElement('canvas');
  canvas.className = 'studio-canvas';
  s.stage.append(canvas);
  s.step('Montando tu vídeo… (se graba en tiempo real)');
  track('video_start', { premium });
  try {
    const res = await recordStoryVideo({ trip, slides, watermark: !premium, canvas, signal: s.signal, onProgress: s.progress });
    if (!res) return;
    track('video_done', { seconds: res.seconds, ext: res.ext });
    const url = URL.createObjectURL(res.blob);
    canvas.replaceWith(Object.assign(document.createElement('video'), { src: url, controls: true, playsInline: true, loop: true, className: 'studio-canvas' }));
    s.step(`Tu vídeo está listo · ${res.seconds} s`);
    const name = `recuerdo-${slug(trip.title)}.${res.ext}`;
    const actions = s.done(`
      <button class="btn btn-primary btn-block" data-share>${ICONS.share}Compartir o guardar</button>
      ${premium ? '' : `<button class="btn btn-ghost btn-block" data-clean>${ICONS.sparkle}Quitar la marca de agua</button>`}`);
    actions.querySelector('[data-share]').addEventListener('click', async () => {
      const how = await deliver(res.blob, name, trip.title);
      if (how !== 'cancelled') track('share', { what: 'video', how });
    });
    actions.querySelector('[data-clean]')?.addEventListener('click', async () => {
      if (await requirePremium('video_clean')) { s.close(); makeVideo(trip); }
    });
  } catch (err) {
    console.error(err);
    s.step('No se pudo crear el vídeo en este dispositivo.');
  }
}

async function makeAlbum(trip) {
  if (!(await requirePremium('album'))) return;
  const photos = await tripPhotos(trip.id);
  const s = studio('Álbum para imprimir');
  s.stage.innerHTML = `<div class="album-preview"><div class="placeholder-img" style="font-size:22px">${esc(trip.title)}</div></div>`;
  s.step('Componiendo las páginas…');
  track('album_start', { photos: photos.length });
  try {
    const res = await buildAlbum(trip, photos, { onProgress: s.progress });
    if (s.signal.aborted) return;
    track('album_done', { pages: res.pages });
    s.step(`Álbum listo · ${res.pages} páginas · ${(res.blob.size / 1048576).toFixed(1).replace('.', ',')} MB`);
    s.stage.innerHTML = `<div class="album-preview"><div class="album-info">${ICONS.images}<b>${esc(trip.title)}</b><span>${res.pages} páginas · 21 × 21 cm · ${esc(fmt.range(trip.start, trip.end))}</span><small>Listo para enviar a cualquier imprenta o servicio de fotolibros.</small></div></div>`;
    const actions = s.done(`
      <button class="btn btn-primary btn-block" data-share>${ICONS.share}Guardar o enviar el PDF</button>
      <button class="btn btn-ghost btn-block" data-print>${ICONS.images}Pedir el álbum impreso</button>`);
    actions.querySelector('[data-share]').addEventListener('click', async () => {
      const how = await deliver(res.blob, `recuerdo-${slug(trip.title)}.pdf`, trip.title);
      if (how !== 'cancelled') track('album_export', { how });
    });
    actions.querySelector('[data-print]').addEventListener('click', () => {
      track('print_intent', { pages: res.pages });
      closeSheet(true);
      openSheet(`<p class="eyebrow">Álbum impreso</p><h2 class="place-name" style="font-size:24px">Muy pronto, en tu casa</h2>
        <p class="place-sub">Estamos cerrando el acuerdo con la imprenta. Mientras tanto, guarda el PDF: está preparado a 21 × 21 cm para cualquier servicio de fotolibros.</p>
        <p class="place-sub" style="margin-top:10px">Hemos anotado tu interés y te avisaremos en la app en cuanto esté disponible.</p>`);
    });
  } catch (err) {
    console.error(err);
    s.step('No se pudo crear el álbum en este dispositivo.');
  }
}

async function shareText(trip) {
  const photos = await tripPhotos(trip.id);
  const places = [...new Set(photos.flatMap((p) => (p.hotspots || []).map((x) => x.name)))];
  const text = `${trip.title} · ${fmt.range(trip.start, trip.end)}\n${places.slice(0, 10).join(' · ')}\n\nRecordado con Recuerdo`;
  track('share', { what: 'trip_text' });
  try {
    if (navigator.share) await navigator.share({ title: trip.title, text });
    else { await navigator.clipboard.writeText(text); toast('Resumen copiado'); }
  } catch { /* cancelado */ }
}
