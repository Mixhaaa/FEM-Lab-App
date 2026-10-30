/** Mallas, cuadratura, expresiones y validación de entradas. */
import { describe, expect, it } from 'vitest';
import { buildMesh, compileExpr, gaussRule, geometricNodes, integrate, solve1D } from '../src/core';
import { ejemploClase, problema } from './helpers';

describe('Cuadratura de Gauss', () => {
  it('n puntos integran exactamente polinomios de grado 2n − 1', () => {
    for (let n = 1; n <= 5; n++) {
      const deg = 2 * n - 1;
      const exacto = (Math.pow(3, deg + 1) - Math.pow(-1, deg + 1)) / (deg + 1);
      expect(integrate((x) => Math.pow(x, deg), -1, 3, n)).toBeCloseTo(exacto, 9);
      expect(gaussRule(n).w.reduce((a, b) => a + b, 0)).toBeCloseTo(2, 14);
    }
  });
});

describe('Mallas', () => {
  it('geométrica: extremos correctos, crecientes y razón h_max/h_min = r', () => {
    for (const hacia of ['izquierda', 'derecha', 'ambos'] as const) {
      const nodes = geometricNodes(0, 2, 10, 8, hacia);
      expect(nodes[0]).toBe(0);
      expect(nodes[10]).toBe(2);
      const h = nodes.slice(1).map((x, i) => x - nodes[i]);
      h.forEach((v) => expect(v).toBeGreaterThan(0));
      expect(Math.max(...h) / Math.min(...h)).toBeCloseTo(8, 8);
      if (hacia === 'izquierda') expect(h[0]).toBeLessThan(h[9]);
      if (hacia === 'derecha') expect(h[0]).toBeGreaterThan(h[9]);
    }
  });

  it('malla geométrica refinada hacia x = 1 mejora el ejemplo de clase (capa límite)', () => {
    const uni = solve1D(ejemploClase(10));
    const geo = solve1D(ejemploClase(10, { mesh: { type: 'geometrica', ne: 10, ratio: 6, hacia: 'derecha' } }));
    expect(geo.error!.L2).toBeLessThan(uni.error!.L2);
  });

  it('manual: se agregan los nodos de cambio de tramo y se avisa', () => {
    const m = buildMesh(
      0,
      1,
      { type: 'manual', nodes: [0, 0.2, 0.7, 1] },
      [
        { x0: 0, x1: 0.5, k: '1', b: '0', c: '0', f: '0' },
        { x0: 0.5, x1: 1, k: '2', b: '0', c: '0', f: '0' },
      ],
      [],
    );
    expect(m.nodes).toEqual([0, 0.2, 0.5, 0.7, 1]);
    expect(m.warnings.length).toBe(1);
  });

  it('manual: nodos desordenados dan error claro', () => {
    expect(() => buildMesh(0, 1, { type: 'manual', nodes: [0, 0.6, 0.3, 1] }, [], [])).toThrowError(/crecientes/);
  });

  it('Ne < 1 o no entero da error', () => {
    expect(() => solve1D(problema({ mesh: { type: 'uniforme', ne: 0 } }))).toThrowError(/Ne/);
    expect(() => solve1D(problema({ mesh: { type: 'uniforme', ne: 2.5 } }))).toThrowError(/entero/);
  });
});

describe('Expresiones', () => {
  it('lee constantes y funciones de x', () => {
    expect(compileExpr('10*x^3').fn(2)).toBeCloseTo(80, 14);
    expect(compileExpr('2+sin(x)').fn(Math.PI / 2)).toBeCloseTo(3, 14);
    expect(compileExpr('x**2').fn(3)).toBe(9);
    expect(compileExpr('pi').fn(0)).toBeCloseTo(Math.PI, 14);
    expect(compileExpr('2,5').fn(0)).toBe(2.5);
    expect(compileExpr('7').constant).toBe(true);
    expect(compileExpr('exp(-x)').constant).toBe(false);
  });

  it('expresión inválida → mensaje claro en español', () => {
    expect(() => compileExpr('10*x^', 'f(x)')).toThrowError(/f\(x\) no es una expresión válida/);
    expect(() => compileExpr('2*y', 'k(x)')).toThrowError(/usa y/);
    expect(() => compileExpr('foo(x)', 'k(x)')).toThrowError(/foo\(\)/);
    expect(() => compileExpr('', 'c(x)')).toThrowError(/vacía/);
  });

  it('k(x) ≤ 0 da error', () => {
    expect(() => solve1D(problema({ k: '1 - 2*x' }))).toThrowError(/positiva/);
  });

  it('expresión que no es finita da error', () => {
    expect(() => solve1D(problema({ f: '1/(x-0.5)', mesh: { type: 'uniforme', ne: 1 }, gaussPoints: 1 }))).toThrowError(
      /no es finita/,
    );
  });

  it('dominio inválido', () => {
    expect(() => solve1D(problema({ x0: 1, xL: 1 }))).toThrowError(/dominio/);
  });
});
