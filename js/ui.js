// Componentes de interfaz compartidos: imágenes de fotos y la hoja inferior arrastrable.

import { blobURL } from './store.js';
import { wikiImage } from './demo.js';
import { demoArtURL } from './demo-art.js';
import { h, esc, haptic } from './util.js';

// ---------- Imágenes ----------
export async function photoSrc(photo, size = 'thumb') {
  if (!photo) return null;
  if (photo.art) return demoArtURL(photo.art);
  if (photo.wiki) return wikiImage(photo.wiki, size);
  if (size === 'full') return blobURL(photo.blobKey);
  return (await blobURL(photo.thumbKey)) || blobURL(photo.blobKey);
}

// Rellena todas las <img data-photo="id"> de un contenedor (carga perezosa y con degradado si falla).
export function hydrateImages(root, photosById, size = 'thumb') {
  root.querySelectorAll('img[data-photo]').forEach(async (img) => {
    const p = photosById.get(img.dataset.photo);
    const src = await photoSrc(p, img.dataset.size || size);
    if (src) {
      img.src = src;
      img.onerror = () => fallback(img, p);
    } else fallback(img, p);
  });
}

function fallback(img, p) {
  const label = p?.hotspots?.[0]?.name || p?.place?.city || '';
  const ph = h(`<div class="placeholder-img">${esc(label)}</div>`);
  ph.style.cssText = img.style.cssText;
  if (img.className) ph.classList.add(...img.className.split(' ').filter(Boolean));
  img.replaceWith(ph);
}

// ---------- Hoja inferior (patrón Google Maps / Apple Maps) ----------
let current = null;

export function openSheet(html, { onClose } = {}) {
  closeSheet(true);
  const root = document.getElementById('sheet-root');
  const backdrop = h('<div class="sheet-backdrop"></div>');
  const sheet = h(`<section class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-handle" aria-hidden="true"><i></i></div>
      <div class="sheet-body"></div>
    </section>`);
  const body = sheet.querySelector('.sheet-body');
  if (typeof html === 'string') body.innerHTML = html; else body.append(html);
  root.append(backdrop, sheet);
  haptic(6);

  const close = () => closeSheet();
  backdrop.addEventListener('click', close);

  // Arrastrar hacia abajo para cerrar.
  const handle = sheet.querySelector('.sheet-handle');
  let startY = null, dy = 0;
  const onDown = (e) => { startY = e.clientY; dy = 0; sheet.style.transition = 'none'; handle.setPointerCapture(e.pointerId); };
  const onMove = (e) => { if (startY == null) return; dy = Math.max(0, e.clientY - startY); sheet.style.transform = `translate(-50%, ${dy}px)`; };
  const onUp = () => {
    if (startY == null) return;
    startY = null; sheet.style.transition = '';
    if (dy > 90) close(); else sheet.style.transform = '';
  };
  handle.addEventListener('pointerdown', onDown);
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
  handle.addEventListener('pointercancel', onUp);
  // También desde el contenido si está arriba del todo.
  body.addEventListener('touchstart', (e) => { if (body.scrollTop <= 0) { startY = e.touches[0].clientY; dy = 0; } }, { passive: true });
  body.addEventListener('touchmove', (e) => {
    if (startY == null) return;
    dy = e.touches[0].clientY - startY;
    if (dy > 0 && body.scrollTop <= 0) { sheet.style.transition = 'none'; sheet.style.transform = `translate(-50%, ${dy}px)`; } else { dy = 0; }
  }, { passive: true });
  body.addEventListener('touchend', () => { if (startY != null) { sheet.style.transition = ''; startY = null; if (dy > 110) close(); else sheet.style.transform = ''; } });

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  current = { sheet, backdrop, onClose, onKey };
  return { body, close };
}

export function closeSheet(instant = false) {
  if (!current) return;
  const { sheet, backdrop, onClose, onKey } = current;
  current = null;
  document.removeEventListener('keydown', onKey);
  onClose?.();
  if (instant) { sheet.remove(); backdrop.remove(); return; }
  sheet.style.transition = 'transform .26s ease-in';
  sheet.style.transform = 'translate(-50%, 100%)';
  backdrop.style.opacity = '0';
  backdrop.style.transition = 'opacity .25s';
  setTimeout(() => { sheet.remove(); backdrop.remove(); }, 260);
}
export const sheetOpen = () => !!current;
