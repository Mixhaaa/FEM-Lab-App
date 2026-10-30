/** Barra, calor, aleta, cable y convección-difusión contra soluciones analíticas. */
import { describe, expect, it } from 'vitest';
import { solve1D } from '../src/core';
import { maxRelErr, problema } from './helpers';

describe('Barra con carga axial uniforme', () => {
  const E = 210e9;
  const A = 0.002;
  const EA = E * A;
  const L = 2;
  const q = 5000;
  const P = 25000;
  const exact = (x: number) => (q * (L * x - (x * x) / 2) + P * x) / EA;

  const sol = solve1D(
    problema({
      xL: L,
      k: String(EA),
      f: String(q),
      bcLeft: { type: 'dirichlet', value: 0 },
      bcRight: { type: 'neumann', q: P },
      mesh: { type: 'uniforme', ne: 6 },
    }),
  );

  it('desplazamientos exactos en los nodos', () => {
    expect(maxRelErr(sol.mesh.nodes, sol.u, exact)).toBeLessThan(1e-12);
  });

  it('fuerza interna N = EA·u′ exacta en el centro de cada elemento', () => {
    for (const p of sol.post) expect(p.kdu).toBeCloseTo(q * (L - p.xm) + P, 5);
  });

  it('reacción en el empotramiento R = −(qL + P)', () => {
    expect(sol.reactions).toHaveLength(1);
    expect(sol.reactions[0].value).toBeCloseTo(-(q * L + P), 4);
  });

  it('la carga como fuerza puntual en x = L da el mismo resultado', () => {
    const s2 = solve1D(
      problema({
        xL: L,
        k: String(EA),
        f: String(q),
        bcRight: { type: 'neumann', q: 0 },
        loads: [{ x: L, P }],
        mesh: { type: 'uniforme', ne: 6 },
      }),
    );
    s2.u.forEach((v, i) => expect(v).toBeCloseTo(sol.u[i], 15));
  });

  it('la energía de deformación ½uᵀKu es igual al trabajo ½uᵀF', () => {
    expect(sol.energy.aplica).toBe(true);
    expect(sol.energy.U).toBeCloseTo(sol.energy.W, 10);
  });

  it('barra de sección variable A(x) converge a la solución analítica', () => {
    const A0 = 0.01;
    const s = solve1D(
      problema({
        xL: 1,
        k: `${E}*${A0}*(1 - x/2)`,
        bcRight: { type: 'neumann', q: 1000 },
        mesh: { type: 'uniforme', ne: 50 },
      }),
    );
    const ex = (x: number) => ((1000 / (E * A0)) * -2 * Math.log(1 - x / 2));
    expect(maxRelErr(s.mesh.nodes, s.u, ex)).toBeLessThan(1e-4);
  });
});

describe('Conducción de calor con generación interna', () => {
  const k = 15;
  const Q = 2e5;
  const L = 0.05;
  const T1 = 100;
  const T2 = 20;
  const exact = (x: number) => T1 + ((T2 - T1) * x) / L + (Q * x * (L - x)) / (2 * k);

  it('temperaturas exactas en los nodos (Dirichlet en ambos extremos)', () => {
    const sol = solve1D(
      problema({
        xL: L,
        k: String(k),
        f: String(Q),
        bcLeft: { type: 'dirichlet', value: T1 },
        bcRight: { type: 'dirichlet', value: T2 },
        mesh: { type: 'uniforme', ne: 5 },
      }),
    );
    expect(maxRelErr(sol.mesh.nodes, sol.u, exact)).toBeLessThan(1e-12);
    // Calor que entra por la izquierda: −k T′(0)
    const dT0 = (T2 - T1) / L + (Q * L) / (2 * k);
    expect(sol.reactions[0].value).toBeCloseTo(-k * dT0, 6);
    // Balance: lo que entra por los extremos + lo generado = 0
    expect(sol.reactions[0].value + sol.reactions[1].value + Q * L).toBeCloseTo(0, 6);
  });

  it('convección en el extremo derecho (Robin)', () => {
    const h = 50;
    const Tinf = 25;
    const C = (Q * L - h * (T1 - Tinf) + (h * Q * L * L) / (2 * k)) / (k + h * L);
    const ex = (x: number) => T1 + C * x - (Q * x * x) / (2 * k);
    const sol = solve1D(
      problema({
        xL: L,
        k: String(k),
        f: String(Q),
        bcLeft: { type: 'dirichlet', value: T1 },
        bcRight: { type: 'robin', h, g: h * Tinf },
        mesh: { type: 'uniforme', ne: 4 },
      }),
    );
    expect(maxRelErr(sol.mesh.nodes, sol.u, ex)).toBeLessThan(1e-12);
  });
});

describe('Aleta con convección', () => {
  const k = 200;
  const D = 0.005;
  const A = (Math.PI * D * D) / 4;
  const Pm = Math.PI * D;
  const h = 25;
  const L = 0.1;
  const Tb = 100;
  const Tinf = 25;
  const m = Math.sqrt((h * Pm) / (k * A));
  const base = {
    xL: L,
    k: String(k * A),
    c: String(h * Pm),
    f: String(h * Pm * Tinf),
    bcLeft: { type: 'dirichlet' as const, value: Tb },
    mesh: { type: 'uniforme' as const, ne: 100 },
  };

  it('punta adiabática: θ/θb = cosh(m(L−x))/cosh(mL) y Q = √(hPkA)·θb·tanh(mL)', () => {
    const sol = solve1D(problema({ ...base, bcRight: { type: 'neumann', q: 0 } }));
    const ex = (x: number) => Tinf + ((Tb - Tinf) * Math.cosh(m * (L - x))) / Math.cosh(m * L);
    expect(maxRelErr(sol.mesh.nodes, sol.u, ex)).toBeLessThan(1e-5);
    const Qfin = Math.sqrt(h * Pm * k * A) * (Tb - Tinf) * Math.tanh(m * L);
    expect(Math.abs(sol.reactions[0].value - Qfin) / Qfin).toBeLessThan(1e-4);
  });

  it('punta con convección (Robin con h·A y g = h·A·T∞)', () => {
    const sol = solve1D(problema({ ...base, bcRight: { type: 'robin', h: h * A, g: h * A * Tinf } }));
    const r = h / (m * k);
    const ex = (x: number) =>
      Tinf + ((Tb - Tinf) * (Math.cosh(m * (L - x)) + r * Math.sinh(m * (L - x)))) / (Math.cosh(m * L) + r * Math.sinh(m * L));
    expect(maxRelErr(sol.mesh.nodes, sol.u, ex)).toBeLessThan(1e-5);
    const Qfin = Math.sqrt(h * Pm * k * A) * (Tb - Tinf) * (Math.sinh(m * L) + r * Math.cosh(m * L)) / (Math.cosh(m * L) + r * Math.sinh(m * L));
    expect(Math.abs(sol.reactions[0].value - Qfin) / Qfin).toBeLessThan(1e-4);
  });
});

describe('Cable tenso y convección-difusión', () => {
  it('cable: −T·w″ = q da la parábola w = q·x(L−x)/(2T)', () => {
    const T = 1000;
    const q = 50;
    const L = 4;
    const sol = solve1D(problema({ xL: L, k: String(T), f: String(q), mesh: { type: 'uniforme', ne: 8 } }));
    expect(maxRelErr(sol.mesh.nodes, sol.u, (x) => (q * x * (L - x)) / (2 * T))).toBeLessThan(1e-12);
  });

  it('−u″ + 5u′ = 0, u(0)=0, u(1)=1 (término b(x))', () => {
    const b = 5;
    const sol = solve1D(
      problema({ b: String(b), bcRight: { type: 'dirichlet', value: 1 }, mesh: { type: 'uniforme', ne: 100 } }),
    );
    const ex = (x: number) => (Math.exp(b * x) - 1) / (Math.exp(b) - 1);
    expect(maxRelErr(sol.mesh.nodes, sol.u, ex)).toBeLessThan(1e-3);
    expect(Math.abs(sol.balance.residual)).toBeLessThan(1e-10 * sol.balance.scale);
    expect(sol.energy.aplica).toBe(false);
  });

  it('avisa si el Péclet de malla es mayor que 1', () => {
    const sol = solve1D(problema({ b: '100', bcRight: { type: 'dirichlet', value: 1 }, mesh: { type: 'uniforme', ne: 10 } }));
    expect(sol.warnings.join(' ')).toMatch(/Péclet/);
  });
});
