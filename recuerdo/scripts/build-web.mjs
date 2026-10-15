// Copia la app web a www/, que es lo que Capacitor mete dentro de la app de iPhone y Android.
import { cp, rm, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'www');
const INCLUDE = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const item of INCLUDE) await cp(join(ROOT, item), join(OUT, item), { recursive: true });
// Runtime de Capacitor (puente con las funciones nativas). Solo en la app; la web no lo necesita.
await mkdir(join(OUT, 'js', 'vendor'), { recursive: true });
await cp(join(ROOT, 'node_modules/@capacitor/core/dist/capacitor.js'), join(OUT, 'js/vendor/capacitor.js'));
const html = await readFile(join(OUT, 'index.html'), 'utf8');
await writeFile(join(OUT, 'index.html'), html.replace('<script type="module" src="js/app.js">', '<script src="js/vendor/capacitor.js"></script>\n<script type="module" src="js/app.js">'));

console.log('www/ lista:', (await readdir(OUT)).join(', '));
