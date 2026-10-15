// Motor de identificación: de una foto (GPS + hora + orientación) a "qué hay en ella".
//
// 1. Dirección exacta (calle, barrio, pueblo).
// 2. Lugares cercanos de Wikipedia + OpenStreetMap.
// 3. Si la foto sabe hacia dónde miraba la cámara, proyectamos cada lugar sobre el
//    encuadre: así sabemos qué edificio está a la izquierda, al centro o a la derecha.
// 4. Opcional: la IA de visión (servidor) mira la imagen, confirma cuál es cada edificio
//    entre los candidatos reales y ajusta la posición de los puntos.

import { reverseGeocode, nearbyWiki, nearbyOSM, mergeCandidates, isFood, kindFromName } from './places.js';
import { horizontalFOV, projectX, angleDiff, bearing, distance } from './geo.js';
import { ai } from './ai.js';

// Lo que sabemos de un punto del mapa. Se pide una vez por parada y se reutiliza para todas
// sus fotos: es lo que hace la importación 5-10 veces más rápida.
export async function gatherContext(lat, lon) {
  const [place, wiki, osm] = await Promise.all([
    reverseGeocode(lat, lon),
    nearbyWiki(lat, lon, 700),
    nearbyOSM(lat, lon),
  ]);
  return { lat, lon, place, wiki, osm };
}

export async function identifyPhoto(photo, { imageBlob, onStep, context } = {}) {
  if (photo.lat == null) {
    photo.status = 'nogps';
    return photo;
  }
  const cam = { lat: photo.lat, lon: photo.lon };
  // Ubicación puesta a mano («fue en Toledo»): sabemos el sitio, no el encuadre.
  if (photo.approx === 'manual') { photo.status = 'geo'; photo.hotspots = []; return photo; }
  onStep?.('place');
  const ctx = context && distance(context, cam) < 80 ? context : await gatherContext(cam.lat, cam.lon);
  const { place } = ctx;
  photo.place = place;
  onStep?.('pois');
  // Copias: los mismos candidatos se puntúan distinto en cada foto.
  const wiki = ctx.wiki.map((o) => ({ ...o })), osm = ctx.osm.map((o) => ({ ...o }));
  const all = mergeCandidates(wiki, osm, cam).filter((c) => c.distance < (isFood(c.kind) ? 90 : 700));
  // Respaldo: el geocodificador suele nombrar el sitio exacto donde estabas («Torre del Oro»).
  // Si las otras fuentes no lo tienen (o no responden), lo añadimos como candidato "aquí mismo".
  const here = hereCandidate(place);
  if (here && !all.some((c) => c.name.toLowerCase() === here.name.toLowerCase())) all.push({ ...here, lat: cam.lat, lon: cam.lon, distance: 0, here: true });

  const landscape = (photo.w || 4) >= (photo.h || 3);
  const fov = horizontalFOV(photo.focal35, landscape);
  const hasHeading = typeof photo.heading === 'number';

  // Puntuación: cercanía + estar en el encuadre + tener artículo (más "monumento").
  for (const c of all) {
    let s = 1 / (1 + c.distance / 120);
    if (c.source === 'wikipedia') s += 0.35;
    if (c.heritage) s += 0.1;
    if (c.here) { c.inView = true; c.x = 0.5; c.score = 0.5; continue; } // respaldo: por detrás de lo que sí está en el encuadre
    if (hasHeading) {
      const rel = Math.abs(angleDiff(photo.heading, bearing(cam, c)));
      c.inView = rel <= fov / 2 + 6;
      c.x = projectX(cam, photo.heading, fov, c);
      s += c.inView ? 0.6 : -0.5;
    }
    if (isFood(c.kind)) s += c.distance < 25 ? 0.4 : -0.2;
    c.score = +s.toFixed(3);
  }
  all.sort((a, b) => b.score - a.score);
  photo.candidates = all.slice(0, 10).map(slim);

  // Ubicación estimada por la hora (foto sin GPS): mostramos lo cercano, pero sin marcar nada en la imagen.
  photo.hotspots = photo.approx ? [] : placeHotspots(all, { hasHeading });
  photo.status = 'geo';

  if (imageBlob && (await ai.available())) {
    onStep?.('ai');
    try {
      const res = await ai.identify(imageBlob, photo);
      if (res?.hotspots?.length) {
        photo.hotspots = res.hotspots.map((hs, i) => {
          const c = photo.candidates.find((k) => k.id === hs.candidate_id);
          return {
            id: `h${i}`, candidateId: c?.id || null,
            name: c?.name || hs.name, kind: c?.kind || hs.kind || 'lugar',
            x: clamp(hs.x), y: clamp(hs.y), confidence: hs.confidence ?? 0.8,
            fact: hs.fact || null, source: 'ai',
          };
        });
      }
      if (res?.caption) photo.aiCaption = res.caption;
      if (res?.scene) photo.aiScene = res.scene;
      photo.status = 'ai';
    } catch (e) {
      console.warn('IA no disponible para esta foto', e);
    }
  }
  return photo;
}

const HERE_CATEGORIES = new Set(['tourism', 'historic', 'amenity', 'building', 'leisure', 'man_made']);
const FOOD_TYPES = { restaurant: 'restaurante', fast_food: 'restaurante', cafe: 'cafe', bar: 'bar', pub: 'bar', ice_cream: 'heladeria' };
function hereCandidate(place) {
  if (!place?.name || !HERE_CATEGORIES.has(place.category)) return null;
  if (place.name === place.street) return null;
  const kind = FOOD_TYPES[place.type] || kindFromName(place.name, place.type === 'place_of_worship' ? 'iglesia' : '');
  return { id: `n:${place.name}`, source: 'osm', name: place.name, kind, description: null, extract: null, image: null, wikiTitle: isFood(kind) ? null : place.name, url: null };
}

function placeHotspots(all, { hasHeading }) {
  const spots = [];
  if (hasHeading) {
    // Hasta 3 puntos en el encuadre, separados entre sí para que no se pisen.
    for (const c of all) {
      if (!c.inView || c.x == null) continue;
      if (spots.some((s) => Math.abs(s.x - c.x) < 0.16)) continue;
      const food = isFood(c.kind);
      const y = food ? 0.66 : c.distance < 120 ? 0.46 : c.distance < 300 ? 0.42 : 0.38;
      spots.push(spot(c, c.x, y, Math.min(0.92, 0.45 + c.score / 3)));
      if (spots.length === 3) break;
    }
  } else {
    // Sin brújula no sabemos hacia dónde miraba: solo marcamos lo que está casi encima.
    const near = all.find((c) => c.distance < 70 && !isFood(c.kind)) || all.find((c) => c.distance < 20);
    if (near) spots.push(spot(near, 0.5, isFood(near.kind) ? 0.62 : 0.45, near.distance < 35 ? 0.7 : 0.5));
  }
  return spots;
}

const spot = (c, x, y, confidence) => ({
  id: `h-${c.id}`, candidateId: c.id, name: c.name, kind: c.kind,
  x: +x.toFixed(3), y: +y.toFixed(3), confidence: +confidence.toFixed(2), source: 'geo',
});
const clamp = (v) => Math.min(0.95, Math.max(0.05, Number(v) || 0.5));

function slim(c) {
  const { id, source, name, lat, lon, kind, description, extract, image, wikiTitle, wikidata, url, cuisine, website, startDate, distance, inView, score } = c;
  return { id, source, name, lat, lon, kind, description, extract, image, wikiTitle, wikidata, url, cuisine, website, startDate, distance, inView, score };
}

// Nombre corto y humano del sitio de la foto: "Barrio de Santa Cruz, Sevilla".
export function placeLine(photo) {
  const p = photo.place;
  if (!p) return photo.status === 'pending' ? 'Reconociendo el lugar…' : photo.lat != null ? 'Ubicación guardada' : 'Sin ubicación';
  const parts = [p.neighbourhood || p.street, p.city || p.county].filter(Boolean);
  return [...new Set(parts)].join(', ') || p.country || 'Ubicación guardada';
}

export function mainSubject(photo) {
  const hs = photo.hotspots?.[0];
  if (hs) return hs.name;
  return photo.place?.name || photo.place?.street || photo.place?.city || null;
}
