// Puente con la app nativa (Capacitor). En la web no hace nada y todo sigue igual.
// En iPhone, las fotos se leen de la fototeca con su ubicación intacta (RecuerdoPhotosPlugin.swift).

let photosPlugin = null;

export const isNative = () => !!window.Capacitor?.isNativePlatform?.();
export const nativePlatform = () => (isNative() ? window.Capacitor.getPlatform() : 'web');
export const hasNativePicker = () => nativePlatform() === 'ios' && !!window.Capacitor?.registerPlugin;

function plugin() {
  photosPlugin ||= window.Capacitor.registerPlugin('RecuerdoPhotos');
  return photosPlugin;
}

// Abre el selector nativo y devuelve File[] listos para importFiles.
// Cada File lleva `nativeMeta` con la ubicación y la fecha de la fototeca, por si el EXIF no las trae.
export async function pickNativePhotos(onProgress) {
  const P = plugin();
  const sub = await P.addListener('progress', (e) => onProgress?.(e));
  try {
    const res = await P.pick({ limit: 0 });
    const files = [];
    for (const ph of res.photos || []) {
      const blob = await (await fetch(ph.webPath)).blob();
      const f = new File([blob], ph.name || 'foto.jpg', {
        type: ph.mime || blob.type || 'image/jpeg',
        lastModified: ph.takenAt ? Date.parse(ph.takenAt) : Date.now(),
      });
      f.nativeMeta = { lat: ph.lat ?? null, lon: ph.lon ?? null, takenAt: ph.takenAt || null, source: ph.source };
      files.push(f);
    }
    return { files, access: res.libraryAccess };
  } finally {
    sub.remove();
  }
}

// Borra las copias temporales una vez guardadas en la app.
export const clearNativeImport = () => (hasNativePicker() ? plugin().clear().catch(() => {}) : Promise.resolve());
