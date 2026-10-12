// Álbum del viaje en PDF, listo para imprimir (21 × 21 cm, 300 ppp aprox.).
// Cada página se compone en un canvas y se guarda como JPEG dentro del PDF:
// así la tipografía de la marca sale idéntica en cualquier imprenta.

import { BRAND, fontsReady, loadPhoto, drawCover, gradientFill, wrapText, drawTag, drawLogo, canvasBlob } from './render.js';
import { groupDays } from './trips.js';
import { placeLine, mainSubject } from './identify.js';
import { KIND_LABEL } from './places.js';
import { fmt } from './util.js';

const PX = 2400;            // lado de la página en píxeles (21 cm ≈ 290 ppp)
const PT = 595.28;          // lado en puntos PDF (21 cm)
const M = 150;              // margen

export async function buildAlbum(trip, photos, { onProgress } = {}) {
  await fontsReady();
  const pages = planPages(trip, photos);
  const canvas = document.createElement('canvas');
  canvas.width = PX; canvas.height = PX;
  const ctx = canvas.getContext('2d');
  const jpegs = [];
  for (let i = 0; i < pages.length; i++) {
    await drawPage(ctx, pages[i], trip, i + 1, pages.length);
    jpegs.push(new Uint8Array(await (await canvasBlob(canvas, 'image/jpeg', 0.9)).arrayBuffer()));
    onProgress?.((i + 1) / pages.length);
  }
  return { blob: pdfFromJpegs(jpegs, PX, PX, PT, PT), pages: pages.length };
}

// Estructura: portada · por cada día, una página de capítulo y una página por foto destacada · cierre.
function planPages(trip, photos) {
  const pages = [{ type: 'cover', photo: photos.find((p) => p.id === trip.coverId) || photos[0] }];
  const days = groupDays(photos);
  days.forEach((d, di) => {
    if (days.length > 1) pages.push({ type: 'day', n: di + 1, date: d.date, stops: d.stops });
    for (const s of d.stops) {
      const picks = [...s.photos.filter((p) => p.fav), ...s.photos.filter((p) => !p.fav && p.hotspots?.length), ...s.photos.filter((p) => !p.fav && !p.hotspots?.length)];
      picks.slice(0, 2).forEach((p) => pages.push({ type: 'photo', photo: p }));
    }
  });
  pages.push({ type: 'end', photos });
  return pages.slice(0, 40); // límite razonable para un álbum de tapa blanda
}

async function drawPage(ctx, page, trip, n, total) {
  ctx.fillStyle = BRAND.paper;
  ctx.fillRect(0, 0, PX, PX);
  ctx.textBaseline = 'alphabetic';

  if (page.type === 'cover') {
    const img = await loadPhoto(page.photo);
    if (img) drawCover(ctx, img, 0, 0, PX, PX); else gradientFill(ctx, 0, 0, PX, PX);
    const g = ctx.createLinearGradient(0, PX * 0.45, 0, PX);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.75)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, PX, PX);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.font = `700 64px ${BRAND.body}`;
    ctx.fillText(fmt.range(trip.start, trip.end).toUpperCase(), M, PX - 520);
    ctx.fillStyle = '#fff';
    ctx.font = `700 260px ${BRAND.display}`;
    wrapText(ctx, trip.title, M, PX - 300, PX - 2 * M, 260, { maxLines: 2 });
    if (trip.companions?.length) {
      ctx.font = `500 66px ${BRAND.body}`;
      ctx.fillText(`Con ${fmt.list(trip.companions)}`, M, PX - 150);
    }
    return;
  }

  if (page.type === 'day') {
    gradientFill(ctx, 0, 0, PX, PX);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = `700 70px ${BRAND.body}`;
    ctx.fillText(`DÍA ${page.n}`, M, 900);
    ctx.fillStyle = '#fff';
    ctx.font = `700 200px ${BRAND.display}`;
    const h = wrapText(ctx, fmt.dayTitle(page.date), M, 1120, PX - 2 * M, 210, { maxLines: 2 });
    ctx.font = `400 72px ${BRAND.body}`;
    const route = [...new Set(page.stops.map((s) => s.name))].slice(0, 6).join(' · ');
    wrapText(ctx, route, M, 1120 + h + 60, PX - 2 * M, 100, { maxLines: 4 });
    folio(ctx, n, '#fff');
    return;
  }

  if (page.type === 'photo') {
    const p = page.photo;
    const img = await loadPhoto(p);
    const ph = 1560;
    ctx.save();
    ctx.beginPath(); ctx.rect(M, M, PX - 2 * M, ph); ctx.clip();
    let geo = null;
    if (img) geo = drawCover(ctx, img, M, M, PX - 2 * M, ph); else gradientFill(ctx, M, M, PX - 2 * M, ph);
    const hs = p.hotspots?.[0];
    if (hs && geo) drawTag(ctx, hs.name, geo.ox + hs.x * geo.sw, Math.min(M + ph - 80, geo.oy + hs.y * geo.sh), 2.4);
    ctx.restore();

    let y = M + ph + 130;
    ctx.fillStyle = BRAND.accent;
    ctx.font = `700 54px ${BRAND.body}`;
    ctx.fillText(`${(hs ? KIND_LABEL[hs.kind] || 'Lugar' : placeLine(p)).toUpperCase()} · ${fmt.shortDate(p.takenAt).toUpperCase()} · ${fmt.time(p.takenAt)}`, M, y);
    y += 120;
    ctx.fillStyle = BRAND.ink;
    ctx.font = `700 110px ${BRAND.display}`;
    y += wrapText(ctx, mainSubject(p) || placeLine(p), M, y, PX - 2 * M, 118, { maxLines: 1 });
    ctx.font = `400 58px ${BRAND.body}`;
    ctx.fillStyle = '#5a4d45';
    const cand = hs && p.candidates?.find((c) => c.id === hs.candidateId);
    const text = p.note?.text ? `«${p.note.text}»` : cand?.extract ? cand.extract.split(/(?<=[.!?])\s/)[0] : placeLine(p);
    wrapText(ctx, text, M, y + 10, PX - 2 * M, 80, { maxLines: 3 });
    folio(ctx, n, '#9b8f87');
    return;
  }

  // Cierre: los lugares del viaje y la firma.
  ctx.fillStyle = BRAND.ink;
  ctx.font = `700 150px ${BRAND.display}`;
  ctx.fillText('Los lugares', M, 420);
  const places = [...new Set(page.photos.flatMap((p) => (p.hotspots || []).map((h) => h.name)))].slice(0, 18);
  ctx.font = `400 64px ${BRAND.body}`;
  ctx.fillStyle = '#5a4d45';
  places.forEach((name, i) => {
    const col = i < 9 ? 0 : 1;
    ctx.fillText(`· ${name}`, M + col * (PX - 2 * M) / 2, 640 + (i % 9) * 110);
  });
  ctx.save();
  ctx.translate(M, PX - 330);
  ctx.fillStyle = BRAND.accent;
  ctx.fillRect(0, 0, 90, 90);
  drawLogo(ctx, 15, 15, 60);
  ctx.restore();
  ctx.fillStyle = BRAND.ink;
  ctx.font = `700 70px ${BRAND.display}`;
  ctx.fillText('Recuerdo', M + 130, PX - 262);
  ctx.font = `400 46px ${BRAND.body}`;
  ctx.fillStyle = '#7d726a';
  ctx.fillText('Tus viajes, con nombre e historia', M + 130, PX - 200);
}

function folio(ctx, n, color) {
  ctx.fillStyle = color;
  ctx.font = `600 40px ${BRAND.body}`;
  ctx.textAlign = 'right';
  ctx.fillText(String(n), PX - M, PX - 70);
  ctx.textAlign = 'left';
}

// PDF mínimo: una imagen JPEG a toda página por cada hoja. Sin dependencias.
function pdfFromJpegs(jpegs, wPx, hPx, wPt, hPt) {
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let size = 0;
  const push = (chunk) => { const b = typeof chunk === 'string' ? enc.encode(chunk) : chunk; parts.push(b); size += b.length; };
  const obj = (id, body) => { offsets[id] = size; push(`${id} 0 obj\n`); body(); push('\nendobj\n'); };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = jpegs.length;
  // 1 catálogo, 2 páginas, y por hoja: página (3+3i), contenido (4+3i), imagen (5+3i)
  const pageIds = jpegs.map((_, i) => 3 + i * 3);
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`));
  jpegs.forEach((jpg, i) => {
    const pid = 3 + i * 3, cid = pid + 1, iid = pid + 2;
    obj(pid, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << /Im${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>`));
    const content = `q ${wPt} 0 0 ${hPt} 0 0 cm /Im${i} Do Q`;
    obj(cid, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    obj(iid, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
      push(jpg);
      push('\nendstream');
    });
  });
  const total = 3 + n * 3;
  const xref = size;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let id = 1; id < total; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}
