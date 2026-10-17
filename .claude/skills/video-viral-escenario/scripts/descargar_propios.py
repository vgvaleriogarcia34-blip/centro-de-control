#!/usr/bin/env python3
"""Lista y descarga los vídeos propios más vistos de YouTube (o Instagram) con yt-dlp.

Ordena por visualizaciones el canal (pestañas Vídeos y Shorts), guarda ranking.md y
descarga los N primeros con su transcripción automática, listos para momentos.py.

Uso:
  python3 descargar_propios.py https://www.youtube.com/@ValerioGarciaMentor --top 6 --out propios
  python3 descargar_propios.py URL --cookies cookies.txt       # si YouTube pide "no soy un robot"
  python3 descargar_propios.py https://www.instagram.com/USUARIO/ --cookies cookies.txt

Desde servidores en la nube YouTube devuelve 403 / "Sign in to confirm you're not a bot"
e Instagram redirige al login: ejecutarlo en el ordenador de Valerio, o pasar un
cookies.txt exportado de su navegador (extensión "Get cookies.txt LOCALLY").
Con --solo-ranking no descarga nada (funciona también desde la nube para YouTube).
"""
import argparse
import json
import os
import subprocess
import sys


def ytdlp(args, cookies):
    extra = ["--cookies", cookies] if cookies else []
    return subprocess.run([sys.executable, "-m", "yt_dlp", *extra, *args], capture_output=True, text=True)


def listar(url, cookies):
    pestañas = [url.rstrip("/") + "/videos", url.rstrip("/") + "/shorts"] if "youtube.com/@" in url else [url]
    items = []
    for p in pestañas:
        r = ytdlp(["--flat-playlist", "-J", p], cookies)
        if r.returncode:
            print(f"No se pudo listar {p}: {r.stderr.strip()[-200:]}", file=sys.stderr)
            continue
        for e in json.loads(r.stdout).get("entries", []):
            items.append({"id": e.get("id"), "titulo": e.get("title"), "vistas": e.get("view_count") or 0,
                          "duracion": e.get("duration"), "tipo": "short" if p.endswith("/shorts") else "video",
                          "url": e.get("url") or e.get("webpage_url")})
    return sorted(items, key=lambda x: -x["vistas"])


def main():
    p = argparse.ArgumentParser()
    p.add_argument("url")
    p.add_argument("--top", type=int, default=6)
    p.add_argument("--out", default="propios")
    p.add_argument("--cookies")
    p.add_argument("--solo-ranking", action="store_true")
    a = p.parse_args()
    os.makedirs(a.out, exist_ok=True)

    items = listar(a.url, a.cookies)
    with open(os.path.join(a.out, "ranking.md"), "w") as fh:
        fh.write("| # | vistas | tipo | título | id |\n|---|---|---|---|---|\n")
        for i, it in enumerate(items, 1):
            fh.write(f"| {i} | {it['vistas']} | {it['tipo']} | {it['titulo']} | {it['id']} |\n")
    for i, it in enumerate(items[:a.top], 1):
        print(f"{i:2d}. {it['vistas']:6d} vistas · {it['tipo']:5s} · {it['titulo']}")
    if a.solo_ranking:
        return

    fallos = 0
    for it in items[:a.top]:
        destino = os.path.join(a.out, f"{it['id']}.%(ext)s")
        r = ytdlp(["-f", "bv*[height<=1920]+ba/b", "--merge-output-format", "mp4", "--write-auto-subs",
                   "--sub-langs", "es.*", "--sub-format", "vtt", "-o", destino, it["url"]], a.cookies)
        if r.returncode:
            fallos += 1
            print(f"✗ {it['id']}: {r.stderr.strip().splitlines()[-1][:160]}", file=sys.stderr)
        else:
            print(f"✓ {it['id']} descargado")
    if fallos:
        print(f"{fallos} descargas fallidas: ejecutar en el ordenador de Valerio o con --cookies.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
