#!/usr/bin/env python3
"""Rótulos editoriales «Impacto» para vídeo vertical: PNG transparentes 1080x1920.

Estilo modelado del vídeo de Impacto Madrid (oct. 2026):
- Antetítulo en versalitas espaciadas (mono IBM Plex o sans Inter), dorado apagado.
- Titular en Playfair Display: palabras normales en blanco roto, regular;
  palabras entre *asteriscos* en cursiva negrita con degradado dorado.
- Divisor fino dorado y subtítulo en Inter mayúsculas espaciadas, blanco.
- Banda oscura en degradado detrás del bloque, que se apoya en el tercio inferior.
- Cabecera diminuta mono espaciada arriba («IMPACTO 26 · DÍA 2»).
- Tarjeta de cierre: negro con grano, monograma en arco dorado, marca en dorado
  degradado, divisor, lugar espaciado y lema en cursiva dorada.

Uso como módulo (lo usa editar_viral.py) o por línea de comandos para previsualizar:
  python3 rotulos.py prueba DIR
"""
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
FUENTES = os.path.join(AQUI, "..", "fuentes")

BLANCO = (243, 239, 231)
DORADO_ALTO = (222, 196, 140)
DORADO_BAJO = (166, 128, 74)
DORADO_PLANO = (201, 172, 118)
FONDO_CIERRE = (10, 12, 17)


def fuente(nombre, tam, peso=None):
    rutas = {
        "serif": "PlayfairDisplay-VF.ttf",
        "serif-cursiva": "PlayfairDisplay-Italic-VF.ttf",
        "mono": "IBMPlexMono-Regular.ttf",
        "sans": "Inter-Regular.otf",
        "sans-light": "Inter-Light.otf",
        "sans-medium": "Inter-Medium.otf",
    }
    f = ImageFont.truetype(os.path.join(FUENTES, rutas[nombre]), tam)
    if peso and nombre.startswith("serif"):
        f.set_variation_by_axes([peso])
    return f


def ancho_espaciado(texto, f, tracking):
    return sum(f.getlength(ch) for ch in texto) + tracking * max(0, len(texto) - 1)


def dibujar_espaciado(d, x, y, texto, f, color, tracking):
    for ch in texto:
        d.text((x, y), ch, font=f, fill=color)
        x += f.getlength(ch) + tracking


def degradado_dorado(alto):
    g = Image.new("RGB", (1, alto))
    for yy in range(alto):
        t = yy / max(1, alto - 1)
        g.putpixel((0, yy), tuple(int(a + (b - a) * t) for a, b in zip(DORADO_ALTO, DORADO_BAJO)))
    return g


def texto_dorado(lienzo, xy, texto, f, tracking=0):
    """Pinta `texto` con degradado dorado vertical usando el texto como máscara."""
    x, y = xy
    caja = f.getbbox(texto)
    w = int(ancho_espaciado(texto, f, tracking)) + 8
    h = caja[3] + 8
    mascara = Image.new("L", (w, h), 0)
    dibujar_espaciado(ImageDraw.Draw(mascara), 0, 0, texto, f, 255, tracking)
    relleno = degradado_dorado(h).resize((w, h))
    lienzo.paste(relleno, (int(x), int(y)), mascara)


def segmentos(linea):
    """'lo *invisible*' -> [('lo ', False), ('invisible', True)]"""
    partes, dorado = [], False
    for trozo in linea.split("*"):
        if trozo:
            partes.append((trozo, dorado))
        dorado = not dorado
    return partes


def banda_oscura(W, H, desde=0.52, opacidad=0.78):
    banda = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(banda)
    y0 = int(H * desde)
    for y in range(y0, H):
        t = (y - y0) / (H - y0)
        d.line([(0, y), (W, y)], fill=(0, 0, 0, int(255 * opacidad * min(1, t * 1.6))))
    return banda


def rotulo(spec, W=1080, H=1920):
    """spec: antetitulo, lineas[] (con *dorado*), divisor, subtitulo, y (0-1 del alto),
    antetitulo_fuente ('mono'|'sans'), tamano, banda (bool)."""
    im = banda_oscura(W, H) if spec.get("banda", True) else Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    tam = spec.get("tamano", 96)
    f_normal = fuente("serif", tam, 400)
    f_dorado = fuente("serif-cursiva", int(tam * 1.04), 700)
    y = H * spec.get("y", 0.71)

    ante = spec.get("antetitulo")
    if ante:
        mono = spec.get("antetitulo_fuente", "mono") == "mono"
        fa = fuente("mono" if mono else "sans-medium", 27 if mono else 29)
        tr = 9 if mono else 8
        ante = ante.upper()
        d_x = (W - ancho_espaciado(ante, fa, tr)) / 2
        dibujar_espaciado(d, d_x, y, ante, fa, DORADO_PLANO, tr)
        # Playfair trae mucho aire sobre las mayúsculas: se compensa para que el
        # antetítulo quede a ~40 px del titular, como en el original.
        y += 44 - f_normal.getbbox("H")[1] * 0.35

    for linea in spec.get("lineas", []):
        partes = segmentos(linea)
        total = sum((f_dorado if g else f_normal).getlength(t) for t, g in partes)
        x = (W - total) / 2
        for t, g in partes:
            f = f_dorado if g else f_normal
            if g:
                texto_dorado(im, (x, y - tam * 0.02), t, f)
            else:
                d.text((x, y), t, font=f, fill=BLANCO)
            x += f.getlength(t)
        y += tam * 1.08

    if spec.get("divisor", bool(spec.get("subtitulo"))):
        y += 22
        d.line([((W - 140) / 2, y), ((W + 140) / 2, y)], fill=DORADO_PLANO + (230,), width=2)
        y += 26
    sub = spec.get("subtitulo")
    if sub:
        fs = fuente("sans", 29)
        sub = sub.upper()
        dibujar_espaciado(d, (W - ancho_espaciado(sub, fs, 5)) / 2, y, sub, fs, BLANCO, 5)
    return im


def cabecera(texto, W=1080, H=1920):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = fuente("mono", 19)
    texto = texto.upper()
    dibujar_espaciado(d, (W - ancho_espaciado(texto, f, 8)) / 2, 118, texto, f, (196, 186, 160, 210), 8)
    return im


def cierre(spec, W=1080, H=1920):
    """Tarjeta final opaca: monograma, marca, lugar y lema."""
    im = Image.new("RGB", (W, H), FONDO_CIERRE)
    rnd = random.Random(7)
    grano = Image.effect_noise((W, H), 18).point(lambda v: 128 + (v - 128) // 3)
    im = Image.blend(im, Image.merge("RGB", [grano] * 3), 0.06)
    d = ImageDraw.Draw(im)

    mono = spec.get("monograma")
    if mono:
        cx, cy, r = W / 2, 675, 104
        d.arc([cx - r, cy - r, cx + r, cy + r], start=40, end=320, fill=DORADO_PLANO, width=3)
        fm = fuente("serif", 88, 400)
        a, b = mono[0], mono[-1]
        wa, wb = fm.getlength(a), fm.getlength(b)
        d.text((cx - 14 - wa, cy - 62), a, font=fm, fill=BLANCO)
        d.line([(cx, cy - 40), (cx, cy + 40)], fill=DORADO_PLANO, width=2)
        d.text((cx + 14, cy - 62), b, font=fm, fill=BLANCO)
        del wb

    marca = spec.get("marca", "").upper()
    tam = spec.get("tamano_marca", 190)
    fmc = fuente("serif", tam, 600)
    while ancho_espaciado(marca, fmc, 6) > W - 150 and tam > 60:
        tam -= 6
        fmc = fuente("serif", tam, 600)
    rgb = im.convert("RGBA")
    texto_dorado(rgb, ((W - ancho_espaciado(marca, fmc, 6)) / 2, 855), marca, fmc, tracking=6)
    im = rgb.convert("RGB")
    d = ImageDraw.Draw(im)
    y = 855 + fmc.getbbox(marca)[3] + 34
    d.line([((W - 380) / 2, y), ((W + 380) / 2, y)], fill=DORADO_PLANO, width=2)
    lugar = spec.get("lugar", "").upper()
    if lugar:
        fl = fuente("sans-light", 58)
        dibujar_espaciado(d, (W - ancho_espaciado(lugar, fl, 22)) / 2, y + 36, lugar, fl, BLANCO, 22)
    lema = spec.get("lema")
    if lema:
        fz = fuente("serif-cursiva", 80, 500)
        d.text(((W - fz.getlength(lema)) / 2, y + 170), lema, font=fz, fill=DORADO_PLANO)
    del rnd
    return im.filter(ImageFilter.SMOOTH_MORE) if spec.get("suave") else im


def guardar(im, ruta):
    im.save(ruta)
    return ruta


if __name__ == "__main__" and len(sys.argv) > 2 and sys.argv[1] == "prueba":
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    guardar(rotulo({"antetitulo": "Ponente", "antetitulo_fuente": "sans", "lineas": ["Valerio", "*García*"],
                    "subtitulo": "Mentor de empresas"}), os.path.join(out, "nombre.png"))
    guardar(rotulo({"antetitulo": "La ponencia", "lineas": ["Hacer visible", "lo *invisible*"]}),
            os.path.join(out, "frase.png"))
    guardar(cabecera("Impacto 26   ·   Día 2"), os.path.join(out, "cabecera.png"))
    guardar(cierre({"monograma": "JC", "marca": "Impacto", "lugar": "Madrid", "lema": "Mañana, último día"}),
            os.path.join(out, "cierre.png"))
    print("Rótulos de prueba en", out)
