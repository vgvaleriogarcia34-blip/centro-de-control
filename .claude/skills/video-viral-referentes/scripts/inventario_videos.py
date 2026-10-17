#!/usr/bin/env python3
"""Inventario visual de una carpeta de vídeos (p. ej. ~/Downloads).

Para cada vídeo saca una hoja de contacto de 8 fotogramas repartidos por todo el
vídeo y anota duración, formato y si hay voz (energía de audio). Con las hojas se
decide a ojo cuáles muestran a Valerio en un escenario o hablando en público.

Uso:
  python3 inventario_videos.py CARPETA [--out inventario] [--min-seg 5] [--max 200]

Salida en --out: una hoja_NNN.jpg por vídeo e indice.md / indice.json con la ruta
de cada uno. No mueve, copia ni modifica los vídeos.
"""
import argparse
import json
import os
import subprocess

EXT = {".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm", ".3gp"}
FONT = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"


def sonda(ruta):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "format=duration:stream=codec_type,width,height", "-of", "json", ruta],
                       capture_output=True, text=True)
    try:
        d = json.loads(r.stdout)
        v = next(s for s in d["streams"] if s["codec_type"] == "video")
        return {"duracion_s": round(float(d["format"]["duration"]), 1),
                "ancho": v.get("width"), "alto": v.get("height"),
                "audio": any(s["codec_type"] == "audio" for s in d["streams"])}
    except (StopIteration, KeyError, ValueError):
        return None


def hoja(ruta, dur, salida):
    # 8 fotogramas equiespaciados; -ss antes de -i para que sea rápido en vídeos largos.
    tmp = []
    for k in range(8):
        t = dur * (k + 0.5) / 8
        f = f"{salida}.{k}.jpg"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", ruta, "-frames:v", "1",
                        "-vf", f"scale=-2:320,drawtext=fontfile={FONT}:text='{int(t // 60)}m{int(t % 60):02d}s':"
                               "x=4:y=4:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.7", f])
        if os.path.exists(f):
            tmp.append(f)
    if not tmp:
        return False
    entradas = sum([["-i", f] for f in tmp], [])
    subprocess.run(["ffmpeg", "-v", "error", "-y", *entradas, "-filter_complex",
                    f"{''.join(f'[{i}:v]' for i in range(len(tmp)))}hstack=inputs={len(tmp)}" if len(tmp) > 1
                    else "null", salida])
    for f in tmp:
        os.remove(f)
    return os.path.exists(salida)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("carpeta")
    p.add_argument("--out", default="inventario")
    p.add_argument("--min-seg", type=float, default=5)
    p.add_argument("--max", type=int, default=200)
    a = p.parse_args()
    os.makedirs(a.out, exist_ok=True)

    videos = []
    for raiz, _, archivos in os.walk(os.path.expanduser(a.carpeta)):
        for n in archivos:
            if os.path.splitext(n)[1].lower() in EXT and not n.startswith("._"):
                videos.append(os.path.join(raiz, n))
    videos.sort(key=os.path.getmtime, reverse=True)

    indice = []
    for ruta in videos[:a.max]:
        info = sonda(ruta)
        if not info or info["duracion_s"] < a.min_seg:
            continue
        n = len(indice) + 1
        salida = os.path.join(a.out, f"hoja_{n:03d}.jpg")
        if hoja(ruta, info["duracion_s"], salida):
            indice.append({"n": n, "ruta": ruta, "hoja": salida, **info})
            print(f"{n:3d}  {info['duracion_s']:7.1f}s  {ruta}")

    with open(os.path.join(a.out, "indice.json"), "w") as fh:
        json.dump(indice, fh, ensure_ascii=False, indent=2)
    with open(os.path.join(a.out, "indice.md"), "w") as fh:
        fh.write("| n | duración | formato | ruta | ¿escenario? |\n|---|---|---|---|---|\n")
        for v in indice:
            fh.write(f"| {v['n']} | {v['duracion_s']} s | {v['ancho']}x{v['alto']} | {v['ruta']} | |\n")
    print(f"{len(indice)} vídeos con hoja en {a.out}/")


if __name__ == "__main__":
    main()
