// Lector de metadatos EXIF sin dependencias.
// Saca de cada foto lo que nos permite "recordar" por el usuario: dónde (GPS),
// cuándo (fecha original), hacia dónde miraba (orientación de la brújula) y con qué lente.
// Soporta JPEG y HEIC/HEIF (iPhone): en HEIC buscamos el bloque TIFF dentro del contenedor.

const TAGS = {
  0x010f: 'make', 0x0110: 'model', 0x0112: 'orientation', 0x0132: 'dateTime',
  0x8769: 'exifIFD', 0x8825: 'gpsIFD',
  0x9003: 'dateTimeOriginal', 0x9011: 'offsetTimeOriginal',
  0x920a: 'focalLength', 0xa405: 'focalLength35', 0xa002: 'pixelWidth', 0xa003: 'pixelHeight',
};
const GPS_TAGS = {
  0x0001: 'latRef', 0x0002: 'lat', 0x0003: 'lonRef', 0x0004: 'lon',
  0x0005: 'altRef', 0x0006: 'alt', 0x0010: 'dirRef', 0x0011: 'dir',
  0x0007: 'timeStamp', 0x001d: 'dateStamp',
};

export async function readExif(file) {
  // 256 KB bastan: los metadatos van al principio del archivo.
  const head = await file.slice(0, 262144).arrayBuffer();
  const view = new DataView(head);
  let tiff = -1;
  if (view.getUint16(0) === 0xffd8) tiff = findJpegTiff(view);
  if (tiff < 0) tiff = scanForTiff(new Uint8Array(head));
  if (tiff < 0) return {};
  try {
    return normalize(parseTiff(view, tiff));
  } catch {
    return {};
  }
}

function findJpegTiff(view) {
  let off = 2;
  while (off + 4 < view.byteLength) {
    if (view.getUint8(off) !== 0xff) return -1;
    const marker = view.getUint8(off + 1);
    const len = view.getUint16(off + 2);
    // APP1 con cabecera "Exif\0\0"
    if (marker === 0xe1 && view.getUint32(off + 4) === 0x45786966 && view.getUint16(off + 8) === 0) {
      return off + 10;
    }
    if (marker === 0xda) return -1; // empieza la imagen: no hay EXIF
    off += 2 + len;
  }
  return -1;
}

// En HEIC el bloque Exif va dentro de un "item" del contenedor ISOBMFF.
// Buscar "Exif\0\0" seguido de una cabecera TIFF válida es robusto y mucho más simple.
function scanForTiff(bytes) {
  for (let i = 0; i < bytes.length - 10; i++) {
    if (bytes[i] === 0x45 && bytes[i + 1] === 0x78 && bytes[i + 2] === 0x69 && bytes[i + 3] === 0x66 &&
        bytes[i + 4] === 0 && bytes[i + 5] === 0) {
      const t = i + 6;
      if ((bytes[t] === 0x4d && bytes[t + 1] === 0x4d && bytes[t + 3] === 0x2a) ||
          (bytes[t] === 0x49 && bytes[t + 1] === 0x49 && bytes[t + 2] === 0x2a)) return t;
    }
  }
  return -1;
}

function parseTiff(view, start) {
  const little = view.getUint16(start) === 0x4949;
  const u16 = (o) => view.getUint16(start + o, little);
  const u32 = (o) => view.getUint32(start + o, little);
  const out = {};

  const readIFD = (ifdOff, dict, target) => {
    if (start + ifdOff + 2 > view.byteLength) return;
    const n = u16(ifdOff);
    for (let i = 0; i < n; i++) {
      const e = ifdOff + 2 + i * 12;
      if (start + e + 12 > view.byteLength) break;
      const tag = u16(e);
      const name = dict[tag];
      if (!name) continue;
      target[name] = readValue(e);
    }
  };

  const readValue = (e) => {
    const type = u16(e + 2);
    const count = u32(e + 4);
    const sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
    const size = (sizes[type] || 1) * count;
    const valOff = size > 4 ? u32(e + 8) : e + 8;
    const at = (k) => start + valOff + k;
    if (at(size) > view.byteLength) return null;
    switch (type) {
      case 2: { // ASCII
        let s = '';
        for (let k = 0; k < count - 1; k++) s += String.fromCharCode(view.getUint8(at(k)));
        return s.trim();
      }
      case 3: return count === 1 ? view.getUint16(at(0), little) : Array.from({ length: count }, (_, k) => view.getUint16(at(k * 2), little));
      case 4: return count === 1 ? view.getUint32(at(0), little) : Array.from({ length: count }, (_, k) => view.getUint32(at(k * 4), little));
      case 5: case 10: {
        const vals = Array.from({ length: count }, (_, k) => {
          const num = type === 5 ? view.getUint32(at(k * 8), little) : view.getInt32(at(k * 8), little);
          const den = type === 5 ? view.getUint32(at(k * 8 + 4), little) : view.getInt32(at(k * 8 + 4), little);
          return den ? num / den : 0;
        });
        return count === 1 ? vals[0] : vals;
      }
      case 1: case 7: return view.getUint8(at(0));
      default: return null;
    }
  };

  readIFD(u32(4), TAGS, out);
  if (out.exifIFD) readIFD(out.exifIFD, TAGS, out);
  if (out.gpsIFD) { out.gps = {}; readIFD(out.gpsIFD, GPS_TAGS, out.gps); }
  return out;
}

function dms(v) {
  if (Array.isArray(v)) return v[0] + (v[1] || 0) / 60 + (v[2] || 0) / 3600;
  return typeof v === 'number' ? v : null;
}

// "2025:05:14 11:42:07" (+ "+02:00") -> ISO. Sin zona: la hora local del sitio, que es lo que el turista recuerda.
function exifDate(s, offset) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${offset && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : ''}`;
}

function normalize(raw) {
  const out = {
    make: raw.make || null,
    model: raw.model || null,
    orientation: raw.orientation || 1,
    takenAt: exifDate(raw.dateTimeOriginal || raw.dateTime, raw.offsetTimeOriginal),
    focal35: raw.focalLength35 || null,
  };
  const g = raw.gps;
  if (g && g.lat != null && g.lon != null) {
    let lat = dms(g.lat), lon = dms(g.lon);
    if (g.latRef === 'S') lat = -lat;
    if (g.lonRef === 'W') lon = -lon;
    if (Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0)) {
      out.lat = +lat.toFixed(6);
      out.lon = +lon.toFixed(6);
    }
    if (typeof g.dir === 'number' && Number.isFinite(g.dir)) out.heading = Math.round(g.dir * 10) / 10;
    if (typeof g.alt === 'number') out.alt = Math.round(g.altRef === 1 ? -g.alt : g.alt);
  }
  return out;
}
