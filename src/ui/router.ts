/** Enrutamiento mínimo por hash (funciona en GitHub Pages sin configuración). */
import { useSyncExternalStore } from 'react';

export type Ruta = 'inicio' | 'config' | 'resultados' | 'paso' | 'armadura' | 'reporte';
export const RUTAS: Ruta[] = ['inicio', 'config', 'resultados', 'paso', 'armadura', 'reporte'];

function leer(): Ruta {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0] as Ruta;
  return RUTAS.includes(h) ? h : 'inicio';
}

function suscribir(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRuta(): Ruta {
  return useSyncExternalStore(suscribir, leer, () => 'inicio');
}

export function ir(r: Ruta) {
  if (leer() !== r) window.location.hash = `/${r}`;
  window.scrollTo({ top: 0 });
}
