// Ilustraciones del viaje de ejemplo: postales planas dibujadas en SVG dentro de la app.
// Cargan al instante, funcionan sin conexión y los puntos caen exactamente sobre cada monumento
// porque las coordenadas salen del mismo dibujo. Lienzo 300×400 (vertical 3:4, como una foto de móvil).

const W = 300, H = 400;

const SKIES = {
  morning: ['#7fb3d8', '#cfe3ee', '#f6e2c4'],
  noon: ['#3f8fd0', '#86c0e6', '#d9ecf5'],
  evening: ['#3b2a5a', '#d0604a', '#f4b065'],
  night: ['#0d1430', '#1e2b5a', '#40456e'],
  sunset: ['#4a2a5e', '#e2634a', '#f7c06a'],
};

function sky(kind, sun) {
  const [a, b, c] = SKIES[kind];
  let s = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  if (sun) s += `<circle cx="${sun[0]}" cy="${sun[1]}" r="${sun[2]}" fill="${sun[3]}" opacity="${sun[4] ?? 0.9}"/>`;
  if (kind === 'night') s += Array.from({ length: 26 }, (_, i) => `<circle cx="${(i * 97) % W}" cy="${(i * 53) % 170}" r="${i % 3 ? 0.8 : 1.3}" fill="#fff" opacity=".8"/>`).join('');
  return s;
}

const windows = (x0, y0, cols, rows, dx, dy, w, h, fill = '#3a2420', op = 0.55) => {
  let s = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) s += `<rect x="${x0 + c * dx}" y="${y0 + r * dy}" width="${w}" height="${h}" rx="${w / 2}" fill="${fill}" opacity="${op}"/>`;
  return s;
};

const palm = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 C2 -30 -2 -60 2 -90" stroke="#5b3b22" stroke-width="5" fill="none"/>
  ${[-60, -20, 20, 60, 100, 140].map((a) => `<path d="M2 -90 q${Math.cos((a * Math.PI) / 180) * 22} ${-10 + Math.sin((a * Math.PI) / 180) * 10} ${Math.cos((a * Math.PI) / 180) * 40} ${Math.sin((a * Math.PI) / 180) * 26 + 6}" stroke="#2f6b3f" stroke-width="6" fill="none" stroke-linecap="round"/>`).join('')}</g>`;

const people = (y, n = 5, seed = 1) => Array.from({ length: n }, (_, i) => {
  const x = 30 + ((i * 61 + seed * 37) % 240);
  const c = ['#2b2b3a', '#8a3b3b', '#3b5a8a', '#5a3b6b', '#2f5f4f'][(i + seed) % 5];
  return `<g transform="translate(${x} ${y})"><circle cx="0" cy="-22" r="5" fill="#3a2a22"/><rect x="-5" y="-17" width="10" height="17" rx="4" fill="${c}"/></g>`;
}).join('');

// Cada escena devuelve { svg, spots: [{ x, y }] } con x/y en fracción del lienzo.
const SCENES = {
  giralda: () => ({
    svg: `${sky('morning', [235, 90, 26, '#fff4d6'])}
      <path d="M0 300 L30 262 L60 300 L90 268 L118 300 V400 H0 Z" fill="#b98762"/>
      <path d="M182 296 L210 258 L240 296 L270 262 L300 290 V400 H182 Z" fill="#a8775a"/>
      <rect x="125" y="140" width="50" height="230" fill="#e6c39a"/><rect x="125" y="140" width="10" height="230" fill="#cfa57a"/>
      ${windows(137, 170, 2, 5, 16, 38, 8, 20)}
      <rect x="129" y="100" width="42" height="42" fill="#efd3aa"/>${windows(137, 108, 2, 1, 16, 0, 9, 26)}
      <rect x="134" y="74" width="32" height="28" fill="#e6c39a"/><rect x="140" y="52" width="20" height="24" fill="#dcb582"/>
      <path d="M150 22 L156 52 H144 Z" fill="#c99a66"/><circle cx="150" cy="18" r="5" fill="#f2c25b"/>
      <rect x="0" y="360" width="300" height="40" fill="#cdb39a"/>${people(372, 6, 1)}`,
    spots: [{ x: 0.5, y: 0.3 }],
  }),
  catedral: () => ({
    svg: `${sky('morning', [60, 70, 20, '#fff4d6'])}
      <rect x="22" y="170" width="256" height="200" fill="#d9b48a"/>
      ${[22, 70, 118, 166, 214, 262].map((x) => `<path d="M${x} 170 L${x + 8} 128 L${x + 16} 170 Z" fill="#c99d70"/>`).join('')}
      <path d="M110 170 L150 96 L190 170 Z" fill="#cfa77c"/>
      <circle cx="150" cy="214" r="30" fill="#a8774f"/><circle cx="150" cy="214" r="22" fill="#5a3a5e"/>
      ${Array.from({ length: 8 }, (_, i) => `<line x1="150" y1="214" x2="${150 + Math.cos((i * Math.PI) / 4) * 22}" y2="${214 + Math.sin((i * Math.PI) / 4) * 22}" stroke="#e8c37a" stroke-width="2"/>`).join('')}
      <path d="M118 370 V292 Q150 250 182 292 V370 Z" fill="#6b4630"/><path d="M128 370 V298 Q150 268 172 298 V370 Z" fill="#3e2a1e"/>
      ${windows(44, 240, 2, 1, 30, 0, 12, 50)}${windows(222, 240, 2, 1, 30, 0, 12, 50)}
      <rect x="0" y="366" width="300" height="34" fill="#c9b49c"/>${people(380, 5, 2)}`,
    spots: [{ x: 0.5, y: 0.535 }],
  }),
  alcazar: () => ({
    svg: `${sky('noon', [250, 60, 22, '#fffbe6'])}
      <rect x="20" y="190" width="260" height="140" fill="#e8d2b0"/>
      ${Array.from({ length: 13 }, (_, i) => `<rect x="${20 + i * 20}" y="178" width="12" height="14" fill="#e8d2b0"/>`).join('')}
      ${[60, 150, 240].map((x) => `<path d="M${x - 26} 330 V262 A26 30 0 1 1 ${x + 26} 262 V330 Z" fill="#7a4a2e"/><path d="M${x - 20} 330 V264 A20 24 0 1 1 ${x + 20} 264 V330 Z" fill="#2f4a3a"/>`).join('')}
      <rect x="20" y="206" width="260" height="8" fill="#3f7a9a" opacity=".55"/>
      <rect x="0" y="330" width="300" height="70" fill="#9fc0a8"/><rect x="70" y="346" width="160" height="30" rx="4" fill="#5aa0c4"/>
      ${palm(30, 360, 1)}${palm(272, 356, 0.9)}`,
    spots: [{ x: 0.5, y: 0.66 }],
  }),
  bar: () => ({
    svg: `${sky('noon')}
      <rect x="0" y="40" width="300" height="330" fill="#f1e6d2"/>
      <rect x="0" y="40" width="300" height="16" fill="#c9a77d"/>
      <rect x="40" y="128" width="220" height="40" rx="4" fill="#5a2a1e"/>
      <text x="150" y="155" text-anchor="middle" font-family="Georgia, serif" font-size="20" font-weight="700" fill="#f2d39a" letter-spacing="3">TABERNA · 1670</text>
      <rect x="40" y="190" width="100" height="150" fill="#3a2418"/><rect x="48" y="198" width="84" height="80" fill="#f5b55d" opacity=".85"/>
      <rect x="170" y="190" width="90" height="150" fill="#3a2418"/><rect x="178" y="198" width="74" height="142" fill="#2a1a12"/>
      ${Array.from({ length: 15 }, (_, i) => `<rect x="${i * 20}" y="340" width="20" height="20" fill="${i % 2 ? '#2f6aa0' : '#e8c35a'}"/>`).join('')}
      ${windows(60, 210, 3, 2, 22, 30, 10, 18, '#6b3a1e', 0.7)}
      <rect x="0" y="360" width="300" height="40" fill="#8f7a66"/>${people(392, 3, 4)}`,
    spots: [{ x: 0.5, y: 0.37 }],
  }),
  plaza: () => ({
    svg: `${sky('evening', [150, 120, 30, '#ffcf8a', 0.8])}
      <rect x="22" y="110" width="40" height="190" fill="#c7764e"/><path d="M18 110 L42 70 L66 110 Z" fill="#8a4a2e"/>
      <rect x="238" y="110" width="40" height="190" fill="#c7764e"/><path d="M234 110 L258 70 L282 110 Z" fill="#8a4a2e"/>
      <path d="M62 300 V200 Q150 168 238 200 V300 Z" fill="#d08a5e"/>
      ${Array.from({ length: 9 }, (_, i) => `<path d="M${72 + i * 18} 300 V262 A8 10 0 0 1 ${88 + i * 18} 262 V300 Z" fill="#6b3a24"/>`).join('')}
      ${windows(76, 214, 8, 1, 18, 0, 8, 18, '#6b3a24', 0.7)}
      <rect x="0" y="300" width="300" height="34" fill="#4e86b0"/><path d="M60 300 Q150 286 240 300" stroke="#e8e0d0" stroke-width="5" fill="none"/>
      <path d="M120 318 h40 l-6 8 h-28 Z" fill="#7a3a2a"/>
      ${Array.from({ length: 15 }, (_, i) => `<rect x="${i * 20}" y="334" width="20" height="10" fill="${i % 2 ? '#2f6aa0' : '#f2f0e8'}"/>`).join('')}
      <rect x="0" y="344" width="300" height="56" fill="#d9b48a"/>${people(380, 6, 3)}`,
    spots: [{ x: 0.5, y: 0.6 }],
  }),
  torre: () => ({
    svg: `${sky('night', [240, 70, 18, '#f6f1d8'])}
      <rect x="0" y="310" width="300" height="90" fill="#1f3354"/>
      ${Array.from({ length: 12 }, (_, i) => `<rect x="${10 + i * 25}" y="${330 + (i % 3) * 18}" width="14" height="2" fill="#f5c46a" opacity=".6"/>`).join('')}
      <rect x="112" y="170" width="76" height="140" fill="#d9a55a"/><rect x="112" y="170" width="18" height="140" fill="#b9853f"/>
      ${Array.from({ length: 6 }, (_, i) => `<rect x="${112 + i * 13}" y="160" width="9" height="12" fill="#d9a55a"/>`).join('')}
      <rect x="128" y="118" width="44" height="44" fill="#e3b46a"/>${Array.from({ length: 4 }, (_, i) => `<rect x="${128 + i * 12}" y="110" width="8" height="10" fill="#e3b46a"/>`).join('')}
      <path d="M138 110 Q150 84 162 110 Z" fill="#f2c45a"/>
      ${windows(132, 196, 3, 3, 14, 34, 6, 16, '#3a2a18', 0.7)}
      <rect x="0" y="296" width="300" height="16" fill="#3a3a48"/>`,
    spots: [{ x: 0.5, y: 0.52 }],
  }),
  setas: () => ({
    svg: `${sky('noon', [60, 60, 20, '#fffbe6'])}
      ${[60, 150, 240].map((x) => `<rect x="${x - 14}" y="180" width="28" height="190" fill="#e9d9b4"/>`).join('')}
      <path d="M0 150 Q40 90 80 140 Q120 80 160 130 Q200 70 240 128 Q275 90 300 120 V196 Q260 220 220 190 Q180 226 140 192 Q100 226 60 196 Q30 220 0 200 Z" fill="#efe1bd"/>
      ${Array.from({ length: 14 }, (_, i) => `<line x1="${i * 22}" y1="96" x2="${i * 22 + 10}" y2="224" stroke="#c9b48a" stroke-width="2"/>`).join('')}
      ${Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${120 + i * 16}" x2="300" y2="${112 + i * 16}" stroke="#c9b48a" stroke-width="2" opacity=".8"/>`).join('')}
      <rect x="0" y="370" width="300" height="30" fill="#bfae96"/>${people(392, 7, 5)}`,
    spots: [{ x: 0.5, y: 0.36 }],
  }),
  basilica: () => ({
    svg: `${sky('noon')}
      <rect x="50" y="150" width="200" height="220" fill="#f4efe6"/>
      <rect x="50" y="150" width="200" height="10" fill="#d7a64e"/><rect x="50" y="360" width="200" height="10" fill="#d7a64e"/>
      <path d="M110 150 V110 H190 V150 Z" fill="#f4efe6"/><path d="M104 110 L150 70 L196 110 Z" fill="#d7a64e"/>
      ${windows(125, 118, 2, 1, 36, 0, 14, 22, '#5a4632', 0.8)}
      <path d="M120 370 V282 Q150 250 180 282 V370 Z" fill="#d7a64e"/><path d="M128 370 V288 Q150 264 172 288 V370 Z" fill="#4a3424"/>
      ${windows(70, 190, 2, 2, 140, 80, 14, 40, '#5a4632', 0.7)}
      <circle cx="150" cy="215" r="16" fill="#d7a64e"/><circle cx="150" cy="215" r="10" fill="#6a5a8a"/>
      <rect x="0" y="370" width="300" height="30" fill="#c9b49c"/>${people(392, 4, 6)}`,
    spots: [{ x: 0.5, y: 0.52 }],
  }),
  puente: () => ({
    svg: `${sky('sunset', [215, 205, 34, '#ffd27a', 0.95])}
      <path d="M0 196 L40 186 L80 192 L120 182 L170 190 L220 180 L300 188 V230 H0 Z" fill="#6b3f4a"/>
      <rect x="0" y="232" width="300" height="168" fill="#3e5f86"/>
      <rect x="215" y="240" width="40" height="120" fill="#ffcf7a" opacity=".25"/>
      <rect x="0" y="226" width="300" height="12" fill="#2a2a34"/>
      ${[50, 150, 250].map((x) => `<path d="M${x - 50} 238 A50 46 0 0 0 ${x + 50} 238" stroke="#2a2a34" stroke-width="6" fill="none"/>${Array.from({ length: 5 }, (_, i) => `<circle cx="${x - 30 + i * 15}" cy="${252 + Math.abs(i - 2) * -4 + 8}" r="6" stroke="#2a2a34" stroke-width="2.5" fill="none"/>`).join('')}`).join('')}
      ${[0, 100, 200, 300].map((x) => `<rect x="${x - 7}" y="236" width="14" height="70" fill="#2a2a34"/>`).join('')}
      <rect x="0" y="216" width="300" height="10" fill="#3a3a44"/>`,
    spots: [{ x: 0.5, y: 0.62 }],
  }),
};

const urls = new Map();
export function demoArtURL(key) {
  if (urls.has(key)) return urls.get(key);
  const scene = SCENES[key]?.();
  if (!scene) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 3}" height="${H * 3}">${scene.svg}</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  urls.set(key, url);
  return url;
}

export const demoArtSpots = (key) => SCENES[key]?.().spots || [];
export const DEMO_ART = Object.keys(SCENES);
