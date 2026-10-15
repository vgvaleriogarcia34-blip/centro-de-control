// Medición de uso, anónima por diseño: solo nombres de evento y números sueltos.
// Sin identificador de dispositivo, sin cookies, sin ubicaciones ni nombres de lugares.
// Se envía al servidor de Recuerdo (/api/events) si existe; si no, solo se cuentan en el móvil.

import { kv } from './store.js';

let endpoint = null;
let checked = false;

async function resolveEndpoint() {
  if (checked) return endpoint;
  checked = true;
  try {
    const r = await fetch('api/health', { cache: 'no-store' });
    if (r.ok && (await r.json()).events) endpoint = 'api/events';
  } catch { /* sin servidor: solo recuento local */ }
  return endpoint;
}

// Solo admitimos valores simples para que nunca se cuele un dato personal por error.
function clean(props = {}) {
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string' && v.length <= 24 && /^[a-z0-9_-]+$/i.test(v)) out[k] = v;
  }
  return out;
}

export async function track(name, props) {
  const event = { e: name, p: clean(props), t: Math.floor(Date.now() / 1000) };
  try {
    const counts = await kv.get('metrics', {});
    counts[name] = (counts[name] || 0) + 1;
    await kv.set('metrics', counts);
  } catch { /* ignorar */ }
  const url = await resolveEndpoint();
  if (!url) return;
  const body = JSON.stringify(event);
  if (!navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) {
    fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
  }
}

export const localMetrics = () => kv.get('metrics', {});
