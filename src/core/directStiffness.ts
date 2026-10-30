/**
 * Método de rigidez directa genérico (lo usan la armadura 2D y el sistema de resortes):
 * ensamblaje de matrices elementales, apoyos por eliminación o penalización,
 * solución por Gauss y reacciones R = K u − F.
 */
import { FemError } from './errors';
import { copyMatrix, gaussSolve, matVec, maxAbsDiag, zeros } from './solvers';
import type { BCMethod, ReducedSystem } from './types';

export interface DSElement {
  dofs: number[];
  ke: number[][];
}

export interface DSInput {
  nDof: number;
  elements: DSElement[];
  loads: number[];
  /** Grado de libertad → valor prescrito. */
  fixed: Map<number, number>;
  bcMethod: BCMethod;
  penaltyExp: number;
  /** Mensaje si la matriz resulta singular. */
  singularMsg: string;
}

export interface DSResult {
  K: number[][];
  F: number[];
  system: ReducedSystem;
  beta?: number;
  u: number[];
  /** R = (K u − F) en los grados de libertad restringidos. */
  reactions: Map<number, number>;
  residualNorm: number;
}

export function directStiffness(inp: DSInput): DSResult {
  const { nDof } = inp;
  const K = zeros(nDof);
  for (const el of inp.elements) {
    el.dofs.forEach((I, a) => el.dofs.forEach((J, b) => (K[I][J] += el.ke[a][b])));
  }
  const F = inp.loads.slice();

  // Grados de libertad libres sin rigidez (nodo suelto)
  for (let i = 0; i < nDof; i++) {
    if (!inp.fixed.has(i) && K[i].every((v) => v === 0)) throw new FemError(inp.singularMsg, 'apoyos');
  }

  let system: ReducedSystem;
  let beta: number | undefined;
  if (inp.bcMethod === 'penalizacion') {
    beta = Math.pow(10, inp.penaltyExp) * maxAbsDiag(K);
    const Kp = copyMatrix(K);
    const Fp = F.slice();
    for (const [i, v] of inp.fixed) {
      Kp[i][i] += beta;
      Fp[i] += beta * v;
    }
    system = { free: K.map((_, i) => i), K: Kp, F: Fp };
  } else {
    const free = K.map((_, i) => i).filter((i) => !inp.fixed.has(i));
    system = {
      free,
      K: free.map((i) => free.map((j) => K[i][j])),
      F: free.map((i) => {
        let s = F[i];
        for (const [d, v] of inp.fixed) s -= K[i][d] * v;
        return s;
      }),
    };
  }

  let us: number[];
  try {
    us = gaussSolve(system.K, system.F, maxAbsDiag(K));
  } catch (e) {
    if (e instanceof FemError) throw new FemError(inp.singularMsg, 'apoyos');
    throw e;
  }
  const u = new Array<number>(nDof).fill(0);
  system.free.forEach((i, a) => (u[i] = us[a]));
  if (inp.bcMethod === 'eliminacion') for (const [i, v] of inp.fixed) u[i] = v;
  if (u.some((v) => !Number.isFinite(v))) throw new FemError(inp.singularMsg, 'apoyos');

  const res = matVec(system.K, us).map((v, i) => v - system.F[i]);
  const residualNorm = Math.sqrt(res.reduce((s, v) => s + v * v, 0));
  const scaleF = Math.max(1e-300, ...system.F.map(Math.abs), ...us.map((v, i) => Math.abs(system.K[i][i] * v)));
  if (residualNorm > 1e-6 * scaleF * Math.sqrt(us.length)) throw new FemError(inp.singularMsg, 'apoyos');

  const Ku = matVec(K, u);
  const reactions = new Map<number, number>();
  for (const i of inp.fixed.keys()) reactions.set(i, Ku[i] - F[i]);
  return { K, F, system, beta, u, reactions, residualNorm };
}
