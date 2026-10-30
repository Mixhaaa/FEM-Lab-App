/** Plantilla de sistema de resortes 1D. */
import { parseNumber, solveSprings, type BCMethod, type SpringProblem, type SpringSolution } from '../core';
import type { Categoria, SistemaUnidades } from './types';

export interface EstadoResortes {
  plantilla: 'resortes';
  sistema: SistemaUnidades;
  nNodos: number;
  /** Índices 0-based. */
  resortes: { i: number; j: number; k: string }[];
  apoyos: { nodo: number; valor: string }[];
  cargas: { nodo: number; P: string }[];
  metodo: BCMethod;
  penalizacion: number;
}

export const UNIDADES_RESORTES: Record<SistemaUnidades, { long: string; fuerza: string; rigidez: string }> = {
  SI: { long: 'm', fuerza: 'N', rigidez: 'N/m' },
  mm: { long: 'mm', fuerza: 'N', rigidez: 'N/mm' },
};

export const EJEMPLOS_RESORTES: { id: string; nombre: string; descripcion: string; estado: EstadoResortes }[] = [
  {
    id: 'serie',
    nombre: 'Tres resortes en serie',
    descripcion: 'Rigideces de 1000, 2000 y 3000 N/m con 600 N en el extremo libre.',
    estado: {
      plantilla: 'resortes',
      sistema: 'SI',
      nNodos: 4,
      resortes: [
        { i: 0, j: 1, k: '1000' },
        { i: 1, j: 2, k: '2000' },
        { i: 2, j: 3, k: '3000' },
      ],
      apoyos: [{ nodo: 0, valor: '0' }],
      cargas: [{ nodo: 3, P: '600' }],
      metodo: 'eliminacion',
      penalizacion: 8,
    },
  },
  {
    id: 'entre-muros',
    nombre: 'Resortes entre dos muros',
    descripcion: 'Cuatro nodos, extremos fijos y una fuerza de 5 kN en el nodo 3.',
    estado: {
      plantilla: 'resortes',
      sistema: 'SI',
      nNodos: 4,
      resortes: [
        { i: 0, j: 1, k: '1000' },
        { i: 1, j: 2, k: '2000' },
        { i: 2, j: 3, k: '3000' },
      ],
      apoyos: [
        { nodo: 0, valor: '0' },
        { nodo: 3, valor: '0' },
      ],
      cargas: [{ nodo: 2, P: '5000' }],
      metodo: 'eliminacion',
      penalizacion: 8,
    },
  },
  {
    id: 'paralelo',
    nombre: 'Resortes en paralelo y en serie',
    descripcion: 'Dos resortes en paralelo entre los nodos 1 y 2, seguidos de uno en serie.',
    estado: {
      plantilla: 'resortes',
      sistema: 'SI',
      nNodos: 3,
      resortes: [
        { i: 0, j: 1, k: '500' },
        { i: 0, j: 1, k: '1500' },
        { i: 1, j: 2, k: '1000' },
      ],
      apoyos: [{ nodo: 0, valor: '0' }],
      cargas: [{ nodo: 2, P: '100' }],
      metodo: 'eliminacion',
      penalizacion: 8,
    },
  },
];

export const plantillaResortes = {
  tipo: 'resortes' as const,
  id: 'resortes',
  nombre: 'Sistema de resortes',
  categoria: 'solidos' as Categoria,
  descripcion: 'Resortes lineales en serie y en paralelo: desplazamientos nodales, fuerzas en cada resorte y reacciones.',
  icono: 'linear_scale',
  ecuacion: String.raw`\mathbf{k}_e = k\begin{bmatrix} 1 & -1\\ -1 & 1\end{bmatrix},\qquad f_e = k\,(u_j - u_i)`,
  sistemas: ['SI', 'mm'] as SistemaUnidades[],
  ejemplos: EJEMPLOS_RESORTES,
};

export function estadoResortesPorDefecto(): EstadoResortes {
  return structuredClone(EJEMPLOS_RESORTES[0].estado);
}

export function construirResortes(e: EstadoResortes): SpringProblem {
  return {
    nNodes: e.nNodos,
    springs: e.resortes.map((r, k) => ({ i: r.i, j: r.j, k: parseNumber(r.k, `La rigidez del resorte ${k + 1}`) })),
    fixed: e.apoyos.map((a, k) => ({ node: a.nodo, value: parseNumber(a.valor, `El desplazamiento del apoyo ${k + 1}`) })),
    loads: e.cargas.map((c, k) => ({ node: c.nodo, P: parseNumber(c.P, `La carga ${k + 1}`) })),
    bcMethod: e.metodo,
    penaltyExp: e.penalizacion,
  };
}

export interface ResultadoResortes {
  estado: EstadoResortes;
  sol: SpringSolution;
  unidades: (typeof UNIDADES_RESORTES)[SistemaUnidades];
  kpis: { id: string; nombre: string; simbolo: string; valor: number; unidad: string; detalle?: string }[];
}

export function resolverResortes(e: EstadoResortes): ResultadoResortes {
  const sol = solveSprings(construirResortes(e));
  const un = UNIDADES_RESORTES[e.sistema];
  let kU = 0;
  sol.u.forEach((v, i) => {
    if (Math.abs(v) > Math.abs(sol.u[kU])) kU = i;
  });
  const fmax = sol.springs.reduce((a, b) => (Math.abs(b.force) > Math.abs(a.force) ? b : a), sol.springs[0]);
  return {
    estado: e,
    sol,
    unidades: un,
    kpis: [
      { id: 'umax', nombre: 'Desplazamiento máximo', simbolo: 'u_max', valor: sol.u[kU], unidad: un.long, detalle: `en el nodo ${kU + 1}` },
      { id: 'fmax', nombre: 'Fuerza máxima en un resorte', simbolo: 'f_max', valor: fmax.force, unidad: un.fuerza, detalle: `resorte ${fmax.id}` },
    ],
  };
}
