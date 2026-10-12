# Recuerdo · beta 0.3

**Tus fotos de viaje, con nombre e historia.** Toca una foto y descubre dónde estabas; toca la iglesia y te dice cuál es, cuándo se construyó y una curiosidad; y después revive el viaje como una historia narrada.

App web instalable (PWA), pensada para móvil. Funciona sin servidor propio, con fuentes abiertas, y se puede ampliar con IA de visión (Claude) cuando hay clave de API.

## Probarla

```bash
cd recuerdo
npm install                      # solo hace falta para activar la IA
npm start                        # http://localhost:8080  (identificación por ubicación)
ANTHROPIC_API_KEY=... npm start  # + IA de visión e historia escrita por IA
```

También se puede publicar tal cual en cualquier hosting estático (GitHub Pages, Netlify…). Sin servidor, la IA queda desactivada y todo lo demás funciona.

La primera vez se carga un **viaje de ejemplo (Sevilla, 2 días)**, para que nadie se encuentre una pantalla vacía.

## Experiencia: lo conocido + lo nuestro

| Patrón conocido | De dónde viene | En Recuerdo |
|---|---|---|
| Aros de historias + visor con barras, toque izq./der., mantener para pausar | Instagram | Cada viaje es una historia **narrada por voz**, con efecto Ken Burns y etiqueta del monumento |
| Doble toque = me gusta, con corazón animado | Instagram | Marca favoritas; las favoritas protagonizan la historia |
| Etiquetas sobre la foto | Instagram (etiquetas de producto) | **Puntos que laten** sobre cada monumento o restaurante: es la firma de la marca |
| Hoja inferior arrastrable con ficha del lugar | Google Maps / Apple Maps | Ficha con nombre, historia, «¿Sabías que…?», cuándo estuviste, escuchar y corregir |
| Cuadrícula por días con cabeceras fijas | Google Fotos | Días → paradas («Giralda · 10:12») |
| «Tal día como hoy» | Google Fotos / Facebook | Tarjeta «Hace 1 año» en el inicio |
| Barra inferior con botón central de crear | Instagram / TikTok | `+` para importar un viaje nuevo |
| Mapa con fotos como chinchetas | Apple Fotos | Mapa global y mapa del recorrido de cada viaje |

**Lo que nos diferencia:** saber *qué es* cada cosa de la foto (no solo dónde), la historia narrada con voz y con tus acompañantes («a las 11:42 estabais frente a la Giralda…»), y las notas de voz grabadas en el momento.

## Cómo identifica

```
Foto ─► EXIF: GPS · fecha/hora · orientación de la brújula · focal
         │
         ├─► Nominatim (OSM) ─────► calle, barrio, pueblo, país
         ├─► Wikipedia geosearch ─► monumentos con artículo, foto y texto
         └─► Overpass (OSM) ──────► restaurantes, cafés, patrimonio sin artículo
                │
                ▼
   Proyección sobre el encuadre: con la orientación y el campo de visión
   sabemos qué edificio queda a la izquierda, al centro o a la derecha
                │
                ▼ (opcional, servidor)
   Claude mira la imagen y CONFIRMA entre candidatos reales (no inventa),
   ajusta la posición de los puntos y escribe la frase para la historia
```

- Todo pasa por **caché local** (IndexedDB): cada lugar se consulta una sola vez. Es la semilla del banco de monumentos.
- Fotos sin GPS (WhatsApp, cámaras): se estima la ubicación con la foto más cercana en el tiempo (< 90 min) y se marca como aproximada.
- Las correcciones del usuario («¿No es esto?») se guardan con confianza máxima.
- Las fotos **no salen del dispositivo**. Con la IA activa solo se envía una copia reducida (1280 px) para analizarla.

## Estructura

```
recuerdo/
├── index.html, manifest.webmanifest, sw.js   PWA (instalable, sin conexión)
├── css/app.css          sistema visual (oscuro por defecto, modo claro, tokens)
├── js/
│   ├── app.js           arranque y rutas (#/, #/viaje/:id, #/mapa, #/importar…)
│   ├── views.js         pantallas: inicio, viaje, mapa, importar, recuerdos, ajustes
│   ├── viewer.js        visor inmersivo, puntos interactivos, fichas, notas de voz
│   ├── story.js         historias narradas a pantalla completa
│   ├── identify.js      motor de identificación (geo + IA)
│   ├── places.js        Nominatim, Wikipedia, Overpass, clasificación de lugares
│   ├── exif.js          lector EXIF propio (JPEG y HEIC)
│   ├── geo.js           distancias, rumbos, proyección en el encuadre
│   ├── trips.js         importación, viajes → días → paradas, narración local
│   ├── voice.js         síntesis de voz y grabación/transcripción de notas
│   ├── store.js         IndexedDB + caché
│   ├── ai.js            puente con el servidor de IA
│   ├── ui.js, util.js   hoja inferior, imágenes, fechas, iconos
│   └── demo.js          viaje de ejemplo
└── server/server.mjs    servidor estático + /api/identify y /api/story (Claude)
```

## Novedades 0.2 (mejoras tras la auditoría de experiencia)

- **Bienvenida** de tres pantallas la primera vez: qué hace, cómo se usa, por dónde empezar.
- **Viaje de ejemplo ilustrado** dentro de la app (`js/demo-art.js`): carga al instante, sin conexión, y los puntos caen exactamente sobre cada monumento.
- **Importación en dos tiempos:** el viaje aparece en segundos y los lugares se reconocen en segundo plano, con una consulta por parada en vez de una por foto. Si se cierra la app, continúa al volver.
- **Rescate de fotos sin ubicación** (`js/locate.js`): «¿Dónde fue esto?» con buscador de sitios, y los pasos exactos para que el iPhone conserve el GPS. Las fotos sin fecha ni GPS (WhatsApp) se quedan en el viaje.
- **Nunca una foto vacía:** bajo cada foto, «dónde estabas» y los lugares cercanos para tocar.
- **Fichas con datos rápidos** de Wikidata (año, estilo, arquitecto, altura, Patrimonio de la Humanidad) y «Leer más».
- **Añadir fotos a un viaje** ya creado (`#/importar/<id>`).
- **Copia de seguridad** en un archivo `.recuerdo` (todo o por viaje) y restauración (`js/backup.js`).
- **Medición anónima** (`js/analytics.js`): solo nombres de acción y números, sin identificador ni ubicaciones. Con el servidor se guardan en `data/events.jsonl`.

### Embudo que se mide

`app_open` → `onboarding_done` → `import_start` → `import_done` (fotos, con GPS, HEIC) → `location_assigned` → `photo_open` (puntos) → `spot_open` / `place_open` → `story_start` → `story_complete` → `share` · además `fav`, `note_saved`, `backup_export`.

## Novedades 0.3 (punto 2: lanzamiento)

- **Vídeo-recuerdo** (`js/video.js`, `js/music.js`): la historia del viaje como vídeo vertical 1080×1920 de ~45 s, con música generada en el propio móvil (sin derechos de autor), etiquetas de los monumentos y transiciones. Se graba en el dispositivo; MP4 (H.264) donde el navegador lo permite. Gratis con la marca «Hecho con Recuerdo», que hace de anuncio cada vez que se comparte.
- **Álbum para imprimir** (`js/album.js`): PDF de 21 × 21 cm a ~290 ppp con portada, un capítulo por día, una página por foto destacada (lugar, hora, nota) y página final con los lugares. Generador de PDF propio, sin dependencias.
- **Gratis y Premium** (`js/plans.js`): Premium = vídeo sin marca, álbum e historia con IA. Precios propuestos: 4,99 €/mes, 29,99 €/año, 6,99 € por viaje. **Durante la beta no se cobra**: el usuario elige el plan que pagaría (`plan_intent`) y Premium se activa gratis, lo que mide la disposición a pagar sin pasarela.
- Botón **«Vídeo y álbum»** en cada viaje (`js/create.js`).

Eventos nuevos: `video_start`, `video_done`, `album_start`, `album_done`, `album_export`, `print_intent`, `paywall_view`, `paywall_dismiss`, `plan_intent`.

## Límites conocidos de la beta

- **HEIC del iPhone:** se leen sus metadatos, pero solo Safari las dibuja. En el iPhone, el selector de fotos las convierte a JPEG. Hay que tocar «Opciones → Ubicación» para que conserven el GPS (la app lo explica).
- **Teselas del mapa:** se usan las de OpenStreetMap, válidas para pruebas. Para producción hay que contratar un proveedor (MapTiler, Stadia, Mapbox).
- **Nominatim y Overpass** son servicios públicos con límite de uso: para comercializar, montar instancias propias o contratar un proveedor.
- La transcripción de notas de voz usa el reconocimiento del navegador (Chrome y Safari). Donde no existe, se guarda el audio y se ofrece escribir la nota.
- Las posiciones de los puntos sin IA son aproximadas en vertical (en horizontal las da la brújula).

## Siguientes pasos

1. **App nativa** (Expo/React Native) para acceder al carrete completo, conservar el GPS sin pasos extra y procesar en segundo plano.
2. **Cuentas y sincronización** para compartir el viaje con los acompañantes, cada uno con sus fotos.
3. **Vídeo-recuerdo** exportable (historia + música + mapa animado) y **álbum impreso**.
4. **Banco de monumentos** en servidor: lo que identifica un usuario ayuda a todos (coste por foto cada vez menor).
5. Detección de rostros en el dispositivo (opcional y con consentimiento explícito) para saber quién sale en cada foto.
