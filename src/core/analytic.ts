/**
 * Solución analítica automática para coeficientes constantes (un solo tramo, sin cargas puntuales):
 *     -k u'' + b u' + c u = f
 * u = A·φ1(x) + B·φ2(x) + u_p(x), con A y B obtenidos de las dos condiciones de frontera.
 * Las exponenciales se escriben desplazadas para que nunca desborden (|φ| ≤ 1 en el dominio).
 */
import { compileExpr } from './expr';
import type { BoundaryCondition, Problem1D } from './types';

interface Basis {
  expr: string;
  val: (x: number) => number;
  d: (x: number) => number;
}

const num = (v: number) => {
  if (v === 0) return '0';
  const s = Number(v.toPrecision(15)).toString();
  return v < 0 ? `(${s})` : s;
};

/** Devuelve la expresión de u(x) o null si no aplica (coeficientes variables, varios tramos, etc.). */
export function analyticConstant(p: Problem1D): string | null {
  if (p.regions.length !== 1 || (p.loads && p.loads.length > 0)) return null;
  const r = p.regions[0];
  let k: number, b: number, c: number, f: number;
  try {
    const ce = [r.k, r.b, r.c, r.f].map((s) => compileExpr(s));
    if (ce.some((e) => !e.constant)) return null;
    [k, b, c, f] = ce.map((e) => e.fn(0));
  } catch {
    return null;
  }
  if (![k, b, c, f].every(Number.isFinite) || !(k > 0)) return null;
  const { x0, xL } = p;
  const sh = (a: number) => (a === 0 ? 'x' : `(x - ${num(a)})`);

  let p1: Basis;
  let p2: Basis;
  let up: Basis;
  const expo = (rr: number): Basis => {
    const xa = rr > 0 ? xL : x0;
    return {
      expr: `exp(${num(rr)}*${sh(xa)})`,
      val: (x) => Math.exp(rr * (x - xa)),
      d: (x) => rr * Math.exp(rr * (x - xa)),
    };
  };

  if (c === 0 && b === 0) {
    p1 = { expr: '1', val: () => 1, d: () => 0 };
    p2 = { expr: sh(x0), val: (x) => x - x0, d: () => 1 };
    const a = -f / (2 * k);
    up = { expr: `${num(a)}*${sh(x0)}^2`, val: (x) => a * (x - x0) ** 2, d: (x) => 2 * a * (x - x0) };
  } else if (c === 0) {
    p1 = { expr: '1', val: () => 1, d: () => 0 };
    p2 = expo(b / k);
    const a = f / b;
    up = { expr: `${num(a)}*${sh(x0)}`, val: (x) => a * (x - x0), d: () => a };
  } else {
    const disc = b * b + 4 * k * c;
    const scale = b * b + Math.abs(4 * k * c);
    if (Math.abs(disc) <= 1e-13 * scale) {
      const rr = b / (2 * k);
      const e = expo(rr);
      p1 = e;
      p2 = { expr: `${sh(x0)}*${e.expr}`, val: (x) => (x - x0) * e.val(x), d: (x) => e.val(x) + (x - x0) * e.d(x) };
    } else if (disc > 0) {
      const s = Math.sqrt(disc);
      p1 = expo((b + s) / (2 * k));
      p2 = expo((b - s) / (2 * k));
    } else {
      const al = b / (2 * k);
      const be = Math.sqrt(-disc) / (2 * k);
      const e = al === 0 ? { expr: '1', val: () => 1, d: () => 0 } : expo(al);
      const pre = al === 0 ? '' : `${e.expr}*`;
      p1 = {
        expr: `${pre}cos(${num(be)}*${sh(x0)})`,
        val: (x) => e.val(x) * Math.cos(be * (x - x0)),
        d: (x) => e.d(x) * Math.cos(be * (x - x0)) - e.val(x) * be * Math.sin(be * (x - x0)),
      };
      p2 = {
        expr: `${pre}sin(${num(be)}*${sh(x0)})`,
        val: (x) => e.val(x) * Math.sin(be * (x - x0)),
        d: (x) => e.d(x) * Math.sin(be * (x - x0)) + e.val(x) * be * Math.cos(be * (x - x0)),
      };
    }
    const a = f / c;
    up = { expr: num(a), val: () => a, d: () => 0 };
  }

  const row = (bc: BoundaryCondition, xe: number, n: number): [number, number, number] => {
    if (bc.type === 'dirichlet') return [p1.val(xe), p2.val(xe), bc.value - up.val(xe)];
    if (bc.type === 'neumann') return [k * n * p1.d(xe), k * n * p2.d(xe), bc.q - k * n * up.d(xe)];
    return [
      k * n * p1.d(xe) + bc.h * p1.val(xe),
      k * n * p2.d(xe) + bc.h * p2.val(xe),
      bc.g - k * n * up.d(xe) - bc.h * up.val(xe),
    ];
  };
  const [a11, a12, r1] = row(p.bcLeft, x0, -1);
  const [a21, a22, r2] = row(p.bcRight, xL, 1);
  const det = a11 * a22 - a12 * a21;
  const sc = Math.max(Math.abs(a11 * a22), Math.abs(a12 * a21), 1e-300);
  if (!(Math.abs(det) > 1e-12 * sc)) return null;
  const A = (r1 * a22 - a12 * r2) / det;
  const B = (a11 * r2 - r1 * a21) / det;
  if (!Number.isFinite(A) || !Number.isFinite(B)) return null;

  const parts: string[] = [];
  if (A !== 0) parts.push(`${num(A)}*${p1.expr}`);
  if (B !== 0) parts.push(`${num(B)}*${p2.expr}`);
  if (up.expr !== '0') parts.push(up.expr);
  return parts.length ? parts.join(' + ') : '0';
}
