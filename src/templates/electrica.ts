/** Plantilla de electrostática 1D (Poisson). */
import { fmt } from '../core';
import { campo, expr, fDirichlet, fNeumann, fNula, kpiEntrante, kpiMaxAbsElem, kpiMaxAbsU, n } from './comun';
import type { Plantilla1D } from './types';

export const EPS0 = 8.8541878128e-12;

/** Potencial exacto en un capacitor de dos dieléctricos en serie. */
function dosDielectricos(e1: number, d1: number, e2: number, d2: number, V0: number, V1: number) {
  const D = (V0 - V1) / (d1 / (e1 * EPS0) + d2 / (e2 * EPS0));
  const Vm = V0 - (D * d1) / (e1 * EPS0);
  return `x <= ${n(d1)} ? ${n(V0)} - ${n(D / (e1 * EPS0))}*x : ${n(Vm)} - ${n(D / (e2 * EPS0))}*(x - ${n(d1)})`;
}

export const electrostatica: Plantilla1D = {
  tipo: '1d',
  id: 'electrostatica',
  nombre: 'Electrostática 1D',
  categoria: 'electrica',
  descripcion: 'Potencial, campo eléctrico y carga inducida en capacitores planos, dieléctricos en capas y regiones con carga espacial.',
  icono: 'bolt',
  ecuacion: String.raw`-\frac{d}{dx}\left[\varepsilon_0\,\varepsilon_r\,\frac{d\varphi}{dx}\right] = \rho(x)`,
  sistemas: ['SI'],
  unidadLongitud: 'm',
  camposTramo: [
    expr('er', 'εᵣ', 'Permitividad relativa', '—', '1', { positivo: true }),
    expr('rho', 'ρ(x)', 'Densidad de carga', 'C/m³', '0'),
  ],
  camposGlobales: [],
  coeficientes: (v) => ({ k: `${v.er}*${EPS0}`, b: '0', c: '0', f: v.rho }),
  traduccion: { k: '\\varepsilon_0\\,\\varepsilon_r', b: '0', c: '0', f: '\\rho(x)' },
  fronteras: [
    fDirichlet('potencial', 'Potencial impuesto (electrodo)', 'φ', 'V', '0'),
    fNeumann(
      'carga',
      'Carga superficial',
      campo('sigma', 'σ', 'Densidad de carga superficial', 'C/m²', '1e-8'),
      undefined,
      'Carga en la frontera, suponiendo campo nulo del otro lado.',
    ),
    fNula('neutra', 'Frontera sin carga', 'D·n = 0 (sin carga superficial)'),
  ],
  incognita: { id: 'phi', simbolo: 'φ', nombre: 'Potencial eléctrico', unidad: 'V' },
  derivada: { id: 'dphi', simbolo: 'dφ/dx', nombre: 'Derivada del potencial', unidad: 'V/m' },
  derivadas: [
    { id: 'E', simbolo: 'E', nombre: 'Campo eléctrico (hacia +x)', unidad: 'V/m', calc: (c) => -c.du },
    { id: 'D', simbolo: 'D', nombre: 'Desplazamiento eléctrico', unidad: 'C/m²', calc: (c) => -c.kdu },
  ],
  reaccion: { id: 'R', simbolo: 'σ_ind', nombre: 'Carga inducida en el electrodo', unidad: 'C/m²' },
  cargaPuntual: { id: 'P', simbolo: 'σ_p', nombre: 'Lámina de carga', unidad: 'C/m²' },
  kpis: [
    kpiMaxAbsU('phimax', 'φ_max', 'Potencial máximo', 'V'),
    kpiMaxAbsElem('E', 'Emax', 'E_max', 'Campo eléctrico máximo', 'V/m'),
    kpiEntrante('izquierda', 'sizq', 'σ_izq', 'Carga en el electrodo izquierdo', 'C/m²'),
    kpiEntrante('derecha', 'sder', 'σ_der', 'Carga en el electrodo derecho', 'C/m²'),
    {
      id: 'C',
      simbolo: 'C/A',
      nombre: 'Capacitancia por unidad de área',
      unidad: 'F/m²',
      calc: (c) => {
        const { izquierda: l, derecha: r } = c.fronteras;
        if (l.type !== 'dirichlet' || r.type !== 'dirichlet' || l.value === r.value) return null;
        const sinCarga = Math.abs(c.integrar((x) => c.campoEn('rho', x))) === 0;
        if (!sinCarga) return null;
        return { valor: Math.abs(c.entrante.izquierda / (l.value - r.value)), detalle: `|σ| / ΔV con ΔV = ${fmt(l.value - r.value)} V` };
      },
    },
  ],
  ejemplos: [
    {
      id: 'capacitor',
      nombre: 'Capacitor de placas paralelas',
      descripcion: 'Dieléctrico de 1 mm con εᵣ = 4 entre electrodos a 10 V y 0 V.',
      estado: {
        x0: '0',
        xL: '1e-3',
        tramos: [{ fin: '1e-3', valores: { er: '4', rho: '0' } }],
        izquierda: { opcion: 'potencial', valores: { valor: '10' } },
        derecha: { opcion: 'potencial', valores: { valor: '0' } },
        malla: { tipo: 'uniforme', ne: 4, ratio: 4, hacia: 'derecha', nodos: '' },
      },
    },
    {
      id: 'dos-dielectricos',
      nombre: 'Capacitor con dos dieléctricos',
      descripcion: 'Capas de 0.4 mm (εᵣ = 2) y 0.6 mm (εᵣ = 8): el campo es mayor en el dieléctrico de menor permitividad.',
      estado: {
        x0: '0',
        xL: '1e-3',
        tramos: [
          { nombre: 'εᵣ = 2', fin: '0.4e-3', valores: { er: '2', rho: '0' } },
          { nombre: 'εᵣ = 8', fin: '1e-3', valores: { er: '8', rho: '0' } },
        ],
        izquierda: { opcion: 'potencial', valores: { valor: '100' } },
        derecha: { opcion: 'potencial', valores: { valor: '0' } },
        malla: { tipo: 'uniforme', ne: 5, ratio: 4, hacia: 'derecha', nodos: '' },
        exacta: dosDielectricos(2, 0.4e-3, 8, 0.6e-3, 100, 0),
      },
    },
    {
      id: 'carga-espacial',
      nombre: 'Región con carga espacial uniforme',
      descripcion: 'Silicio (εᵣ = 11.7) de 1 µm con ρ = −160 C/m³ y ambos extremos a 0 V.',
      estado: {
        x0: '0',
        xL: '1e-6',
        tramos: [{ fin: '1e-6', valores: { er: '11.7', rho: '-160' } }],
        izquierda: { opcion: 'potencial', valores: { valor: '0' } },
        derecha: { opcion: 'potencial', valores: { valor: '0' } },
        malla: { tipo: 'uniforme', ne: 8, ratio: 4, hacia: 'derecha', nodos: '' },
      },
    },
  ],
};
