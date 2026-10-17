#!/usr/bin/env python3
"""Monta un vídeo corto en clave viral a partir de un plan JSON.

Hace lo que hacen los cortos que funcionan: el mejor momento delante, planos
cortos, empuje de zoom en cada plano, texto grande en pantalla que cuenta la
historia aunque no haya voz, barra de progreso, cortes al ritmo de la música,
sonido a -14 LUFS y exportación 1080x1920 H.264 lista para Reels/TikTok/Shorts.

Admite varias fuentes (cada clip puede traer su `fuente`, vídeo o foto), conservar
la voz de quien habla (`audio.modo: clips`, con música de fondo opcional) y
subtítulos automáticos palabra a palabra (`subtitulos: true`, con faster-whisper).

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
IMAGENES = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".bmp"}
# Rótulos editoriales (skill video-letras-editorial), cargados solo si el plan los usa.
RUTA_ROTULOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                            "video-letras-editorial", "scripts")
LOOKS = {
    "vivo": "eq=contrast=1.08:saturation=1.18:brightness=0.01",
    "editorial": "eq=contrast=1.06:saturation=0.82:brightness=-0.035,"
                 "colorbalance=rs=0.03:bs=-0.02:rh=0.02,vignette=PI/4.2",
}
_whisper = None


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


def es_imagen(ruta):
    return os.path.splitext(ruta)[1].lower() in IMAGENES


def duracion(c):
    """Duración en el montaje: `dur` para fotos, (fin-ini)/velocidad para vídeo."""
    if es_imagen(c["_fuente"]):
        return float(c.get("dur", 2.5))
    return (c["fin"] - c["ini"]) / c.get("velocidad", 1.0)


def ajustar_a_beats(clips, pulsos, minimo=0.8):
    """Acorta cada plano para que el corte caiga en el pulso anterior.

    Solo acorta: alargar podría pisar un corte del original que hay justo después de `fin`.
    """
    t = 0.0
    for c in clips:
        dur = duracion(c)
        validos = [p for p in pulsos if minimo <= p - t <= dur + 1e-3]
        if validos:
            objetivo = max(validos)
            if es_imagen(c["_fuente"]):
                c["dur"] = round(objetivo - t, 3)
            else:
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


def subtitulos(src, c, carpeta, i, estilo):
    """drawtext por grupo de 2–3 palabras, sincronizado con la voz del clip."""
    global _whisper
    import numpy as np
    from faster_whisper import WhisperModel
    wav = os.path.join(carpeta, f"sub{i:02d}.wav")
    run(["ffmpeg", "-v", "error", "-y", "-ss", str(c["ini"]), "-t", str(c["fin"] - c["ini"]), "-i", src,
         "-vn", "-ac", "1", "-ar", "16000", wav])
    with wave.open(wav) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    if _whisper is None:
        _whisper = WhisperModel("small", compute_type="int8")
    segs, _ = _whisper.transcribe(a, language="es", word_timestamps=True, vad_filter=True)
    palabras = [w for s in segs if s.no_speech_prob < 0.6 for w in (s.words or [])]
    vel = c.get("velocidad", 1.0)
    grupos, actual = [], []
    for w in palabras:
        actual.append(w)
        texto = " ".join(x.word.strip() for x in actual)
        if len(actual) >= 3 or len(texto) > 16 or re.search(r"[.,?!]$", w.word.strip()):
            grupos.append(actual)
            actual = []
    if actual:
        grupos.append(actual)
    tam = estilo.get("tamano", 84)
    # Por defecto abajo (bajo los textos «abajo» del plan); arriba si el clip lleva rótulo editorial.
    pos = estilo.get("posicion") or ("arriba" if c.get("rotulo") else "abajo")
    y = {"arriba": 0.22, "centro": 0.50, "abajo": 0.70}[pos]
    capas = []
    for j, g in enumerate(grupos):
        texto = " ".join(x.word.strip() for x in g).upper()
        if "AMARA.ORG" in texto:
            continue
        ini, fin = g[0].start / vel, g[-1].end / vel
        if j + 1 < len(grupos):
            fin = max(fin, min(grupos[j + 1][0].start / vel, fin + 0.4))
        ruta = os.path.join(carpeta, f"s{i}_{j}.txt")
        with open(ruta, "w") as fh:
            fh.write(texto)
        destacar = any(len(re.sub(r"\W", "", x.word)) >= 7 or re.search(r"\d", x.word) for x in g)
        color = estilo.get("color_destacado", "#FFD400") if destacar else estilo.get("color", "white")
        capas.append(
            f"drawtext=fontfile={estilo.get('fuente', FUENTE_LETRA)}:textfile={ruta}:fontsize={tam}:"
            f"fontcolor={color}:borderw={estilo.get('borde', 8)}:bordercolor=black:"
            f"x=(w-text_w)/2:y=h*{y}:enable='between(t,{ini:.3f},{fin:.3f})'")
    return capas


def rotulos():
    if RUTA_ROTULOS not in sys.path:
        sys.path.insert(0, RUTA_ROTULOS)
    import rotulos as r
    return r


def png_rotulo(spec, W, H, carpeta, i):
    return rotulos().guardar(rotulos().rotulo(spec, W, H), os.path.join(carpeta, f"rotulo{i:02d}.png"))


def png_cabecera(texto, W, H, carpeta):
    ruta = os.path.join(carpeta, "cabecera.png")
    if not os.path.exists(ruta):
        rotulos().guardar(rotulos().cabecera(texto, W, H), ruta)
    return ruta


def render_clip(c, i, plan, carpeta):
    src = c["_fuente"]
    W, H = plan.get("resolucion", [1080, 1920])
    fps = plan.get("fps", 30)
    vel = c.get("velocidad", 1.0)
    dur = duracion(c)
    foto = es_imagen(src)
    zoom = c.get("zoom", plan.get("zoom_fotos", 1.15) if foto else plan.get("zoom", 1.06))
    frames = max(1, round(dur * fps))
    # Empuje de zoom lineal de 1 a `zoom` a lo largo del plano, centrado (o en foco x,y 0-1).
    fx, fy = c.get("foco", [0.5, 0.45])
    filtros = [] if foto else [f"setpts=(PTS-STARTPTS)/{vel}"]
    filtros += [
        f"scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase",
        f"crop={W * 2}:{H * 2}",
        f"zoompan=z='1+({zoom}-1)*on/{frames}':d=1:s={W}x{H}:fps={fps}:"
        f"x='(iw-iw/zoom)*{fx}':y='(ih-ih/zoom)*{fy}'",
    ]
    if c.get("color", plan.get("color", True)) and not c.get("cierre"):
        filtros.append(LOOKS[plan.get("look", "vivo")])
    filtros += capa_texto(c.get("texto", ""), {**plan.get("estilo_texto", {}), **c.get("estilo", {})},
                          carpeta, i, dur)
    if not foto and c.get("subtitulos", plan.get("subtitulos", False)):
        filtros += subtitulos(src, c, carpeta, i, plan.get("estilo_subtitulos", {}))

    # Capas PNG encima: cabecera fija y rótulo editorial con entrada/salida en fundido.
    capas = []
    if plan.get("cabecera") and not c.get("cierre") and not c.get("sin_cabecera"):
        capas.append((png_cabecera(plan["cabecera"], W, H, carpeta), False))
    if c.get("rotulo"):
        capas.append((png_rotulo(c["rotulo"], W, H, carpeta, i), True))
    entradas_capas = sum([["-loop", "1", "-framerate", str(fps), "-t", f"{dur:.3f}", "-i", p] for p, _ in capas], [])
    grafo = f"[0:v]{','.join(filtros)}[b0]"
    for k, (_, animada) in enumerate(capas, start=1):
        if animada:
            # Si el clip anterior/siguiente lleva el mismo rótulo, no hay fundido en ese corte:
            # el texto cruza el corte quieto, como en el original.
            fundidos, sube = [], "0"
            if not c.get("_rotulo_sigue_de_antes"):
                fundidos.append("fade=t=in:st=0.12:d=0.45:alpha=1")
                sube = "'14*max(0,1-t/0.55)'"
            if not c.get("_rotulo_sigue_despues"):
                fundidos.append(f"fade=t=out:st={max(0.5, dur - 0.4):.3f}:d=0.35:alpha=1")
            grafo += (f";[{k}:v]{','.join(['format=rgba'] + fundidos)}[o{k}]"
                      f";[b{k - 1}][o{k}]overlay=0:{sube}[b{k}]")
        else:
            grafo += f";[{k}:v]format=rgba[o{k}];[b{k - 1}][o{k}]overlay=0:0[b{k}]"
    grafo += f";[b{len(capas)}]null[v]"
    entrada = (["-loop", "1", "-framerate", str(fps), "-t", f"{dur:.3f}", "-i", src] if foto else
               ["-ss", str(c["ini"]), "-t", str(c["fin"] - c["ini"]), "-i", src])
    salida = os.path.join(carpeta, f"clip{i:02d}.mp4")
    run(["ffmpeg", "-v", "error", "-y", *entrada, *entradas_capas, "-filter_complex", grafo, "-map", "[v]",
         "-an", "-frames:v", str(frames),
         "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", salida])
    return salida, frames / fps


def audio_clip(c, i, d, carpeta):
    """Sonido original del clip (voz, aplausos) o silencio si es foto o no tiene audio."""
    salida = os.path.join(carpeta, f"a{i:02d}.wav")
    src = c["_fuente"]
    tiene = not es_imagen(src) and "audio" in subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type",
         "-of", "csv=p=0", src], capture_output=True, text=True).stdout
    if tiene:
        run(["ffmpeg", "-v", "error", "-y", "-ss", str(c["ini"]), "-t", str(c["fin"] - c["ini"]), "-i", src,
             "-vn", "-af", f"atempo={c.get('velocidad', 1.0)},apad", "-t", f"{d:.3f}",
             "-ar", "48000", "-ac", "2", salida])
    else:
        run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
             "-t", f"{d:.3f}", salida])
    return salida


def main():
    with open(sys.argv[1]) as fh:
        plan = json.load(fh)
    base = os.path.dirname(os.path.abspath(sys.argv[1]))

    def ruta(p):
        return p if os.path.isabs(os.path.expanduser(p)) else os.path.join(base, p)

    fuente = ruta(plan["fuente"]) if plan.get("fuente") else None
    salida = ruta(plan["salida"])
    clips = plan["clips"]
    cierres = tempfile.mkdtemp()
    for n, c in enumerate(clips):
        if c.get("cierre"):
            W, H = plan.get("resolucion", [1080, 1920])
            c["fuente"] = rotulos().guardar(rotulos().cierre(c["cierre"], W, H), os.path.join(cierres, f"cierre{n}.png"))
            c.setdefault("zoom", 1.03)
            c.setdefault("dur", 3.0)
        c["_fuente"] = os.path.expanduser(ruta(c["fuente"])) if c.get("fuente") else fuente
        if not c["_fuente"]:
            sys.exit("Clip sin fuente y el plan no tiene `fuente` por defecto.")
    for antes, despues in zip(clips, clips[1:]):
        if antes.get("rotulo") and antes.get("rotulo") == despues.get("rotulo"):
            antes["_rotulo_sigue_despues"] = despues["_rotulo_sigue_de_antes"] = True
    audio = plan.get("audio", {})
    modo = audio.get("modo", "continuo")
    pista = ruta(audio["archivo"]) if audio.get("archivo") else fuente

    if plan.get("ajustar_a_beats") and modo == "continuo":
        total = sum(duracion(c) for c in clips)
        pulsos, bpm = beats(pista, audio.get("desde", 0), total)
        clips = ajustar_a_beats(clips, pulsos)
        print(f"Tempo estimado: {bpm} BPM")

    with tempfile.TemporaryDirectory() as carpeta:
        partes, sonidos, total = [], [], 0.0
        for i, c in enumerate(clips):
            ruta_clip, d = render_clip(c, i, plan, carpeta)
            partes.append(ruta_clip)
            if modo == "clips":
                sonidos.append(audio_clip(c, i, d, carpeta))
            origen = os.path.basename(c["_fuente"])
            tramo = f"{c.get('dur', 2.5)} s de foto" if es_imagen(c["_fuente"]) else f"{c['ini']:.2f}-{c['fin']:.2f} s"
            print(f"plano {i + 1}: {origen} {tramo} → {total:.2f}-{total + d:.2f} s · {c.get('texto', '')!r}")
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
        norma = f"loudnorm=I={audio.get('lufs', -14)}:TP=-1.0:LRA=11"
        cierre = f"afade=t=in:d=0.05,afade=t=out:st={max(0, total - fundido):.3f}:d={fundido}"
        af, fc = None, None
        if modo == "continuo":
            entradas = ["-i", unido, "-ss", str(audio.get("desde", 0)), "-t", f"{total:.3f}", "-i", pista]
            af = f"{cierre},{norma}"
            mapas = ["-map", "0:v", "-map", "1:a"]
        elif modo == "clips":
            lista_a = os.path.join(carpeta, "lista_a.txt")
            with open(lista_a, "w") as fh:
                fh.writelines(f"file '{p}'\n" for p in sonidos)
            voz = os.path.join(carpeta, "voz.wav")
            run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lista_a, "-c", "copy", voz])
            entradas = ["-i", unido, "-i", voz]
            musica = audio.get("musica")
            if musica:
                # Música por debajo de la voz; se agacha sola cuando hay voz (sidechain).
                entradas += ["-stream_loop", "-1", "-ss", str(musica.get("desde", 0)), "-i", ruta(musica["archivo"])]
                fc = (f"[1:a]asplit=2[v][sc];[2:a]volume={musica.get('volumen', 0.25)}[m];"
                      f"[m][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md];"
                      f"[v][md]amix=inputs=2:duration=first:normalize=0,{cierre},{norma}[a]")
                mapas = ["-map", "0:v", "-map", "[a]"]
            else:
                af = f"{cierre},{norma}"
                mapas = ["-map", "0:v", "-map", "1:a"]
        else:
            entradas, mapas = ["-i", unido], ["-map", "0:v"]
        cmd = ["ffmpeg", "-v", "error", "-y", *entradas]
        if fc:
            cmd += ["-filter_complex", fc]
        cmd += mapas
        if vf:
            cmd += ["-vf", ",".join(vf)]
        if af:
            cmd += ["-af", af]
        if af or fc:
            cmd += ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
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
