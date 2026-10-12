// Bienvenida de tres pantallas (solo la primera vez): qué hace, cómo se usa, y por dónde empezar.

import { h, haptic } from './util.js';
import { kv } from './store.js';
import { demoArtURL } from './demo-art.js';
import { track } from './analytics.js';

const SLIDES = [
  { art: 'giralda', spot: { x: 50, y: 30 }, label: 'Giralda', eyebrow: 'Toca la foto',
    title: '¿Cómo se llamaba aquella iglesia?', text: 'Toca cualquier monumento de tus fotos y te decimos qué es, su historia y el día que estuviste allí.' },
  { art: 'puente', spot: { x: 50, y: 62 }, label: 'Puente de Triana', eyebrow: 'Revívelo',
    title: 'Tu viaje, contado con voz', text: 'Lo ordenamos por días y lugares y te lo narramos como una historia, con tus acompañantes y tus notas de voz.' },
  { art: 'plaza', spot: { x: 50, y: 60 }, label: 'Plaza de España', eyebrow: 'Solo tuyo',
    title: 'Tus fotos no salen del móvil', text: 'Todo se guarda en tu teléfono. Para reconocer los sitios solo consultamos mapas y enciclopedias abiertas.' },
];

export async function maybeOnboard() {
  if (await kv.get('onboarded')) return;
  let i = 0;
  const el = h(`<div class="onb" role="dialog" aria-label="Bienvenida">
    <div class="onb-art"><img alt=""><span class="onb-spot"><span class="dot"></span><span class="label"></span></span></div>
    <div class="onb-body">
      <div class="onb-dots">${SLIDES.map(() => '<i></i>').join('')}</div>
      <p class="eyebrow"></p><h1></h1><p class="onb-text"></p>
      <div class="onb-actions">
        <button class="btn btn-primary btn-block" data-next>Siguiente</button>
        <button class="btn btn-ghost btn-block" data-skip>Saltar</button>
      </div>
    </div></div>`);
  document.getElementById('overlay-root').append(el);
  document.body.style.overflow = 'hidden';

  const show = () => {
    const s = SLIDES[i];
    el.querySelector('.onb-art img').src = demoArtURL(s.art);
    const spot = el.querySelector('.onb-spot');
    spot.style.left = `${s.spot.x}%`; spot.style.top = `${s.spot.y}%`;
    spot.querySelector('.label').textContent = s.label;
    el.querySelector('.eyebrow').textContent = s.eyebrow;
    el.querySelector('h1').textContent = s.title;
    el.querySelector('.onb-text').textContent = s.text;
    el.querySelectorAll('.onb-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    const last = i === SLIDES.length - 1;
    el.querySelector('[data-next]').textContent = last ? 'Ver el viaje de ejemplo' : 'Siguiente';
    el.querySelector('[data-skip]').textContent = last ? 'Subir mis fotos' : 'Saltar';
    el.querySelector('.onb-body').classList.remove('in'); void el.offsetWidth; el.querySelector('.onb-body').classList.add('in');
  };
  const finish = async (goTo) => {
    await kv.set('onboarded', true);
    track('onboarding_done', { slide: i + 1, to: goTo === '#/importar' ? 'import' : 'demo' });
    el.remove();
    document.body.style.overflow = '';
    location.hash = goTo;
  };
  el.querySelector('[data-next]').addEventListener('click', () => {
    haptic(6);
    if (i < SLIDES.length - 1) { i++; show(); } else finish('#/viaje/demo-sevilla');
  });
  el.querySelector('[data-skip]').addEventListener('click', () => finish(i === SLIDES.length - 1 ? '#/importar' : '#/'));
  let sx = 0;
  el.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    if (dx < -50 && i < SLIDES.length - 1) { i++; show(); }
    if (dx > 50 && i > 0) { i--; show(); }
  });
  show();
}
