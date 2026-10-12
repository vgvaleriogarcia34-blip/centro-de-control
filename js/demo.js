// Viaje de ejemplo: la primera vez que se abre la app ya hay algo que tocar (nada de pantallas vacías).
// Las imágenes son las fotos principales de los artículos de Wikipedia (licencias libres) y se
// resuelven al vuelo; los textos y posiciones vienen ya preparados, como si la app los hubiera identificado.

import { db, kv, cached } from './store.js';
import { demoArtSpots } from './demo-art.js';

// Sube este número cuando cambie el viaje de ejemplo: se vuelve a sembrar en los móviles que ya lo tenían.
const DEMO_VERSION = 2;
const ART = ["giralda", "catedral", "alcazar", "bar", "plaza", "torre", "setas", "basilica", "puente"];

const P = (o) => o;
const STOPS = [
  P({ t: '2025-05-14T10:12:00', wiki: 'Giralda', lat: 37.38618, lon: -5.99262, heading: 20,
    city: 'Sevilla', hood: 'Santa Cruz', street: 'Plaza Virgen de los Reyes',
    spot: { name: 'Giralda', kind: 'monumento', x: 0.5, y: 0.34,
      extract: 'La Giralda es el campanario de la catedral de Santa María de la Sede de Sevilla. Los dos tercios inferiores corresponden al alminar de la antigua mezquita almohade, del siglo XII, y el tercio superior es un remate renacentista. En su interior no hay escaleras: se sube por 35 rampas, pensadas para poder ascender a caballo.' },
    fav: true, note: 'Aquí Luis se empeñó en subir las 35 rampas sin parar. Llegamos sin aliento, pero qué vistas.' }),
  P({ t: '2025-05-14T10:48:00', wiki: 'Catedral de Sevilla', lat: 37.38581, lon: -5.99316, heading: 95,
    city: 'Sevilla', hood: 'Santa Cruz', street: 'Avenida de la Constitución',
    spot: { name: 'Catedral de Sevilla', kind: 'catedral', x: 0.5, y: 0.5,
      extract: 'La catedral de Santa María de la Sede de Sevilla es la catedral gótica con mayor superficie del mundo. Se empezó a construir en 1433 sobre la antigua mezquita mayor de la ciudad. En su interior se encuentra el monumento funerario de Cristóbal Colón.' } }),
  P({ t: '2025-05-14T12:05:00', wiki: 'Real Alcázar de Sevilla', lat: 37.38306, lon: -5.99028, heading: 160,
    city: 'Sevilla', hood: 'Santa Cruz', street: 'Patio de Banderas',
    spot: { name: 'Real Alcázar de Sevilla', kind: 'palacio', x: 0.5, y: 0.48,
      extract: 'El Real Alcázar de Sevilla es un conjunto palaciego amurallado construido en diferentes etapas históricas. Es el palacio real en uso más antiguo de Europa. Fue declarado Patrimonio de la Humanidad por la Unesco en 1987, junto con la catedral y el Archivo de Indias.' } }),
  P({ t: '2025-05-14T14:20:00', wiki: 'El Rinconcillo', lat: 37.39459, lon: -5.98774, heading: 300,
    city: 'Sevilla', hood: 'Santa Catalina', street: 'Calle Gerona',
    spot: { name: 'El Rinconcillo', kind: 'bar', x: 0.5, y: 0.6,
      extract: 'El Rinconcillo es una taberna situada en el centro de Sevilla. Abrió sus puertas en 1670 y está considerada la más antigua de la ciudad. Es conocida por anotar la cuenta con tiza sobre el mostrador de madera.' },
    note: 'Espinacas con garbanzos y la cuenta apuntada con tiza en la barra.' }),
  P({ t: '2025-05-14T18:35:00', wiki: 'Plaza de España (Sevilla)', lat: 37.37720, lon: -5.98690, heading: 120,
    city: 'Sevilla', hood: 'Parque de María Luisa', street: 'Avenida de Isabel la Católica',
    spot: { name: 'Plaza de España', kind: 'plaza', x: 0.5, y: 0.46,
      extract: 'La plaza de España de Sevilla es un conjunto arquitectónico situado en el parque de María Luisa. Fue diseñada por el arquitecto Aníbal González para la Exposición Iberoamericana de 1929. Sus bancos de azulejos representan las provincias de España.' },
    fav: true }),
  P({ t: '2025-05-14T21:10:00', wiki: 'Torre del Oro', lat: 37.38243, lon: -5.99637, heading: 210,
    city: 'Sevilla', hood: 'El Arenal', street: 'Paseo de Cristóbal Colón',
    spot: { name: 'Torre del Oro', kind: 'castillo', x: 0.5, y: 0.42,
      extract: 'La Torre del Oro es una torre albarrana de Sevilla situada junto al río Guadalquivir. Fue construida por los almohades entre 1220 y 1221 para controlar el acceso al puerto. Hoy alberga un museo naval.' } }),
  P({ t: '2025-05-15T10:30:00', wiki: 'Metropol Parasol', lat: 37.39330, lon: -5.99170, heading: 45,
    city: 'Sevilla', hood: 'La Encarnación', street: 'Plaza de la Encarnación',
    spot: { name: 'Metropol Parasol', kind: 'monumento', x: 0.5, y: 0.4,
      extract: 'El Metropol Parasol, conocido popularmente como «las Setas», es una estructura de madera situada en la plaza de la Encarnación. Diseñada por el arquitecto alemán Jürgen Mayer, se inauguró en 2011. En su sótano se conservan restos arqueológicos romanos y andalusíes.' } }),
  P({ t: '2025-05-15T12:15:00', wiki: 'Basílica de la Macarena', lat: 37.40030, lon: -5.98920, heading: 350,
    city: 'Sevilla', hood: 'La Macarena', street: 'Calle Bécquer',
    spot: { name: 'Basílica de la Macarena', kind: 'iglesia', x: 0.5, y: 0.47,
      extract: 'La basílica de Santa María de la Esperanza Macarena es un templo católico de Sevilla. Se construyó a mediados del siglo XX junto a la muralla y el arco de la Macarena. En ella se venera la imagen de la Esperanza Macarena, una de las devociones más populares de la Semana Santa sevillana.' } }),
  P({ t: '2025-05-15T18:05:00', wiki: 'Puente de Isabel II', lat: 37.38560, lon: -6.00080, heading: 260,
    city: 'Sevilla', hood: 'Triana', street: 'Puente de Isabel II',
    spot: { name: 'Puente de Triana', kind: 'puente', x: 0.5, y: 0.52,
      extract: 'El puente de Isabel II, conocido como puente de Triana, une el centro de Sevilla con el barrio de Triana sobre el Guadalquivir. Se inauguró en 1852 y es uno de los puentes de hierro más antiguos de España que se conservan.' },
    fav: true, note: 'Atardecer en Triana. Marta dice que es el mejor momento de todo el viaje.' }),
];

export async function seedDemo(force = false) {
  const seeded = await kv.get('demoSeeded');
  const version = await kv.get('demoVersion', 1);
  if (!force && seeded && (version >= DEMO_VERSION || !(await db.get('trips', 'demo-sevilla')))) return null;
  const tripId = 'demo-sevilla';
  const photos = STOPS.map((s, i) => {
    const id = `demo-${i}`;
    const candId = `demo-c${i}`;
    const art = ART[i];
    const spot = demoArtSpots(art)[0] || { x: s.spot.x, y: s.spot.y };
    return {
      id, tripId, demo: true, name: `${s.wiki}.jpg`, art, wikiTitle: s.wiki,
      takenAt: s.t, lat: s.lat, lon: s.lon, heading: s.heading, focal35: 26, w: 3, h: 4,
      place: { city: s.city, neighbourhood: s.hood, street: s.street, state: 'Andalucía', country: 'España', countryCode: 'ES' },
      candidates: [{ id: candId, source: 'wikipedia', name: s.spot.name, kind: s.spot.kind, extract: s.spot.extract,
        wikiTitle: s.wiki, url: `https://es.wikipedia.org/wiki/${encodeURIComponent(s.wiki.replace(/ /g, '_'))}`, distance: 40 + i * 7, lat: s.lat, lon: s.lon }],
      hotspots: [{ id: `h${i}`, candidateId: candId, name: s.spot.name, kind: s.spot.kind, x: spot.x, y: spot.y, confidence: 0.9, source: 'geo' }],
      status: 'geo', fav: !!s.fav,
      note: s.note ? { text: s.note } : null,
    };
  });
  await db.put('trips', {
    id: tripId, demo: true, title: 'Sevilla', cities: ['Sevilla'], country: 'España',
    start: STOPS[0].t, end: STOPS[STOPS.length - 1].t, coverId: 'demo-4',
    companions: ['Marta', 'Luis'], createdAt: new Date().toISOString(),
  });
  for (const p of photos) await db.put('photos', p);
  await kv.set('demoSeeded', true);
  await kv.set('demoVersion', DEMO_VERSION);
  return tripId;
}

// Imagen principal del artículo de Wikipedia (se guarda en caché para la próxima vez).
export function wikiImage(title, size = 'thumb') {
  return cached(`wikiimg:${title}`, 30, async () => {
    const r = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
    if (!r.ok) return null;
    const j = await r.json();
    const thumb = j.thumbnail?.source || null;
    // Las miniaturas de Wikimedia admiten cualquier ancho en la URL: pedimos 1280 px para el visor.
    // Sin pasarnos del ancho original (Wikimedia no amplía).
    const ow = j.originalimage?.width || 1280;
    const sized = (w) => (thumb && /\/\d+px-/.test(thumb) && w < ow ? thumb.replace(/\/\d+px-/, `/${w}px-`) : j.originalimage?.source || thumb);
    return { thumb: sized(480), full: sized(1280) };
  }).then((v) => (v ? (size === 'full' ? v.full : v.thumb) : null)).catch(() => null);
}

