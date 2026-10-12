# Recuerdo en el iPhone y en Android

La app nativa usa **Capacitor**: el mismo código web, dentro de una app real de App Store y Google Play, con acceso a funciones del móvil.

## Qué aporta la app nativa ya hoy

- **Fotos con su ubicación siempre.** En iPhone, Recuerdo pide permiso a la fototeca y lee cada foto original (`ios/App/App/RecuerdoPhotosPlugin.swift`): llega con GPS, fecha y orientación de la brújula, sin que el usuario tenga que tocar «Opciones → Ubicación». Si no da permiso, funciona como la web.
- Fotos que solo están en iCloud: se descargan al elegirlas.
- Textos de permisos en español (fotos, micrófono para notas de voz, transcripción).

## Compilar en iPhone desde un Mac (lo más sencillo)

Necesitas un Mac con **Xcode** (gratis en la App Store del Mac) y tu cuenta de Apple Developer.

```bash
cd recuerdo
npm install
npm run ios          # prepara la app web y abre el proyecto en Xcode
```

En Xcode:

1. Selecciona el proyecto **App** → pestaña **Signing & Capabilities** → en **Team** elige tu cuenta de Apple. Xcode firma la app; no hay que compartir contraseñas con nadie.
2. Cambia el **Bundle Identifier** (`com.recuerdo.app`) por uno tuyo, por ejemplo `com.tuempresa.recuerdo`. Cámbialo también en `capacitor.config.json`.
3. Conecta tu iPhone y pulsa ▶ para probarla en tu móvil.
4. Para TestFlight y la App Store: **Product → Archive → Distribute App**.

## Sin Mac: compilar en la nube

Se puede compilar en un servidor macOS de GitHub Actions. Para ello creas en App Store Connect una **clave de API** (Usuarios y acceso → Integraciones) y la guardas tú como *secreto* del repositorio en GitHub. Nadie más la ve, tampoco Claude. Cuando lo decidas, se añade el flujo de compilación que sube la app a TestFlight.

## Android

```bash
npm run android      # abre el proyecto en Android Studio
```

Pendiente: el selector nativo con ubicación para Android (permiso `ACCESS_MEDIA_LOCATION`). Mientras tanto usa el selector web.

## Cada vez que cambie la app web

```bash
npm run sync         # copia la web a www/ y la mete en iOS y Android
```

## Aún no probado

El módulo nativo de fotos se ha escrito y revisado contra el código de Capacitor 8.5.2, pero **no se ha compilado**: hace falta un Mac. La primera compilación en Xcode puede pedir algún ajuste menor.
