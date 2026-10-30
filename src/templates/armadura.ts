/** Plantilla de armadura plana 2D con elementos barra. */
import { FemError, parseNumber, solveTruss, type BCMethod, type TrussProblem, type TrussSolution } from '../core';
import type { Categoria, SistemaUnidades } from './types';

export type TipoApoyo = 'articulado' | 'rodillo-x' | 'rodillo-y';

export const APOYOS: Record<TipoApoyo, { nombre: string; ayuda: string; ux: boolean; uy: boolean }> = {
  articulado: { nombre: 'Articulado (fijo)', ayuda: 'Restringe u_x y u_y.', ux: true, uy: true },
  'rodillo-x': { nombre: 'Rodillo horizontal', ayuda: 'Se desliza en x; restringe u_y.', ux: false, uy: true },
  'rodillo-y': { nombre: 'Rodillo vertical', ayuda: 'Se desliza en y; restringe u_x.', ux: true, uy: false },
};

export interface EstadoArmadura {
  plantilla: 'armadura';
  sistema: SistemaUnidades;
  nodos: { x: string; y: string }[];
  /** Índices de nodos 0-based. */
  barras: { i: number; j: number; E: string; A: string }[];
  apoyos: { nodo: number; tipo: TipoApoyo }[];
  cargas: { nodo: number; Fx: string; Fy: string }[];
  metodo: BCMethod;
  penalizacion: number;
}

export const UNIDADES_ARMADURA: Record<SistemaUnidades, { long: string; fuerza: string; esfuerzo: string; area: string }> = {
  SI: { long: 'm', fuerza: 'N', esfuerzo: 'Pa', area: 'm²' },
  mm: { long: 'mm', fuerza: 'N', esfuerzo: 'MPa', area: 'mm²' },
};

export interface EjemploArmadura {
  id: string;
  nombre: string;
  descripcion: string;
  estado: EstadoArmadura;
}

const acero = (s: SistemaUnidades) => (s === 'SI' ? '200e9' : '200000');

function pratt(): EstadoArmadura {
  // 4 paneles de 2 m, altura 2 m
  const nodos = [
    { x: '0', y: '0' },
    { x: '2', y: '0' },
    { x: '4', y: '0' },
    { x: '6', y: '0' },
    { x: '8', y: '0' },
    { x: '2', y: '2' },
    { x: '4', y: '2' },
    { x: '6', y: '2' },
  ];
  const pares: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4], // cordón inferior
    [5, 6], [6, 7], // cordón superior
    [0, 5], [4, 7], // montantes extremos inclinados
    [1, 5], [2, 6], [3, 7], // verticales
    [5, 2], [7, 2], // diagonales
  ];
  return {
    plantilla: 'armadura',
    sistema: 'SI',
    nodos,
    barras: pares.map(([i, j]) => ({ i, j, E: '200e9', A: '0.002' })),
    apoyos: [
      { nodo: 0, tipo: 'articulado' },
      { nodo: 4, tipo: 'rodillo-x' },
    ],
    cargas: [1, 2, 3].map((nodo) => ({ nodo, Fx: '0', Fy: '-10000' })),
    metodo: 'eliminacion',
    penalizacion: 8,
  };
}

export const EJEMPLOS_ARMADURA: EjemploArmadura[] = [
  {
    id: 'dos-barras',
    nombre: 'Dos barras a 45° con carga vertical',
    descripcion: 'Nodo superior cargado con 10 kN hacia abajo; ambas barras quedan en compresión N = −P/√2.',
    estado: {
      plantilla: 'armadura',
      sistema: 'SI',
      nodos: [
        { x: '0', y: '0' },
        { x: '2', y: '0' },
        { x: '1', y: '1' },
      ],
      barras: [
        { i: 0, j: 2, E: acero('SI'), A: '1e-4' },
        { i: 1, j: 2, E: acero('SI'), A: '1e-4' },
      ],
      apoyos: [
        { nodo: 0, tipo: 'articulado' },
        { nodo: 1, tipo: 'articulado' },
      ],
      cargas: [{ nodo: 2, Fx: '0', Fy: '-10000' }],
      metodo: 'eliminacion',
      penalizacion: 8,
    },
  },
  {
    id: 'pratt',
    nombre: 'Armadura Pratt de 4 paneles',
    descripcion: 'Luz de 8 m, altura de 2 m y tres cargas de 10 kN en el cordón inferior.',
    estado: pratt(),
  },
  {
    id: 'triangulo-mm',
    nombre: 'Triángulo isostático (N, mm, MPa)',
    descripcion: 'Base de 4000 mm, altura de 3000 mm y una carga horizontal de 10 kN en el vértice superior.',
    estado: {
      plantilla: 'armadura',
      sistema: 'mm',
      nodos: [
        { x: '0', y: '0' },
        { x: '4000', y: '0' },
        { x: '4000', y: '3000' },
      ],
      barras: [
        { i: 0, j: 1, E: acero('mm'), A: '500' },
        { i: 1, j: 2, E: acero('mm'), A: '500' },
        { i: 0, j: 2, E: acero('mm'), A: '500' },
      ],
      apoyos: [
        { nodo: 0, tipo: 'articulado' },
        { nodo: 1, tipo: 'rodillo-x' },
      ],
      cargas: [{ nodo: 2, Fx: '10000', Fy: '0' }],
      metodo: 'eliminacion',
      penalizacion: 8,
    },
  },
];

export const plantillaArmadura = {
  tipo: 'armadura' as const,
  id: 'armadura',
  nombre: 'Armadura plana 2D',
  categoria: 'solidos' as Categoria,
  descripcion: 'Cerchas articuladas con elementos barra: desplazamientos, fuerzas axiales, esfuerzos, reacciones y deformada.',
  icono: 'architecture',
  ecuacion: String.raw`\mathbf{k}_e = \frac{EA}{L}\begin{bmatrix} c^2 & cs & -c^2 & -cs\\ cs & s^2 & -cs & -s^2\\ -c^2 & -cs & c^2 & cs\\ -cs & -s^2 & cs & s^2\end{bmatrix}`,
  sistemas: ['SI', 'mm'] as SistemaUnidades[],
  ejemplos: EJEMPLOS_ARMADURA,
};

export function estadoArmaduraPorDefecto(): EstadoArmadura {
  return structuredClone(EJEMPLOS_ARMADURA[0].estado);
}

export function construirArmadura(e: EstadoArmadura): TrussProblem {
  const nodos = e.nodos.map((nd, i) => ({
    x: parseNumber(nd.x, `La coordenada x del nodo ${i + 1}`),
    y: parseNumber(nd.y, `La coordenada y del nodo ${i + 1}`),
  }));
  const bars = e.barras.map((b, k) => {
    const E = parseNumber(b.E, `E de la barra ${k + 1}`);
    const A = parseNumber(b.A, `A de la barra ${k + 1}`);
    return { i: b.i, j: b.j, E, A };
  });
  const vistos = new Set<number>();
  for (const a of e.apoyos) {
    if (vistos.has(a.nodo)) throw new FemError(`El nodo ${a.nodo + 1} tiene dos apoyos; deja solo uno.`, 'apoyos');
    vistos.add(a.nodo);
  }
  return {
    nodes: nodos,
    bars,
    supports: e.apoyos.map((a) => ({ node: a.nodo, ux: APOYOS[a.tipo].ux, uy: APOYOS[a.tipo].uy })),
    loads: e.cargas.map((c, k) => ({
      node: c.nodo,
      Fx: parseNumber(c.Fx, `Fx de la carga ${k + 1}`),
      Fy: parseNumber(c.Fy, `Fy de la carga ${k + 1}`),
    })),
    bcMethod: e.metodo,
    penaltyExp: e.penalizacion,
  };
}

export interface ResultadoArmadura {
  estado: EstadoArmadura;
  sol: TrussSolution;
  unidades: (typeof UNIDADES_ARMADURA)[SistemaUnidades];
  kpis: { id: string; nombre: string; simbolo: string; valor: number; unidad: string; detalle?: string }[];
}

export function resolverArmadura(e: EstadoArmadura): ResultadoArmadura {
  const sol = solveTruss(construirArmadura(e));
  const un = UNIDADES_ARMADURA[e.sistema];
  const nn = e.nodos.length;
  let kU = 0;
  for (let i = 1; i < nn; i++) {
    if (Math.hypot(sol.u[2 * i], sol.u[2 * i + 1]) > Math.hypot(sol.u[2 * kU], sol.u[2 * kU + 1])) kU = i;
  }
  const tr = sol.bars.reduce((a, b) => (b.N > a.N ? b : a), sol.bars[0]);
  const co = sol.bars.reduce((a, b) => (b.N < a.N ? b : a), sol.bars[0]);
  const sg = sol.bars.reduce((a, b) => (Math.abs(b.sigma) > Math.abs(a.sigma) ? b : a), sol.bars[0]);
  const kpis: ResultadoArmadura['kpis'] = [
    {
      id: 'umax',
      nombre: 'Desplazamiento máximo',
      simbolo: '|u|_max',
      valor: Math.hypot(sol.u[2 * kU], sol.u[2 * kU + 1]),
      unidad: un.long,
      detalle: `en el nodo ${kU + 1}`,
    },
    {
      id: 'Nt',
      nombre: 'Máxima tracción',
      simbolo: 'N_t',
      valor: Math.max(tr.N, 0),
      unidad: un.fuerza,
      detalle: tr.estado === 'tracción' ? `barra ${tr.id}` : 'ninguna barra en tracción',
    },
    {
      id: 'Nc',
      nombre: 'Máxima compresión',
      simbolo: 'N_c',
      valor: Math.min(co.N, 0),
      unidad: un.fuerza,
      detalle: co.estado === 'compresión' ? `barra ${co.id}` : 'ninguna barra en compresión',
    },
    { id: 'smax', nombre: 'Esfuerzo máximo', simbolo: 'σ_max', valor: sg.sigma, unidad: un.esfuerzo, detalle: `barra ${sg.id}` },
  ];
  return { estado: e, sol, unidades: un, kpis };
}
