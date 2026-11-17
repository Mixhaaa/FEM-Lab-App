/** Elementos cúbicos de 4 nodos (igualmente espaciados dentro del elemento). */
import { describe, expect, it } from 'vitest';
import { compileExpr, computeElement, convergenceStudy, formaCubica, formaLagrange, solve1D, xiNodos } from '../src/core';
import { ejemploClase, maxRelErr, problema } from './helpers';

const co = (k: string, b = '0', c = '0', f = '0') => ({ k: compileExpr(k), b: compileExpr(b), c: compileExpr(c), f: compileExpr(f), etiqueta: '' });

describe('Funciones de forma cúbicas', () => {
  it('valen 1 en su nodo y 0 en los demás, y suman 1', () => {
    const xis = xiNodos(3);
    expect(xis).toEqual([-1, -1 / 3, 1 / 3, 1]);
    expect(xiNodos(2)).toEqual([-1, 0, 1]);
    xis.forEach((xi, a) => formaCubica(xi).N.forEach((n, b) => expect(n).toBeCloseTo(a === b ? 1 : 0, 14)));
    for (const xi of [-0.9, -0.2, 0.37, 0.8]) {
      const { N, dNdxi } = formaCubica(xi);
      expect(N.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 14);
      expect(dNdxi.reduce((s, v) => s + v, 0)).toBeCloseTo(0, 13);
    }
  });
  it('las derivadas coinciden con diferencias finitas', () => {
    for (const orden of [1, 2, 3] as const) {
      for (const xi of [-0.7, 0.1, 0.55]) {
        const d = 1e-6;
        const { dNdxi } = formaLagrange(orden, xi);
        const mas = formaLagrange(orden, xi + d).N;
        const menos = formaLagrange(orden, xi - d).N;
        dNdxi.forEach((v, a) => expect(v).toBeCloseTo((mas[a] - menos[a]) / (2 * d), 8));
      }
    }
  });
});

describe('Elemento cúbico', () => {
  it('matrices elementales conocidas (rigidez, masa, convección y carga)', () => {
    const h = 0.6;
    const el = computeElement(1, [0, 3], 0, h, 0, co('1', '1', '1', '1'), 4, 3, [0, 1, 2, 3]);
    const K = [
      [148, -189, 54, -13],
      [-189, 432, -297, 54],
      [54, -297, 432, -189],
      [-13, 54, -189, 148],
    ].map((f) => f.map((v) => v / (40 * h)));
    const M = [
      [128, 99, -36, 19],
      [99, 648, -81, -36],
      [-36, -81, 648, 99],
      [19, -36, 99, 128],
    ].map((f) => f.map((v) => (v * h) / 1680));
    const B = [
      [-40, 57, -24, 7],
      [-57, 0, 81, -24],
      [24, -81, 0, 57],
      [-7, 24, -57, 40],
    ].map((f) => f.map((v) => v / 80));
    el.KeK.forEach((fila, i) => fila.forEach((v, j) => expect(v).toBeCloseTo(K[i][j], 11)));
    el.KeC.forEach((fila, i) => fila.forEach((v, j) => expect(v).toBeCloseTo(M[i][j], 12)));
    el.KeB.forEach((fila, i) => fila.forEach((v, j) => expect(v).toBeCloseTo(B[i][j], 12)));
    [1, 3, 3, 1].forEach((v, i) => expect(el.Fe[i]).toBeCloseTo((v * h) / 8, 13));
  });
});

describe('Solución con elementos cúbicos', () => {
  it('reproduce exactamente una solución cúbica con un solo elemento', () => {
    // -u'' = 6x, u(0) = u(1) = 0  →  u = x − x³
    const s = solve1D(problema({ f: '6*x', mesh: { type: 'uniforme', ne: 1 }, orden: 3, gaussPoints: 4, exact: 'x - x^3' }));
    expect(s.mesh.nodes.length).toBe(4);
    expect(s.mesh.nodes[1]).toBeCloseTo(1 / 3, 15);
    expect(maxRelErr(s.mesh.nodes, s.u, (x) => x - x ** 3)).toBeLessThan(1e-13);
    expect(s.error!.L2).toBeLessThan(1e-13);
    expect(s.post[0].du).toBeCloseTo(1 - 3 * 0.25, 12); // u'(0.5) = 1 − 3x²
    expect(s.post[0].duA).toBeCloseTo(1, 12);
    expect(s.post[0].duB).toBeCloseTo(-2, 12);
    expect(s.nodalFlux[1]).toBeCloseTo(1 - 3 / 9, 12);
  });

  it('numera los nodos en orden y deja K con 7 diagonales', () => {
    const s = solve1D(ejemploClase(3, { orden: 3, gaussPoints: 4 }));
    expect(s.mesh.nodes.length).toBe(10);
    expect(s.elements[1].dofs).toEqual([3, 4, 5, 6]);
    expect(s.elements[1].nodes).toEqual([3, 6]);
    expect(s.solverUsed).toBe('gauss');
    for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) if (Math.abs(i - j) > 3) expect(s.K[i][j]).toBe(0);
    for (let i = 1; i < 10; i++) expect(s.mesh.nodes[i]).toBeGreaterThan(s.mesh.nodes[i - 1]);
  });

  it('ejemplo de clase: lineal > cuadrático > cúbico en error', () => {
    const e = [1, 2, 3].map((orden) => solve1D(ejemploClase(3, { orden: orden as 1 | 2 | 3, gaussPoints: 4 })).error!.L2);
    expect(e[1]).toBeLessThan(e[0] / 3);
    expect(e[2]).toBeLessThan(e[1] / 3);
  });

  it('orden de convergencia: L² ~ h⁴ y H¹ ~ h³', () => {
    const c = convergenceStudy(ejemploClase(2, { orden: 3, gaussPoints: 4 }));
    expect(c.orden.L2).toBeGreaterThan(3.7);
    expect(c.orden.L2).toBeLessThan(4.3);
    expect(c.orden.H1).toBeGreaterThan(2.7);
    expect(c.orden.H1).toBeLessThan(3.3);
  });

  it('orden con referencia de malla fina (sin solución analítica)', () => {
    const c = convergenceStudy(problema({ k: '1 + x', c: '2', f: 'exp(x)', orden: 3, gaussPoints: 4 }), [2, 4, 8, 16]);
    expect(c.referencia).toBe('malla-fina');
    expect(c.orden.L2).toBeGreaterThan(3.6);
    expect(c.orden.H1).toBeGreaterThan(2.7);
  });

  it('eliminación y penalización dan lo mismo; Thomas avisa y usa Gauss', () => {
    const a = solve1D(ejemploClase(4, { orden: 3, gaussPoints: 4 }));
    const b = solve1D(ejemploClase(4, { orden: 3, gaussPoints: 4, bcMethod: 'penalizacion' }));
    a.u.forEach((v, i) => expect(Math.abs(b.u[i] - v)).toBeLessThan(1e-8));
    const t = solve1D(ejemploClase(4, { orden: 3, gaussPoints: 4, solver: 'thomas' }));
    expect(t.solverUsed).toBe('gauss');
    expect(t.warnings.some((w) => w.includes('7 diagonales'))).toBe(true);
    expect(solve1D(ejemploClase(4, { orden: 3, gaussPoints: 3 })).warnings.some((w) => w.includes('4 puntos de Gauss'))).toBe(true);
  });

  it('barra con carga uniforme, Neumann y balance', () => {
    const EA = 2e7;
    const q = 1000;
    const P = 500;
    const s = solve1D(problema({ k: String(EA), f: String(q), xL: 2, bcRight: { type: 'neumann', q: P }, mesh: { type: 'uniforme', ne: 2 }, orden: 3, gaussPoints: 4 }));
    const ex = (x: number) => ((q * 2 + P) * x - (q * x * x) / 2) / EA;
    expect(maxRelErr(s.mesh.nodes, s.u, ex)).toBeLessThan(1e-12);
    expect(s.reactions[0].value).toBeCloseTo(-(q * 2 + P), 7);
    expect(Math.abs(s.balance.residual)).toBeLessThan(1e-9 * s.balance.scale);
  });

  it('con Ne = 1 lineal sigue dando lo mismo que antes', () => {
    expect(solve1D(ejemploClase(3, { orden: 1 })).u).toEqual(solve1D(ejemploClase(3)).u);
  });
});
