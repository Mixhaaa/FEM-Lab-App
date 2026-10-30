/** Plantillas de ingeniería: traducción física → k, b, c, f y resultados con nombre y unidad. */
import { describe, expect, it } from 'vitest';
import { convergenceStudy } from '../src/core';
import {
  aplicarEjemplo,
  EJEMPLOS_ARMADURA,
  EJEMPLOS_RESORTES,
  EPS0,
  estadoPorDefecto,
  PLANTILLAS,
  PLANTILLAS_1D,
  plantilla1D,
  resolverArmadura,
  resolverPlantilla1D,
  resolverResortes,
  unidad,
  type Estado1D,
  type Plantilla1D,
} from '../src/templates';

const P = (id: string) => plantilla1D(id)!;
const ej = (t: Plantilla1D, id: string): Estado1D => aplicarEjemplo(t, estadoPorDefecto(t), id);
const kpi = (r: ReturnType<typeof resolverPlantilla1D>, id: string) => r.kpis.find((k) => k.def.id === id)!.valor.valor;
const fino = (e: Estado1D, ne = 400): Estado1D => ({ ...e, malla: { ...e.malla, tipo: 'uniforme', ne } });

describe('Todas las plantillas 1D y sus ejemplos', () => {
  for (const t of PLANTILLAS_1D) {
    it(`${t.nombre}: estado por defecto válido`, () => {
      const r = resolverPlantilla1D(t, estadoPorDefecto(t));
      expect(r.sol.u.every(Number.isFinite)).toBe(true);
      expect(r.kpis.length).toBeGreaterThan(0);
      expect(Math.abs(r.sol.balance.residual)).toBeLessThan(1e-9 * r.sol.balance.scale);
    });
    for (const e of t.ejemplos) {
      it(`${t.nombre} › ${e.nombre}: MEF con malla fina ≈ solución analítica`, () => {
        const r = resolverPlantilla1D(t, fino(ej(t, e.id)));
        if (!r.exacta) {
          // Sin solución analítica: al menos la convergencia contra malla fina debe ser de orden 2
          const c = convergenceStudy(r.problem, [8, 16, 32, 64]);
          if (!c.solucionExacta) expect(c.orden.L2).toBeGreaterThan(1.8);
          return;
        }
        const escala = Math.max(...r.sol.error!.exactAtNodes.map(Math.abs), 1e-300);
        expect(r.sol.error!.maxNodal / escala).toBeLessThan(1e-3);
      });
    }
  }
});

describe('Barra con carga axial', () => {
  it('ejemplo de Stitch: reacción = −(∫q dx + P) y desplazamiento máximo en la punta', () => {
    const r = resolverPlantilla1D(P('barra'), ej(P('barra'), 'empotrada'));
    expect(r.exacta?.origen).toBe('usuario');
    expect(r.reacciones[0].valor).toBeCloseTo(-(2500 + 25000), 6);
    expect(r.reacciones[0].unidad).toBe('N');
    const umax = r.kpis.find((k) => k.def.id === 'umax')!;
    expect(umax.valor.x).toBe(1);
    expect(umax.unidad).toBe('m');
    // σ = N/A en cada elemento
    r.elementos.forEach((el) => expect(el.valores.sigma).toBeCloseTo(el.valores.N / 0.0025, 0));
  });

  it('en el sistema N-mm-MPa las unidades se rotulan en mm y MPa', () => {
    const t = P('barra');
    const r = resolverPlantilla1D(t, ej(t, 'biempotrada'));
    expect(unidad(t.incognita.unidad, r.estado.sistema)).toBe('mm');
    expect(r.kpis.find((k) => k.def.id === 'smax')!.unidad).toBe('MPa');
    // Reacciones −P·b/L y −P·a/L
    expect(r.reacciones[0].valor).toBeCloseTo(-7000, 6);
    expect(r.reacciones[1].valor).toBeCloseTo(-3000, 6);
  });

  it('dos materiales: el nodo de la interfaz se crea solo', () => {
    const r = resolverPlantilla1D(P('barra'), ej(P('barra'), 'dos-materiales'));
    expect(r.sol.mesh.nodes).toContain(0.3);
    expect(r.elementos.map((e) => e.tramo)).toEqual([0, 0, 1, 1]);
  });

  it('valores físicos inválidos dan mensajes claros', () => {
    const t = P('barra');
    const e = ej(t, 'empotrada');
    e.tramos[0].valores.E = '-5';
    expect(() => resolverPlantilla1D(t, e)).toThrowError(/Módulo de elasticidad \(E\) debe ser mayor que cero/);
    const e2 = ej(t, 'empotrada');
    e2.tramos[0].valores.A = '0.001*(1 - 2*x)';
    expect(() => resolverPlantilla1D(t, e2)).toThrowError(/Área de la sección \(A\(x\)\) en x = 0\.5 debe ser mayor que cero/);
    const e3 = ej(t, 'empotrada');
    e3.tramos[0].valores.E = '200e9*x';
    expect(() => resolverPlantilla1D(t, e3)).toThrowError(/número constante/);
  });
});

describe('Calor, aleta, Darcy, tubería y electrostática', () => {
  it('calor con generación: lo que entra por los extremos + lo generado = 0', () => {
    const r = resolverPlantilla1D(P('calor'), ej(P('calor'), 'generacion'));
    expect(r.exacta?.origen).toBe('automatica');
    expect(kpi(r, 'Qizq') + kpi(r, 'Qder') + 2e5 * 0.05).toBeCloseTo(0, 6);
  });

  it('aleta adiabática: η = tanh(mL)/(mL) y Q_base = Q_conv', () => {
    const r = resolverPlantilla1D(P('aleta'), fino(ej(P('aleta'), 'pin-adiabatica')));
    const D = 0.005;
    const m = Math.sqrt((25 * Math.PI * D) / ((200 * Math.PI * D * D) / 4));
    expect(kpi(r, 'eta')).toBeCloseTo(Math.tanh(m * 0.1) / (m * 0.1), 4);
    const Qf = Math.sqrt(25 * Math.PI * D * 200 * ((Math.PI * D * D) / 4)) * 75 * Math.tanh(m * 0.1);
    expect(Math.abs(kpi(r, 'Qb') - Qf) / Qf).toBeLessThan(1e-4);
    expect(Math.abs(kpi(r, 'Qconv') - kpi(r, 'Qb')) / Qf).toBeLessThan(1e-4);
  });

  it('aleta con punta convectiva: Q_base = Q_conv + Q_punta', () => {
    const r = resolverPlantilla1D(P('aleta'), fino(ej(P('aleta'), 'pin-conveccion')));
    // Calor que sale por la punta = −(g − h·T) del término Robin
    const Qpunta = -r.sol.balance.terms.find((t) => t.nombre.includes('Robin'))!.valor;
    expect(Qpunta).toBeGreaterThan(0);
    expect(kpi(r, 'Qb')).toBeCloseTo(kpi(r, 'Qconv') + Qpunta, 6);
  });

  it('permeámetro: Q = K·A·Δh/L', () => {
    const r = resolverPlantilla1D(P('darcy'), ej(P('darcy'), 'permeametro'));
    expect(kpi(r, 'Qizq')).toBeCloseTo((1e-4 * 0.01 * 1) / 0.5, 12);
    r.elementos.forEach((e) => expect(e.valores.v).toBeCloseTo((1e-4 * 1) / 0.5, 12));
  });

  it('Hagen-Poiseuille: Q = π·D⁴·Δp/(128·μ·L)', () => {
    const r = resolverPlantilla1D(P('tuberia'), ej(P('tuberia'), 'poiseuille'));
    const Q = (Math.PI * 0.01 ** 4 * 500) / (128 * 1e-3 * 10);
    expect(kpi(r, 'Qizq') / Q).toBeCloseTo(1, 10);
    expect(kpi(r, 'dp')).toBeCloseTo(500, 8);
    // Re = ρ·V·D/μ con V = Q/(πD²/4)
    expect(kpi(r, 'Re')).toBeCloseTo((1000 * (Q / ((Math.PI * 0.01 ** 2) / 4)) * 0.01) / 1e-3, 6);
    expect(kpi(r, 'Re')).toBeLessThan(2300);
  });

  it('tubería con toma intermedia: el caudal cambia justo en la toma', () => {
    const r = resolverPlantilla1D(P('tuberia'), ej(P('tuberia'), 'reduccion'));
    expect(kpi(r, 'Qizq') + kpi(r, 'Qder') - 1e-6).toBeCloseTo(0, 12);
    expect(kpi(r, 'Re')).toBeLessThan(2300);
  });

  it('capacitor: C/A = ε0·εr/d y la carga de los electrodos es opuesta', () => {
    const r = resolverPlantilla1D(P('electrostatica'), ej(P('electrostatica'), 'capacitor'));
    expect(kpi(r, 'C') / ((EPS0 * 4) / 1e-3)).toBeCloseTo(1, 10);
    expect(kpi(r, 'sizq') + kpi(r, 'sder')).toBeCloseTo(0, 18);
    expect(kpi(r, 'Emax')).toBeCloseTo(1e4, 6);
  });

  it('convección-difusión con Péclet 2 avisa; con Péclet 1 no', () => {
    const t = P('general');
    const e = ej(t, 'conveccion-difusion');
    expect(resolverPlantilla1D(t, e).avisos.join(' ')).toMatch(/Péclet/);
    e.tramos[0].valores.b = '20';
    expect(resolverPlantilla1D(t, e).avisos.join(' ')).not.toMatch(/Péclet/);
  });

  it('cable con carga puntual no tiene solución automática (usa malla fina)', () => {
    const r = resolverPlantilla1D(P('cable'), ej(P('cable'), 'base-elastica'));
    expect(r.exacta).toBeUndefined();
  });

  it('el ejemplo de clase de la plantilla general da u ≈ [0, 0.0030, 0.0391, 0]', () => {
    const r = resolverPlantilla1D(P('general'), ej(P('general'), 'clase'));
    expect(r.sol.u.map((v) => +v.toFixed(4))).toEqual([0, 0.003, 0.0391, 0]);
  });

  it('una plantilla sin cargas puntuales las rechaza', () => {
    const e = ej(P('aleta'), 'pin-adiabatica');
    e.cargas = [{ x: '0.05', P: '1' }];
    expect(() => resolverPlantilla1D(P('aleta'), e)).toThrowError(/no admite cargas puntuales/);
  });
});

describe('Armadura 2D y resortes desde sus plantillas', () => {
  it('todos los ejemplos de armadura se resuelven en equilibrio', () => {
    for (const ejm of EJEMPLOS_ARMADURA) {
      const r = resolverArmadura(ejm.estado);
      const eq = r.sol.equilibrium;
      expect(Math.abs(eq.sumFx) + Math.abs(eq.sumFy)).toBeLessThan(1e-8 * eq.scale);
    }
  });

  it('Pratt: reacciones verticales de 15 kN y fuerzas simétricas', () => {
    const r = resolverArmadura(EJEMPLOS_ARMADURA.find((e) => e.id === 'pratt')!.estado);
    const ry = r.sol.reactions.map((x) => x.Ry);
    expect(ry[0]).toBeCloseTo(15000, 4);
    expect(ry[1]).toBeCloseTo(15000, 4);
    const N = r.sol.bars.map((b) => b.N);
    expect(N[0]).toBeCloseTo(N[3], 4); // cordón inferior extremo
    expect(N[1]).toBeCloseTo(N[2], 4);
    expect(N[4]).toBeLessThan(0); // cordón superior en compresión
    expect(N[11]).toBeGreaterThan(0); // diagonales Pratt en tracción
  });

  it('triángulo en N-mm-MPa: N_AC = P·D/L = 12.5 kN', () => {
    const r = resolverArmadura(EJEMPLOS_ARMADURA.find((e) => e.id === 'triangulo-mm')!.estado);
    expect(r.sol.bars[2].N).toBeCloseTo(12500, 6);
    expect(r.sol.bars[2].sigma).toBeCloseTo(25, 8); // MPa
    expect(r.unidades.esfuerzo).toBe('MPa');
  });

  it('todos los ejemplos de resortes cumplen equilibrio', () => {
    for (const ejm of EJEMPLOS_RESORTES) {
      const r = resolverResortes(ejm.estado);
      expect(Math.abs(r.sol.equilibrium)).toBeLessThan(1e-8);
    }
  });

  it('paralelo + serie: rigidez equivalente 1/(1/2000 + 1/1000)', () => {
    const r = resolverResortes(EJEMPLOS_RESORTES.find((e) => e.id === 'paralelo')!.estado);
    expect(r.sol.u[2]).toBeCloseTo(100 / (1 / (1 / 2000 + 1 / 1000)), 12);
  });

  it('el catálogo tiene las 10 plantillas', () => {
    expect(PLANTILLAS.map((p) => p.id)).toEqual([
      'barra',
      'calor',
      'aleta',
      'cable',
      'darcy',
      'tuberia',
      'electrostatica',
      'armadura',
      'resortes',
      'general',
    ]);
  });
});
