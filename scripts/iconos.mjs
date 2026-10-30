/**
 * Descarga la fuente Material Symbols recortada a los íconos que usa la app
 * y la guarda en public/fonts/ (así la app funciona sin conexión).
 * Uso: npm run iconos   (vuelve a ejecutarlo si agregas íconos nuevos)
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Íconos que se eligen con una condición (icon={a ? 'x' : 'y'}) y el regex no detecta
const EXTRA = ['slideshow', 'close_fullscreen', 'light_mode', 'dark_mode', 'grid_4x4', 'functions', 'assignment_turned_in', 'warning', 'info', 'check_circle', 'error', 'expand_more'];
const nombres = new Set(EXTRA);
const re = /(?:\bname|\bicono?|\bi)\s*[=:]\s*\{?\s*['"]([a-z][a-z0-9_]*)['"]/g;
function recorrer(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) recorrer(p);
    else if (/\.(tsx?|mjs)$/.test(f)) for (const m of readFileSync(p, 'utf8').matchAll(re)) nombres.add(m[1]);
  }
}
recorrer('src');
const lista = [...nombres].sort();
const url = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=${lista.join(',')}&display=block`;
const css = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' } })).text();
const src = css.match(/url\((https:[^)]+)\)/)?.[1];
if (!src) throw new Error('No se encontró la URL de la fuente:\n' + css);
const buf = Buffer.from(await (await fetch(src)).arrayBuffer());
mkdirSync('public/fonts', { recursive: true });
writeFileSync('public/fonts/material-symbols.woff2', buf);
console.log(`${lista.length} íconos, ${(buf.length / 1024).toFixed(1)} KB:\n${lista.join(' ')}`);
