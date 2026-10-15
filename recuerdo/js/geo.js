// Geometría de la escena: distancias, rumbos y proyección de un lugar sobre la foto.

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function distance(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearing(a, b) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

// Diferencia angular con signo en (-180, 180]
export const angleDiff = (a, b) => ((b - a + 540) % 360) - 180;

// Campo de visión horizontal a partir de la focal equivalente a 35 mm (36 mm de ancho de sensor).
// Sin dato, 66° es lo típico de la cámara principal de un móvil (~26 mm).
export function horizontalFOV(focal35, landscape = true) {
  const f = focal35 || 26;
  const w = landscape ? 36 : 24;
  return deg(2 * Math.atan(w / (2 * f)));
}

// ¿Dónde aparece un lugar en la foto? Devuelve x (0-1) o null si queda fuera del encuadre.
export function projectX(cam, heading, fov, target, margin = 6) {
  const rel = angleDiff(heading, bearing(cam, target));
  if (Math.abs(rel) > fov / 2 + margin) return null;
  return Math.min(0.92, Math.max(0.08, 0.5 + rel / fov));
}

export function formatDistance(m) {
  if (m == null) return '';
  if (m < 1000) return `${Math.round(m / 5) * 5} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`;
}
