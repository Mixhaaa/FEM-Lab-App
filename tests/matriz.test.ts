/** Propiedades de matrices, orden local y texto MATLAB. */
import { describe, expect, it } from 'vitest';
import { infoMatriz, ordenesLocales, solve1D, solveTruss } from '../src/core';
import { matrizMatlab, numMatlab, vectorMatlab } from '../src/export/matlab-texto';
import { ejemploClase, problema } from './helpers';

describe('infoMatriz', () => {
  it('K del ejemplo de clase: tridiagonal, simétrica y diagonal dominante', () => {
    const s = solve1D(ejemploClase(3));
    const info = infoMatriz(s.K);
    expect(info.filas).toBe(4);
    expect(info.nnz).toBe(10); // 4 diagonales + 3 + 3
    expect(info.anchoBanda).toBe(1);
    expect(info.simetrica).toBe(true);
    expect(info.diagonalDominante).toBe(true);
    expect(info.densidad).toBeCloseTo(10 / 16, 12);
  });

  it('con b ≠ 0 la matriz deja de ser simétrica', () => {
    const s = solve1D(problema({ b: '5', bcRight: { type: 'dirichlet', value: 1 } }));
    expect(infoMatriz(s.K).simetrica).toBe(false);
  });

  it('armadura: el ancho de banda depende de la numeración de los nodos', () => {
    const t = solveTruss({
      nodes: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0.5, y: 1 },
      ],
      bars: [
        { i: 0, j: 1, E: 1, A: 1 },
        { i: 1, j: 2, E: 1, A: 1 },
        { i: 0, j: 2, E: 1, A: 1 },
      ],
      supports: [
        { node: 0, ux: true, uy: true },
        { node: 1, ux: false, uy: true },
      ],
      loads: [{ node: 2, Fx: 1, Fy: 0 }],
      bcMethod: 'eliminacion',
      penaltyExp: 8,
    });
    const info = infoMatriz(t.K);
    expect(info.filas).toBe(6);
    expect(info.simetrica).toBe(true);
    expect(info.anchoBanda).toBe(5);
  });
});

describe('ordenesLocales', () => {
  it('error ∝ h² da orden 2 en cada par de mallas', () => {
    const h = [0.5, 0.25, 0.125];
    const o = ordenesLocales(h, h.map((x) => 3 * x * x));
    expect(o[0]).toBeNaN();
    expect(o[1]).toBeCloseTo(2, 12);
    expect(o[2]).toBeCloseTo(2, 12);
  });
});

describe('Texto MATLAB', () => {
  it('matrices y vectores con la sintaxis de MATLAB', () => {
    expect(numMatlab(0)).toBe('0');
    expect(numMatlab(1 / 3, 4)).toBe('0.3333');
    expect(numMatlab(2.5e-12)).toBe('2.5e-12');
    expect(matrizMatlab('K', [
      [1, -1],
      [-1, 1],
    ])).toBe('K = [\n    1  -1;\n    -1  1\n];');
    expect(vectorMatlab('F', [1, 2.5])).toBe('F = [1; 2.5];');
  });
});
