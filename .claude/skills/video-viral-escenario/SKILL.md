---
name: video-viral-escenario
description: Flujo completo para convertir el material de Valerio en un escenario (ponencias, talleres, charlas, eventos) en vídeos virales. Busca los vídeos y fotos en sus carpetas (Descargas, Imágenes/Fotos, Escritorio) o en Google Drive, se queda con los que lo muestran hablando en público, encuentra los mejores momentos y monta una composición vertical con voz, subtítulos, gancho y CTA. Usar cuando Valerio diga "busca vídeos donde salgo en un escenario", "busca en Descargas/Fotos", "haz una composición con mis vídeos", "convierte mis ponencias en reels", "saca virales de mis charlas" o "busca vídeos ganadores en mi ordenador".
---

# De escenario a viral

Orquesta tres skills: `video-viral-referentes` (inventario y fichas), `video-viral-edicion`
(montaje) y `video-letras-editorial` (rótulos premium). Pasos en orden; no saltar el 2.

## 0. Dónde está el material

- **Ordenador de Valerio** (Descargas, Imágenes, Fotos, Escritorio): solo si esta sesión corre
  en su ordenador (Claude Desktop o `claude remote-control`). En una sesión en la nube **no se
  puede**: decirlo en una línea y pedir que arrastre los archivos al chat o abra la sesión local.
  Nunca inventar resultados de una carpeta que no se ha podido leer.
- **Google Drive**: listar con `search_files` (`mimeType contains 'video/'`, `'image/'`). Los
  archivos son privados: el conector los devuelve en base64 dentro de la conversación, así que
  solo vale para fotos pequeñas. Para vídeos, pedir que los suba o comparta.
- **Subidos al chat**: en `/root/.claude/uploads/...`.
- **Excluir siempre**: DNI, pasaportes, contratos, capturas con datos personales, aunque salgan
  en la búsqueda de imágenes.

## 1. Inventario visual

```bash
python3 -I .claude/skills/video-viral-referentes/scripts/inventario_videos.py ~/Downloads --out inventario/descargas
python3 -I .claude/skills/video-viral-referentes/scripts/inventario_videos.py ~/Pictures --out inventario/imagenes
# macOS Fotos: exportar antes el álbum a una carpeta; la fototeca no se lee directamente.
```

## 2. Quedarse con los de escenario

Mirar cada `hoja_NNN.jpg` (Read) y marcar en `indice.md` los que cumplen al menos dos de estas señales:
micrófono (diadema o de mano), público de espaldas o en filas, pantalla o diapositiva detrás,
tarima o atril, luz de escena; Valerio de pie y gesticulando.
Descartar los movidos, los oscuros, los de menos de 5 s y los que no muestran a Valerio.
Para las fotos, igual: sirven de plano de 2–2,5 s (zoom lento) o de portada.

## 3. Mejores momentos

Para cada vídeo elegido:

```bash
python3 -I .claude/skills/video-viral-escenario/scripts/momentos.py VIDEO --out momentos/NOMBRE.json
```

- **Con voz**: los candidatos (12–45 s) empiezan en una frase con gancho y acaban en un final de
  frase. Leer el texto: elegir los que se entienden solos y dicen algo que la audiencia no espera.
  Las reacciones del público (aplausos, risas) sirven de remate de 1–2 s.
- **Sin voz** (solo música): usar `analizar_video.py` y la hoja de contacto para elegir planos de
  energía (público de pie, aplausos, gestos amplios) y contar la historia con texto en pantalla.

## 4. Composición

Un plan de `video-viral-edicion` con `fuente` por clip (vídeos y fotos mezclados):

```json
{
  "salida": "escenario-viral.mp4",
  "subtitulos": true,
  "audio": {"modo": "clips", "lufs": -14,
            "musica": {"archivo": "musica.mp3", "volumen": 0.2}},
  "clips": [
    {"fuente": "~/Downloads/ponencia.mp4", "ini": 312.4, "fin": 321.0, "texto": "Nadie se atreve\na preguntarlo"},
    {"fuente": "~/Pictures/escenario.jpg", "dur": 2.0, "texto": "Y la respuesta\nduele."},
    {"fuente": "~/Downloads/taller.mov", "ini": 45.2, "fin": 52.8, "texto": "Comenta FAMILIA",
     "estilo": {"posicion": "abajo"}}
  ]
}
```

- `audio.modo: clips` conserva la voz y los aplausos de cada clip; la música de fondo se agacha
  sola cuando habla (sidechain). Si ningún clip tiene voz, usar `modo: continuo` con la música.
- `subtitulos: true` transcribe y quema subtítulos de 2–3 palabras en mayúsculas (amarillo en
  palabras largas o cifras). Van abajo; suben arriba si el clip lleva `rotulo` editorial.
- Estructura que funciona: **gancho** (la frase más fuerte, 3–8 s) → **desarrollo** (1–2
  momentos, con algún plano de público o foto entre medias) → **remate** (aplauso, frase final)
  → **CTA**. Duración total: 20–45 s si hay voz, 12–20 s si solo hay música.
- Para piezas de marca o evento, usar rótulos de `video-letras-editorial` (`look: editorial`,
  `rotulo`, `cabecera`, `cierre`).

```bash
python3 -I .claude/skills/video-viral-edicion/scripts/editar_viral.py plan.json
```

## 5. Control y entrega

Mismo control de calidad que `video-viral-edicion` (§4): hoja de contacto del resultado, texto
fuera de las caras y de la zona de botones, LUFS ≈ -14, sin fotogramas negros. Entregar el MP4 con
SendUserFile, la portada y el copy (gancho, 3–5 líneas, CTA con la palabra clave, 3–5 hashtags).
Frases de terceros (clientes, asistentes): solo con permiso; anonimizar según la política de FE.
