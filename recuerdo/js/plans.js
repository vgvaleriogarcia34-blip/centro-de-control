// Gratis y Premium.
//
// Gratis: reconocer lugares, fotos interactivas, historia narrada y vídeo con la marca «Hecho con Recuerdo»
// (la marca de agua es el motor de crecimiento: cada vídeo compartido es un anuncio).
// Premium: vídeo sin marca, álbum en PDF para imprimir e historia escrita con IA.
//
// Durante la beta no se cobra: el usuario elige el plan que pagaría (medimos la disposición a pagar)
// y Premium se activa gratis. Cuando haya pasarela de pago, solo cambia `checkout()`.

import { openSheet } from './ui.js';
import { kv } from './store.js';
import { track } from './analytics.js';
import { ICONS, toast } from './util.js';

export const PLANS = [
  { id: 'year', name: 'Anual', price: '29,99 €', per: 'al año', note: 'Equivale a 2,50 € al mes', best: true },
  { id: 'month', name: 'Mensual', price: '4,99 €', per: 'al mes', note: 'Cancela cuando quieras' },
  { id: 'trip', name: 'Solo este viaje', price: '6,99 €', per: 'una vez', note: 'Vídeo y álbum de un viaje' },
];

export const FEATURES = {
  video_clean: 'Vídeo sin la marca de Recuerdo',
  album: 'Álbum en PDF listo para imprimir',
  ai_story: 'Historia escrita con IA, por capítulos',
};

export const isPremium = () => kv.get('premium', false);

// Devuelve true si se puede usar la función (ya era Premium o acaba de activarlo).
export async function requirePremium(feature) {
  if (await isPremium()) return true;
  return new Promise((resolve) => {
    track('paywall_view', { feature });
    let chosen = 'year';
    const { body, close } = openSheet(`
      <div class="place-kind">${ICONS.sparkle}Recuerdo Premium</div>
      <h2 class="place-name">Convierte tus viajes en recuerdos para siempre</h2>
      <ul class="perks">
        <li>${ICONS.check}<span><b>Álbum para imprimir</b> en PDF de 21 × 21 cm, con tus fotos, lugares y notas</span></li>
        <li>${ICONS.check}<span><b>Vídeo sin marca de agua</b> para Reels, TikTok y WhatsApp</span></li>
        <li>${ICONS.check}<span><b>Historia escrita con IA</b>, capítulo a capítulo</span></li>
        <li>${ICONS.check}<span>Todo lo gratuito, <b>sin límites</b> de viajes ni fotos</span></li>
      </ul>
      <div class="plan-list" role="radiogroup">
        ${PLANS.map((p) => `<button class="plan ${p.id === chosen ? 'on' : ''}" role="radio" aria-checked="${p.id === chosen}" data-plan="${p.id}">
          ${p.best ? '<span class="plan-badge">Mejor precio</span>' : ''}
          <span class="plan-name">${p.name}</span><span class="plan-price">${p.price} <small>${p.per}</small></span><span class="plan-note">${p.note}</span>
        </button>`).join('')}
      </div>
      <div class="beta-note">${ICONS.info}<span><b>Durante la beta, Premium es gratis.</b> Elige el plan que pagarías: nos ayuda a fijar los precios. No se te cobrará nada.</span></div>
      <button class="btn btn-primary btn-block" data-go>Activar Premium gratis</button>
      <button class="btn btn-ghost btn-block" data-no style="margin-top:8px">Ahora no</button>`, { onClose: () => resolve(false) });
    body.querySelectorAll('[data-plan]').forEach((b) => b.addEventListener('click', () => {
      chosen = b.dataset.plan;
      body.querySelectorAll('[data-plan]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
    }));
    body.querySelector('[data-no]').addEventListener('click', () => { track('paywall_dismiss', { feature }); close(); });
    body.querySelector('[data-go]').addEventListener('click', async () => {
      await checkout(chosen, feature);
      resolve(true);
      close();
    });
  });
}

async function checkout(plan, feature) {
  // Beta: sin cobro. Aquí irá la pasarela (App Store / Google Play en la app, Stripe en la web).
  track('plan_intent', { plan, feature });
  await kv.set('premium', true);
  await kv.set('premiumPlanIntent', plan);
  toast('Premium activado. ¡Gracias por probar la beta!');
}
