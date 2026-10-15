// Dibujo en canvas compartido por el vídeo-recuerdo y el álbum: fotos a sangre,
// textos con la tipografía de la marca y la etiqueta del monumento.

import { photoSrc } from './ui.js';

export const BRAND = {
  accent: '#ff6b4a', accent2: '#ffb36b', pink: '#e8407a', ink: '#1d1714', paper: '#faf5f0', night: '#0f0d0c',
  display: '"Fraunces", Georgia, serif', body: '"Inter", -apple-system, "Segoe UI", Roboto, sans-serif',
};

export async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('700 40px Fraunces'), document.fonts.load('500 40px Fraunces'),
      document.fonts.load('400 20px Inter'), document.fonts.load('600 20px Inter'), document.fonts.load('700 20px Inter'),
    ]);
  } catch { /* se usan las de reserva */ }
}

const cache = new Map();
export async function loadPhoto(photo) {
  if (!photo) return null;
  if (cache.has(photo.id)) return cache.get(photo.id);
  const p = (async () => {
    const src = (await photoSrc(photo, 'full')) || (await photoSrc(photo, 'thumb'));
    if (!src) return null;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  })();
  cache.set(photo.id, p);
  return p;
}

// Dibuja la imagen cubriendo el rectángulo (como object-fit: cover), con zoom/desplazamiento opcional.
export function drawCover(ctx, img, x, y, w, h, { zoom = 1, dx = 0, dy = 0 } = {}) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const s = Math.max(w / iw, h / ih) * zoom;
  const sw = iw * s, sh = ih * s;
  const ox = x + (w - sw) / 2 + dx * w, oy = y + (h - sh) / 2 + dy * h;
  ctx.drawImage(img, ox, oy, sw, sh);
  return { ox, oy, sw, sh }; // para colocar etiquetas en coordenadas de la foto
}

export function gradientFill(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, BRAND.accent2); g.addColorStop(0.45, BRAND.accent); g.addColorStop(1, BRAND.pink);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

// Texto con saltos de línea automáticos. Devuelve la altura usada.
export function wrapText(ctx, text, x, y, maxW, lineH, { maxLines = 99, align = 'left' } = {}) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  }
  ctx.textAlign = align;
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
  ctx.textAlign = 'left';
  return lines.length * lineH;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Etiqueta del monumento sobre la foto (el punto que late de la app, congelado).
export function drawTag(ctx, name, x, y, scale = 1) {
  const r = 16 * scale;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 14 * scale;
  ctx.fillStyle = BRAND.accent; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.lineWidth = 4 * scale; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.font = `600 ${26 * scale}px ${BRAND.body}`;
  const tw = ctx.measureText(name).width;
  const px = x + r + 12 * scale, ph = 50 * scale;
  ctx.fillStyle = 'rgba(0,0,0,.62)';
  roundRect(ctx, px, y - ph / 2, tw + 32 * scale, ph, ph / 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
  ctx.fillText(name, px + 16 * scale, y + 1);
  ctx.restore();
}

export function drawLogo(ctx, x, y, size, color = '#fff') {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 24;
  ctx.scale(s, s);
  ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke(new Path2D('M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z'));
  ctx.stroke(new Path2D('M9.5 9.5l2 2 3.5-3.5'));
  ctx.restore();
}

export const canvasBlob = (canvas, type = 'image/jpeg', q = 0.88) => new Promise((r) => canvas.toBlob(r, type, q));
