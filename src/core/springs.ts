/**
 * Sistema de resortes 1D (rigidez directa).
 *   ke = k [1 −1; −1 1],   fuerza en el resorte = k (u_j − u_i)  (> 0 tracción)
 */
import { directStiffness } from './directStiffness';
import { FemError } from './errors';
import type { BCMethod, ReducedSystem } from './types';

export interface Spring {
  i: number; // 0-based
  j: number;
  k: number;
}
export interface SpringProblem {
  nNodes: number;
  springs: Spring[];
  /** Nodos con desplazamiento prescrito. */
  fixed: { node: number; value: number }[];
  loads: { node: number; P: number }[];
  bcMethod: BCMethod;
  penaltyExp: number;
}
export interface SpringSolution {
  problem: SpringProblem;
  K: number[][];
  F: number[];
  system: ReducedSystem;
  beta?: number;
  u: number[];
  springs: { id: number; i: number; j: number; k: number; ke: number[][]; elong: number; force: number }[];
  reactions: { node: number; value: number }[];
  /** Σ cargas + Σ reacciones (debe ser ≈ 0). */
  equilibrium: number;
  residualNorm: number;
}

export function solveSprings(p: SpringProblem): SpringSolution {
  const n = p.nNodes;
  if (!Number.isInteger(n) || n < 2) throw new FemError('El sistema de resortes necesita al menos 2 nodos.', 'nodos');
  if (p.springs.length < 1) throw new FemError('Agrega al menos un resorte.', 'resortes');
  const chk = (i: number, que: string) => {
    if (!Number.isInteger(i) || i < 0 || i >= n) throw new FemError(`${que} usa el nodo ${i + 1}, que no existe (hay ${n} nodos).`, 'nodos');
  };
  p.springs.forEach((s, e) => {
    chk(s.i, `El resorte ${e + 1}`);
    chk(s.j, `El resorte ${e + 1}`);
    if (s.i === s.j) throw new FemError(`El resorte ${e + 1} une el nodo ${s.i + 1} consigo mismo.`, 'resortes');
    if (!(Number.isFinite(s.k) && s.k > 0)) throw new FemError(`La rigidez del resorte ${e + 1} debe ser un número positivo.`, 'resortes');
  });
  if (p.fixed.length === 0) throw new FemError('Fija al menos un nodo: sin apoyos el sistema se desplaza como cuerpo rígido (K singular).', 'apoyos');
  const fixed = new Map<number, number>();
  for (const f of p.fixed) {
    chk(f.node, 'Un apoyo');
    fixed.set(f.node, f.value ?? 0);
  }
  const loads = new Array<number>(n).fill(0);
  for (const l of p.loads) {
    chk(l.node, 'Una carga');
    loads[l.node] += l.P;
  }
  const kes = p.springs.map((s) => [
    [s.k, -s.k],
    [-s.k, s.k],
  ]);
  const ds = directStiffness({
    nDof: n,
    elements: p.springs.map((s, e) => ({ dofs: [s.i, s.j], ke: kes[e] })),
    loads,
    fixed,
    bcMethod: p.bcMethod,
    penaltyExp: p.penaltyExp,
    singularMsg: 'El sistema de resortes es inestable: hay nodos o grupos de nodos sin conexión a un apoyo (K singular).',
  });
  const springs = p.springs.map((s, e) => {
    const elong = ds.u[s.j] - ds.u[s.i];
    return { id: e + 1, i: s.i, j: s.j, k: s.k, ke: kes[e], elong, force: s.k * elong };
  });
  const reactions = [...ds.reactions].map(([node, value]) => ({ node, value }));
  const equilibrium = loads.reduce((s, v) => s + v, 0) + reactions.reduce((s, r) => s + r.value, 0);
  return {
    problem: p,
    K: ds.K,
    F: ds.F,
    system: ds.system,
    beta: ds.beta,
    u: ds.u,
    springs,
    reactions,
    equilibrium,
    residualNorm: ds.residualNorm,
  };
}
