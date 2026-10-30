/** Solución analítica automática para coeficientes constantes. */
import { describe, expect, it } from 'vitest';
import { analyticConstant, compileExpr, solve1D, type BoundaryCondition } from '../src/core';
import { problema } from './helpers';

const D = (value: number): BoundaryCondition => ({ type: 'dirichlet', value });
const N = (q: number): BoundaryCondition => ({ type: 'neumann', q });
const R = (h: number, g: number): BoundaryCondition => ({ type: 'robin', h, g });

describe('analyticConstant', () => {
  const casos: [string, Parameters<typeof problema>[0], (x: number) => number][] = [
    ['−u″ = 1, u(0)=u(1)=0', { f: '1' }, (x) => (x * (1 - x)) / 2],
    ['−u″ + 5u′ = 0, u(1)=1', { b: '5', bcRight: D(1) }, (x) => (Math.exp(5 * x) - 1) / (Math.exp(5) - 1)],
    ['−u″ + u = 0, u′(0)=0, u′(1)=1', { c: '1', bcLeft: N(0), bcRight: N(1) }, (x) => Math.cosh(x) / Math.sinh(1)],
    [
      '−u″ − u = 1 (oscilatorio)',
      { c: '-1', f: '1' },
      (x) => -1 + Math.cos(x) + ((1 - Math.cos(1)) / Math.sin(1)) * Math.sin(x),
    ],
    ['Robin izquierda', { bcLeft: R(2, 3), mesh: { type: 'uniforme', ne: 3 } }, (x) => 1 - x],
  ];
  for (const [nombre, over, ex] of casos) {
    it(nombre, () => {
      const s = analyticConstant(problema(over));
      expect(s).not.toBeNull();
      const fn = compileExpr(s!).fn;
      for (const x of [0, 0.13, 0.5, 0.77, 1]) expect(fn(x)).toBeCloseTo(ex(x), 10);
    });
  }

  it('aleta larga (mL = 40) sin desbordamiento', () => {
    const s = analyticConstant(problema({ xL: 1, k: '1', c: '1600', bcLeft: D(1), bcRight: N(0) }))!;
    const fn = compileExpr(s).fn;
    expect(fn(0)).toBeCloseTo(1, 12);
    expect(fn(0.5)).toBeCloseTo(Math.cosh(40 * 0.5) / Math.cosh(40), 12);
    expect(Number.isFinite(fn(1))).toBe(true);
  });

  it('coincide con el MEF en mallas finas (caso mixto con b, c, f y Robin)', () => {
    const p = problema({ x0: 1, xL: 3, k: '2', b: '0.5', c: '3', f: '4', bcLeft: R(1, 2), bcRight: N(-1), mesh: { type: 'uniforme', ne: 400 } });
    const s = analyticConstant(p)!;
    const sol = solve1D({ ...p, exact: s });
    expect(sol.error!.maxNodal).toBeLessThan(1e-5);
  });

  it('no aplica con coeficientes variables, varios tramos o cargas puntuales', () => {
    expect(analyticConstant(problema({ k: '1+x' }))).toBeNull();
    expect(analyticConstant(problema({ loads: [{ x: 0.5, P: 1 }] }))).toBeNull();
    expect(
      analyticConstant(
        problema({
          regions: [
            { x0: 0, x1: 0.5, k: '1', b: '0', c: '0', f: '0' },
            { x0: 0.5, x1: 1, k: '2', b: '0', c: '0', f: '0' },
          ],
        }),
      ),
    ).toBeNull();
  });

  it('no aplica si el problema es singular (Neumann en ambos lados, c = 0)', () => {
    expect(analyticConstant(problema({ bcLeft: N(0), bcRight: N(0) }))).toBeNull();
  });
});
