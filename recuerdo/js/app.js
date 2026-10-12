// Arranque y enrutado por hash (funciona en cualquier hosting estático, incluido GitHub Pages).

import { homeView, tripView, mapView, importView, memoriesView, settingsView, applyTheme } from './views.js';
import { seedDemo } from './demo.js';
import { closeViewer } from './viewer.js';
import { closeStory } from './story.js';
import { closeSheet } from './ui.js';

const routes = [
  [/^#?\/?$/, 'home', () => homeView()],
  [/^#\/viaje\/([\w-]+)$/, 'home', (m) => tripView(m[1])],
  [/^#\/mapa$/, 'map', () => mapView()],
  [/^#\/importar$/, 'import', () => importView()],
  [/^#\/recuerdos$/, 'memories', () => memoriesView()],
  [/^#\/ajustes$/, 'settings', () => settingsView()],
];

async function route() {
  closeViewer(); closeStory(); closeSheet(true);
  const hash = location.hash || '#/';
  for (const [re, tab, fn] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    const go = async () => {
      // Pantalla nueva = nodo nuevo: así no se acumulan escuchadores entre navegaciones.
      const old = document.getElementById('view');
      const v = old.cloneNode(false);
      v.classList.remove('enter');
      old.replaceWith(v);
      await fn(m);
      void v.offsetWidth;
      v.classList.add('enter');
      window.scrollTo(0, 0);
    };
    // Transiciones suaves entre pantallas donde el navegador lo permite.
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(go);
    else await go();
    return;
  }
  location.hash = '#/';
}

async function boot() {
  try { applyTheme(localStorage.getItem('recuerdo.theme') || 'auto'); } catch { /* sin almacenamiento */ }
  try { await seedDemo(); } catch (e) { console.warn('No se pudo preparar el viaje de ejemplo', e); }
  window.addEventListener('hashchange', route);
  await route();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
