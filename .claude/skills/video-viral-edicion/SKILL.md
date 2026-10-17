---
name: video-viral-edicion
description: Reedita un vídeo corto (Reels, TikTok, Shorts) para que tenga opciones de viralizarse: gancho en el primer segundo, mejor momento delante, planos cortos al ritmo de la música, empuje de zoom, texto grande en pantalla que cuenta la historia, barra de progreso, CTA, sonido a -14 LUFS y exportación 1080x1920. Escribe también el copy del post. Usar cuando Valerio suba un vídeo y diga "hazlo viral", "edita este vídeo", "conviértelo en reel", "móntalo para TikTok/Instagram", "ponle textos/gancho", o tras analizar referentes con video-viral-referentes.
---

# Edición viral con un plan JSON

Todo el montaje sale de un `plan.json`; el script lo renderiza con ffmpeg. Para juntar
varios vídeos y fotos de escenario con voz y subtítulos, el flujo completo está en
`video-viral-escenario`; para letras premium, en `video-letras-editorial`. Cambiar textos
u orden es editar el JSON y volver a renderizar (~1,5 min para 15 s).

## 1. Diagnóstico (antes de tocar nada)

```bash
python3 -I .claude/skills/video-viral-referentes/scripts/analizar_video.py VIDEO --out analisis/original
```

Leer `contacto.jpg` y anotar, por segundo, qué pasa en cada plano. Con eso y el patrón de
`video-viral-referentes` (o sus valores por defecto) se detectan los fallos típicos:
arranque en negro o fundido, primer corte tarde (>2,5 s), planos largos (>3 s), cero texto
en pantalla en un vídeo sin voz, sonido demasiado alto (> -10 LUFS, las plataformas lo bajan
y suena aplastado), sin CTA.

## 2. Guion de texto en pantalla

El vídeo sin voz se cuenta con el texto. Reglas:

- **Plano 1 = el momento de más energía** del metraje + gancho en el fotograma 0.
  Fórmulas que funcionan: contraste ("Esto NO es una fiesta."), resultado primero,
  pregunta directa, "Nadie te cuenta…". No inventar cifras ni resultados que no consten.
- 2–4 palabras por plano, una idea por plano, frases que encadenan
  ("Primero… / Luego… / Y…"). Una línea **entera en MAYÚSCULAS** sale en amarillo.
- Máximo 2 líneas por plano (3 solo en el CTA): una línea más baja el texto encima de
  la cara. Comprobar en la hoja de contacto del resultado.
- Último plano: CTA de comentario con palabra clave ("Comenta TALLER") o pregunta.
- Duración final 12–20 s. Plano de 1,3–2,5 s.

## 3. El plan

Ver `plan-ejemplo.json`. Campos:

| Campo | Qué hace |
|---|---|
| `fuente`, `salida` | Rutas (relativas al plan o absolutas) |
| `clips[]` | `ini`/`fin` en segundos del original, `texto` (`\n` fuerza salto), opcionales `zoom`, `velocidad`, `foco` [x,y] 0–1, `estilo` |
| `estilo_texto` | `tamano` (px a 1080 de ancho), `max_caracteres` por línea, `posicion` arriba/centro/abajo, `color`, `color_destacado` |
| `audio` | `modo: continuo` usa la música del original sin trocear, empezando en `desde`; `lufs` objetivo; `fundido_final` |
| `ajustar_a_beats` | Estima el tempo y acorta cada plano para cortar en el pulso (nunca alarga: no pisa cortes del original) |
| `barra_progreso`, `zoom`, `color`, `portada` | Barra amarilla abajo, empuje de zoom por defecto, viveza de color, JPG de portada |
| `clips[].fuente` | Vídeo **o foto** propio de ese clip (si falta, usa `fuente` del plan). Fotos: `dur` en s y zoom lento (`zoom_fotos`, 1.15) |
| `audio.modo: clips` | Conserva el sonido de cada clip (voz, aplausos); `audio.musica` {archivo, volumen, desde} la pone debajo y se agacha cuando hay voz |
| `audio.archivo` | En `modo: continuo`, música de un archivo aparte en vez de la del vídeo `fuente` |
| `subtitulos` (plan o clip) | Subtítulos automáticos de 2–3 palabras (faster-whisper); `estilo_subtitulos` {tamano, posicion, color} |
| `look` | `vivo` (por defecto) o `editorial` (oscuro y cálido, con viñeta) |
| `clips[].rotulo`, `cabecera`, `clips[].cierre` | Rótulos editoriales dorados, cabecera fija y tarjeta final: ver la skill `video-letras-editorial` |

Para elegir `ini`/`fin`, no cruzar los `cortes_s` del original (salvo que se quiera) y
dejar fuera fundidos a negro y planos movidos.

```bash
python3 -I .claude/skills/video-viral-edicion/scripts/editar_viral.py plan.json
```

## 4. Control de calidad

1. Pasar `analizar_video.py --sin-voz` al resultado: 1080x1920, primer corte < 2,5 s,
   plano medio ≤ 2,5 s, LUFS ≈ -14.
2. Hoja de contacto a 2 fps y **mirarla**: texto legible, sin tapar caras, dentro de
   la zona segura (ni arriba del todo ni en el 20 % inferior / lateral derecho), sin
   fotogramas negros ni cortes a mitad de un plano ajeno.
3. Corregir el JSON y repetir.

## 5. Entrega

- El MP4 y la portada (enviar con SendUserFile; no subir vídeos al repo).
- Copy del post: primera línea = gancho; 3–5 líneas que cuentan el porqué; CTA con la
  misma palabra clave del vídeo; 3–5 hashtags de nicho.
- 2 variantes de gancho para probar (mismo vídeo, cambia solo el texto del plano 1).
- Publicar con sonido en tendencia si la plataforma lo permite (sustituye la música;
  el plugin Virlo da los sonidos en tendencia).
