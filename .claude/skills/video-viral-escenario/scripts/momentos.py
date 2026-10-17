#!/usr/bin/env python3
"""Encuentra los momentos virales de una charla, ponencia o taller grabado.

Transcribe con faster-whisper y propone fragmentos de 12–45 s que empiezan en una
frase con gancho (pregunta, negación, cifra, contraste, "nadie", "error"...) y
terminan en un final de frase. Detecta también reacciones del público (aplausos,
risas): picos de sonido sin voz.

Uso:
  python3 momentos.py VIDEO [--out momentos.json] [--top 8] [--min 12] [--max 45]

Salida: JSON con la transcripción por frases, los candidatos puntuados y las
reacciones. Los candidatos se pegan tal cual como clips en un plan de
video-viral-edicion (ini/fin en segundos del vídeo de origen).
"""
import argparse
import json
import re
import subprocess
import tempfile
import wave

GANCHOS = [
    (r"\?", 3, "pregunta"),
    (r"\b(nadie|nunca|jamás|ningún|ninguna)\b", 3, "absoluto"),
    (r"\bno (es|son|está|tienes|sabes|hace|funciona|eres)\b", 3, "negación"),
    (r"\b\d+([.,]\d+)?\s*(%|por ciento|euros|€|millones|años|clientes|veces)", 4, "cifra"),
    (r"\b(error|errores|problema|fracas\w*|miedo|culpa|mentira|secreto|verdad)\b", 2, "tensión"),
    (r"\b(pero|sin embargo|en realidad|la diferencia)\b", 1, "contraste"),
    (r"\b(tu|tus|tú|te)\b", 1, "a ti"),
    (r"\b(familia|hijo|hija|padre|madre|hermano|sucesi\w+|relevo|herencia)\b", 2, "familia"),
    (r"\b(empresa|negocio|dinero|margen|ventas|beneficio)\b", 1, "negocio"),
]
ARRANQUES_FLOJOS = r"^(bueno|vale|entonces|eh|ehm|y|o sea|pues|a ver|vamos a)\b"


def audio(video):
    import numpy as np
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-ac", "1", "-ar", "16000", tmp.name],
                       check=True)
        with wave.open(tmp.name) as w:
            return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


def frases(a):
    from faster_whisper import WhisperModel
    m = WhisperModel("small", compute_type="int8")
    segs, _ = m.transcribe(a, language="es", vad_filter=True, word_timestamps=True)
    palabras = [w for s in segs if s.no_speech_prob < 0.6 for w in (s.words or [])]
    salida, actual = [], []
    for w in palabras:
        actual.append(w)
        if re.search(r"[.?!…]$", w.word.strip()):
            salida.append(actual)
            actual = []
    if actual:
        salida.append(actual)
    out = []
    for f in salida:
        texto = "".join(w.word for w in f).strip()
        if "amara.org" in texto.lower():
            continue
        out.append({"ini": round(f[0].start, 2), "fin": round(f[-1].end, 2), "texto": texto})
    return out


def puntuar_gancho(texto):
    t = texto.lower()
    puntos, motivos = 0, []
    for patron, peso, nombre in GANCHOS:
        if re.search(patron, t):
            puntos += peso
            motivos.append(nombre)
    if re.match(ARRANQUES_FLOJOS, t):
        puntos -= 3
        motivos.append("arranque flojo")
    if len(t.split()) <= 9:
        puntos += 1
        motivos.append("corta")
    return puntos, motivos


def reacciones(a, fr, umbral_db=-18):
    """Segundos con mucho sonido y sin voz transcrita: aplausos, risas, gritos."""
    import numpy as np
    habla = [(f["ini"], f["fin"]) for f in fr]
    picos = []
    for s in range(len(a) // 16000):
        rms = float(np.sqrt((a[s * 16000:(s + 1) * 16000] ** 2).mean()))
        db = 20 * np.log10(rms + 1e-9)
        if db > umbral_db and not any(i - 0.3 <= s <= f + 0.3 for i, f in habla):
            if picos and s - picos[-1]["fin"] <= 1:
                picos[-1]["fin"] = s + 1
            else:
                picos.append({"ini": s, "fin": s + 1})
    return [p for p in picos if p["fin"] - p["ini"] >= 2]


def candidatos(fr, minimo, maximo):
    cands = []
    for i, f in enumerate(fr):
        g, motivos = puntuar_gancho(f["texto"])
        if g < 2:
            continue
        j, texto = i, [f["texto"]]
        while j + 1 < len(fr) and fr[j + 1]["fin"] - f["ini"] <= maximo:
            j += 1
            texto.append(fr[j]["texto"])
            if fr[j]["fin"] - f["ini"] >= minimo and re.search(r"[.!?]$", fr[j]["texto"]):
                # Parar en la primera frase de cierre fuerte una vez alcanzado el mínimo.
                if puntuar_gancho(fr[j]["texto"])[0] >= 2:
                    break
        dur = fr[j]["fin"] - f["ini"]
        if dur < minimo:
            continue
        cuerpo = sum(max(0, puntuar_gancho(t)[0]) for t in texto[1:]) / max(1, len(texto) - 1)
        palabras_seg = len(" ".join(texto).split()) / dur
        puntos = round(2 * g + cuerpo + min(palabras_seg, 3.5), 1)
        cands.append({"ini": round(max(0, f["ini"] - 0.15), 2), "fin": round(fr[j]["fin"] + 0.25, 2),
                      "duracion_s": round(dur, 1), "puntos": puntos, "gancho": f["texto"],
                      "motivos": motivos, "texto": " ".join(texto)})
    cands.sort(key=lambda c: -c["puntos"])
    elegidos = []
    for c in cands:  # sin solapes
        if all(c["fin"] <= e["ini"] or c["ini"] >= e["fin"] for e in elegidos):
            elegidos.append(c)
    return elegidos


def main():
    p = argparse.ArgumentParser()
    p.add_argument("video")
    p.add_argument("--out", default="momentos.json")
    p.add_argument("--top", type=int, default=8)
    p.add_argument("--min", type=float, default=12)
    p.add_argument("--max", type=float, default=45)
    a = p.parse_args()
    señal = audio(a.video)
    fr = frases(señal)
    res = {"video": a.video, "frases": fr,
           "candidatos": candidatos(fr, a.min, a.max)[:a.top],
           "reacciones_publico": reacciones(señal, fr)}
    with open(a.out, "w") as fh:
        json.dump(res, fh, ensure_ascii=False, indent=2)
    if not fr:
        print("Sin voz detectada: usar el vídeo como metraje con texto en pantalla.")
    for c in res["candidatos"]:
        print(f"[{c['puntos']:4}] {c['ini']:7.2f}-{c['fin']:7.2f} ({c['duracion_s']} s) "
              f"{', '.join(c['motivos'])}\n       «{c['gancho']}»")
    for r in res["reacciones_publico"]:
        print(f"reacción del público: {r['ini']}-{r['fin']} s")


if __name__ == "__main__":
    main()
