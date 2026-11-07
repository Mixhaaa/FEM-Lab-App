/** Elementos cuadráticos de 3 nodos (inicio, centro, fin). */
import { describe, expect, it } from 'vitest';
import { computeElement, compileExpr, convergenceStudy, solve1D } from '../src/core';
import { EXACTA_CLASE, ejemploClase, maxRelErr, problema } from './helpers';

const co = (k: string, b = '0', c = '0', f = '0') => ({
  k: compileExpr(k),
  b: compileExpr(b),
  c: compileExpr(c),
  f: compileExpr(f),
  etiqueta: '',
});

describe('Elemento cuadrático', () => {
  it('matriz y vector elementales conocidos (k = 1, f = 1)', () => {
    const h = 0.5;
    const el = computeElement(1, [0, 2], 0, h, 0, co('1', '0', '0', '1'), 3, 2, [0, 1, 2]);
    const K = [
      [7, -8, 1],
      [-8, 16, -8],
      [1, -8, 7],
    ].map((f) => f.map((v) => v / (3 * h)));
    el.Ke.forEach((fila, i) => fila.forEach((v, j) => expect(v).toBeCloseTo(K[i][j], 12)));
    [1, 4, 1].forEach((v, i) => expect(el.Fe[i]).toBeCloseTo((v * h) / 6, 14));
  });

  it('matriz de masa c·∫N·N y convección b·∫N·N′ conocidas', () => {
    const h = 2;
    const el = computeElement(1, [0, 2], 0, h, 0, co('1', '3', '1'), 3, 2, [0, 1, 2]);
    const M = [
      [4, 2, -1],
      [2, 16, 2],
      [-1, 2, 4],
    ].map((f) => f.map((v) => (v * h) / 30));
    el.KeC.forEach((fila, i) => fila.forEach((v, j) => expect(v).toBeCloseTo(M[i][j], 12)));
    const B = [
      [-3, 4, -1],
      [-4, 0, 4],
      [1, -4, 3],
    ].map((f) => f.map((v) => (3 * v) / 6));
    el.KeB.forEach((fila, i) => fila.forEach((v, j) => expect(v).toBeCloseTo(B[i][j], 12)));
  });
});

describe('Solución con elementos cuadráticos', () => {
  it('reproduce exactamente una solución cuadrática con un solo elemento', () => {
    // -u'' = 2, u(0) = u(1) = 0  →  u = x(1 − x)
    const s = solve1D(problema({ f: '2', mesh: { type: 'uniforme', ne: 1 }, orden: 2, exact: 'x*(1-x)' }));
    expect(s.mesh.nodes).toEqual([0, 0.5, 1]);
    expect(s.u[1]).toBeCloseTo(0.25, 14);
    expect(s.error!.L2).toBeLessThan(1e-12);
    expect(s.post[0].duA).toBeCloseTo(1, 12);
    expect(s.post[0].duB).toBeCloseTo(-1, 12);
  });

  it('numera los nodos en orden y deja K con 5 diagonales', () => {
    const s = solve1D(ejemploClase(3, { orden: 2 }));
    expect(s.mesh.nodes.length).toBe(7);
    expect(s.elements[1].dofs).toEqual([2, 3, 4]);
    expect(s.elements[1].nodes).toEqual([2, 4]);
    expect(s.solverUsed).toBe('gauss');
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if (Math.abs(i - j) > 2) expect(s.K[i][j]).toBe(0);
  });

  it('ejemplo de clase: mucho más preciso que con lineales', () => {
    const lin = solve1D(ejemploClase(3));
    const cua = solve1D(ejemploClase(3, { orden: 2 }));
    expect(cua.error!.maxNodal).toBeLessThan(lin.error!.maxNodal / 3);
    expect(cua.error!.L2).toBeLessThan(lin.error!.L2 / 3);
  });

  it('orden de convergencia: L² ~ h³ y H¹ ~ h²', () => {
    const c = convergenceStudy(ejemploClase(2, { orden: 2 }));
    expect(c.orden.L2).toBeGreaterThan(2.8);
    expect(c.orden.L2).toBeLessThan(3.2);
    expect(c.orden.H1).toBeGreaterThan(1.8);
    expect(c.orden.H1).toBeLessThan(2.2);
  });

  it('orden con referencia de malla fina (sin solución analítica)', () => {
    const c = convergenceStudy(problema({ k: '1 + x', c: '2', f: 'exp(x)', orden: 2 }));
    expect(c.referencia).toBe('malla-fina');
    expect(c.orden.L2).toBeGreaterThan(2.7);
    expect(c.orden.H1).toBeGreaterThan(1.8);
  });

  it('eliminación y penalización dan lo mismo', () => {
    const a = solve1D(ejemploClase(4, { orden: 2 }));
    const b = solve1D(ejemploClase(4, { orden: 2, bcMethod: 'penalizacion' }));
    expect(maxRelErr(a.mesh.nodes, b.u, (x) => a.u[a.mesh.nodes.indexOf(x)])).toBeLessThan(1e-6);
  });

  it('barra con carga uniforme y carga puntual: reacción y desplazamientos exactos', () => {
    // -(EA u')' = q, u(0) = 0, EA u'(L) = P;  u = [ (qL + P) x − q x²/2 ] / EA
    const EA = 2e7;
    const q = 1000;
    const P = 500;
    const s = solve1D(
      problema({ k: String(EA), f: String(q), xL: 2, bcRight: { type: 'neumann', q: P }, mesh: { type: 'uniforme', ne: 3 }, orden: 2 }),
    );
    const ex = (x: number) => ((q * 2 + P) * x - (q * x * x) / 2) / EA;
    expect(maxRelErr(s.mesh.nodes, s.u, ex)).toBeLessThan(1e-12);
    expect(s.reactions[0].value).toBeCloseTo(-(q * 2 + P), 8);
    expect(Math.abs(s.balance.residual)).toBeLessThan(1e-9 * s.balance.scale);
  });

  it('dos tramos y una carga puntual interior', () => {
    // k = 1 en [0, 0.5], k = 4 en [0.5, 1], f = 0, u(0) = 0, u(1) = 1, P = 2 en x = 0.25
    const s = solve1D(
      problema({
        regions: [
          { x0: 0, x1: 0.5, k: '1', b: '0', c: '0', f: '0' },
          { x0: 0.5, x1: 1, k: '4', b: '0', c: '0', f: '0' },
        ],
        loads: [{ x: 0.25, P: 2 }],
        bcRight: { type: 'dirichlet', value: 1 },
        mesh: { type: 'uniforme', ne: 2 },
        orden: 2,
      }),
    );
    // Lineales por tramos: el MEF cuadrático también es exacto
    const lin = solve1D(
      problema({
        regions: [
          { x0: 0, x1: 0.5, k: '1', b: '0', c: '0', f: '0' },
          { x0: 0.5, x1: 1, k: '4', b: '0', c: '0', f: '0' },
        ],
        loads: [{ x: 0.25, P: 2 }],
        bcRight: { type: 'dirichlet', value: 1 },
        mesh: { type: 'uniforme', ne: 2 },
      }),
    );
    for (const [i, x] of lin.mesh.nodes.entries()) expect(s.u[s.mesh.nodes.indexOf(x)]).toBeCloseTo(lin.u[i], 12);
  });

  it('Robin con solución automática', () => {
    // -u'' + u = 1, u(0) = 0, u'(1) + 2u(1) = 1
    const s = solve1D(problema({ c: '1', f: '1', bcRight: { type: 'robin', h: 2, g: 1 }, mesh: { type: 'uniforme', ne: 8 }, orden: 2 }));
    const l = solve1D(problema({ c: '1', f: '1', bcRight: { type: 'robin', h: 2, g: 1 }, mesh: { type: 'uniforme', ne: 512 } }));
    expect(Math.abs(s.u[s.u.length - 1] - l.u[l.u.length - 1])).toBeLessThan(1e-6);
  });

  it('si se pide Thomas, avisa y usa Gauss', () => {
    const s = solve1D(ejemploClase(4, { orden: 2, solver: 'thomas' }));
    expect(s.solverUsed).toBe('gauss');
    expect(s.warnings.some((w) => w.includes('5 diagonales'))).toBe(true);
  });

  it('avisa si hay pocos puntos de Gauss', () => {
    const s = solve1D(ejemploClase(4, { orden: 2, gaussPoints: 2 }));
    expect(s.warnings.some((w) => w.includes('3 puntos de Gauss'))).toBe(true);
  });

  it('error nodal superconvergente en los nodos extremos', () => {
    const s = solve1D(problema({ f: 'exp(x)', mesh: { type: 'uniforme', ne: 4 }, orden: 2, exact: '-exp(x) + (exp(1) - 1)*x + 1' }));
    // k constante, b = c = 0: los nodos extremos de cada elemento son exactos
    for (const el of s.elements) for (const d of el.nodes) expect(Math.abs(s.error!.nodal[d])).toBeLessThan(1e-9);
  });
});

it('no cambia los resultados con elementos lineales', () => {
  const a = solve1D(ejemploClase(3));
  const b = solve1D(ejemploClase(3, { orden: 1 }));
  expect(b.u).toEqual(a.u);
  expect(EXACTA_CLASE).toContain('sinh');
});

describe('Plantillas con elementos cuadráticos', () => {
  it('derivada máxima del ejemplo de clase contra la exacta (u′(1) = −0.754)', async () => {
    const { aplicarEjemplo, estadoPorDefecto, plantilla1D, resolverPlantilla1D } = await import('../src/templates');
    const t = plantilla1D('general')!;
    const e = aplicarEjemplo(t, estadoPorDefecto(t), 'clase');
    const exacta = 0.3 + 0.006 - (1.06 * Math.cosh(10)) / Math.sinh(10);
    const d = (ne: number) => resolverPlantilla1D(t, { ...e, orden: 2, malla: { ...e.malla, ne } }).kpis.find((x) => /Derivada/.test(x.def.nombre))!.valor;
    expect(d(40).x).toBeCloseTo(1, 6);
    expect(Math.abs(d(40).valor - exacta) / Math.abs(exacta)).toBeLessThan(1e-2);
    expect(Math.abs(d(160).valor - exacta) / Math.abs(exacta)).toBeLessThan(1e-3);
  });

  it('todos los ejemplos dan los mismos indicadores que una malla lineal muy fina', async () => {
    const { aplicarEjemplo, estadoPorDefecto, PLANTILLAS_1D, resolverPlantilla1D } = await import('../src/templates');
    for (const t of PLANTILLAS_1D) {
      for (const ej of t.ejemplos) {
        const e = aplicarEjemplo(t, estadoPorDefecto(t), ej.id);
        const cua = resolverPlantilla1D(t, { ...e, orden: 2, malla: { ...e.malla, tipo: 'uniforme', ne: 40 } });
        const fina = resolverPlantilla1D(t, { ...e, orden: 1, malla: { ...e.malla, tipo: 'uniforme', ne: 2000 } });
        const nombre = `${t.id}/${ej.id}`;
        for (const k of cua.kpis) {
          const ref = fina.kpis.find((x) => x.def.id === k.def.id);
          if (!ref) continue;
          const esc = Math.max(Math.abs(ref.valor.valor), ...fina.kpis.filter((x) => x.unidad === ref.unidad).map((x) => Math.abs(x.valor.valor)), 1e-300);
          // Derivada máxima en una capa límite (u' muy empinada en el borde): las dos mallas la miden
          // en puntos distintos (borde contra centro del último elemento); se revisa aparte contra la exacta.
          const capaLimite = t.id === 'general' && ['clase', 'conveccion-difusion'].includes(ej.id) && /Derivada/.test(k.def.nombre);
          // En problemas simétricos el máximo en valor absoluto puede caer en cualquiera de los dos extremos
          const L = cua.problem.xL - cua.problem.x0;
          const otroLado = k.valor.x !== undefined && ref.valor.x !== undefined && Math.abs(k.valor.x - ref.valor.x) > 0.01 * L;
          const dif = otroLado ? Math.abs(Math.abs(k.valor.valor) - Math.abs(ref.valor.valor)) : Math.abs(k.valor.valor - ref.valor.valor);
          expect(dif / esc, `${nombre} · ${k.def.nombre}`).toBeLessThan(capaLimite ? 5e-2 : 1e-2);
        }
        cua.reacciones.forEach((rc, i) => {
          const ref = fina.reacciones[i].valor;
          const esc = Math.max(...fina.reacciones.map((x) => Math.abs(x.valor)), 1e-300);
          expect(Math.abs(rc.valor - ref) / esc, `${nombre} · reacción ${rc.lado} (${rc.valor} vs ${ref})`).toBeLessThan(2e-3);
        });
        for (const el of cua.elementos) for (const [id, [a, b]] of Object.entries(el.extremos)) expect(Number.isFinite(a) && Number.isFinite(b), `${nombre} ${id}`).toBe(true);
      }
    }
   }, 60_000);
});
