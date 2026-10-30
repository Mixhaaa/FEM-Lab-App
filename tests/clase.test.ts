/**
 * Ejemplo de clase: -u'' + 100u = 10x³ en [0,1], u(0) = u(1) = 0.
 * Valores de referencia calculados de forma independiente con NumPy
 * (masa consistente, carga integrada con 3 puntos de Gauss).
 */
import { describe, expect, it } from 'vitest';
import { convergenceStudy, solve1D } from '../src/core';
import { EXACTA_CLASE, ejemploClase } from './helpers';

describe('Ejemplo de clase con Ne = 3', () => {
  const sol = solve1D(ejemploClase(3));

  it('u ≈ [0, 0.0030, 0.0391, 0]', () => {
    const esperado = [0, 0.0030, 0.0391, 0];
    sol.u.forEach((v, i) => expect(v).toBeCloseTo(esperado[i], 4));
    // Con más precisión (referencia NumPy)
    expect(sol.u[1]).toBeCloseTo(0.003021447064768365, 12);
    expect(sol.u[2]).toBeCloseTo(0.03909648313980442, 12);
  });

  it('matriz elemental Ke = (1/h)[1 −1; −1 1] + 100·h/6·[2 1; 1 2]', () => {
    const Ke = sol.elements[0].Ke;
    expect(Ke[0][0]).toBeCloseTo(14.111111111111112, 12);
    expect(Ke[0][1]).toBeCloseTo(2.555555555555555, 12);
    expect(Ke[1][0]).toBeCloseTo(2.555555555555555, 12);
    expect(Ke[1][1]).toBeCloseTo(14.111111111111112, 12);
  });

  it('vector elemental Fe del primer elemento', () => {
    expect(sol.elements[0].Fe[0]).toBeCloseTo(0.006172839506172837, 14);
    expect(sol.elements[0].Fe[1]).toBeCloseTo(0.02469135802469136, 14);
  });

  it('K y F globales', () => {
    const K = [
      [14.111111111111112, 2.555555555555555, 0, 0],
      [2.555555555555555, 28.22222222222222, 2.555555555555557, 0],
      [0, 2.555555555555557, 28.222222222222236, 2.555555555555555],
      [0, 0, 2.555555555555555, 14.11111111111111],
    ];
    const F = [0.006172839506172837, 0.1851851851851852, 1.1111111111111112, 1.1975308641975306];
    sol.K.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(K[i][j], 10)));
    sol.F.forEach((v, i) => expect(v).toBeCloseTo(F[i], 12));
  });

  it('reacciones en los apoyos', () => {
    expect(sol.reactions[0].value).toBeCloseTo(0.001548636326012983, 10);
    expect(sol.reactions[1].value).toBeCloseTo(-1.0976176295069193, 10);
  });

  it('el balance global cierra', () => {
    expect(Math.abs(sol.balance.residual)).toBeLessThan(1e-12 * sol.balance.scale);
  });

  it('usa Thomas (matriz tridiagonal y diagonal dominante)', () => {
    expect(sol.solverUsed).toBe('thomas');
  });
});

describe('Convergencia del ejemplo de clase', () => {
  const conv = convergenceStudy(ejemploClase(4), [4, 8, 16, 32, 64, 128]);

  it('el error nodal disminuye como h² (orden ≈ 2)', () => {
    expect(conv.orden.nodal).toBeGreaterThan(1.9);
    expect(conv.orden.nodal).toBeLessThan(2.15);
    // Cada vez que h se divide entre 2 el error se divide entre ≈ 4
    for (let i = 3; i < conv.rows.length; i++) {
      const razon = conv.rows[i - 1].maxNodal / conv.rows[i].maxNodal;
      expect(razon).toBeGreaterThan(3.6);
      expect(razon).toBeLessThan(4.4);
    }
  });

  it('error L² ~ h² y seminorma H¹ ~ h', () => {
    expect(conv.orden.L2).toBeGreaterThan(1.9);
    expect(conv.orden.L2).toBeLessThan(2.1);
    expect(conv.orden.H1).toBeGreaterThan(0.95);
    expect(conv.orden.H1).toBeLessThan(1.05);
  });

  it('sin solución analítica usa una malla fina de referencia y obtiene el mismo orden', () => {
    const c2 = convergenceStudy(ejemploClase(4, { exact: undefined }), [4, 8, 16, 32, 64]);
    expect(c2.referencia).toBe('malla-fina');
    expect(c2.orden.nodal).toBeGreaterThan(1.85);
    expect(c2.orden.nodal).toBeLessThan(2.2);
  });

  it('la solución analítica del enunciado cumple las fronteras', () => {
    const sol = solve1D(ejemploClase(64));
    expect(sol.error!.exactAtNodes[0]).toBeCloseTo(0, 12);
    expect(sol.error!.exactAtNodes[64]).toBeCloseTo(0, 12);
    expect(sol.error!.maxNodal).toBeLessThan(1e-4);
    expect(EXACTA_CLASE).toContain('sinh');
  });
});
