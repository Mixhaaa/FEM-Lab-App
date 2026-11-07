/**
 * Revisa si una solución analítica escrita corresponde al problema actual:
 * que cumpla las fronteras Dirichlet y la ecuación -(k u')' + b u' + c u = f
 * en puntos interiores. Solo lee datos; no interviene en el cálculo MEF.
 *
 * Sirve para detectar, por ejemplo, que se cambió el dominio de un ejemplo
 * y la fórmula de su solución exacta ya no aplica.
 */
import { compileExpr, fmt } from './expr';
import type { Problem1D } from './types';

/** Devuelve null si la expresión es coherente con el problema; si no, el motivo. */
export function motivoExactaIncompatible(p: Problem1D, expr: string): string | null {
  let u: (x: number) => number;
  try {
    u = compileExpr(expr, 'La solución analítica').fn;
  } catch {
    return null; // los errores de escritura se informan en el propio campo
  }
  const L = p.xL - p.x0;
  const val = (x: number) => {
    const v = u(x);
    return Number.isFinite(v) ? v : NaN;
  };

  // Escala de u en el dominio
  const muestras = Array.from({ length: 41 }, (_, i) => p.x0 + (L * i) / 40);
  const us = muestras.map(val);
  if (us.some((v) => Number.isNaN(v))) return 'no da un valor finito en todo el dominio';
  const escalaU = Math.max(...us.map(Math.abs), 1e-12);

  // 1. Fronteras Dirichlet
  for (const [bc, x, nombre] of [
    [p.bcLeft, p.x0, 'x₀'],
    [p.bcRight, p.xL, 'xL'],
  ] as const) {
    if (bc.type !== 'dirichlet') continue;
    const ux = val(x);
    const escala = Math.max(escalaU, Math.abs(bc.value), 1e-12);
    if (!(Math.abs(ux - bc.value) <= 1e-6 * escala)) {
      return `en ${nombre} = ${fmt(x)} da ${fmt(ux)}, pero la frontera pide ${fmt(bc.value)}`;
    }
  }

  // 2. La ecuación en puntos interiores (solo sin cargas puntuales, que crean quiebres)
  if ((p.loads ?? []).length > 0) return null;
  const d = 1e-3 * L;
  let peor = 0;
  let escalaEc = 1e-300;
  let xPeor = 0;
  for (const r of p.regions) {
    let co: ((x: number) => number)[];
    try {
      co = [r.k, r.b, r.c, r.f].map((s) => compileExpr(s).fn);
    } catch {
      return null;
    }
    const [k, b, c, f] = co;
    const largo = r.x1 - r.x0;
    if (largo <= 4 * d) continue;
    for (let i = 0; i < 7; i++) {
      const x = r.x0 + 2 * d + ((largo - 4 * d) * (i + 0.37)) / 7;
      const u0 = val(x);
      const up = val(x + d);
      const um = val(x - d);
      const flujoD = (k(x + d / 2) * (up - u0)) / d;
      const flujoI = (k(x - d / 2) * (u0 - um)) / d;
      const difusion = -(flujoD - flujoI) / d;
      const conv = (b(x) * (up - um)) / (2 * d);
      const reac = c(x) * u0;
      const res = difusion + conv + reac - f(x);
      // Escala: cada término por separado (si u es lineal, la difusión es la resta de dos flujos casi iguales)
      const esc = (Math.abs(flujoD) + Math.abs(flujoI)) / d + Math.abs(conv) + Math.abs(reac) + Math.abs(f(x));
      if (!Number.isFinite(res)) return 'no se puede evaluar la ecuación con ella';
      escalaEc = Math.max(escalaEc, esc);
      if (Math.abs(res) > peor) {
        peor = Math.abs(res);
        xPeor = x;
      }
    }
  }
  if (peor > 1e-5 * escalaEc) {
    return `no cumple la ecuación: en x = ${fmt(xPeor)} queda un residuo de ${fmt(peor, 3)}`;
  }
  return null;
}
