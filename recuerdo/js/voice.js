// Voz: la app narra (síntesis del navegador, gratis y sin conexión) y escucha
// (notas de voz grabadas en el momento, transcritas cuando el navegador lo permite).

let voice = null;
function pickVoice() {
  if (voice || !('speechSynthesis' in window)) return voice;
  const vs = speechSynthesis.getVoices();
  // Preferimos voces naturales/neuronales en español de España, luego cualquier español.
  voice = vs.find((v) => /es-ES/i.test(v.lang) && /natural|neural|premium|enhanced|google/i.test(v.name))
    || vs.find((v) => /es-ES/i.test(v.lang))
    || vs.find((v) => /^es/i.test(v.lang)) || null;
  return voice;
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { voice = null; pickVoice(); };

export const canSpeak = () => 'speechSynthesis' in window;

export function speak(text, { onend, rate = 1 } = {}) {
  if (!canSpeak() || !text) { onend?.(); return () => {}; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-ES';
  u.rate = rate;
  const v = pickVoice();
  if (v) u.voice = v;
  let done = false;
  const finish = () => { if (!done) { done = true; onend?.(); } };
  u.onend = finish;
  u.onerror = finish;
  speechSynthesis.speak(u);
  return () => { done = true; speechSynthesis.cancel(); };
}
export const stopSpeaking = () => { if (canSpeak()) speechSynthesis.cancel(); };
export const pauseSpeaking = () => { if (canSpeak()) speechSynthesis.pause(); };
export const resumeSpeaking = () => { if (canSpeak()) speechSynthesis.resume(); };

// ---------- Notas de voz ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canRecord = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

export async function startNote({ onText } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();

  let transcript = '';
  let recog = null;
  if (SR) {
    try {
      recog = new SR();
      recog.lang = 'es-ES';
      recog.continuous = true;
      recog.interimResults = true;
      recog.onresult = (e) => {
        let finalText = '', interim = '';
        for (const r of e.results) (r.isFinal ? (finalText += r[0].transcript) : (interim += r[0].transcript));
        transcript = (finalText + ' ' + interim).trim();
        onText?.(transcript);
      };
      recog.start();
    } catch { recog = null; }
  }

  return {
    async stop() {
      recog?.stop();
      await new Promise((r) => { rec.onstop = r; rec.stop(); });
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      const text = transcript ? transcript.charAt(0).toUpperCase() + transcript.slice(1) : '';
      return { blob, text };
    },
  };
}
