// Vídeo-recuerdo: la historia del viaje como vídeo vertical 1080×1920 con música,
// listo para Reels, TikTok, Estados de WhatsApp o guardarlo en el carrete.
// Se graba en el propio móvil (canvas + MediaRecorder): ninguna foto sale del dispositivo.

import { BRAND, fontsReady, loadPhoto, drawCover, gradientFill, wrapText, drawTag, drawLogo } from './render.js';
import { createMusic } from './music.js';

const W = 1080, H = 1920, FPS = 30;
const DUR = { chapter: 3.2, photo: 3.8, end: 2.6 };
const FADE = 0.45;

export const canRecordVideo = () => !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);

function pickMime() {
  // H.264 + AAC primero: es lo que reproducen todos los iPhone, Instagram y WhatsApp.
  const options = [
    'video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.4D401F,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a', 'video/mp4;codecs=avc1', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm',
  ];
  return options.find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
}

// De la historia completa nos quedamos con lo que cabe en ~60 s: portada, días y fotos con lugar.
function selectSlides(slides) {
  const out = [];
  let budget = 58 - DUR.end;
  for (const s of slides) {
    const d = s.type === 'chapter' ? DUR.chapter : DUR.photo;
    if (budget - d < 0) break;
    out.push(s);
    budget -= d;
  }
  return out;
}

export async function recordStoryVideo({ trip, slides, watermark = true, canvas, onProgress, signal }) {
  await fontsReady();
  const list = selectSlides(slides);
  const imgs = await Promise.all(list.map((s) => (s.photo ? loadPhoto(s.photo) : null)));
  const timeline = [];
  let t = 0;
  list.forEach((s, i) => { const d = s.type === 'chapter' ? DUR.chapter : DUR.photo; timeline.push({ s, img: imgs[i], start: t, dur: d }); t += d; });
  timeline.push({ s: { type: 'end' }, img: null, start: t, dur: DUR.end });
  const total = t + DUR.end;

  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(FPS);
  const music = createMusic(total + 0.5);
  if (music) music.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  const mimeType = pickMime();
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((r) => { rec.onstop = r; });

  await music?.start();
  rec.start(500);
  const t0 = performance.now();
  await new Promise((resolve) => {
    const frame = () => {
      if (signal?.aborted) return resolve();
      const now = (performance.now() - t0) / 1000;
      if (now >= total) return resolve();
      drawFrame(ctx, timeline, now, total, { trip, watermark });
      onProgress?.(now / total);
      requestAnimationFrame(frame);
    };
    frame();
  });
  rec.stop();
  await stopped;
  music?.stop();
  stream.getTracks().forEach((tr) => tr.stop());
  if (signal?.aborted) return null;
  const type = (mimeType || 'video/webm').split(';')[0];
  return { blob: new Blob(chunks, { type }), ext: type === 'video/mp4' ? 'mp4' : 'webm', seconds: Math.round(total) };
}

function drawFrame(ctx, timeline, now, total, opts) {
  const i = timeline.findIndex((x) => now < x.start + x.dur);
  const cur = timeline[Math.max(0, i)];
  const local = now - cur.start;
  drawSlide(ctx, cur, local, opts);
  // Fundido con la diapositiva siguiente al final de cada una.
  const next = timeline[i + 1];
  if (next && local > cur.dur - FADE) {
    ctx.save();
    ctx.globalAlpha = (local - (cur.dur - FADE)) / FADE;
    drawSlide(ctx, next, 0, opts);
    ctx.restore();
  }
  drawBars(ctx, timeline, now);
}

function drawSlide(ctx, { s, img, dur }, local, { trip, watermark }) {
  const p = Math.min(1, local / dur);
  ctx.fillStyle = BRAND.night;
  ctx.fillRect(0, 0, W, H);

  if (s.type === 'end') {
    gradientFill(ctx, 0, 0, W, H);
    drawLogo(ctx, W / 2 - 70, 640, 140);
    ctx.fillStyle = '#fff';
    ctx.font = `700 120px ${BRAND.display}`;
    ctx.textAlign = 'center'; ctx.fillText('Recuerdo', W / 2, 930);
    ctx.font = `500 46px ${BRAND.body}`;
    wrapText(ctx, 'Tus viajes, con nombre e historia', W / 2, 1020, 820, 60, { align: 'center' });
    ctx.font = `600 38px ${BRAND.body}`;
    ctx.globalAlpha = 0.9;
    ctx.fillText('Haz el tuyo', W / 2, 1220);
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
    return;
  }

  let geo = null;
  if (img) {
    geo = drawCover(ctx, img, 0, 0, W, H, { zoom: 1 + 0.08 * p, dx: -0.015 * p, dy: -0.01 * p });
  } else gradientFill(ctx, 0, 0, W, H);

  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(0,0,0,.45)'); shade.addColorStop(0.22, 'rgba(0,0,0,0)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0)'); shade.addColorStop(1, s.type === 'chapter' && img ? 'rgba(0,0,0,.85)' : 'rgba(0,0,0,.8)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);

  // Cabecera tipo historia: título del viaje.
  ctx.fillStyle = '#fff';
  ctx.font = `700 40px ${BRAND.body}`;
  ctx.fillText(trip.title, 64, 150);

  const appear = Math.min(1, local / 0.6);
  ctx.globalAlpha = appear;
  if (s.type === 'chapter') {
    ctx.font = `700 34px ${BRAND.body}`;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillText((s.eyebrow || '').toUpperCase(), 72, 1080);
    ctx.fillStyle = '#fff';
    ctx.font = `700 128px ${BRAND.display}`;
    const h = wrapText(ctx, s.title, 72, 1220, W - 144, 132, { maxLines: 3 });
    ctx.font = `400 46px ${BRAND.body}`;
    wrapText(ctx, s.text, 72, 1220 + h + 30, W - 144, 64, { maxLines: 5 });
  } else {
    if (s.tag && geo && local > 0.5) drawTag(ctx, s.tag.name, geo.ox + s.tag.x * geo.sw, Math.min(H * 0.62, geo.oy + s.tag.y * geo.sh), 1.6);
    ctx.font = `700 34px ${BRAND.body}`;
    ctx.fillStyle = BRAND.accent2;
    ctx.fillText((s.eyebrow || '').toUpperCase(), 72, 1380);
    ctx.fillStyle = '#fff';
    ctx.font = `700 96px ${BRAND.display}`;
    const h = wrapText(ctx, s.title, 72, 1490, W - 144, 104, { maxLines: 2 });
    ctx.font = `400 42px ${BRAND.body}`;
    wrapText(ctx, s.text, 72, 1490 + h + 20, W - 144, 58, { maxLines: 4 });
  }
  ctx.globalAlpha = 1;

  if (watermark) {
    ctx.globalAlpha = 0.85;
    drawLogo(ctx, W - 380, H - 118, 40);
    ctx.fillStyle = '#fff'; ctx.font = `600 32px ${BRAND.body}`;
    ctx.fillText('Hecho con Recuerdo', W - 330, H - 86);
    ctx.globalAlpha = 1;
  }
}

function drawBars(ctx, timeline, now) {
  const n = timeline.length, gap = 10, x0 = 48, w = (W - 96 - gap * (n - 1)) / n;
  timeline.forEach((x, k) => {
    const fill = Math.max(0, Math.min(1, (now - x.start) / x.dur));
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x0 + k * (w + gap), 60, w, 6);
    ctx.fillStyle = '#fff'; ctx.fillRect(x0 + k * (w + gap), 60, w * fill, 6);
  });
}
