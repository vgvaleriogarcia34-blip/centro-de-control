// «¿Dónde fue esto?»: rescata las fotos que llegan sin ubicación.
// Explica por qué pasa (sobre todo en iPhone) y deja buscar el sitio por nombre.

import { openSheet } from './ui.js';
import { searchPlace } from './places.js';
import { assignLocation } from './trips.js';
import { ICONS, esc, toast } from './util.js';

export function openLocateSheet(photos, { onDone, allMissing = false } = {}) {
  const n = photos.length;
  const { body, close } = openSheet(`
    <div class="place-kind">${ICONS.pin}${n === 1 ? 'Foto sin ubicación' : `${n} fotos sin ubicación`}</div>
    <h2 class="place-name" style="font-size:26px">¿Dónde fue esto?</h2>
    <p class="place-sub">${allMissing
      ? 'Tus fotos han llegado sin la información de dónde se hicieron, así que no podemos reconocer los lugares solos.'
      : n === 1 ? 'Esta foto no guardaba dónde se hizo. Dinos el sitio y la colocamos en tu viaje.' : 'Estas fotos no guardaban dónde se hicieron. Dinos el sitio y las colocamos en tu viaje.'}</p>
    <form class="locate-form" data-form>
      <label class="field"><span>Ciudad, pueblo o lugar</span>
        <input id="locate-q" class="input" type="search" enterkeyhint="search" autocomplete="off" placeholder="Ej.: Toledo, Catedral de Burgos…"></label>
    </form>
    <div class="list" data-results></div>
    <details class="tip-box" ${allMissing ? 'open' : ''}>
      <summary><b>¿Fotos del iPhone?</b> Cómo conservar la ubicación</summary>
      <ol class="tip-steps">
        <li>Toca <b>+</b> en Recuerdo y elige tus fotos.</li>
        <li>Antes de confirmar, toca <b>Opciones</b> (arriba, en la pantalla de selección).</li>
        <li>Activa <b>Ubicación</b> y toca <b>OK</b>.</li>
        <li>Así cada foto llega con su sitio y reconocemos cada monumento.</li>
      </ol>
      <a class="btn btn-ghost btn-block" href="#/importar">${ICONS.images}Volver a elegir las fotos</a>
    </details>`);
  const input = body.querySelector('#locate-q');
  const results = body.querySelector('[data-results]');
  setTimeout(() => input.focus(), 320);

  let timer = null, last = '';
  const run = async () => {
    const q = input.value.trim();
    if (q.length < 3 || q === last) return;
    last = q;
    results.innerHTML = '<div class="skeleton" style="height:56px;border-radius:12px;margin:8px 0"></div>';
    try {
      const list = await searchPlace(q);
      if (input.value.trim() !== q) return;
      results.innerHTML = list.length
        ? list.map((r, i) => `<button class="list-item" data-i="${i}"><span class="thumb">${ICONS.pin}</span><span class="grow"><b>${esc(r.name)}</b><small>${esc(r.label)}</small></span></button>`).join('')
        : '<p class="place-sub" style="padding:10px 2px">No encontramos ese sitio. Prueba con el nombre del pueblo o la ciudad.</p>';
      results.onclick = async (e) => {
        const item = e.target.closest('[data-i]');
        if (!item) return;
        const r = list[+item.dataset.i];
        await assignLocation(photos, r);
        close();
        toast(`${n === 1 ? 'Foto colocada' : `${n} fotos colocadas`} en ${r.place.city || r.name}`);
        onDone?.(r);
      };
    } catch {
      results.innerHTML = '<p class="place-sub" style="padding:10px 2px">Sin conexión. Inténtalo de nuevo en un momento.</p>';
    }
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 650); });
  body.querySelector('[data-form]').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(timer); last = ''; run(); });
}
