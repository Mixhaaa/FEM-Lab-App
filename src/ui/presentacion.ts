/** Modo presentación: pantalla completa, letra grande y control con el teclado. */
import { useEffect, useRef } from 'react';
import { ir, type Ruta } from './router';
import { useApp } from './store';

const EVENTO = 'femlab:avanzar';
const SECCIONES: Ruta[] = ['inicio', 'config', 'resultados', 'paso', 'armadura'];

/** Llama a cb(+1) o cb(-1) cuando el presentador avanza o retrocede (flechas, Re Pág/Av Pág). */
export function useAvanzar(cb: (dir: 1 | -1) => void) {
  const ref = useRef(cb);
  useEffect(() => {
    ref.current = cb;
  }, [cb]);
  useEffect(() => {
    const f = (e: Event) => ref.current((e as CustomEvent<1 | -1>).detail);
    window.addEventListener(EVENTO, f);
    return () => window.removeEventListener(EVENTO, f);
  }, []);
}

/** Aplica el modo presentación al documento y escucha el teclado. Se usa una vez, en App. */
export function usePresentacion() {
  const presentacion = useApp((s) => s.presentacion);
  const setPresentacion = useApp((s) => s.setPresentacion);

  useEffect(() => {
    const raiz = document.documentElement;
    if (presentacion) {
      raiz.dataset.presentacion = '1';
      raiz.requestFullscreen?.().catch(() => {
        /* algunos navegadores (iPhone) no permiten pantalla completa: se queda solo la letra grande */
      });
    } else {
      delete raiz.dataset.presentacion;
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
  }, [presentacion]);

  useEffect(() => {
    // Esc sale de pantalla completa: también se sale del modo presentación
    const alCambiar = () => {
      if (!document.fullscreenElement && useApp.getState().presentacion) setPresentacion(false);
    };
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, [setPresentacion]);

  useEffect(() => {
    if (!presentacion) return;
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      let dir: 1 | -1 | 0 = 0;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') dir = 1;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') dir = -1;
      if (dir) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(EVENTO, { detail: dir }));
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= SECCIONES.length) {
        e.preventDefault();
        ir(SECCIONES[n - 1]);
      }
      if (e.key === 'Escape') setPresentacion(false);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [presentacion, setPresentacion]);

  return presentacion;
}
