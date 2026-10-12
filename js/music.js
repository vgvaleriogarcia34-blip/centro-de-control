// Música propia para el vídeo-recuerdo, generada en el momento con Web Audio:
// sin derechos de autor y sin descargas. Acordes suaves (I–V–vi–IV) con un arpegio ligero.

export function createMusic(seconds) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ac = new AC();
  const dest = ac.createMediaStreamDestination();
  const master = ac.createGain();
  master.gain.value = 0;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 2400;
  master.connect(lp).connect(dest);

  const t0 = ac.currentTime + 0.1;
  master.gain.setValueAtTime(0, t0);
  master.gain.linearRampToValueAtTime(0.22, t0 + 2);
  master.gain.setValueAtTime(0.22, t0 + Math.max(2.5, seconds - 3));
  master.gain.linearRampToValueAtTime(0, t0 + seconds);

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]; // Do, Sol, Lam, Fa
  const bar = 3.2;
  for (let t = 0, i = 0; t < seconds; t += bar, i++) {
    const ch = chords[i % 4];
    for (const n of ch) pad(ac, master, midi(n - 12), t0 + t, bar + 0.6);
    pad(ac, master, midi(ch[0] - 24), t0 + t, bar + 0.6, 0.5); // bajo
    ch.concat(ch[0] + 12).forEach((n, k) => pluck(ac, master, midi(n), t0 + t + k * (bar / 4)));
  }
  return { stream: dest.stream, start: () => ac.resume(), stop: () => ac.close().catch(() => {}) };
}

function pad(ac, out, f, at, dur, vol = 0.18) {
  const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine'; o2.type = 'triangle';
  o.frequency.value = f; o2.frequency.value = f * 1.003;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.8);
  g.gain.linearRampToValueAtTime(0, at + dur);
  o.connect(g); o2.connect(g); g.connect(out);
  o.start(at); o2.start(at); o.stop(at + dur + 0.1); o2.stop(at + dur + 0.1);
}

function pluck(ac, out, f, at) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'triangle'; o.frequency.value = f * 2;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.09, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
  o.connect(g).connect(out);
  o.start(at); o.stop(at + 1);
}
