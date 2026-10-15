// Puente con el servidor de IA (opcional). Si la app se sirve sin servidor (p. ej. GitHub Pages)
// todo sigue funcionando con la identificación por geolocalización y la narración local.

let health = null;

async function check() {
  if (health) return health;
  health = fetch('api/health', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : { ai: false }))
    .catch(() => ({ ai: false }));
  return health;
}

async function toBase64JPEG(blob, max = 1280) {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const data = c.toDataURL('image/jpeg', 0.82);
  return data.slice(data.indexOf(',') + 1);
}

async function post(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

export const ai = {
  async available() {
    let off = false;
    try { off = localStorage.getItem('recuerdo.ai') === 'off'; } catch { /* almacenamiento bloqueado */ }
    if (off) return false;
    return !!(await check()).ai;
  },
  async status() { return check(); },

  async identify(imageBlob, photo) {
    const image = await toBase64JPEG(imageBlob);
    return post('api/identify', {
      image,
      takenAt: photo.takenAt,
      heading: photo.heading ?? null,
      place: photo.place,
      candidates: (photo.candidates || []).map(({ id, name, kind, description, distance, inView }) => ({ id, name, kind, description, distance, inView })),
    });
  },

  // Narración completa del viaje en capítulos, escrita por la IA con los datos ya identificados.
  async story(payload) { return post('api/story', payload); },
};
