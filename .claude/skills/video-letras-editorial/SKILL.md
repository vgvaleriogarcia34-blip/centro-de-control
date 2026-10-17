---
name: video-letras-editorial
description: Rotula vídeos verticales con el estilo editorial «Impacto» (modelado del vídeo de Impacto Madrid, oct. 2026): titular en Playfair Display con una palabra en cursiva dorada, antetítulo en versalitas espaciadas, divisor fino, subtítulo en Inter, banda oscura, cabecera mínima, look oscuro y tarjeta de cierre negra con monograma y marca en dorado. Usar cuando Valerio pida "letras como las de Impacto", "rótulos elegantes", "estilo editorial", "letras doradas", "rótulo de ponente", "tarjeta final", "que se vea premium", o para eventos, ponencias y marca personal (frente al estilo viral de letras gordas de video-viral-edicion).
---

# Letras editoriales «Impacto»

Dos estilos conviven en `video-viral-edicion`:

| | Viral (por defecto) | Editorial (esta skill) |
|---|---|---|
| Letra | Inter ExtraBold, blanco con borde negro, amarillo | Playfair Display blanco roto + cursiva **dorada** |
| Dónde | Arriba, grande | Tercio inferior, centrado, sobre banda oscura |
| Entra | Corte seco | Fundido 0,45 s subiendo 14 px; fijo si cruza un corte |
| Color | Vivo, saturado | Oscuro, cálido, viñeta (`look: editorial`) |
| Cierre | CTA en texto | Tarjeta negra con grano, monograma, marca dorada |
| Para | Captar en frío, alcance | Eventos, ponencias, marca personal, premium |

Se pueden mezclar: gancho viral en el plano 1 y rótulos editoriales después, pero no en el mismo plano.

## Anatomía (medida sobre el original, 1080x1920)

- **Cabecera**: IBM Plex Mono 19 px, versalitas, espaciado 8, beige al 80 %, y=118. Ej.: `IMPACTO 26 · DÍA 2`.
- **Antetítulo**: IBM Plex Mono 27 px espaciado 9 (o Inter Medium 29 px espaciado 8 para «PONENTE»), dorado `#C9AC76`.
- **Titular**: Playfair Display 96 px. Blanco roto `#F3EFE7` en regular; lo marcado `*así*` en cursiva peso 700 con degradado `#DEC48C → #A6804A`. 1–2 líneas, interlineado 1,08. El bloque arranca al 71 % del alto.
- **Divisor**: 140 px x 2 px dorado. **Subtítulo**: Inter 29 px, mayúsculas, espaciado 5, blanco.
- **Banda**: negro de 0 a 78 % desde el 52 % del alto hasta abajo.
- **Cierre**: fondo `#0A0C11` con grano; arco dorado (r=104 px) con dos iniciales separadas por una barra; marca en Playfair 600 dorado degradado (se ajusta al ancho); divisor 380 px; lugar en Inter Light espaciado 22; lema en Playfair cursiva dorado.

## Cómo usarlo en un plan de `video-viral-edicion`

```json
{
  "look": "editorial",
  "barra_progreso": false,
  "cabecera": "Familias Empresarias   ·   Taller",
  "clips": [
    {"ini": 1.0, "fin": 4.0, "rotulo": {"antetitulo": "Ponente", "antetitulo_fuente": "sans",
      "lineas": ["Valerio", "*García*"], "subtitulo": "Mentor de empresas"}},
    {"ini": 4.1, "fin": 5.9, "rotulo": {"antetitulo": "La ponencia", "lineas": ["Hacer visible", "lo *invisible*"]}},
    {"ini": 12.0, "fin": 14.6, "rotulo": {"lineas": ["Formas de poder", "*ver*"]}},
    {"cierre": {"monograma": "FE", "marca": "Familias", "lugar": "Empresarias", "lema": "Comenta TALLER"}, "dur": 3.0}
  ]
}
```

Campos del `rotulo`: `antetitulo`, `antetitulo_fuente` (`mono` | `sans`), `lineas` (lista; `*palabra*` = cursiva dorada), `subtitulo` (pone divisor), `divisor`, `tamano` (96), `y` (0.71), `banda` (true).
Campos del `cierre`: `monograma` (2 letras), `marca`, `lugar`, `lema`, `tamano_marca`; duración con `dur`.

Patrones del original que conviene repetir:
1. **Presentación**: «PONENTE / Nombre / *Apellido* / — / CARGO» sobre el primer plano en el que se ve bien a la persona.
2. **Tesis**: «LA PONENCIA / frase / *palabra clave*», que se mantiene sobre 2–3 planos seguidos (el mismo `rotulo` en clips consecutivos no parpadea en el corte).
3. **Lista**: primera línea fija («Formas de poder») y la palabra dorada que cambia en cada plano (*ver*, *dar*, *conectar*, *cuidar*): ritmo sin cansar.
4. **Cierre**: tarjeta de marca con un lema de urgencia o CTA («Mañana, último día»).

Reglas: una sola palabra o grupo dorado por rótulo; máximo 2 líneas de titular (unos 16 caracteres por línea a 96 px); nada de emojis. Usar el apellido o la palabra que carga el sentido como dorado.

## Previsualizar sin renderizar vídeo

```bash
python3 -I .claude/skills/video-letras-editorial/scripts/rotulos.py prueba /tmp/rotulos
```

Genera `nombre.png`, `frase.png`, `cabecera.png` y `cierre.png`. Superponerlos a un fotograma con
`ffmpeg -i fotograma.png -i nombre.png -filter_complex overlay out.png` y mirar el resultado antes de montar.

Fuentes incluidas en `fuentes/` (licencia OFL): Playfair Display (variable), IBM Plex Mono, Inter.
