/**
 * Tipos del núcleo de cálculo de FEM Lab.
 *
 * Problema modelo 1D en [x0, xL]:
 *     -(k(x) u')' + b(x) u' + c(x) u = f(x)
 *
 * Convención de fronteras (normal exterior n: n = -1 en x0, n = +1 en xL):
 *   Dirichlet: u = valor
 *   Neumann:   k ∂u/∂n = q          (q > 0 significa "entra al dominio")
 *   Robin:     k ∂u/∂n + h u = g
 */

export type BCType = 'dirichlet' | 'neumann' | 'robin';

export type BoundaryCondition =
  | { type: 'dirichlet'; value: number }
  | { type: 'neumann'; q: number }
  | { type: 'robin'; h: number; g: number };

/** Región (tramo) con sus propios coeficientes, escritos como expresiones en x. */
export interface Region {
  x0: number;
  x1: number;
  k: string;
  b: string;
  c: string;
  f: string;
  /** Nombre opcional ("Acero", "Tramo 1", ...). */
  nombre?: string;
}

export interface PointLoad {
  x: number;
  P: number;
}

export type MeshSpec =
  | { type: 'uniforme'; ne: number }
  | {
      type: 'geometrica';
      ne: number;
      /** Razón entre el elemento más grande y el más pequeño (>= 1). */
      ratio: number;
      /** Extremo hacia el cual se refina. */
      hacia: 'izquierda' | 'derecha' | 'ambos';
    }
  | { type: 'manual'; nodes: number[] };

export type BCMethod = 'eliminacion' | 'penalizacion';
export type SolverType = 'auto' | 'thomas' | 'gauss';

export interface Problem1D {
  x0: number;
  xL: number;
  regions: Region[];
  loads: PointLoad[];
  bcLeft: BoundaryCondition;
  bcRight: BoundaryCondition;
  mesh: MeshSpec;
  /** Puntos de Gauss por elemento (1..5). */
  gaussPoints: number;
  bcMethod: BCMethod;
  /** β = 10^penaltyExp · max|K_ii|. */
  penaltyExp: number;
  solver: SolverType;
  /** Solución analítica opcional, expresión en x. */
  exact?: string;
}

/** Datos de un punto de Gauss, guardados para el modo paso a paso. */
export interface GaussPointData {
  xi: number;
  w: number;
  x: number;
  N: [number, number];
  k: number;
  b: number;
  c: number;
  f: number;
}

export interface ElementResult {
  id: number; // 1-based
  nodes: [number, number]; // índices 0-based
  xa: number;
  xb: number;
  h: number;
  region: number; // índice 0-based
  Ke: number[][];
  /** Partes de Ke: difusión (k), convección (b) y reacción (c). */
  KeK: number[][];
  KeB: number[][];
  KeC: number[][];
  Fe: number[];
  gauss: GaussPointData[];
}

export interface MeshInfo {
  nodes: number[];
  /** Conectividad 0-based: [nodo inicial, nodo final]. */
  elements: [number, number][];
  /** Región de cada elemento (0-based). */
  elementRegion: number[];
  /** Nodos agregados automáticamente (cambios de tramo o cargas puntuales). */
  forcedNodes: number[];
  warnings: string[];
}

export interface ReducedSystem {
  /** Índices (0-based) de los grados de libertad libres. */
  free: number[];
  K: number[][];
  F: number[];
}

export interface Reaction {
  node: number;
  x: number;
  lado: 'izquierda' | 'derecha';
  /** R = k ∂u/∂n en el apoyo (lo que el apoyo "inyecta" al dominio). */
  value: number;
}

export interface BalanceTerm {
  nombre: string;
  valor: number;
}

export interface Balance {
  terms: BalanceTerm[];
  /** Suma de todos los términos: debe ser ≈ 0. */
  residual: number;
  /** Escala de referencia para juzgar el residuo. */
  scale: number;
}

export interface EnergyCheck {
  aplica: boolean;
  motivo?: string;
  U: number; // ½ uᵀ K u
  W: number; // ½ uᵀ F
}

export interface ElementPost {
  id: number;
  xm: number;
  h: number;
  du: number; // u' en el elemento (constante)
  k: number; // k(x_m)
  kdu: number; // k(x_m)·u'
}

export interface ErrorInfo {
  nodal: number[]; // u_h - u_exacta en cada nodo
  maxNodal: number;
  L2: number;
  H1semi: number;
  exactAtNodes: number[];
}

export interface Solution1D {
  problem: Problem1D;
  mesh: MeshInfo;
  elements: ElementResult[];
  /** K y F ensamblados, con cargas puntuales y fronteras naturales (antes de Dirichlet). */
  K: number[][];
  F: number[];
  /** Solo el ensamblaje de elementos (sin cargas puntuales ni fronteras). */
  Kassembled: number[][];
  Fassembled: number[];
  /** Sistema que realmente se resuelve (reducido o penalizado). */
  system: ReducedSystem;
  bcMethod: BCMethod;
  beta?: number;
  solverUsed: 'thomas' | 'gauss';
  u: number[];
  post: ElementPost[];
  /** k·u' promediado en cada nodo. */
  nodalFlux: number[];
  reactions: Reaction[];
  balance: Balance;
  energy: EnergyCheck;
  residualNorm: number;
  error?: ErrorInfo;
  warnings: string[];
}
