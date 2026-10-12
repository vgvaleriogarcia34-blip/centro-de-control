// Servidor de Recuerdo: sirve la app y, si hay credenciales de Anthropic, añade la IA de visión.
//   npm install && ANTHROPIC_API_KEY=... npm start      → http://localhost:8080
// Sin clave (o sin instalar dependencias) sirve la app igual: la identificación funciona por ubicación.

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;
const MODEL = process.env.RECUERDO_MODEL || 'claude-opus-5-5';

let client = null;
if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    client = new Anthropic();
  } catch {
    console.warn('Falta @anthropic-ai/sdk: ejecuta "npm install" para activar la IA.');
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
};

// ---------- Llamada a Claude con salida JSON garantizada ----------
async function askJSON({ system, content, schema, effort, maxTokens }) {
  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content }],
    output_config: { effort, format: { type: 'json_schema', schema } },
  };
  let res;
  try {
    // Si un clasificador de seguridad rechaza la petición, el servidor la reintenta con otro modelo.
    res = await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  } catch (err) {
    if (err?.status !== 400) throw err;
    res = await client.messages.create(params); // cuenta o plataforma sin la beta: petición estándar
  }
  if (res.stop_reason === 'refusal') throw Object.assign(new Error('refusal'), { status: 422 });
  if (res.stop_reason === 'max_tokens') throw Object.assign(new Error('respuesta truncada'), { status: 502 });
  const text = res.content.find((b) => b.type === 'text')?.text;
  return JSON.parse(text);
}

const IDENTIFY_SYSTEM = `Eres el guía de viajes de la app Recuerdo. Recibes una foto hecha por un turista, la dirección donde se hizo y una lista de lugares reales que había cerca (de OpenStreetMap y Wikipedia), con su distancia y si caían dentro del encuadre según la brújula del móvil.

Tu trabajo:
1. Señala en la imagen los elementos reconocibles que correspondan a lugares de la lista (fachadas, torres, puentes, el interior de una iglesia, la entrada de un restaurante). Para cada uno da su centro aproximado como fracción de la imagen: x (0 = borde izquierdo, 1 = derecho) e y (0 = arriba, 1 = abajo).
2. Usa candidate_id solo con ids de la lista. Si ves con total seguridad un monumento muy conocido que no está en la lista, puedes incluirlo con candidate_id vacío. Nunca inventes nombres de locales o lugares menores.
3. Si no reconoces ningún lugar de la lista en la imagen, devuelve hotspots vacío: es mejor no marcar nada que marcar algo equivocado.
4. fact: una observación breve sobre ese elemento tal y como se ve en esta foto (estilo, detalle visible), en español. Sin inventar fechas ni datos.
5. scene: una frase describiendo la escena (momento del día, ambiente, si hay gente). caption: una frase cálida en segunda persona para la historia del viaje, mencionando el lugar principal.
confidence entre 0 y 1. Máximo 4 hotspots.`;

const IDENTIFY_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['scene', 'caption', 'hotspots'],
  properties: {
    scene: { type: 'string' },
    caption: { type: 'string' },
    hotspots: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['candidate_id', 'name', 'kind', 'x', 'y', 'confidence', 'fact'],
        properties: {
          candidate_id: { type: 'string' }, name: { type: 'string' }, kind: { type: 'string' },
          x: { type: 'number' }, y: { type: 'number' }, confidence: { type: 'number' }, fact: { type: 'string' },
        },
      },
    },
  },
};

async function identify(body) {
  const { image, takenAt, heading, place, candidates = [] } = body;
  if (typeof image !== 'string' || image.length < 100) throw Object.assign(new Error('imagen no válida'), { status: 400 });
  const context = {
    hecha: takenAt, orientacion_camara_grados: heading,
    direccion: place, candidatos: candidates.slice(0, 12),
  };
  const out = await askJSON({
    system: IDENTIFY_SYSTEM,
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
      { type: 'text', text: `Datos de la foto:\n${JSON.stringify(context, null, 1)}` },
    ],
    schema: IDENTIFY_SCHEMA, effort: 'low', maxTokens: 4000,
  });
  const ids = new Set(candidates.map((c) => c.id));
  out.hotspots = (out.hotspots || [])
    .filter((h) => h.candidate_id === '' || ids.has(h.candidate_id))
    .map((h) => ({ ...h, candidate_id: h.candidate_id || null }))
    .slice(0, 4);
  return out;
}

const STORY_SYSTEM = `Eres el narrador de Recuerdo. Con los datos de un viaje (fotos ordenadas por hora, dónde se hizo cada una, qué lugar aparece, notas del viajero) escribes la historia del viaje en español, en segunda persona (plural si viajó acompañado, nombrando a los acompañantes con naturalidad).
Estructura: una diapositiva "chapter" de portada, una "chapter" por día si hay varios, y diapositivas "photo" para las fotos más significativas (favoritas, con nota o con lugar identificado; como mucho 4 por parada).
Cada texto: 1-3 frases, cálido y concreto, mencionando la hora o el momento del día y algún dato del lugar tomado SOLO del campo "about". Incluye las notas del viajero cuando existan. No inventes hechos que no estén en los datos.
photo_id: el id de la foto (en "chapter" puede ir vacío o con la foto de fondo). eyebrow: etiqueta corta (p. ej. "Día 1" o el tipo de lugar).`;

const STORY_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'slides'],
  properties: {
    title: { type: 'string' },
    slides: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['type', 'photo_id', 'eyebrow', 'title', 'text'],
        properties: {
          type: { type: 'string', enum: ['chapter', 'photo'] },
          photo_id: { type: 'string' }, eyebrow: { type: 'string' }, title: { type: 'string' }, text: { type: 'string' },
        },
      },
    },
  },
};

async function story(body) {
  const photos = (body.photos || []).slice(0, 300);
  const out = await askJSON({
    system: STORY_SYSTEM,
    content: [{ type: 'text', text: JSON.stringify({ ...body, photos }) }],
    schema: STORY_SCHEMA, effort: 'medium', maxTokens: 16000,
  });
  const ids = new Set(photos.map((p) => p.id));
  out.slides = out.slides.filter((s) => s.type === 'chapter' || ids.has(s.photo_id));
  return out;
}

// ---------- HTTP ----------
function readBody(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('demasiado grande'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(Object.assign(new Error('JSON no válido'), { status: 400 })); } });
    req.on('error', reject);
  });
}

function send(res, status, data, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(data) : data);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.endsWith('/api/health')) return send(res, 200, { ai: !!client, model: client ? MODEL : null });
    if (url.pathname.endsWith('/api/identify') && req.method === 'POST') {
      if (!client) return send(res, 503, { error: 'IA no configurada' });
      return send(res, 200, await identify(await readBody(req)));
    }
    if (url.pathname.endsWith('/api/story') && req.method === 'POST') {
      if (!client) return send(res, 503, { error: 'IA no configurada' });
      return send(res, 200, await story(await readBody(req, 2 * 1024 * 1024)));
    }
    // Ficheros estáticos
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (path.startsWith('..') || path.startsWith('server')) return send(res, 404, 'No encontrado', 'text/plain');
    let file = join(ROOT, path || 'index.html');
    const s = await stat(file).catch(() => null);
    if (s?.isDirectory()) file = join(file, 'index.html');
    else if (!s) file = join(ROOT, 'index.html');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch (err) {
    console.error(err.message);
    send(res, err.status || 500, { error: err.status ? err.message : 'Error interno' });
  }
});

server.listen(PORT, () => {
  console.log(`Recuerdo en http://localhost:${PORT}  ·  IA: ${client ? `activa (${MODEL})` : 'desactivada (sin ANTHROPIC_API_KEY)'}`);
});
