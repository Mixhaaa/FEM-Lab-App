/** Plantillas de fluidos: medio poroso (Darcy) y tubería en flujo laminar. */
import { fmt } from '../core';
import { campo, expr, fDirichlet, fNeumann, fNula, fRobin, kpiEntrante, kpiMaxAbsElem, kpiMaxU, n } from './comun';
import type { Plantilla1D } from './types';

/** Carga hidráulica exacta en dos estratos en serie con cargas impuestas. */
function dosEstratos(K1: number, L1: number, K2: number, L2: number, H0: number, H1: number) {
  const q = (H0 - H1) / (L1 / K1 + L2 / K2);
  const hm = H0 - (q * L1) / K1;
  return `x <= ${n(L1)} ? ${n(H0)} - ${n(q / K1)}*x : ${n(hm)} - ${n(q / K2)}*(x - ${n(L1)})`;
}

export const darcy: Plantilla1D = {
  tipo: '1d',
  id: 'darcy',
  nombre: 'Flujo en medio poroso (Darcy)',
  categoria: 'fluidos',
  descripcion: 'Carga hidráulica, velocidad de Darcy y caudal en columnas de suelo, estratos en serie o acuíferos con recarga.',
  icono: 'water_drop',
  ecuacion: String.raw`-\frac{d}{dx}\left[K\,A\,\frac{dh}{dx}\right] = r(x)`,
  sistemas: ['SI'],
  unidadLongitud: 'm',
  camposTramo: [
    expr('K', 'K', 'Conductividad hidráulica', 'm/s', '1e-5', { positivo: true }),
    expr('A', 'A', 'Área de flujo', 'm²', '1', { positivo: true, ayuda: 'En un acuífero: espesor × ancho unitario.' }),
    expr('r', 'r(x)', 'Recarga o fuente por unidad de longitud', 'm²/s', '0', { ayuda: 'Caudal que entra por cada metro (positivo = recarga).' }),
  ],
  camposGlobales: [],
  coeficientes: (v) => ({ k: `${v.K}*${v.A}`, b: '0', c: '0', f: v.r }),
  traduccion: { k: 'K\\,A', b: '0', c: '0', f: 'r(x)' },
  fronteras: [
    fDirichlet('carga', 'Carga hidráulica impuesta', 'h', 'm', '1'),
    fNula('impermeable', 'Frontera impermeable', 'Impermeable (Q = 0)'),
    fNeumann('caudal', 'Caudal que entra', campo('Q', 'Q', 'Caudal entrante', 'm³/s', '1e-6'), undefined, 'Positivo si el agua entra al dominio.'),
    fRobin(
      'semipermeable',
      'Capa semipermeable',
      [campo('C', 'C', 'Conductancia de la capa', 'm²/s', '1e-6', { positivo: true }), campo('He', 'H_ext', 'Carga exterior', 'm', '0')],
      (v) => ({ h: v.C, g: v.C * v.He }),
      (v) => `Capa semipermeable: C = ${fmt(v.C)} m²/s, H_ext = ${fmt(v.He)} m`,
      'Caudal entrante = C·(H_ext − h).',
    ),
  ],
  incognita: { id: 'h', simbolo: 'h', nombre: 'Carga hidráulica', unidad: 'm' },
  derivada: { id: 'i', simbolo: 'dh/dx', nombre: 'Gradiente hidráulico', unidad: '—' },
  derivadas: [
    { id: 'i', simbolo: 'dh/dx', nombre: 'Gradiente hidráulico', unidad: '—', calc: (c) => c.du },
    { id: 'v', simbolo: 'v', nombre: 'Velocidad de Darcy (hacia +x)', unidad: 'm/s', calc: (c) => -c.campo('K') * c.du },
    { id: 'Q', simbolo: 'Q', nombre: 'Caudal (hacia +x)', unidad: 'm³/s', calc: (c) => -c.kdu },
  ],
  reaccion: { id: 'R', simbolo: 'Q_ext', nombre: 'Caudal que entra por el extremo', unidad: 'm³/s' },
  cargaPuntual: { id: 'P', simbolo: 'Q_p', nombre: 'Pozo de inyección (negativo = bombeo)', unidad: 'm³/s' },
  kpis: [
    kpiMaxU('hmax', 'h_max', 'Carga hidráulica máxima', 'm'),
    kpiMaxAbsElem('v', 'vmax', 'v_max', 'Velocidad de Darcy máxima', 'm/s'),
    kpiEntrante('izquierda', 'Qizq', 'Q_izq', 'Caudal que entra por la izquierda', 'm³/s'),
    kpiEntrante('derecha', 'Qder', 'Q_der', 'Caudal que entra por la derecha', 'm³/s'),
  ],
  ejemplos: [
    {
      id: 'permeametro',
      nombre: 'Permeámetro de carga constante',
      descripcion: 'Columna de arena de 0.5 m con K = 1e-4 m/s, sección de 0.01 m² y cargas de 1.2 m y 0.2 m.',
      estado: {
        x0: '0',
        xL: '0.5',
        tramos: [{ fin: '0.5', valores: { K: '1e-4', A: '0.01', r: '0' } }],
        izquierda: { opcion: 'carga', valores: { valor: '1.2' } },
        derecha: { opcion: 'carga', valores: { valor: '0.2' } },
        malla: { tipo: 'uniforme', ne: 5, ratio: 4, hacia: 'derecha', nodos: '' },
      },
    },
    {
      id: 'estratos',
      nombre: 'Dos estratos en serie (arena + limo)',
      descripcion: 'El estrato menos permeable concentra casi toda la pérdida de carga.',
      estado: {
        x0: '0',
        xL: '2',
        tramos: [
          { nombre: 'Arena', fin: '1', valores: { K: '1e-4', A: '1', r: '0' } },
          { nombre: 'Limo', fin: '2', valores: { K: '1e-6', A: '1', r: '0' } },
        ],
        izquierda: { opcion: 'carga', valores: { valor: '5' } },
        derecha: { opcion: 'carga', valores: { valor: '1' } },
        malla: { tipo: 'uniforme', ne: 6, ratio: 4, hacia: 'derecha', nodos: '' },
        exacta: dosEstratos(1e-4, 1, 1e-6, 1, 5, 1),
      },
    },
    {
      id: 'acuifero',
      nombre: 'Acuífero entre dos ríos con recarga',
      descripcion: 'Acuífero confinado de 20 m de espesor y 1 km de largo con recarga uniforme por lluvia.',
      estado: {
        x0: '0',
        xL: '1000',
        tramos: [{ fin: '1000', valores: { K: '1e-4', A: '20', r: '3e-8' } }],
        izquierda: { opcion: 'carga', valores: { valor: '10' } },
        derecha: { opcion: 'carga', valores: { valor: '8' } },
        malla: { tipo: 'uniforme', ne: 10, ratio: 4, hacia: 'derecha', nodos: '' },
      },
    },
  ],
};

export const tuberia: Plantilla1D = {
  tipo: '1d',
  id: 'tuberia',
  nombre: 'Flujo laminar en tubería',
  categoria: 'fluidos',
  descripcion: 'Presión y caudal en tuberías con flujo laminar (Hagen-Poiseuille), cambios de diámetro, fugas distribuidas y tomas puntuales.',
  icono: 'plumbing',
  ecuacion: String.raw`-\frac{d}{dx}\left[\frac{\pi D^4}{128\,\mu}\,\frac{dp}{dx}\right] = q_l(x)`,
  sistemas: ['SI'],
  unidadLongitud: 'm',
  camposTramo: [
    expr('D', 'D', 'Diámetro interior', 'm', '0.01', { positivo: true }),
    campo('mu', 'μ', 'Viscosidad dinámica', 'Pa·s', '1e-3', { positivo: true }),
    expr('ql', 'q_l(x)', 'Caudal inyectado por unidad de longitud', 'm²/s', '0', { ayuda: 'Negativo para fugas o extracción distribuida.' }),
  ],
  camposGlobales: [campo('rho', 'ρ', 'Densidad del fluido', 'kg/m³', '1000', { positivo: true })],
  coeficientes: (v) => ({ k: `pi*${v.D}^4/(128*${v.mu})`, b: '0', c: '0', f: v.ql }),
  traduccion: { k: '\\pi D^4/(128\\,\\mu)', b: '0', c: '0', f: 'q_l(x)' },
  fronteras: [
    fDirichlet('presion', 'Presión impuesta', 'p', 'Pa', '2000'),
    fNeumann('caudal', 'Caudal que entra', campo('Q', 'Q', 'Caudal entrante', 'm³/s', '1e-5'), undefined, 'Positivo si el fluido entra a la tubería.'),
    fNula('cerrado', 'Extremo cerrado', 'Extremo cerrado (Q = 0)'),
    fRobin(
      'deposito',
      'Descarga a un depósito por una válvula',
      [campo('Rh', 'R_h', 'Resistencia hidráulica de la válvula', 'Pa·s/m³', '1e9', { positivo: true }), campo('pd', 'p_d', 'Presión del depósito', 'Pa', '0')],
      (v) => ({ h: 1 / v.Rh, g: v.pd / v.Rh }),
      (v) => `Válvula R_h = ${fmt(v.Rh)} Pa·s/m³ hacia p_d = ${fmt(v.pd)} Pa`,
      'Caudal entrante = (p_d − p)/R_h.',
    ),
  ],
  incognita: { id: 'p', simbolo: 'p', nombre: 'Presión', unidad: 'Pa' },
  derivada: { id: 'dp', simbolo: 'dp/dx', nombre: 'Gradiente de presión', unidad: 'Pa/m' },
  derivadas: [
    { id: 'grad', simbolo: 'dp/dx', nombre: 'Gradiente de presión', unidad: 'Pa/m', calc: (c) => c.du },
    { id: 'Q', simbolo: 'Q', nombre: 'Caudal (hacia +x)', unidad: 'm³/s', calc: (c) => -c.kdu },
    { id: 'V', simbolo: 'V', nombre: 'Velocidad media', unidad: 'm/s', calc: (c) => -c.kdu / ((Math.PI * c.campo('D') ** 2) / 4) },
  ],
  reaccion: { id: 'R', simbolo: 'Q_ext', nombre: 'Caudal que entra por el extremo', unidad: 'm³/s' },
  cargaPuntual: { id: 'P', simbolo: 'Q_p', nombre: 'Caudal puntual inyectado (negativo = toma)', unidad: 'm³/s' },
  kpis: [
    {
      id: 'dp',
      simbolo: 'Δp',
      nombre: 'Caída de presión p(x0) − p(xL)',
      unidad: 'Pa',
      calc: (c) => ({ valor: c.u[0] - c.u[c.u.length - 1] }),
    },
    kpiEntrante('izquierda', 'Qizq', 'Q_izq', 'Caudal que entra por la izquierda', 'm³/s'),
    kpiEntrante('derecha', 'Qder', 'Q_der', 'Caudal que entra por la derecha', 'm³/s'),
    kpiMaxAbsElem('V', 'Vmax', 'V_max', 'Velocidad media máxima', 'm/s'),
    {
      id: 'Re',
      simbolo: 'Re',
      nombre: 'Número de Reynolds máximo',
      unidad: '—',
      calc: (c) => {
        const Re = c.xm.map((x, i) => (c.global('rho') * Math.abs(c.porElemento.V[i]) * c.campoEn('D', x)) / c.campoEn('mu', x));
        let k = 0;
        Re.forEach((v, i) => (v > Re[k] ? (k = i) : 0));
        return {
          valor: Re[k],
          x: c.xm[k],
          detalle: Re[k] < 2300 ? 'Flujo laminar (Re < 2300): el modelo es válido.' : 'Re ≥ 2300: el flujo podría ser turbulento y el modelo de Hagen-Poiseuille no aplica.',
        };
      },
    },
  ],
  ejemplos: [
    {
      id: 'poiseuille',
      nombre: 'Tubería de Hagen-Poiseuille',
      descripcion: 'Agua (μ = 1 mPa·s) en un tubo de 10 mm y 10 m con una diferencia de presión de 500 Pa (Re ≈ 1560, laminar).',
      estado: {
        x0: '0',
        xL: '10',
        tramos: [{ fin: '10', valores: { D: '0.01', mu: '1e-3', ql: '0' } }],
        globales: { rho: '1000' },
        izquierda: { opcion: 'presion', valores: { valor: '500' } },
        derecha: { opcion: 'presion', valores: { valor: '0' } },
        malla: { tipo: 'uniforme', ne: 5, ratio: 4, hacia: 'derecha', nodos: '' },
      },
    },
    {
      id: 'reduccion',
      nombre: 'Reducción de diámetro con una toma intermedia',
      descripcion: 'Aceite (μ = 0.05 Pa·s) en un tramo de 12 mm y otro de 8 mm; a 2 m se extrae 1 mL/s.',
      estado: {
        x0: '0',
        xL: '8',
        tramos: [
          { nombre: 'D = 12 mm', fin: '4', valores: { D: '0.012', mu: '0.05', ql: '0' } },
          { nombre: 'D = 8 mm', fin: '8', valores: { D: '0.008', mu: '0.05', ql: '0' } },
        ],
        globales: { rho: '880' },
        izquierda: { opcion: 'presion', valores: { valor: '50000' } },
        derecha: { opcion: 'presion', valores: { valor: '0' } },
        cargas: [{ x: '2', P: '-1e-6' }],
        malla: { tipo: 'uniforme', ne: 8, ratio: 4, hacia: 'derecha', nodos: '' },
      },
    },
  ],
};
