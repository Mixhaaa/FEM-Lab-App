/** Plantillas de sólidos 1D: barra con carga axial y cable o cuerda tensa. */
import { fmt } from '../core';
import { campo, expr, fDirichlet, fNeumann, fNula, fRobin, kpiMaxAbsElem, kpiMaxAbsU } from './comun';
import { unidad, type Plantilla1D } from './types';

const LONG = { SI: 'm', mm: 'mm' };
const FUERZA = 'N';
const ESFUERZO = { SI: 'Pa', mm: 'MPa' };
const AREA = { SI: 'm²', mm: 'mm²' };
const CARGA_LIN = { SI: 'N/m', mm: 'N/mm' };
const RIGIDEZ = { SI: 'N/m', mm: 'N/mm' };
const RIGIDEZ_DIST = { SI: 'N/m²', mm: 'N/mm²' };

export const barra: Plantilla1D = {
  tipo: '1d',
  id: 'barra',
  nombre: 'Barra con carga axial',
  categoria: 'solidos',
  descripcion: 'Desplazamientos, deformaciones, esfuerzos y reacciones en una barra con sección A(x), carga distribuida y cargas puntuales.',
  icono: 'straighten',
  ecuacion: String.raw`-\frac{d}{dx}\left[E\,A(x)\,\frac{du}{dx}\right] + k_s\,u = q(x)`,
  sistemas: ['SI', 'mm'],
  unidadLongitud: LONG,
  camposTramo: [
    campo('E', 'E', 'Módulo de elasticidad', ESFUERZO, { SI: '200e9', mm: '200000' }, { positivo: true }),
    expr('A', 'A(x)', 'Área de la sección', AREA, { SI: '0.0025', mm: '2500' }, { positivo: true, ayuda: 'Puede depender de x, por ejemplo 0.002*(1 - x/2).' }),
    expr('q', 'q(x)', 'Carga axial distribuida', CARGA_LIN, '0', { ayuda: 'Positiva en la dirección +x.' }),
    expr('ks', 'kₛ', 'Rigidez del medio elástico', RIGIDEZ_DIST, '0', {
      noNegativo: true,
      ayuda: 'Resortes distribuidos a lo largo de la barra (por ejemplo, un pilote en el suelo). Déjalo en 0 si no aplica.',
    }),
  ],
  camposGlobales: [],
  coeficientes: (v) => ({ k: `${v.E}*${v.A}`, b: '0', c: v.ks, f: v.q }),
  traduccion: { k: 'E\\,A(x)', b: '0', c: 'k_s', f: 'q(x)' },
  fronteras: [
    fDirichlet('fijo', 'Apoyo fijo', 'u', LONG, '0', 'Desplazamiento impuesto (0 = empotrado).'),
    fNeumann('fuerza', 'Fuerza en el extremo', campo('F', 'F', 'Fuerza aplicada', FUERZA, { SI: '25000', mm: '25000' }), undefined, 'Positiva hacia +x.'),
    fNula('libre', 'Extremo libre', 'Extremo libre (N = 0)'),
    fRobin(
      'resorte',
      'Resorte en el extremo',
      [
        campo('kr', 'kᵣ', 'Rigidez del resorte', RIGIDEZ, { SI: '1e7', mm: '1e4' }, { positivo: true }),
        campo('d0', 'δ₀', 'Desplazamiento del apoyo del resorte', LONG, '0'),
      ],
      (v) => ({ h: v.kr, g: v.kr * v.d0 }),
      (v, c) => `Resorte kᵣ = ${fmt(v.kr)} ${unidad(RIGIDEZ, c.sistema)}`,
      'Un resorte une el extremo con un apoyo; la fuerza es −kᵣ(u − δ₀).',
    ),
  ],
  incognita: { id: 'u', simbolo: 'u', nombre: 'Desplazamiento', unidad: LONG },
  derivada: { id: 'du', simbolo: 'ε', nombre: 'Deformación unitaria', unidad: '—' },
  derivadas: [
    { id: 'eps', simbolo: 'ε', nombre: 'Deformación unitaria', unidad: '—', latex: '\\varepsilon', calc: (c) => c.du },
    { id: 'sigma', simbolo: 'σ', nombre: 'Esfuerzo normal', unidad: ESFUERZO, latex: '\\sigma', calc: (c) => c.campo('E') * c.du },
    { id: 'N', simbolo: 'N', nombre: 'Fuerza axial', unidad: FUERZA, calc: (c) => c.kdu },
  ],
  reaccion: { id: 'R', simbolo: 'R', nombre: 'Reacción (positiva hacia +x)', unidad: FUERZA },
  cargaPuntual: { id: 'P', simbolo: 'P', nombre: 'Fuerza puntual (positiva hacia +x)', unidad: FUERZA },
  kpis: [
    kpiMaxAbsU('umax', 'u_max', 'Desplazamiento máximo', LONG),
    kpiMaxAbsElem('sigma', 'smax', 'σ_max', 'Esfuerzo máximo', ESFUERZO),
    kpiMaxAbsElem('N', 'Nmax', 'N_max', 'Fuerza axial máxima', FUERZA),
    {
      id: 'alarg',
      simbolo: 'δ',
      nombre: 'Alargamiento total u(L) − u(0)',
      unidad: LONG,
      calc: (c) => ({ valor: c.u[c.u.length - 1] - c.u[0] }),
    },
  ],
  ejemplos: [
    {
      id: 'empotrada',
      nombre: 'Barra empotrada con carga triangular y fuerza en la punta',
      descripcion: 'Acero, L = 1 m, A = 25 cm², q(x) = 5000·x N/m y P = 25 kN en el extremo libre.',
      estado: {
        sistema: 'SI',
        x0: '0',
        xL: '1',
        tramos: [{ fin: '1', valores: { E: '210e9', A: '0.0025', q: '5000*x', ks: '0' } }],
        izquierda: { opcion: 'fijo', valores: { valor: '0' } },
        derecha: { opcion: 'fuerza', valores: { F: '25000' } },
        malla: { tipo: 'uniforme', ne: 6, ratio: 4, hacia: 'derecha', nodos: '' },
        exacta: '(25000*x + 5000*(x/2 - x^3/6))/(210e9*0.0025)',
      },
    },
    {
      id: 'dos-materiales',
      nombre: 'Barra de dos materiales (acero + aluminio)',
      descripcion: 'Tramo de acero de 0.3 m y tramo de aluminio de 0.3 m con una fuerza de 30 kN en el extremo.',
      estado: {
        sistema: 'SI',
        x0: '0',
        xL: '0.6',
        tramos: [
          { nombre: 'Acero', fin: '0.3', valores: { E: '200e9', A: '4e-4', q: '0', ks: '0' } },
          { nombre: 'Aluminio', fin: '0.6', valores: { E: '70e9', A: '6e-4', q: '0', ks: '0' } },
        ],
        izquierda: { opcion: 'fijo', valores: { valor: '0' } },
        derecha: { opcion: 'fuerza', valores: { F: '30000' } },
        malla: { tipo: 'uniforme', ne: 4, ratio: 4, hacia: 'derecha', nodos: '' },
        exacta: `x <= 0.3 ? 30000*x/(200e9*4e-4) : 30000*0.3/(200e9*4e-4) + 30000*(x-0.3)/(70e9*6e-4)`,
      },
    },
    {
      id: 'conica',
      nombre: 'Barra cónica con fuerza en la punta',
      descripcion: 'A(x) = 0.001·(1 − x/2) m², E = 200 GPa, F = 10 kN.',
      estado: {
        sistema: 'SI',
        x0: '0',
        xL: '1',
        tramos: [{ fin: '1', valores: { E: '200e9', A: '0.001*(1 - x/2)', q: '0', ks: '0' } }],
        izquierda: { opcion: 'fijo', valores: { valor: '0' } },
        derecha: { opcion: 'fuerza', valores: { F: '10000' } },
        malla: { tipo: 'uniforme', ne: 8, ratio: 4, hacia: 'derecha', nodos: '' },
        exacta: '-2*10000/(200e9*0.001)*log(1 - x/2)',
      },
    },
    {
      id: 'biempotrada',
      nombre: 'Barra biempotrada con carga puntual (N, mm, MPa)',
      descripcion: 'L = 1000 mm, A = 100 mm², E = 200 000 MPa y P = 10 kN a 300 mm del apoyo izquierdo.',
      estado: {
        sistema: 'mm',
        x0: '0',
        xL: '1000',
        tramos: [{ fin: '1000', valores: { E: '200000', A: '100', q: '0', ks: '0' } }],
        izquierda: { opcion: 'fijo', valores: { valor: '0' } },
        derecha: { opcion: 'fijo', valores: { valor: '0' } },
        cargas: [{ x: '300', P: '10000' }],
        malla: { tipo: 'uniforme', ne: 10, ratio: 4, hacia: 'derecha', nodos: '' },
        exacta: `x <= 300 ? 10000*700*x/(200000*100*1000) : 10000*300*(1000 - x)/(200000*100*1000)`,
      },
    },
  ],
};

export const cable: Plantilla1D = {
  tipo: '1d',
  id: 'cable',
  nombre: 'Cable o cuerda tensa',
  categoria: 'solidos',
  descripcion: 'Deflexión transversal pequeña de un cable con tensión T bajo carga distribuida, opcionalmente sobre una base elástica.',
  icono: 'cable',
  ecuacion: String.raw`-\frac{d}{dx}\left[T\,\frac{dw}{dx}\right] + k_f\,w = p(x)`,
  sistemas: ['SI', 'mm'],
  unidadLongitud: LONG,
  camposTramo: [
    campo('T', 'T', 'Tensión del cable', FUERZA, '5000', { positivo: true }),
    expr('p', 'p(x)', 'Carga transversal distribuida', CARGA_LIN, { SI: '200', mm: '0.2' }, { ayuda: 'w es positiva en el sentido de la carga.' }),
    expr('kf', 'k_f', 'Rigidez de la base elástica', RIGIDEZ_DIST, '0', { noNegativo: true, ayuda: 'Déjalo en 0 para un cable libre.' }),
  ],
  camposGlobales: [],
  coeficientes: (v) => ({ k: v.T, b: '0', c: v.kf, f: v.p }),
  traduccion: { k: 'T', b: '0', c: 'k_f', f: 'p(x)' },
  fronteras: [
    fDirichlet('fijo', 'Apoyo fijo', 'w', LONG, '0', 'Deflexión impuesta en el apoyo.'),
    fNula('deslizadera', 'Deslizadera (sin fuerza transversal)', 'Extremo en deslizadera (T·w′ = 0)', 'El extremo puede moverse transversalmente sin oposición.'),
    fNeumann('fuerza', 'Fuerza transversal en el extremo', campo('F', 'F', 'Fuerza transversal', FUERZA, '500'), undefined, 'Positiva en el sentido de w.'),
    fRobin(
      'resorte',
      'Resorte transversal',
      [campo('kr', 'kᵣ', 'Rigidez del resorte', RIGIDEZ, { SI: '1000', mm: '1' }, { positivo: true })],
      (v) => ({ h: v.kr, g: 0 }),
      (v, c) => `Resorte kᵣ = ${fmt(v.kr)} ${unidad(RIGIDEZ, c.sistema)}`,
    ),
  ],
  incognita: { id: 'w', simbolo: 'w', nombre: 'Deflexión', unidad: LONG },
  derivada: { id: 'dw', simbolo: 'θ', nombre: 'Pendiente', unidad: 'rad' },
  derivadas: [
    { id: 'theta', simbolo: 'θ', nombre: 'Pendiente w′', unidad: 'rad', latex: '\\theta', calc: (c) => c.du },
    { id: 'V', simbolo: 'V', nombre: 'Componente transversal de la tensión T·w′', unidad: FUERZA, calc: (c) => c.kdu },
  ],
  reaccion: { id: 'R', simbolo: 'R', nombre: 'Reacción transversal (positiva en el sentido de w)', unidad: FUERZA },
  cargaPuntual: { id: 'P', simbolo: 'P', nombre: 'Fuerza transversal puntual', unidad: FUERZA },
  kpis: [
    kpiMaxAbsU('wmax', 'w_max', 'Flecha máxima', LONG),
    kpiMaxAbsElem('theta', 'thmax', 'θ_max', 'Pendiente máxima', 'rad'),
    kpiMaxAbsElem('V', 'Vmax', 'V_max', 'Fuerza transversal máxima', FUERZA),
  ],
  ejemplos: [
    {
      id: 'uniforme',
      nombre: 'Cable con carga uniforme',
      descripcion: 'L = 10 m, T = 5 kN y p = 200 N/m: la deflexión es una parábola.',
      estado: {
        sistema: 'SI',
        x0: '0',
        xL: '10',
        tramos: [{ fin: '10', valores: { T: '5000', p: '200', kf: '0' } }],
        izquierda: { opcion: 'fijo', valores: { valor: '0' } },
        derecha: { opcion: 'fijo', valores: { valor: '0' } },
        malla: { tipo: 'uniforme', ne: 8, ratio: 4, hacia: 'derecha', nodos: '' },
      },
    },
    {
      id: 'triangular',
      nombre: 'Cable con carga triangular',
      descripcion: 'p(x) = 300·x/L sobre un cable de 6 m con T = 4 kN.',
      estado: {
        sistema: 'SI',
        x0: '0',
        xL: '6',
        tramos: [{ fin: '6', valores: { T: '4000', p: '300*x/6', kf: '0' } }],
        izquierda: { opcion: 'fijo', valores: { valor: '0' } },
        derecha: { opcion: 'fijo', valores: { valor: '0' } },
        malla: { tipo: 'uniforme', ne: 6, ratio: 4, hacia: 'derecha', nodos: '' },
        exacta: `300/(6*4000*6)*x*(36 - x^2)`,
      },
    },
    {
      id: 'base-elastica',
      nombre: 'Cuerda sobre base elástica con carga puntual',
      descripcion: 'T = 1 kN, base k_f = 4 kN/m² y una fuerza de 500 N en el centro (sin solución analítica: la convergencia usa una malla fina).',
      estado: {
        sistema: 'SI',
        x0: '0',
        xL: '4',
        tramos: [{ fin: '4', valores: { T: '1000', p: '0', kf: '4000' } }],
        izquierda: { opcion: 'fijo', valores: { valor: '0' } },
        derecha: { opcion: 'fijo', valores: { valor: '0' } },
        cargas: [{ x: '2', P: '500' }],
        malla: { tipo: 'uniforme', ne: 20, ratio: 4, hacia: 'derecha', nodos: '' },
      },
    },
  ],
};

