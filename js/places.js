// Fuentes de conocimiento sobre lugares, todas abiertas y gratuitas:
//  · OpenStreetMap / Nominatim → dirección: calle, barrio, pueblo, país.
//  · Wikipedia geosearch       → monumentos, iglesias, plazas... con artículo y foto.
//  · OpenStreetMap / Overpass  → restaurantes, cafés, bares y patrimonio sin artículo.
// Todo pasa por caché local: cada sitio se consulta una sola vez.

import { cached } from './store.js';
import { distance } from './geo.js';

let lang = 'es';
export const setLang = (l) => { lang = l || 'es'; };
export const getLang = () => lang;

// Nominatim pide como máximo 1 petición por segundo: cola con espaciado.
let nominatimChain = Promise.resolve();
function nominatimQueue(fn) {
  const run = nominatimChain.then(fn);
  nominatimChain = run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, 1100)));
  return run;
}

async function getJSON(url, opts = {}, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// ---------- Dirección ----------
export function reverseGeocode(lat, lon) {
  const key = `rev:${lang}:${lat.toFixed(4)},${lon.toFixed(4)}`;
  return cached(key, 180, () => nominatimQueue(async () => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=${lang}&lat=${lat}&lon=${lon}`;
    const j = await getJSON(url);
    const a = j.address || {};
    return {
      name: j.name || null,
      street: a.road || a.pedestrian || a.footway || a.square || null,
      number: a.house_number || null,
      neighbourhood: a.neighbourhood || a.quarter || a.suburb || a.city_district || null,
      city: a.city || a.town || a.village || a.hamlet || a.municipality || null,
      county: a.county || null,
      state: a.state || null,
      country: a.country || null,
      countryCode: (a.country_code || '').toUpperCase(),
      category: j.category, type: j.type,
    };
  }).catch(() => null));
}

// ---------- Clasificación ----------
const KIND_RULES = [
  ['catedral', /catedral|cathedral|cathédrale|duomo|kathedrale/i],
  ['iglesia', /iglesia|parroquia|basílica|basilica|church|église|chiesa|kirche|templo/i],
  ['capilla', /capilla|ermita|chapel|chapelle|cappella/i],
  ['monasterio', /monasterio|convento|abadía|monastery|convent|abbey|cartuja/i],
  ['palacio', /palacio|palace|palais|palazzo|alcázar|alcazar/i],
  ['castillo', /castillo|castle|château|castello|fortaleza|alcazaba|torre|tower/i],
  ['museo', /museo|museum|musée|pinacoteca|galería|gallery/i],
  ['plaza', /^plaza|^piazza|^place |square|^praça/i],
  ['puente', /puente|bridge|pont|ponte/i],
  ['parque', /parque|jardín|jardines|park|garden|jardin/i],
  ['mirador', /mirador|viewpoint|belvedere/i],
  ['calle', /^calle|^avenida|^paseo|^rúa|street|^via /i],
  ['teatro', /teatro|theatre|theater|ópera|opera/i],
  ['mercado', /mercado|market|marché/i],
  ['monumento', /monumento|estatua|fuente|arco|puerta|muralla|monument|statue|fountain|gate|wall/i],
];
export function kindFromName(name = '', desc = '') {
  const s = `${name} ${desc}`;
  for (const [k, re] of KIND_RULES) if (re.test(s)) return k;
  return 'lugar';
}
export const KIND_LABEL = {
  catedral: 'Catedral', iglesia: 'Iglesia', capilla: 'Capilla', monasterio: 'Monasterio', palacio: 'Palacio',
  castillo: 'Fortaleza', museo: 'Museo', plaza: 'Plaza', puente: 'Puente', parque: 'Parque', mirador: 'Mirador',
  calle: 'Calle', teatro: 'Teatro', mercado: 'Mercado', monumento: 'Monumento', lugar: 'Lugar de interés',
  restaurante: 'Restaurante', cafe: 'Café', bar: 'Bar', heladeria: 'Heladería', barrio: 'Barrio',
};
export const isFood = (k) => k === 'restaurante' || k === 'cafe' || k === 'bar' || k === 'heladeria';

// ---------- Monumentos con artículo (Wikipedia) ----------
export function nearbyWiki(lat, lon, radius = 600) {
  const key = `wiki:${lang}:${lat.toFixed(3)},${lon.toFixed(3)}:${radius}`;
  return cached(key, 60, async () => {
    const base = `https://${lang}.wikipedia.org/w/api.php?origin=*&format=json`;
    const geo = await getJSON(`${base}&action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=${Math.min(radius, 10000)}&gslimit=40`);
    const hits = geo?.query?.geosearch || [];
    if (!hits.length) return [];
    const ids = hits.map((h) => h.pageid).join('|');
    const det = await getJSON(`${base}&action=query&prop=pageimages|description|extracts|pageprops&ppprop=wikibase_item&exintro=1&explaintext=1&exsentences=3&exlimit=max&piprop=thumbnail&pithumbsize=800&pageids=${ids}`);
    const pages = det?.query?.pages || {};
    return hits.map((h) => {
      const p = pages[h.pageid] || {};
      const kind = kindFromName(h.title, p.description);
      return {
        id: `w:${h.pageid}`,
        source: 'wikipedia',
        name: h.title,
        lat: h.lat, lon: h.lon,
        kind,
        description: p.description || null,
        extract: p.extract || null,
        image: p.thumbnail?.source || null,
        wikidata: p.pageprops?.wikibase_item || null,
        wikiTitle: h.title,
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}`,
      };
    })
      // descartamos artículos que no son "lugares visitables" (barrios enteros, estaciones, empresas...)
      .filter((c) => !/^(Distrito|Barrio|Estación|Línea|Anexo:)/i.test(c.name));
  }).catch(() => []);
}

// ---------- Restaurantes y patrimonio sin artículo (OpenStreetMap) ----------
export function nearbyOSM(lat, lon) {
  const key = `osm:${lat.toFixed(4)},${lon.toFixed(4)}`;
  return cached(key, 30, async () => {
    const q = `[out:json][timeout:12];(
      nwr(around:90,${lat},${lon})["amenity"~"^(restaurant|cafe|bar|pub|ice_cream|fast_food)$"]["name"];
      nwr(around:250,${lat},${lon})["historic"]["name"];
      nwr(around:250,${lat},${lon})["amenity"="place_of_worship"]["name"];
      nwr(around:250,${lat},${lon})["tourism"~"^(attraction|museum|viewpoint|artwork)$"]["name"];
    );out center tags 60;`;
    const j = await getJSON('https://overpass-api.de/api/interpreter', {
      method: 'POST', body: 'data=' + encodeURIComponent(q),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, 9000);
    return (j.elements || []).map((e) => {
      const t = e.tags || {};
      const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
      if (la == null) return null;
      const amenity = t.amenity;
      let kind = { restaurant: 'restaurante', fast_food: 'restaurante', cafe: 'cafe', bar: 'bar', pub: 'bar', ice_cream: 'heladeria' }[amenity];
      if (!kind) kind = amenity === 'place_of_worship' ? kindFromName(t.name, 'iglesia') : kindFromName(t.name, t.historic || t.tourism || '');
      const name = t[`name:${lang}`] || t.name;
      let wikiTitle = null;
      if (t.wikipedia) { const [wl, ...rest] = t.wikipedia.split(':'); if (wl === lang) wikiTitle = rest.join(':'); }
      return {
        id: `o:${e.type[0]}${e.id}`,
        source: 'osm',
        name, lat: la, lon: lo, kind,
        cuisine: t.cuisine ? t.cuisine.split(';').map((s) => s.replace(/_/g, ' ')).slice(0, 3) : null,
        website: t.website || t['contact:website'] || null,
        wikidata: t.wikidata || null,
        wikiTitle,
        heritage: !!(t.heritage || t.historic),
        startDate: t.start_date || null,
        url: `https://www.openstreetmap.org/${e.type}/${e.id}`,
      };
    }).filter(Boolean);
  }).catch(() => []);
}

// Une ambas fuentes sin duplicados (mismo wikidata o mismo nombre a < 80 m).
export function mergeCandidates(wiki, osm, cam) {
  const out = [...wiki];
  for (const o of osm) {
    const dup = out.find((w) => (o.wikidata && w.wikidata === o.wikidata) ||
      (o.wikiTitle && w.wikiTitle === o.wikiTitle) ||
      (norm(w.name) === norm(o.name) && distance(w, o) < 80));
    if (dup) {
      dup.cuisine ||= o.cuisine; dup.website ||= o.website; dup.startDate ||= o.startDate;
      continue;
    }
    out.push(o);
  }
  for (const c of out) c.distance = Math.round(distance(cam, c));
  return out.sort((a, b) => a.distance - b.distance);
}
const norm = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// ---------- Ficha detallada al tocar ----------
export function wikiDetails(title, l = lang) {
  if (!title) return Promise.resolve(null);
  return cached(`wikidet:${l}:${title}`, 60, async () => {
    const base = `https://${l}.wikipedia.org/w/api.php?origin=*&format=json`;
    const j = await getJSON(`${base}&action=query&prop=extracts|pageimages|description|pageprops&ppprop=wikibase_item&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=1000&redirects=1&titles=${encodeURIComponent(title)}`);
    const p = Object.values(j?.query?.pages || {})[0];
    if (!p || p.missing !== undefined) return null;
    return { title: p.title, extract: p.extract || '', description: p.description || '', image: p.thumbnail?.source || null, wikidata: p.pageprops?.wikibase_item || null };
  }).catch(() => null);
}

// Del texto de Wikipedia sacamos un "¿Sabías que...?": una frase con fecha o cifra que no sea la primera.
export function pickFact(extract = '') {
  const sentences = extract.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g) || [];
  const rest = sentences.slice(1).map((s) => s.trim()).filter((s) => s.length > 40 && s.length < 260);
  return rest.find((s) => /\b(1[0-9]{3}|20[0-2][0-9]|siglo|century|metros|m de altura)\b/i.test(s)) || rest[0] || null;
}

export function splitParagraphs(extract = '', max = 3) {
  return extract.split(/\n+/).map((s) => s.trim()).filter(Boolean).slice(0, max);
}

// ---------- Datos rápidos (Wikidata): año, estilo, arquitecto, protección, altura ----------
const FACT_PROPS = { P571: 'inception', P84: 'architect', P149: 'style', P1435: 'heritage', P2048: 'height' };
export function wikidataFacts(qid) {
  if (!qid) return Promise.resolve(null);
  return cached(`wd:${lang}:${qid}`, 90, async () => {
    const base = 'https://www.wikidata.org/w/api.php?origin=*&format=json&action=wbgetentities';
    const j = await getJSON(`${base}&ids=${qid}&props=claims`);
    const claims = j?.entities?.[qid]?.claims || {};
    const val = (p) => (claims[p] || []).filter((c) => c.rank !== 'deprecated').map((c) => c.mainsnak?.datavalue?.value).filter(Boolean);
    const out = {};
    const inc = val('P571')[0];
    if (inc?.time) {
      const year = parseInt(inc.time.slice(0, 5), 10);
      out.inception = inc.precision <= 7 ? `Siglo ${roman(Math.ceil(Math.abs(year) / 100))}` : String(year);
    }
    const h = val('P2048')[0];
    if (h?.amount && /Q11573$/.test(h.unit || '')) out.height = `${Math.round(Math.abs(parseFloat(h.amount)))} m de altura`;
    const ids = { architect: val('P84').slice(0, 2), style: val('P149').slice(0, 1), heritage: val('P1435').slice(0, 2) };
    const all = [...new Set(Object.values(ids).flat().map((v) => v.id).filter(Boolean))];
    if (all.length) {
      const l = await getJSON(`${base}&ids=${all.join('|')}&props=labels&languages=${lang}|en`);
      const label = (id) => l?.entities?.[id]?.labels?.[lang]?.value || l?.entities?.[id]?.labels?.en?.value;
      for (const [k, arr] of Object.entries(ids)) {
        const names = arr.map((v) => label(v.id)).filter(Boolean);
        if (names.length) out[k] = names;
      }
    }
    return out;
  }).catch(() => null);
}
function roman(n) {
  const m = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let r = '';
  for (const [v, s] of [[20, 'XX'], ...m]) while (n >= v) { r += s; n -= v; }
  return r;
}

// ---------- Buscar un sitio por nombre (fotos sin GPS: «¿Dónde fue esto?») ----------
export function searchPlace(q) {
  return nominatimQueue(async () => {
    const j = await getJSON(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=${lang}&q=${encodeURIComponent(q)}`);
    const seen = new Set();
    return (j || []).filter((r) => !seen.has(r.display_name) && seen.add(r.display_name)).map((r) => {
      const a = r.address || {};
      return {
        lat: +r.lat, lon: +r.lon, label: r.display_name,
        name: r.name || a.city || a.town || a.village || q,
        place: {
          name: r.name || null, street: a.road || null, neighbourhood: a.neighbourhood || a.suburb || null,
          city: a.city || a.town || a.village || a.municipality || null, state: a.state || null,
          country: a.country || null, countryCode: (a.country_code || '').toUpperCase(),
        },
      };
    });
  });
}
