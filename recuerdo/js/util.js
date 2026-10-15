// Utilidades de presentación: fechas en lenguaje natural, DOM, avisos y vibración.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// Las fechas EXIF sin zona son "hora local del sitio": las leemos como hora de reloj, sin convertir.
export function parseLocal(iso) {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return new Date(iso);
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
}

const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const fmt = {
  longDate: (iso) => { const d = parseLocal(iso); return d ? capital(d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) : ''; },
  dayTitle: (iso) => { const d = parseLocal(iso); return d ? capital(d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })) : ''; },
  time: (iso) => { const d = parseLocal(iso); return d ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''; },
  monthYear: (iso) => { const d = parseLocal(iso); return d ? capital(d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })) : ''; },
  shortDate: (iso) => { const d = parseLocal(iso); return d ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''; },
  momentOfDay: (iso) => {
    const d = parseLocal(iso); if (!d) return '';
    const hr = d.getHours();
    if (hr < 6) return 'de madrugada'; if (hr < 12) return 'por la mañana'; if (hr < 14) return 'a mediodía';
    if (hr < 20) return 'por la tarde'; return 'por la noche';
  },
  range: (a, b) => {
    const da = parseLocal(a), db = parseLocal(b); if (!da) return '';
    if (!db || da.toDateString() === db.toDateString()) return fmt.longDate(a);
    const sameMonth = da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear();
    const left = da.toLocaleDateString('es-ES', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
    return `${left} – ${db.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  },
  list: (arr) => arr.length <= 1 ? (arr[0] || '') : `${arr.slice(0, -1).join(', ')} y ${arr[arr.length - 1]}`,
};

export const daysBetween = (a, b) => Math.round((new Date(parseLocal(b)).setHours(0, 0, 0, 0) - new Date(parseLocal(a)).setHours(0, 0, 0, 0)) / 864e5);

let toastTimer;
export function toast(msg, ms = 2400) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* sin vibración */ } };

const AVATAR_COLORS = ['#ff6b4a', '#e8407a', '#7c5cff', '#2bb5a0', '#f2a03d', '#3a8dde'];
export function avatar(name) {
  const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  let n = 0; for (const c of name) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="avatar" style="background:${AVATAR_COLORS[n % AVATAR_COLORS.length]}" title="${esc(name)}">${esc(initials)}</span>`;
}

export const ICONS = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"/></svg>',
  speaker: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.3-9.2C1.4 8.4 3.6 5 7 5c2 0 3.4 1 5 2.8C13.6 6 15 5 17 5c3.4 0 5.6 3.4 4.3 6.8C19.5 16.4 12 21 12 21z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 0v14m6-12v14"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>',
  stories: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M10 9l5 3-5 3z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>',
  people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14.5c2.4 0 4 1.6 4.8 4.5"/></svg>',
  external: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  fork: '<svg viewBox="0 0 24 24"><path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 3c-2 0-3 2.5-3 6s1 4 3 4v8"/></svg>',
  church: '<svg viewBox="0 0 24 24"><path d="M12 2v4M10 4h4M12 6l-5 5v10h10V11zM4 21h16M10 21v-4a2 2 0 0 1 4 0v4"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
  images: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="15" height="13" rx="2"/><path d="M7 21h12a2 2 0 0 0 2-2V8"/><path d="M3 15l4-4 4 4 2-2 5 5"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  labels: '<svg viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>',
  logo: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><path d="M9.5 9.5l2 2 3.5-3.5"/></svg>',
};

export const KIND_ICON = (kind) => (['restaurante', 'cafe', 'bar', 'heladeria'].includes(kind) ? ICONS.fork : ['catedral', 'iglesia', 'capilla', 'monasterio'].includes(kind) ? ICONS.church : ICONS.pin);
