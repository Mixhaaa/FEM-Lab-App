/** Las tres condiciones de frontera, propiedades por tramos, cargas puntuales y métodos. */
import { describe, expect, it } from 'vitest';
import { FemError, solve1D } from '../src/core';
import { ejemploClase, maxRelErr, problema } from './helpers';

describe('Condiciones de frontera (convención k·∂u/∂n con normal exterior)', () => {
  it('Dirichlet no homogéneo', () => {
    const sol = solve1D(problema({ bcLeft: { type: 'dirichlet', value: 2 }, bcRight: { type: 'dirichlet', value: 5 } }));
    expect(maxRelErr(sol.mesh.nodes, sol.u, (x) => 2 + 3 * x)).toBeLessThan(1e-13);
  });

  it('Neumann a la izquierda: −u′(0) = q', () => {
    const q = 3;
    const sol = solve1D(problema({ bcLeft: { type: 'neumann', q }, mesh: { type: 'uniforme', ne: 4 } }));
    expect(maxRelErr(sol.mesh.nodes, sol.u, (x) => q * (1 - x))).toBeLessThan(1e-13);
  });

  it('Neumann homogéneo con carga: −u″ = 1, u′(0) = 0, u(1) = 0', () => {
    const sol = solve1D(problema({ f: '1', bcLeft: { type: 'neumann', q: 0 }, mesh: { type: 'uniforme', ne: 5 } }));
    expect(maxRelErr(sol.mesh.nodes, sol.u, (x) => (1 - x * x) / 2)).toBeLessThan(1e-13);
  });

  it('Robin a la izquierda: −u′(0) + h·u(0) = g', () => {
    const h = 2;
    const g = 3;
    const A = g / (1 + h);
    const sol = solve1D(problema({ bcLeft: { type: 'robin', h, g }, mesh: { type: 'uniforme', ne: 3 } }));
    expect(maxRelErr(sol.mesh.nodes, sol.u, (x) => A * (1 - x))).toBeLessThan(1e-13);
  });

  it('Robin a la derecha: u′(1) + h·u(1) = g', () => {
    const h = 4;
    const g = 10;
    const sol = solve1D(problema({ bcRight: { type: 'robin', h, g }, mesh: { type: 'uniforme', ne: 3 } }));
    expect(maxRelErr(sol.mesh.nodes, sol.u, (x) => (g / (1 + h)) * x)).toBeLessThan(1e-13);
  });

  it('Robin en ambos extremos (sin Dirichlet, pero K no singular)', () => {
    const [h1, g1, h2, g2] = [1, 2, 3, 4];
    // u = a + b·x:  −b + h1·a = g1 ;  b + h2(a + b) = g2
    const det = h1 * (1 + h2) + h2;
    const a = (g1 * (1 + h2) + g2) / det;
    const b = h1 * a - g1;
    const sol = solve1D(
      problema({ bcLeft: { type: 'robin', h: h1, g: g1 }, bcRight: { type: 'robin', h: h2, g: g2 }, mesh: { type: 'uniforme', ne: 4 } }),
    );
    expect(maxRelErr(sol.mesh.nodes, sol.u, (x) => a + b * x)).toBeLessThan(1e-12);
    expect(sol.reactions).toHaveLength(0);
  });

  it('Neumann en ambos extremos con c > 0: −u″ + u = 0, u′(0)=0, u′(1)=1', () => {
    const sol = solve1D(
      problema({ c: '1', bcLeft: { type: 'neumann', q: 0 }, bcRight: { type: 'neumann', q: 1 }, mesh: { type: 'uniforme', ne: 200 } }),
    );
    expect(maxRelErr(sol.mesh.nodes, sol.u, (x) => Math.cosh(x) / Math.sinh(1))).toBeLessThan(1e-4);
  });

  it('sin Dirichlet y c = 0: error claro de matriz singular', () => {
    expect(() => solve1D(problema({ bcLeft: { type: 'neumann', q: 1 }, bcRight: { type: 'neumann', q: -1 } }))).toThrowError(
      /singular/,
    );
  });
});

describe('Propiedades por tramos', () => {
  const dosMateriales = (ne: number) =>
    problema({
      xL: 3,
      regions: [
        { x0: 0, x1: 1, k: '2', b: '0', c: '0', f: '0', nombre: 'Material 1' },
        { x0: 1, x1: 3, k: '5', b: '0', c: '0', f: '0', nombre: 'Material 2' },
      ],
      bcRight: { type: 'neumann', q: 10 },
      mesh: { type: 'uniforme', ne },
    });

  it('barra de dos materiales: u(1) = P·a/EA₁, u(3) = u(1) + P·b/EA₂', () => {
    const sol = solve1D(dosMateriales(3));
    expect(sol.mesh.nodes).toEqual([0, 1, 2, 3]);
    expect(sol.u[1]).toBeCloseTo(5, 12);
    expect(sol.u[3]).toBeCloseTo(9, 12);
    expect(sol.mesh.elementRegion).toEqual([0, 1, 1]);
  });

  it('si la malla uniforme no cae en el cambio de material, se reparte por tramos', () => {
    const sol = solve1D(dosMateriales(4));
    expect(sol.mesh.nodes.some((x) => Math.abs(x - 1) < 1e-12)).toBe(true);
    expect(sol.mesh.nodes.length).toBe(5);
    expect(sol.u[sol.u.length - 1]).toBeCloseTo(9, 12);
    // Ningún elemento cruza el cambio de material
    sol.elements.forEach((el) => expect(el.xb <= 1 + 1e-12 || el.xa >= 1 - 1e-12).toBe(true));
  });

  it('pared compuesta: flujo q = ΔT / (L₁/k₁ + L₂/k₂)', () => {
    const [k1, k2, L1, L2, T1, T2] = [1.2, 0.04, 0.2, 0.1, 30, -10];
    const sol = solve1D(
      problema({
        xL: L1 + L2,
        regions: [
          { x0: 0, x1: L1, k: String(k1), b: '0', c: '0', f: '0' },
          { x0: L1, x1: L1 + L2, k: String(k2), b: '0', c: '0', f: '0' },
        ],
        bcLeft: { type: 'dirichlet', value: T1 },
        bcRight: { type: 'dirichlet', value: T2 },
        mesh: { type: 'uniforme', ne: 6 },
      }),
    );
    const flujo = (T1 - T2) / (L1 / k1 + L2 / k2);
    for (const p of sol.post) expect(-p.kdu).toBeCloseTo(flujo, 10);
  });

  it('tramos con distinta carga f: el balance global cierra', () => {
    const sol = solve1D(
      problema({
        regions: [
          { x0: 0, x1: 0.5, k: '1', b: '0', c: '0', f: '4' },
          { x0: 0.5, x1: 1, k: '3', b: '0', c: '2', f: 'x^2' },
        ],
        mesh: { type: 'uniforme', ne: 7 },
      }),
    );
    expect(Math.abs(sol.balance.residual)).toBeLessThan(1e-12 * sol.balance.scale);
  });

  it('tramos con huecos dan un error claro', () => {
    expect(() =>
      solve1D(
        problema({
          regions: [
            { x0: 0, x1: 0.4, k: '1', b: '0', c: '0', f: '0' },
            { x0: 0.5, x1: 1, k: '1', b: '0', c: '0', f: '0' },
          ],
        }),
      ),
    ).toThrowError(/contiguos/);
  });
});

describe('Cargas puntuales', () => {
  it('barra biempotrada con P en x = 0.3: u = P·a·b/(EA·L), reacciones −P·b/L y −P·a/L', () => {
    const sol = solve1D(problema({ loads: [{ x: 0.3, P: 1 }], mesh: { type: 'uniforme', ne: 5 } }));
    const i = sol.mesh.nodes.findIndex((x) => Math.abs(x - 0.3) < 1e-12);
    expect(i).toBeGreaterThan(0);
    expect(sol.u[i]).toBeCloseTo(0.21, 12);
    expect(sol.reactions[0].value).toBeCloseTo(-0.7, 12);
    expect(sol.reactions[1].value).toBeCloseTo(-0.3, 12);
  });
});

describe('Eliminación vs penalización y Thomas vs Gauss', () => {
  it('penalización reproduce la eliminación (ejemplo de clase)', () => {
    const a = solve1D(ejemploClase(10));
    const b = solve1D(ejemploClase(10, { bcMethod: 'penalizacion', penaltyExp: 10 }));
    expect(b.beta).toBeGreaterThan(0);
    a.u.forEach((v, i) => expect(Math.abs(v - b.u[i])).toBeLessThan(1e-9));
    a.reactions.forEach((r, i) => expect(b.reactions[i].value).toBeCloseTo(r.value, 6));
  });

  it('penalización con Dirichlet no homogéneo', () => {
    const b = solve1D(
      problema({ bcLeft: { type: 'dirichlet', value: 2 }, bcRight: { type: 'dirichlet', value: 5 }, bcMethod: 'penalizacion' }),
    );
    expect(maxRelErr(b.mesh.nodes, b.u, (x) => 2 + 3 * x)).toBeLessThan(1e-7);
  });

  it('el sistema reducido tiene solo los nodos libres', () => {
    const a = solve1D(ejemploClase(3));
    expect(a.system.free).toEqual([1, 2]);
    expect(a.system.K).toHaveLength(2);
  });

  it('Thomas y Gauss dan la misma solución', () => {
    const t = solve1D(ejemploClase(20, { solver: 'thomas' }));
    const g = solve1D(ejemploClase(20, { solver: 'gauss' }));
    expect(t.solverUsed).toBe('thomas');
    expect(g.solverUsed).toBe('gauss');
    t.u.forEach((v, i) => expect(v).toBeCloseTo(g.u[i], 14));
  });

  it('el error lanzado es FemError con mensaje en español', () => {
    try {
      solve1D(problema({ bcLeft: { type: 'neumann', q: 0 }, bcRight: { type: 'neumann', q: 0 } }));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(FemError);
      expect((e as Error).message).toMatch(/Dirichlet/);
    }
  });
});
