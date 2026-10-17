#!/usr/bin/env python3
"""Monta un vídeo corto en clave viral a partir de un plan JSON.

Hace lo que hacen los cortos que funcionan: el mejor momento delante, planos
cortos, empuje de zoom en cada plano, texto grande en pantalla que cuenta la
historia aunque no haya voz, barra de progreso, cortes al ritmo de la música,
sonido a -14 LUFS y exportación 1080x1920 H.264 lista para Reels/TikTok/Shorts.

Uso:
  python3 editar_viral.py plan.json

Formato del plan: ver ../plan-ejemplo.json y SKILL.md.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import wave

FUENTE_LETRA = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit("ffmpeg falló:\n" + " ".join(cmd) + "\n" + r.stderr[-1500:])
    return r


def beats(fuente, desde, dur):
    """Tiempos de pulso (s, relativos a `desde`) estimados por autocorrelación de onsets."""
    import numpy as np
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        run(["ffmpeg", "-v", "error", "-y", "-ss", str(desde), "-t", str(dur + 2),
             "-i", fuente, "-ac", "1", "-ar", "16000", tmp.name])
        with wave.open(tmp.name) as w:
            a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32)
    hop = 256
    n = len(a) // hop
    env = np.array([np.sqrt((a[i * hop:(i + 1) * hop] ** 2).mean()) for i in range(n)])
    onset = np.maximum(0, np.diff(np.log(env + 1e-3)))
    fps = 16000 / hop
    ac = np.correlate(onset, onset, "full")[len(onset) - 1:]
    lo, hi = int(fps * 60 / 180), int(fps * 60 / 70)
    periodo = lo + int(np.argmax(ac[lo:hi]))
    fases = [onset[f::periodo].sum() for f in range(periodo)]
    fase = int(np.argmax(fases))
    bpm = round(60 * fps / periodo, 1)
    return [(fase + k * periodo) / fps for k in range((n - fase) // periodo + 1)], bpm


def ajustar_a_beats(clips, pulsos, minimo=0.8):
    """Acorta cada plano para que el corte caiga en el pulso anterior.

    Solo acorta: alargar podría pisar un corte del original que hay justo después de `fin`.
    """
    t = 0.0
    for c in clips:
        dur = (c["fin"] - c["ini"]) / c.get("velocidad", 1.0)
        validos = [p for p in pulsos if minimo <= p - t <= dur + 1e-3]
        if validos:
            objetivo = max(validos)
            c["fin"] = round(c["ini"] + (objetivo - t) * c.get("velocidad", 1.0), 3)
            dur = objetivo - t
        t += dur
    return clips


def lineas_texto(texto, max_car):
    lineas = []
    for parrafo in texto.split("\n"):
        actual = ""
        for palabra in parrafo.split():
            if actual and len(actual) + 1 + len(palabra) > max_car:
                lineas.append(actual)
                actual = palabra
            else:
                actual = (actual + " " + palabra).strip()
        if actual:
            lineas.append(actual)
    return lineas


def capa_texto(texto, estilo, carpeta, idx, dur):
    """Un drawtext por línea, centrado, con entrada rápida (fade 0,12 s)."""
    if not texto:
        return []
    tam = estilo.get("tamano", 92)
    lineas = lineas_texto(texto, estilo.get("max_caracteres", 16))
    alto_linea = int(tam * 1.18)
    # Bandas dentro de la zona segura de Reels/TikTok (arriba la cabecera, abajo y a la derecha los botones).
    y0 = {"arriba": 0.12, "centro": 0.40, "abajo": 0.58}[estilo.get("posicion", "arriba")]
    capas = []
    for j, linea in enumerate(lineas):
        ruta = os.path.join(carpeta, f"t{idx}_{j}.txt")
        with open(ruta, "w") as fh:
            fh.write(linea)
        destacar = linea.isupper() and len(linea) > 1
        color = estilo.get("color_destacado", "#FFD400") if destacar else estilo.get("color", "white")
        capas.append(
            f"drawtext=fontfile={estilo.get('fuente', FUENTE_LETRA)}:textfile={ruta}:"
            f"fontsize={tam}:fontcolor={color}:borderw={estilo.get('borde', 7)}:bordercolor=black:"
            f"shadowx=0:shadowy=6:shadowcolor=black@0.5:"
            f"x=(w-text_w)/2:y=h*{y0}+{j * alto_linea}:"
            f"alpha='min(1,t/0.12)':enable='between(t,0,{dur:.3f})'")
    return capas


def render_clip(fuente, c, i, plan, carpeta):
    W, H = plan.get("resolucion", [1080, 1920])
    fps = plan.get("fps", 30)
    vel = c.get("velocidad", 1.0)
    dur = (c["fin"] - c["ini"]) / vel
    zoom = c.get("zoom", plan.get("zoom", 1.06))
    frames = max(1, round(dur * fps))
    # Empuje de zoom lineal de 1 a `zoom` a lo largo del plano, centrado (o en foco x,y 0-1).
    fx, fy = c.get("foco", [0.5, 0.45])
    filtros = [
        f"setpts=(PTS-STARTPTS)/{vel}",
        f"scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase",
        f"crop={W * 2}:{H * 2}",
        f"zoompan=z='1+({zoom}-1)*on/{frames}':d=1:s={W}x{H}:fps={fps}:"
        f"x='(iw-iw/zoom)*{fx}':y='(ih-ih/zoom)*{fy}'",
    ]
    if c.get("color", plan.get("color", True)):
        filtros.append("eq=contrast=1.08:saturation=1.18:brightness=0.01")
    filtros += capa_texto(c.get("texto", ""), {**plan.get("estilo_texto", {}), **c.get("estilo", {})},
                          carpeta, i, dur)
    salida = os.path.join(carpeta, f"clip{i:02d}.mp4")
    run(["ffmpeg", "-v", "error", "-y", "-ss", str(c["ini"]), "-t", str(c["fin"] - c["ini"]),
         "-i", fuente, "-an", "-vf", ",".join(filtros), "-frames:v", str(frames),
         "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", salida])
    return salida, frames / fps


def main():
    with open(sys.argv[1]) as fh:
        plan = json.load(fh)
    base = os.path.dirname(os.path.abspath(sys.argv[1]))
    fuente = os.path.join(base, plan["fuente"]) if not os.path.isabs(plan["fuente"]) else plan["fuente"]
    salida = os.path.join(base, plan["salida"]) if not os.path.isabs(plan["salida"]) else plan["salida"]
    clips = plan["clips"]
    audio = plan.get("audio", {})

    if plan.get("ajustar_a_beats") and audio.get("modo", "continuo") == "continuo":
        total = sum((c["fin"] - c["ini"]) / c.get("velocidad", 1.0) for c in clips)
        pulsos, bpm = beats(fuente, audio.get("desde", 0), total)
        clips = ajustar_a_beats(clips, pulsos)
        print(f"Tempo estimado: {bpm} BPM")

    with tempfile.TemporaryDirectory() as carpeta:
        partes, total = [], 0.0
        for i, c in enumerate(clips):
            ruta, d = render_clip(fuente, c, i, plan, carpeta)
            partes.append(ruta)
            print(f"plano {i + 1}: {c['ini']:.2f}-{c['fin']:.2f} s de origen → {total:.2f}-{total + d:.2f} s · {c.get('texto', '')!r}")
            total += d
        lista = os.path.join(carpeta, "lista.txt")
        with open(lista, "w") as fh:
            fh.writelines(f"file '{p}'\n" for p in partes)
        unido = os.path.join(carpeta, "unido.mp4")
        run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", unido])

        vf = []
        if plan.get("barra_progreso", True):
            color = plan.get("color_barra", "#FFD400")
            vf.append(f"drawbox=x=0:y=ih-18:w='iw*t/{total:.3f}':h=18:c={color}:t=fill")
        fundido = audio.get("fundido_final", 0.6)
        if audio.get("modo", "continuo") == "continuo":
            entradas = ["-i", unido, "-ss", str(audio.get("desde", 0)), "-t", f"{total:.3f}", "-i", fuente]
            af = (f"afade=t=in:d=0.05,afade=t=out:st={max(0, total - fundido):.3f}:d={fundido},"
                  f"loudnorm=I={audio.get('lufs', -14)}:TP=-1.0:LRA=11")
            mapas = ["-map", "0:v", "-map", "1:a"]
        else:
            entradas, af, mapas = ["-i", unido], None, ["-map", "0:v"]
        cmd = ["ffmpeg", "-v", "error", "-y", *entradas, *mapas]
        if vf:
            cmd += ["-vf", ",".join(vf)]
        if af:
            cmd += ["-af", af, "-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
        cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
                "-profile:v", "high", "-movflags", "+faststart", "-t", f"{total:.3f}", salida]
        os.makedirs(os.path.dirname(salida) or ".", exist_ok=True)
        run(cmd)

        if plan.get("portada"):
            t = plan["portada"].get("segundo", 0.4)
            run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", salida, "-frames:v", "1",
                 re.sub(r"\.mp4$", "", salida) + "-portada.jpg"])
    print(f"Listo: {salida} ({total:.2f} s)")


if __name__ == "__main__":
    main()
