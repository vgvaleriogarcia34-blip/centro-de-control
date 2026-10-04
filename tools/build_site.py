"""Genera la carpeta site/ lista para publicar en GitHub Pages.

site/index.html              -> landing
site/entrenador/index.html   -> entrenador (con prueba de 3 días)
site/entrenador/ejercicios.json
"""
import pathlib, shutil
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "site"
ARTIFACT = "https://claude.ai/artifact/QrvpS6wvt5ky19TN3LuZVN"
HEAD = ('<!doctype html><html lang="es"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>html,body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>')
def wrap(src, repl=()):
    s = (ROOT / src).read_text(encoding="utf-8")
    for a, b in repl: s = s.replace(a, b)
    return HEAD + s + "</body></html>"
if OUT.exists(): shutil.rmtree(OUT)
(OUT / "entrenador").mkdir(parents=True)
(OUT / "index.html").write_text(wrap("landing-mof/index.html", [(ARTIFACT, "entrenador/")]), encoding="utf-8")
(OUT / "entrenador" / "index.html").write_text(wrap("camara-criterio-mof/index.html"), encoding="utf-8")
shutil.copy(ROOT / "biblioteca-mof" / "ejercicios.json", OUT / "entrenador" / "ejercicios.json")
(OUT / ".nojekyll").write_text("")
print("site/ generado:", *[p.relative_to(ROOT) for p in OUT.rglob("*") if p.is_file()])
