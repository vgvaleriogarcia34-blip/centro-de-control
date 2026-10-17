---
name: video-viral-referentes
description: Analiza vídeos cortos, imágenes y copy de los referentes top del mercado (Reels, TikTok, Shorts) y saca el patrón que se puede copiar: gancho de los 3 primeros segundos, ritmo de cortes, texto en pantalla, sonido, estructura y copy del post. Usar cuando Valerio diga "analiza a los tops", "qué hacen los que más venden", "por qué este vídeo se hizo viral", "estudia a la competencia en Reels/TikTok", "ficha de este vídeo", o antes de editar un vídeo con video-viral-edicion.
---

# Referentes virales: medir antes de copiar

Sale de aquí un **patrón** con cifras, no opiniones. El patrón alimenta el plan de
`video-viral-edicion`.

## 1. Conseguir los referentes

Por orden de preferencia:

1. **Plugin Virlo** (si está instalado): `niche-analysis`, `trend-scout` y
   `creator-deep-dive` dan los vídeos que más superan a su propio canal, sonidos y
   hashtags en tendencia. Es la mejor fuente para *qué* elegir.
2. **Skill `youtube-fe:yt-viral`** para Shorts: ordena por vídeos que superan a su canal.
3. **Archivos subidos por Valerio** (descargados del móvil o con SnapTik/SaveFrom): es lo
   más fiable, porque YouTube, TikTok e Instagram bloquean descargas desde este
   contenedor ("Sign in to confirm you're not a bot").
4. **URL directa** con `--cookies cookies.txt` exportado del navegador, si se tiene.

Elegir 5–10 vídeos **del mismo formato** que el nuestro (aquí: montaje de evento /
taller sin voz) y que hayan superado claramente la media de su cuenta. Un vídeo viral de
otro formato no enseña nada útil.

## 2. Ficha técnica de cada vídeo

```bash
python3 -I .claude/skills/video-viral-referentes/scripts/analizar_video.py VIDEO_O_URL \
  --out analisis/<nombre> --copy "texto del post"
```

Da `ficha.json`, `ficha.md`, `gancho.jpg` (primeros 3 s a 6 fps) y `contacto.jpg`
(1 fps). Mide: duración, 9:16, planos y cortes por 10 s, primer corte, LUFS, si hay voz y
qué dice (faster-whisper; las alucinaciones de Whisper sobre música se descartan).

Después **mirar las dos hojas de contacto** (Read sobre los .jpg) y completar a ojo:

| Qué mirar | Pregunta |
|---|---|
| Fotograma 0 | ¿Hay ya acción, cara o texto? ¿O arranca en negro/fundido? |
| Gancho (0–3 s) | Escribir la promesa o tensión en una frase. ¿Qué fórmula es? (contraste "esto no es X", resultado primero, pregunta, cifra, "nadie te cuenta") |
| Texto en pantalla | Tamaño, posición, cuántas palabras por plano, palabra destacada en color |
| Ritmo | Plano medio en s; ¿cortes al golpe de música? |
| Cierre | CTA, bucle con el inicio, pregunta para comentarios |
| Copy | Primera línea (lo que se ve sin "más"), longitud, CTA, hashtags |

## 3. El patrón

Juntar las fichas en una tabla (una fila por vídeo) y sacar la **mediana** de duración,
plano medio, primer corte y nº de palabras por texto, más las fórmulas de gancho que se
repiten. Eso es el patrón. Escribirlo así:

```
PATRÓN (n=7 referentes de montaje de evento)
- Duración: 12–18 s · plano medio 1,5–2 s · primer corte antes de 2,5 s
- Gancho: contraste ("Esto NO es…") sobre el plano de más energía, texto en 0,0 s
- Texto: 2–4 palabras por plano, blanco con borde negro, 1 palabra en amarillo
- Cierre: CTA de comentario con palabra clave; el último plano enlaza con el primero
- Copy: 1.ª línea repite el gancho; 3–5 líneas; CTA; 3–5 hashtags de nicho
```

Si no hay referentes disponibles, usar como base los valores de arriba (son los habituales
en cortos que funcionan en 2025–2026) y decirlo: es una hipótesis, no una medición.

## 4. Buscar metraje propio en una carpeta (Descargas, Fotos…)

Solo funciona en una sesión que corra en el ordenador de Valerio (Claude Desktop o
`claude remote-control`); una sesión en la nube no ve sus carpetas.

```bash
python3 -I .claude/skills/video-viral-referentes/scripts/inventario_videos.py ~/Downloads --out inventario
# Fotos en macOS: ~/Pictures (la fototeca de Fotos hay que exportarla antes a una carpeta)
```

Saca una hoja de 8 fotogramas por vídeo (`hoja_NNN.jpg`) e `indice.md`. Mirar las
hojas con Read y marcar en el índice las que muestran a Valerio **en un escenario o
hablando en público** (micrófono de diadema o de mano, público de espaldas, pantalla o
atril detrás). Esas son la materia prima de `video-viral-edicion`. No mueve ni copia
nada.

## 5. Diagnóstico del vídeo propio

Pasar el mismo script al vídeo de Valerio y comparar fila a fila con el patrón. Cada
diferencia es un cambio del plan de edición.
