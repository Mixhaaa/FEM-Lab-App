/**
 * Verificación matemática con soluciones fabricadas (MMS).
 *
 * Se elige una u(x) conocida y coeficientes variables k, b, c; la f que le corresponde
 * se obtiene derivando a mano:  f = -(k u')' + b u' + c u = -k' u' - k u'' + b u' + c u.
 * Los datos de frontera (Dirichlet, Neumann, Robin) salen de la misma u. El MEF debe
 * converger a u con el orden teórico en las 9 combinaciones de fronteras, con elementos
 * lineales (h² en L², h en H¹) y cuadráticos (h³ y h²), en un dominio que no empieza en 0.
 */
import { describe, expect, it } from 'vitest';
import { integrate, motivoExactaIncompatible, solve1D, type BoundaryCondition, type Problem1D } from '../src/core';
import { problema } from './helpers';

// u = sin(2x) + x²,  k = 1 + x²,  b = 2 − x,  c = 3 + cos(x)
const U = 'sin(2*x) + x^2';
const K = '1 + x^2';
const B = '2 - x';
const C = '3 + cos(x)';
const F = '-(2*x)*(2*cos(2*x) + 2*x) - (1 + x^2)*(-4*sin(2*x) + 2) + (2 - x)*(2*cos(2*x) + 2*x) + (3 + cos(x))*(sin(2*x) + x^2)';
const u = (x: number) => Math.sin(2 * x) + x * x;
const du = (x: number) => 2 * Math.cos(2 * x) + 2 * x;
const k = (x: number) => 1 + x * x;
const X0 = 0.3;
const XL = 1.7;

type Tipo = 'dirichlet' | 'neumann' | 'robin';
/** Condición de frontera que cumple la u fabricada. n = −1 en x0 y +1 en xL. */
function frontera(tipo: Tipo, x: number, n: -1 | 1): BoundaryCondition {
  const flujo = k(x) * n * du(x); // k ∂u/∂n
  if (tipo === 'dirichlet') return { type: 'dirichlet', value: u(x) };
  if (tipo === 'neumann') return { type: 'neumann', q: flujo };
  const h = n === -1 ? 2 : 3;
  return { type: 'robin', h, g: flujo + h * u(x) };
}

function caso(izq: Tipo, der: Tipo, ne: number, orden: 1 | 2, extra: Partial<Problem1D> = {}): Problem1D {
  return problema({
    x0: X0,
    xL: XL,
    k: K,
    b: B,
    c: C,
    f: F,
    bcLeft: frontera(izq, X0, -1),
    bcRight: frontera(der, XL, 1),
    mesh: { type: 'uniforme', ne },
    gaussPoints: 4,
    orden,
    exact: U,
    ...extra,
  });
}

const TIPOS: Tipo[] = ['dirichlet', 'neumann', 'robin'];
const tasa = (e1: number, e2: number) => Math.log2(e1 / e2);

describe('Soluciones fabricadas: coeficientes variables y todas las fronteras', () => {
  it('la f escrita a mano corresponde a la u elegida (revisión independiente por diferencias finitas)', () => {
    expect(motivoExactaIncompatible(caso('dirichlet', 'dirichlet', 4, 1), U)).toBeNull();
  });

  for (const izq of TIPOS) {
    for (const der of TIPOS) {
      it(`${izq} – ${der}: lineales h² / h y cuadráticos h³ / h²`, () => {
        for (const orden of [1, 2] as const) {
          const a = solve1D(caso(izq, der, 16, orden)).error!;
          const b = solve1D(caso(izq, der, 32, orden)).error!;
          const nombre = `${izq}-${der} orden ${orden}`;
          expect(tasa(a.L2, b.L2), `${nombre} L²`).toBeGreaterThan(orden + 1 - 0.15);
          expect(tasa(a.L2, b.L2), `${nombre} L²`).toBeLessThan(orden + 1 + 0.25);
          expect(tasa(a.H1semi, b.H1semi), `${nombre} H¹`).toBeGreaterThan(orden - 0.15);
          expect(tasa(a.H1semi, b.H1semi), `${nombre} H¹`).toBeLessThan(orden + 0.25);
          // Y el error ya es pequeño frente a u (máx |u| ≈ 2.6)
          expect(b.maxNodal, `${nombre} nodal`).toBeLessThan(orden === 1 ? 2e-3 : 2e-6);
        }
      });
    }
  }

  it('las reacciones convergen al flujo exacto k ∂u/∂n en los apoyos', () => {
    for (const orden of [1, 2] as const) {
      const s = solve1D(caso('dirichlet', 'dirichlet', 64, orden));
      const izq = s.reactions.find((r) => r.lado === 'izquierda')!.value;
      const der = s.reactions.find((r) => r.lado === 'derecha')!.value;
      expect(Math.abs(izq - -k(X0) * du(X0))).toBeLessThan(orden === 1 ? 2e-3 : 1e-6);
      expect(Math.abs(der - k(XL) * du(XL))).toBeLessThan(orden === 1 ? 2e-3 : 1e-6);
    }
  });

  it("la derivada del posproceso converge a u' (centro; y extremos en cuadráticos)", () => {
    const lin = solve1D(caso('dirichlet', 'robin', 64, 1));
    for (const p of lin.post) expect(Math.abs(p.du - du(p.xm))).toBeLessThan(2e-3);
    // Cuadráticos: u' en el centro y en los extremos converge como h² (al duplicar Ne el error baja ~4 veces)
    const peor = (ne: number) => {
      const cua = solve1D(caso('dirichlet', 'robin', ne, 2));
      let centro = 0;
      let extremos = 0;
      let flujo = 0;
      cua.post.forEach((p, e) => {
        const el = cua.elements[e];
        centro = Math.max(centro, Math.abs(p.du - du(p.xm)));
        extremos = Math.max(extremos, Math.abs(p.duA - du(el.xa)), Math.abs(p.duB - du(el.xb)));
        flujo = Math.max(flujo, Math.abs(p.kdu - k(p.xm) * du(p.xm)));
      });
      return { centro, extremos, flujo };
    };
    const a = peor(32);
    const b = peor(64);
    expect(a.centro).toBeLessThan(1e-3);
    expect(a.extremos).toBeLessThan(5e-3);
    expect(a.flujo).toBeLessThan(3e-3);
    for (const m of ['centro', 'extremos', 'flujo'] as const) {
      expect(tasa(a[m], b[m]), m).toBeGreaterThan(1.8);
      expect(tasa(a[m], b[m]), m).toBeLessThan(2.2);
    }
  });

  it('las normas L² y H¹ del error coinciden con una integración independiente', () => {
    for (const orden of [1, 2] as const) {
      const s = solve1D(caso('neumann', 'dirichlet', 6, orden));
      // u_h y u_h' evaluadas directamente con interpolación de Lagrange en cada elemento
      let L2 = 0;
      let H1 = 0;
      for (const el of s.elements) {
        const xs = el.dofs.map((d) => s.mesh.nodes[d]);
        const us = el.dofs.map((d) => s.u[d]);
        const lag = (x: number, derivada: boolean) => {
          let total = 0;
          for (let i = 0; i < xs.length; i++) {
            if (!derivada) {
              let li = 1;
              for (let j = 0; j < xs.length; j++) if (j !== i) li *= (x - xs[j]) / (xs[i] - xs[j]);
              total += us[i] * li;
            } else {
              let dli = 0;
              for (let m = 0; m < xs.length; m++) {
                if (m === i) continue;
                let prod = 1 / (xs[i] - xs[m]);
                for (let j = 0; j < xs.length; j++) if (j !== i && j !== m) prod *= (x - xs[j]) / (xs[i] - xs[j]);
                dli += prod;
              }
              total += us[i] * dli;
            }
          }
          return total;
        };
        // 40 subintervalos con Gauss de 5 puntos: integración mucho más fina que la del núcleo
        for (let q = 0; q < 40; q++) {
          const a = el.xa + (el.h * q) / 40;
          const b = el.xa + (el.h * (q + 1)) / 40;
          L2 += integrate((x) => (lag(x, false) - u(x)) ** 2, a, b, 5);
          H1 += integrate((x) => (lag(x, true) - du(x)) ** 2, a, b, 5);
        }
      }
      expect(s.error!.L2 / Math.sqrt(L2)).toBeCloseTo(1, 3);
      expect(s.error!.H1semi / Math.sqrt(H1)).toBeCloseTo(1, 3);
    }
  });

  it('malla refinada, penalización y los dos solucionadores dan la misma solución', () => {
    for (const orden of [1, 2] as const) {
      const base = solve1D(caso('dirichlet', 'robin', 24, orden));
      const pen = solve1D(caso('dirichlet', 'robin', 24, orden, { bcMethod: 'penalizacion', penaltyExp: 10 }));
      const gauss = solve1D(caso('dirichlet', 'robin', 24, orden, { solver: 'gauss' }));
      base.u.forEach((v, i) => {
        expect(Math.abs(pen.u[i] - v)).toBeLessThan(1e-7);
        expect(Math.abs(gauss.u[i] - v)).toBeLessThan(1e-11);
      });
      const geo = solve1D(caso('robin', 'neumann', 48, orden, { mesh: { type: 'geometrica', ne: 48, ratio: 6, hacia: 'ambos' } }));
      expect(geo.error!.maxNodal).toBeLessThan(orden === 1 ? 3e-3 : 1e-5);
    }
  });
});

describe('Solución fabricada con dos materiales y una carga puntual', () => {
  // Flujo w = k u' = cos(x) − P·H(x − 0.8): continuo en el cambio de material (x = 0.5) y con salto −P en la carga.
  // −(k u')' = sin(x) en cada tramo. k = 1 en [0, 0.5] y k = 5 en [0.5, 1.2].
  const P = 0.7;
  const s05 = Math.sin(0.5);
  const s08 = Math.sin(0.8);
  const exacta = `x <= 0.5 ? sin(x) : (x <= 0.8 ? ${s05} + (sin(x) - ${s05})/5 : ${s05} + (${s08} - ${s05})/5 + (sin(x) - ${s08})/5 - ${P}*(x - 0.8)/5)`;
  const uEx = (x: number) => (x <= 0.5 ? Math.sin(x) : x <= 0.8 ? s05 + (Math.sin(x) - s05) / 5 : s05 + (s08 - s05) / 5 + (Math.sin(x) - s08) / 5 - (P * (x - 0.8)) / 5);
  const prob = (ne: number, orden: 1 | 2): Problem1D =>
    problema({
      x0: 0,
      xL: 1.2,
      regions: [
        { x0: 0, x1: 0.5, k: '1', b: '0', c: '0', f: 'sin(x)' },
        { x0: 0.5, x1: 1.2, k: '5', b: '0', c: '0', f: 'sin(x)' },
      ],
      loads: [{ x: 0.8, P }],
      bcLeft: { type: 'dirichlet', value: 0 },
      // k u'(1.2) = cos(1.2) − P
      bcRight: { type: 'neumann', q: Math.cos(1.2) - P },
      mesh: { type: 'uniforme', ne },
      orden,
      exact: exacta,
    });

  it('converge con el orden teórico aunque u tenga quiebres (hay nodos en ellos)', () => {
    for (const orden of [1, 2] as const) {
      const a = solve1D(prob(12, orden));
      const b = solve1D(prob(24, orden));
      // Hay nodo en 0.5 y en 0.8
      for (const x of [0.5, 0.8]) expect(a.mesh.nodes.some((n) => Math.abs(n - x) < 1e-12)).toBe(true);
      expect(tasa(a.error!.L2, b.error!.L2)).toBeGreaterThan(orden + 1 - 0.3);
      expect(tasa(a.error!.H1semi, b.error!.H1semi)).toBeGreaterThan(orden - 0.3);
      // k constante por tramos y b = c = 0: los extremos de los elementos son exactos
      for (const el of b.elements) for (const d of el.nodes) expect(Math.abs(b.u[d] - uEx(b.mesh.nodes[d]))).toBeLessThan(1e-10);
      // Reacción en el empotramiento: k ∂u/∂n = −k u'(0) = −1
      expect(b.reactions[0].value).toBeCloseTo(-1, 9);
      expect(Math.abs(b.balance.residual)).toBeLessThan(1e-10 * b.balance.scale);
    }
  });
});
