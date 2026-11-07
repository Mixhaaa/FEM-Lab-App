/**
 * Estudio de convergencia: resuelve con Ne = 2, 4, 8, ... y ajusta la pendiente
 * de log(error) vs log(h) por mínimos cuadrados.
 * Esperado para elementos lineales: error nodal y L² ~ h², seminorma H¹ ~ h.
 * Para cuadráticos: L² ~ h³, seminorma H¹ ~ h², y en los nodos suele ser aún más rápido.
 */
import { formaCuadratica } from './element1d';
import { compileExpr, evalChecked } from './expr';
import { computeError, computeErrorFns, solve1D } from './fem1d';
import { MAX_ELEMENTOS, MAX_ELEMENTOS_CUADRATICOS } from './mesh';
import type { MeshSpec, Problem1D } from './types';

export interface ConvergenceRow {
  ne: number;
  h: number;
  maxNodal: number;
  L2: number;
  H1semi: number;
}

export interface ConvergenceResult {
  rows: ConvergenceRow[];
  /** Pendientes ajustadas (orden de convergencia). NaN si no se puede calcular. */
  orden: { nodal: number; L2: number; H1: number };
  /** True si el error nodal es del orden del redondeo (nodos exactos). */
  superconvergenciaNodal: boolean;
  /**
   * True si el MEF reproduce la solución exacta en toda la malla (por ejemplo, solución lineal por tramos):
   * los errores son de redondeo y no tiene sentido hablar de orden.
   */
  solucionExacta: boolean;
  referencia: 'analitica' | 'malla-fina';
  refNe?: number;
}

/** Pendiente por mínimos cuadrados de log(e) vs log(h). */
export function fitSlope(h: number[], e: number[]): number {
  const pts = h.map((hi, i) => [Math.log(hi), Math.log(e[i])]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  if (pts.length < 2) return NaN;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  let num = 0;
  let den = 0;
  for (const [x, y] of pts) {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }
  return den === 0 ? NaN : num / den;
}

/** Orden local entre mallas consecutivas: log(e_{i−1}/e_i) / log(h_{i−1}/h_i). */
export function ordenesLocales(h: number[], e: number[]): number[] {
  return h.map((hi, i) => {
    if (i === 0) return NaN;
    const r = Math.log(e[i - 1] / e[i]) / Math.log(h[i - 1] / hi);
    return Number.isFinite(r) ? r : NaN;
  });
}

function meshFor(spec: MeshSpec, ne: number): MeshSpec {
  if (spec.type === 'geometrica') return { ...spec, ne };
  return { type: 'uniforme', ne };
}

/** Mallas del estudio por defecto: los cuadráticos convergen más rápido y llegan antes al redondeo. */
export function mallasPorDefecto(orden: 1 | 2 = 1): number[] {
  return orden === 2 ? [2, 4, 8, 16, 32, 64] : [2, 4, 8, 16, 32, 64, 128, 256];
}

export function convergenceStudy(problem: Problem1D, neList: number[] = mallasPorDefecto(problem.orden ?? 1)): ConvergenceResult {
  const ordenEl = problem.orden ?? 1;
  const hasExact = !!problem.exact && problem.exact.trim() !== '';
  let refNe: number | undefined;
  let refFn: ((x: number) => number) | undefined;
  let refD: ((x: number) => number) | undefined;

  if (!hasExact) {
    // Solución de referencia con una malla mucho más fina
    refNe = Math.min(ordenEl === 2 ? MAX_ELEMENTOS_CUADRATICOS : MAX_ELEMENTOS, 8 * Math.max(...neList));
    const ref = solve1D({ ...problem, exact: undefined, mesh: meshFor(problem.mesh, refNe), bcMethod: 'eliminacion' });
    // Con cuadráticos, la referencia se interpola con sus propias funciones de forma
    const xs = ordenEl === 2 ? ref.mesh.elements.map(([a]) => ref.mesh.nodes[a]).concat(ref.mesh.nodes[ref.mesh.nodes.length - 1]) : ref.mesh.nodes;
    const us = ref.u;
    const locate = (x: number) => {
      let lo = 0;
      let hi = xs.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (xs[mid] <= x) lo = mid;
        else hi = mid;
      }
      return lo;
    };
    if (ordenEl === 2) {
      const enElemento = (x: number) => {
        const e = locate(x);
        const J = (xs[e + 1] - xs[e]) / 2;
        const sh = formaCuadratica((x - (xs[e] + xs[e + 1]) / 2) / J);
        const ue = ref.mesh.elementDofs[e].map((d) => us[d]);
        return { sh, ue, J };
      };
      refFn = (x) => {
        const { sh, ue } = enElemento(x);
        return sh.N.reduce((s, n, a) => s + n * ue[a], 0);
      };
      refD = (x) => {
        const { sh, ue, J } = enElemento(x);
        return sh.dNdxi.reduce((s, d, a) => s + d * ue[a], 0) / J;
      };
    } else {
      refFn = (x) => {
        const i = locate(x);
        const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
        return us[i] + t * (us[i + 1] - us[i]);
      };
      refD = (x) => {
        const i = locate(x);
        return (us[i + 1] - us[i]) / (xs[i + 1] - xs[i]);
      };
    }
  }

  const exactCE = hasExact ? compileExpr(problem.exact!, 'La solución analítica u(x)') : undefined;
  const rows: ConvergenceRow[] = [];
  let uScale = 0;
  let L = 0;
  for (const ne of neList) {
    const sol = solve1D({ ...problem, exact: undefined, mesh: meshFor(problem.mesh, ne) });
    const nodes = sol.mesh.nodes;
    let hmax = 0;
    for (const el of sol.elements) hmax = Math.max(hmax, el.h);
    const dofs = ordenEl === 2 ? sol.mesh.elementDofs : undefined;
    const err = exactCE
      ? computeError(problem.exact!, (x) => evalChecked(exactCE, x, 'u(x)'), nodes, sol.u, dofs)
      : computeErrorFns(refFn!, refD!, nodes, sol.u, dofs);
    rows.push({ ne, h: hmax, maxNodal: err.maxNodal, L2: err.L2, H1semi: err.H1semi });
    uScale = Math.max(uScale, ...sol.u.map(Math.abs));
    L = nodes[nodes.length - 1] - nodes[0];
  }

  const solucionExacta = rows.every((r) => r.L2 <= 1e-10 * Math.max(uScale, 1e-300) * Math.sqrt(L));

  // Nodos exactos: el error nodal es del orden del redondeo frente al error L²
  const superconvergenciaNodal = !solucionExacta && rows.every((r) => r.maxNodal < 1e-6 * r.L2 || r.maxNodal < 1e-14);

  // Ajustar con los puntos de la zona asintótica (mitad más fina, mínimo 3)
  const k = Math.max(3, Math.ceil(rows.length / 2));
  const tail = rows.slice(-k);
  const h = tail.map((r) => r.h);
  const orden = solucionExacta
    ? { nodal: NaN, L2: NaN, H1: NaN }
    : {
        nodal: superconvergenciaNodal ? NaN : fitSlope(h, tail.map((r) => r.maxNodal)),
        L2: fitSlope(h, tail.map((r) => r.L2)),
        H1: fitSlope(h, tail.map((r) => r.H1semi)),
      };
  return { rows, orden, superconvergenciaNodal, solucionExacta, referencia: hasExact ? 'analitica' : 'malla-fina', refNe };
}

