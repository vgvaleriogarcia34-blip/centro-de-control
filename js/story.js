// "Tu viaje contado": historias a pantalla completa como en Instagram, pero narradas.
// Barras de progreso, toque izquierda/derecha, mantener pulsado para pausar,
// efecto Ken Burns en las fotos y una voz que cuenta dónde estabais y qué era cada sitio.

import { ICONS, esc, h, haptic } from './util.js';
import { photoSrc } from './ui.js';
import { speak, stopSpeaking, canSpeak, pauseSpeaking, resumeSpeaking } from './voice.js';
import { kv } from './store.js';

let st = null;

export async function playStory(trip, slides, { startAt = 0, onClose } = {}) {
  closeStory();
  const root = document.getElementById('overlay-root');
  const coverSrc = await photoSrc(slides[0]?.photo, 'thumb');
  const el = h(`<div class="story" role="dialog" aria-label="Historia del viaje">
    <div class="story-frame">
      <div class="story-media"></div>
      <div class="story-shade"></div>
      <div class="story-bars">${slides.map(() => '<i><b></b></i>').join('')}</div>
      <div class="story-head">
        <span class="avatar">${coverSrc ? `<img src="${esc(coverSrc)}" alt="">` : ''}</span>
        <div style="flex:1"><b>${esc(trip.title)}</b><small data-sub></small></div>
        <button class="icon-btn" data-act="sound" aria-label="Narración">${ICONS.speaker}</button>
        <button class="icon-btn" data-act="close" aria-label="Cerrar">${ICONS.close}</button>
      </div>
      <div class="story-content"></div>
      <div class="story-tap l" data-act="prev"></div>
      <div class="story-tap r" data-act="next"></div>
    </div>
  </div>`);
  root.append(el);
  document.body.style.overflow = 'hidden';
  const sound = canSpeak() && (await kv.get('storySound', true));
  st = { el, trip, slides, i: startAt, raf: 0, t0: 0, elapsed: 0, dur: 6000, paused: false, sound, stopVoice: null, onClose, voiceDone: true };
  el.querySelector('[data-act="sound"]').style.opacity = sound ? 1 : 0.45;

  el.addEventListener('click', onClick);
  const frame = el.querySelector('.story-frame');
  let holdTimer = null, held = false;
  frame.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    held = false;
    holdTimer = setTimeout(() => { held = true; pause(true); }, 220);
  });
  const release = () => { clearTimeout(holdTimer); if (held) { pause(false); setTimeout(() => { held = false; }, 50); } };
  frame.addEventListener('pointerup', release);
  frame.addEventListener('pointercancel', release);
  frame.addEventListener('click', (e) => { if (held) e.stopPropagation(); }, true);
  let sy = 0;
  frame.addEventListener('touchstart', (e) => { sy = e.touches[0].clientY; }, { passive: true });
  frame.addEventListener('touchend', (e) => { if (e.changedTouches[0].clientY - sy > 120) closeStory(); });
  document.addEventListener('keydown', onKey);
  show(st.i);
}

export function closeStory() {
  if (!st) return;
  cancelAnimationFrame(st.raf);
  stopSpeaking();
  document.removeEventListener('keydown', onKey);
  st.el.remove();
  document.body.style.overflow = '';
  const cb = st.onClose;
  st = null;
  cb?.();
}

function onKey(e) {
  if (e.key === 'Escape') closeStory();
  if (e.key === 'ArrowRight') next();
  if (e.key === 'ArrowLeft') prev();
  if (e.key === ' ') { e.preventDefault(); pause(!st.paused); }
}

function onClick(e) {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'close') closeStory();
  if (act === 'next') next();
  if (act === 'prev') prev();
  if (act === 'sound') {
    st.sound = !st.sound;
    kv.set('storySound', st.sound);
    e.target.closest('button').style.opacity = st.sound ? 1 : 0.45;
    if (!st.sound) { stopSpeaking(); st.voiceDone = true; } else narrate(st.slides[st.i]);
  }
}

const next = () => { haptic(4); if (st.i < st.slides.length - 1) show(st.i + 1); else closeStory(); };
const prev = () => { haptic(4); show(Math.max(0, st.i - 1)); };

function pause(on) {
  if (!st) return;
  st.paused = on;
  st.el.querySelector('.story-media img')?.style.setProperty('animation-play-state', on ? 'paused' : 'running');
  if (on) pauseSpeaking(); else { st.t0 = performance.now() - st.elapsed; resumeSpeaking(); }
}

async function show(i) {
  cancelAnimationFrame(st.raf);
  stopSpeaking();
  st.i = i;
  const s = st.slides[i];
  const bars = [...st.el.querySelectorAll('.story-bars b')];
  bars.forEach((b, k) => { b.style.width = k < i ? '100%' : '0%'; });
  st.el.querySelector('[data-sub]').textContent = s.eyebrow || '';

  const media = st.el.querySelector('.story-media');
  const content = st.el.querySelector('.story-content');
  media.innerHTML = '';
  content.innerHTML = '';
  if (s.photo) {
    const src = (await photoSrc(s.photo, 'full')) || (await photoSrc(s.photo, 'thumb'));
    if (!st || st.i !== i) return;
    if (src) {
      const img = new Image();
      img.className = 'kb';
      img.alt = s.title || '';
      img.src = src;
      img.onerror = () => { img.remove(); media.append(storyPlaceholder(s)); };
      media.append(img);
    } else media.append(storyPlaceholder(s));
  }
  if (s.type === 'chapter') {
    content.innerHTML = `<div class="story-chapter" style="${s.photo ? 'background:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.7))' : ''}">
      <p class="eyebrow" style="color:rgba(255,255,255,.85)">${esc(s.eyebrow || '')}</p>
      <h2>${esc(s.title)}</h2><p>${esc(s.text)}</p></div>`;
  } else {
    content.innerHTML = `${s.tag ? `<div class="story-tag" style="left:${s.tag.x * 100}%;top:${Math.min(0.7, s.tag.y + 0.08) * 100}%">${esc(s.tag.name)}</div>` : ''}
      <div class="story-caption"><div class="place-kind">${esc(s.eyebrow || '')}</div><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p></div>`;
  }
  // Duración: lo que tarda en leerse (o narrarse), entre 5 y 14 segundos.
  const words = (s.speech || s.text || '').split(/\s+/).length;
  st.dur = Math.min(14000, Math.max(5000, words * 330 + 1200));
  st.elapsed = 0;
  st.t0 = performance.now();
  st.paused = false;
  narrate(s);
  tick();
}

function storyPlaceholder(s) {
  return h(`<div class="placeholder-img" style="font-size:0"></div>`);
}

function narrate(s) {
  if (!st.sound) { st.voiceDone = true; return; }
  st.voiceDone = false;
  const idx = st.i;
  speak(s.speech || s.text, { onend: () => { if (st && st.i === idx) st.voiceDone = true; } });
}

function tick() {
  st.raf = requestAnimationFrame(() => {
    if (!st) return;
    if (!st.paused) {
      st.elapsed = performance.now() - st.t0;
      const pct = Math.min(1, st.elapsed / st.dur);
      const bar = st.el.querySelectorAll('.story-bars b')[st.i];
      if (bar) bar.style.width = `${pct * 100}%`;
      // Avanza cuando se acaba el tiempo y la voz ha terminado de contar la diapositiva.
      if (pct >= 1 && st.voiceDone) return next();
      if (st.elapsed > st.dur + 12000) return next(); // red de seguridad si la voz se cuelga
    }
    tick();
  });
}
