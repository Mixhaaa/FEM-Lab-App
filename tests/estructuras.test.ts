/** Armadura 2D y sistema de resortes. */
import { describe, expect, it } from 'vitest';
import { solveSprings, solveTruss, type TrussProblem } from '../src/core';

const E = 200e9;
const A = 1e-4;
const P = 10000;

describe('Armadura 2D: dos barras a 45° con carga vertical', () => {
  const p: TrussProblem = {
    nodes: [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
    bars: [
      { i: 0, j: 2, E, A },
      { i: 1, j: 2, E, A },
    ],
    supports: [
      { node: 0, ux: true, uy: true },
      { node: 1, ux: true, uy: true },
    ],
    loads: [{ node: 2, Fx: 0, Fy: -P }],
    bcMethod: 'eliminacion',
    penaltyExp: 8,
  };
  const sol = solveTruss(p);

  it('fuerza axial N = −P/√2 (compresión) en ambas barras', () => {
    for (const b of sol.bars) {
      expect(b.N).toBeCloseTo(-P / Math.SQRT2, 6);
      expect(b.estado).toBe('compresión');
      expect(b.sigma).toBeCloseTo(-P / Math.SQRT2 / A, 0);
    }
  });

  it('desplazamiento vertical δ = −P·√2/(EA) y horizontal nulo', () => {
    expect(sol.u[4]).toBeCloseTo(0, 15);
    expect(sol.u[5] / (-P * Math.SQRT2 / (E * A))).toBeCloseTo(1, 10);
  });

  it('reacciones (±P/2, P/2) y equilibrio global', () => {
    expect(sol.reactions[0].Rx).toBeCloseTo(P / 2, 6);
    expect(sol.reactions[0].Ry).toBeCloseTo(P / 2, 6);
    expect(sol.reactions[1].Rx).toBeCloseTo(-P / 2, 6);
    expect(sol.reactions[1].Ry).toBeCloseTo(P / 2, 6);
    expect(Math.abs(sol.equilibrium.sumFx)).toBeLessThan(1e-9 * P);
    expect(Math.abs(sol.equilibrium.sumFy)).toBeLessThan(1e-9 * P);
    expect(Math.abs(sol.equilibrium.sumM)).toBeLessThan(1e-9 * P);
  });

  it('penalización da el mismo resultado', () => {
    const s2 = solveTruss({ ...p, bcMethod: 'penalizacion', penaltyExp: 10 });
    expect(s2.u[5]).toBeCloseTo(sol.u[5], 12);
    s2.bars.forEach((b, i) => expect(b.N).toBeCloseTo(sol.bars[i].N, 2));
  });
});

describe('Armadura 2D: triángulo isostático (método de los nudos)', () => {
  const L = 4;
  const H = 3;
  const D = Math.hypot(L, H);
  const sol = solveTruss({
    nodes: [
      { x: 0, y: 0 },
      { x: L, y: 0 },
      { x: L, y: H },
    ],
    bars: [
      { i: 0, j: 1, E, A },
      { i: 1, j: 2, E, A },
      { i: 0, j: 2, E, A },
    ],
    supports: [
      { node: 0, ux: true, uy: true },
      { node: 1, ux: false, uy: true },
    ],
    loads: [{ node: 2, Fx: P, Fy: 0 }],
    bcMethod: 'eliminacion',
    penaltyExp: 8,
  });

  it('N_AB = 0, N_BC = −P·H/L, N_AC = P·D/L', () => {
    expect(Math.abs(sol.bars[0].N)).toBeLessThan(1e-6);
    expect(sol.bars[0].estado).toBe('nula');
    expect(sol.bars[1].N).toBeCloseTo((-P * H) / L, 6);
    expect(sol.bars[2].N).toBeCloseTo((P * D) / L, 6);
  });

  it('reacciones: Ax = −P, Ay = −P·H/L, By = P·H/L', () => {
    expect(sol.reactions[0].Rx).toBeCloseTo(-P, 6);
    expect(sol.reactions[0].Ry).toBeCloseTo((-P * H) / L, 6);
    expect(sol.reactions[1].Rx).toBeNull();
    expect(sol.reactions[1].Ry).toBeCloseTo((P * H) / L, 6);
  });
});

describe('Armadura 2D: errores', () => {
  const cuadrado = (bcMethod: 'eliminacion' | 'penalizacion') =>
    solveTruss({
      nodes: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      bars: [
        { i: 0, j: 1, E, A },
        { i: 1, j: 2, E, A },
        { i: 2, j: 3, E, A },
        { i: 3, j: 0, E, A },
      ],
      supports: [
        { node: 0, ux: true, uy: true },
        { node: 1, ux: false, uy: true },
      ],
      loads: [{ node: 2, Fx: P, Fy: 0 }],
      bcMethod,
      penaltyExp: 8,
    });

  it('un cuadrado sin diagonal es un mecanismo: error claro', () => {
    expect(() => cuadrado('eliminacion')).toThrowError(/inestable/);
    expect(() => cuadrado('penalizacion')).toThrowError(/inestable/);
  });

  it('barra con nodo inexistente', () => {
    expect(() =>
      solveTruss({
        nodes: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        bars: [{ i: 0, j: 5, E, A }],
        supports: [{ node: 0, ux: true, uy: true }],
        loads: [],
        bcMethod: 'eliminacion',
        penaltyExp: 8,
      }),
    ).toThrowError(/no existe/);
  });
});

describe('Sistema de resortes', () => {
  it('tres resortes en serie con carga en el extremo', () => {
    const s = solveSprings({
      nNodes: 4,
      springs: [
        { i: 0, j: 1, k: 1000 },
        { i: 1, j: 2, k: 2000 },
        { i: 2, j: 3, k: 3000 },
      ],
      fixed: [{ node: 0, value: 0 }],
      loads: [{ node: 3, P: 600 }],
      bcMethod: 'eliminacion',
      penaltyExp: 8,
    });
    expect(s.u[1]).toBeCloseTo(0.6, 12);
    expect(s.u[2]).toBeCloseTo(0.9, 12);
    expect(s.u[3]).toBeCloseTo(1.1, 12);
    s.springs.forEach((sp) => expect(sp.force).toBeCloseTo(600, 9));
    expect(s.reactions[0].value).toBeCloseTo(-600, 9);
    expect(Math.abs(s.equilibrium)).toBeLessThan(1e-9);
  });

  it('nodo central entre dos apoyos: u = P/(k1 + k2)', () => {
    const s = solveSprings({
      nNodes: 3,
      springs: [
        { i: 0, j: 1, k: 100 },
        { i: 1, j: 2, k: 300 },
      ],
      fixed: [
        { node: 0, value: 0 },
        { node: 2, value: 0 },
      ],
      loads: [{ node: 1, P: 40 }],
      bcMethod: 'penalizacion',
      penaltyExp: 10,
    });
    expect(s.u[1]).toBeCloseTo(0.1, 8);
  });

  it('sin apoyos: error claro', () => {
    expect(() =>
      solveSprings({
        nNodes: 2,
        springs: [{ i: 0, j: 1, k: 1 }],
        fixed: [],
        loads: [],
        bcMethod: 'eliminacion',
        penaltyExp: 8,
      }),
    ).toThrowError(/Fija al menos un nodo/);
  });
});
