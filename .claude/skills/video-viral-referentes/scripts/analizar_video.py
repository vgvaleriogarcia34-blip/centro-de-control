#!/usr/bin/env python3
"""Ficha técnica de un vídeo corto (propio o de un referente).

Mide lo que se puede medir sin opinar: duración, formato, cortes por segundo,
energía del audio, si hay voz y qué dice, y saca hojas de contacto del gancho
(primeros 3 s, a 6 fps) y del vídeo entero (1 fps) para leerlas a ojo.

Uso:
  python3 analizar_video.py VIDEO_O_URL [--out DIR] [--copy "texto del post"] [--sin-voz] [--cookies cookies.txt]

Si se pasa una URL (TikTok, Reels, Shorts, YouTube) se descarga con yt-dlp.
Salida en DIR: ficha.json, ficha.md, gancho.jpg, contacto.jpg
"""
import argparse
import json
import os
import re
import subprocess
import sys
import wave

FONT = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def descargar(url, out, cookies=None):
    plantilla = os.path.join(out, "origen.%(ext)s")
    extra = ["--cookies", cookies] if cookies else []
    r = run([sys.executable, "-m", "yt_dlp", "-f", "mp4/best", "-o", plantilla,
             "--write-info-json", "--no-playlist", *extra, url])
    if r.returncode:
        sys.exit("No se pudo descargar: " + r.stderr[-500:])
    video = next(os.path.join(out, f) for f in os.listdir(out)
                 if f.startswith("origen.") and not f.endswith(".json"))
    info = {}
    ruta_info = os.path.join(out, "origen.info.json")
    if os.path.exists(ruta_info):
        with open(ruta_info) as fh:
            d = json.load(fh)
        info = {k: d.get(k) for k in ("title", "description", "uploader", "view_count",
                                       "like_count", "comment_count", "upload_date",
                                       "channel_follower_count", "tags")}
    return video, info


def sonda(video):
    r = run(["ffprobe", "-v", "error", "-show_entries",
             "format=duration:stream=codec_type,width,height,r_frame_rate",
             "-of", "json", video])
    d = json.loads(r.stdout)
    v = next(s for s in d["streams"] if s["codec_type"] == "video")
    num, den = v["r_frame_rate"].split("/")
    return {"duracion_s": round(float(d["format"]["duration"]), 2),
            "ancho": v["width"], "alto": v["height"],
            "fps": round(int(num) / int(den), 2),
            "vertical_9_16": abs(v["height"] / v["width"] - 16 / 9) < 0.05,
            "tiene_audio": any(s["codec_type"] == "audio" for s in d["streams"])}


def cortes(video, umbral):
    r = run(["ffmpeg", "-i", video, "-vf", f"select='gt(scene,{umbral})',showinfo",
             "-f", "null", "-"])
    tiempos = [float(t) for t in re.findall(r"pts_time:([0-9.]+)", r.stderr)]
    # Fundidos y destellos disparan varios cortes seguidos: uno cada 0,25 s como máximo.
    limpios = []
    for t in tiempos:
        if not limpios or t - limpios[-1] > 0.25:
            limpios.append(round(t, 2))
    return limpios


def audio_mono(video, ruta):
    run(["ffmpeg", "-v", "error", "-y", "-i", video, "-ac", "1", "-ar", "16000", ruta])
    import numpy as np
    with wave.open(ruta) as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


def energia(a):
    import numpy as np
    seg = [a[i:i + 16000] for i in range(0, len(a), 16000)]
    db = [round(float(20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-6)), 1) for s in seg if len(s)]
    return db


def lufs(video):
    r = run(["ffmpeg", "-i", video, "-af", "loudnorm=print_format=json", "-f", "null", "-"])
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr, re.S)
    return float(json.loads(m.group(0))["input_i"]) if m else None


def transcribir(a):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return None, "faster-whisper no instalado (pip install faster-whisper)"
    m = WhisperModel("small", compute_type="int8")
    segs, info = m.transcribe(a, language="es", vad_filter=True)
    texto = [{"ini": round(s.start, 2), "fin": round(s.end, 2), "texto": s.text.strip()}
             for s in segs if s.no_speech_prob < 0.6]
    # Whisper inventa créditos de subtítulos sobre música: se descartan.
    texto = [t for t in texto if "amara.org" not in t["texto"].lower()]
    return texto, None


def hoja(video, salida, filtro_fps, columnas, filas, hasta=None):
    vf = (f"fps={filtro_fps},scale=216:-1,"
          f"drawtext=fontfile={FONT}:text='%{{pts\\:hms}}':x=4:y=4:fontsize=18:"
          f"fontcolor=yellow:box=1:boxcolor=black@0.7,tile={columnas}x{filas}")
    cmd = ["ffmpeg", "-v", "error", "-y"]
    if hasta:
        cmd += ["-t", str(hasta)]
    run(cmd + ["-i", video, "-vf", vf, "-frames:v", "1", salida])


def main():
    p = argparse.ArgumentParser()
    p.add_argument("fuente")
    p.add_argument("--out", default="analisis")
    p.add_argument("--copy", default="", help="texto del post/caption si no viene de yt-dlp")
    p.add_argument("--umbral", type=float, default=0.3)
    p.add_argument("--sin-voz", action="store_true", help="no transcribir")
    p.add_argument("--cookies", help="cookies.txt exportado del navegador, si la plataforma pide login")
    a = p.parse_args()
    os.makedirs(a.out, exist_ok=True)

    meta = {}
    video = a.fuente
    if re.match(r"https?://", a.fuente):
        video, meta = descargar(a.fuente, a.out, a.cookies)

    ficha = {"fuente": a.fuente, **sonda(video)}
    c = cortes(video, a.umbral)
    planos = [b - x for x, b in zip([0] + c, c + [ficha["duracion_s"]])]
    ficha.update({
        "cortes_s": c,
        "n_planos": len(planos),
        "plano_medio_s": round(sum(planos) / len(planos), 2),
        "plano_mas_largo_s": round(max(planos), 2),
        "primer_corte_s": c[0] if c else None,
        "cortes_por_10s": round(10 * len(c) / ficha["duracion_s"], 1),
    })
    if ficha["tiene_audio"]:
        mono = audio_mono(video, os.path.join(a.out, "audio.wav"))
        ficha["energia_db_por_segundo"] = energia(mono)
        ficha["lufs_integrado"] = lufs(video)
        if not a.sin_voz:
            texto, aviso = transcribir(mono)
            ficha["voz"] = texto
            ficha["hay_voz"] = bool(texto)
            if aviso:
                ficha["aviso_voz"] = aviso
    ficha["copy"] = a.copy or (meta.get("description") or meta.get("title") or "")
    ficha["metricas_publicas"] = {k: v for k, v in meta.items() if k not in ("description",)}
    if meta.get("view_count") and meta.get("channel_follower_count"):
        ficha["vistas_por_seguidor"] = round(meta["view_count"] / meta["channel_follower_count"], 2)

    hoja(video, os.path.join(a.out, "gancho.jpg"), 6, 6, 3, hasta=3)
    n = max(1, int(ficha["duracion_s"]))
    hoja(video, os.path.join(a.out, "contacto.jpg"), 1, 10, (n + 9) // 10)

    with open(os.path.join(a.out, "ficha.json"), "w") as fh:
        json.dump(ficha, fh, ensure_ascii=False, indent=2)

    voz = ficha.get("voz") or []
    md = [f"# Ficha · {os.path.basename(str(a.fuente))}", "",
          f"- Duración: {ficha['duracion_s']} s · {ficha['ancho']}x{ficha['alto']} · "
          f"{'9:16' if ficha['vertical_9_16'] else 'NO 9:16'} · {ficha['fps']} fps",
          f"- Planos: {ficha['n_planos']} · medio {ficha['plano_medio_s']} s · "
          f"más largo {ficha['plano_mas_largo_s']} s · primer corte en {ficha['primer_corte_s']} s",
          f"- Ritmo: {ficha['cortes_por_10s']} cortes cada 10 s",
          f"- Sonoridad: {ficha.get('lufs_integrado')} LUFS (objetivo redes: -14)",
          f"- Voz: {'sí' if voz else 'no'}",
          "", "## Copy", "", ficha["copy"] or "_(sin copy)_", "",
          "## Lo que se dice", ""]
    md += [f"- [{t['ini']}–{t['fin']}] {t['texto']}" for t in voz] or ["_(solo música)_"]
    md += ["", "## Por leer a ojo en gancho.jpg y contacto.jpg", "",
           "- ¿Qué se ve en el fotograma 0? ¿Hay texto en pantalla antes de 1 s?",
           "- ¿Cuál es la promesa o la tensión del gancho, en una frase?",
           "- ¿Cara, movimiento o contraste en los 3 primeros segundos?",
           "- ¿Hay subtítulos, barra de progreso, CTA final, bucle con el inicio?"]
    with open(os.path.join(a.out, "ficha.md"), "w") as fh:
        fh.write("\n".join(md) + "\n")
    print(json.dumps({k: v for k, v in ficha.items() if k not in ("energia_db_por_segundo",)},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
