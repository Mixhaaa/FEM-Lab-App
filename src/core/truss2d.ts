/**
 * Armadura plana 2D con elementos barra lineales (2 grados de libertad por nodo).
 *
 *   c = cos θ, s = sin θ, L = longitud
 *   ke = (EA/L) [ c²  cs  −c² −cs ;  cs  s²  −cs −s² ;  −c² −cs  c²  cs ;  −cs −s²  cs  s² ]
 *   Fuerza axial  N = (EA/L) [−c −s c s] · u_e   (N > 0 tracción)
 */
import { directStiffness } from './directStiffness';
import { FemError } from './errors';
import { fmt } from './expr';
import type { BCMethod, ReducedSystem } from './types';

export interface TrussNode {
  x: number;
  y: number;
}
export interface TrussBar {
  i: number; // 0-based
  j: number;
  E: number;
  A: number;
}
export interface TrussSupport {
  node: number;
  ux: boolean;
  uy: boolean;
  /** Desplazamientos prescritos (asentamientos), por defecto 0. */
  dx?: number;
  dy?: number;
}
export interface TrussLoad {
  node: number;
  Fx: number;
  Fy: number;
}
export interface TrussProblem {
  nodes: TrussNode[];
  bars: TrussBar[];
  supports: TrussSupport[];
  loads: TrussLoad[];
  bcMethod: BCMethod;
  penaltyExp: number;
}

export interface TrussBarResult {
  id: number; // 1-based
  i: number;
  j: number;
  L: number;
  c: number;
  s: number;
  EA_L: number;
  ke: number[][];
  dofs: number[];
  elong: number;
  strain: number;
  N: number;
  sigma: number;
  estado: 'tracción' | 'compresión' | 'nula';
}

export interface TrussReaction {
  node: number;
  Rx: number | null;
  Ry: number | null;
}

export interface TrussSolution {
  problem: TrussProblem;
  K: number[][];
  F: number[];
  system: ReducedSystem;
  beta?: number;
  u: number[];
  bars: TrussBarResult[];
  reactions: TrussReaction[];
  equilibrium: { sumFx: number; sumFy: number; sumM: number; scale: number };
  /** Factor de escala sugerido para dibujar la deformada. */
  scaleSuggestion: number;
  residualNorm: number;
  warnings: string[];
}

export function trussBarStiffness(n1: TrussNode, n2: TrussNode, E: number, A: number) {
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const L = Math.hypot(dx, dy);
  const c = dx / L;
  const s = dy / L;
  const k = (E * A) / L;
  const m = [
    [c * c, c * s, -c * c, -c * s],
    [c * s, s * s, -c * s, -s * s],
    [-c * c, -c * s, c * c, c * s],
    [-c * s, -s * s, c * s, s * s],
  ];
  return { L, c, s, k, ke: m.map((r) => r.map((v) => v * k)) };
}

function num(v: unknown, nombre: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new FemError(`${nombre} debe ser un número finito.`, nombre);
  return v;
}

export function solveTruss(p: TrussProblem): TrussSolution {
  const warnings: string[] = [];
  const nn = p.nodes.length;
  if (nn < 2) throw new FemError('La armadura necesita al menos 2 nodos.', 'nodos');
  if (p.bars.length < 1) throw new FemError('La armadura necesita al menos 1 barra.', 'barras');
  p.nodes.forEach((nd, i) => {
    num(nd.x, `La coordenada x del nodo ${i + 1}`);
    num(nd.y, `La coordenada y del nodo ${i + 1}`);
  });
  const checkNode = (i: number, que: string) => {
    if (!Number.isInteger(i) || i < 0 || i >= nn) throw new FemError(`${que} usa el nodo ${i + 1}, que no existe (hay ${nn} nodos).`, 'nodos');
  };
  const seen = new Set<string>();
  p.bars.forEach((b, e) => {
    checkNode(b.i, `La barra ${e + 1}`);
    checkNode(b.j, `La barra ${e + 1}`);
    if (b.i === b.j) throw new FemError(`La barra ${e + 1} une el nodo ${b.i + 1} consigo mismo.`, 'barras');
    if (!(num(b.E, `E de la barra ${e + 1}`) > 0)) throw new FemError(`E de la barra ${e + 1} debe ser positivo.`, 'barras');
    if (!(num(b.A, `A de la barra ${e + 1}`) > 0)) throw new FemError(`A de la barra ${e + 1} debe ser positiva.`, 'barras');
    const L = Math.hypot(p.nodes[b.j].x - p.nodes[b.i].x, p.nodes[b.j].y - p.nodes[b.i].y);
    if (!(L > 0)) throw new FemError(`La barra ${e + 1} tiene longitud cero (sus nodos coinciden).`, 'barras');
    const key = [Math.min(b.i, b.j), Math.max(b.i, b.j)].join('-');
    if (seen.has(key)) warnings.push(`Las barras entre los nodos ${b.i + 1} y ${b.j + 1} están repetidas (actúan en paralelo).`);
    seen.add(key);
  });
  if (p.supports.length === 0) throw new FemError('La armadura no tiene apoyos: agrega al menos un apoyo fijo y uno de rodillo.', 'apoyos');

  const fixed = new Map<number, number>();
  for (const s of p.supports) {
    checkNode(s.node, 'Un apoyo');
    if (s.ux) fixed.set(2 * s.node, s.dx ?? 0);
    if (s.uy) fixed.set(2 * s.node + 1, s.dy ?? 0);
  }
  if (fixed.size < 3) {
    warnings.push('Una armadura plana necesita al menos 3 restricciones para ser estable.');
  }
  const loads = new Array<number>(2 * nn).fill(0);
  for (const l of p.loads) {
    checkNode(l.node, 'Una carga');
    loads[2 * l.node] += num(l.Fx, 'Fx');
    loads[2 * l.node + 1] += num(l.Fy, 'Fy');
  }

  const geo = p.bars.map((b) => trussBarStiffness(p.nodes[b.i], p.nodes[b.j], b.E, b.A));
  const ds = directStiffness({
    nDof: 2 * nn,
    elements: p.bars.map((b, e) => ({ dofs: [2 * b.i, 2 * b.i + 1, 2 * b.j, 2 * b.j + 1], ke: geo[e].ke })),
    loads,
    fixed,
    bcMethod: p.bcMethod,
    penaltyExp: p.penaltyExp,
    singularMsg:
      'La armadura es inestable (es un mecanismo) o le faltan apoyos: la matriz K es singular. Revisa que esté triangulada y que los apoyos impidan traslaciones y giros.',
  });
  const u = ds.u;

  const bars: TrussBarResult[] = p.bars.map((b, e) => {
    const { L, c, s, k, ke } = geo[e];
    const dofs = [2 * b.i, 2 * b.i + 1, 2 * b.j, 2 * b.j + 1];
    const elong = -c * u[dofs[0]] - s * u[dofs[1]] + c * u[dofs[2]] + s * u[dofs[3]];
    const N = k * elong;
    const scaleN = Math.max(1e-300, ...loads.map(Math.abs));
    const estado = Math.abs(N) < 1e-9 * scaleN ? 'nula' : N > 0 ? 'tracción' : 'compresión';
    return { id: e + 1, i: b.i, j: b.j, L, c, s, EA_L: k, ke, dofs, elong, strain: elong / L, N, sigma: N / b.A, estado };
  });

  const reactions: TrussReaction[] = [];
  for (let node = 0; node < nn; node++) {
    const rx = ds.reactions.get(2 * node);
    const ry = ds.reactions.get(2 * node + 1);
    if (rx !== undefined || ry !== undefined) reactions.push({ node, Rx: rx ?? null, Ry: ry ?? null });
  }

  let sumFx = 0;
  let sumFy = 0;
  let sumM = 0;
  let scale = 0;
  for (let node = 0; node < nn; node++) {
    const fx = loads[2 * node] + (ds.reactions.get(2 * node) ?? 0);
    const fy = loads[2 * node + 1] + (ds.reactions.get(2 * node + 1) ?? 0);
    sumFx += fx;
    sumFy += fy;
    sumM += p.nodes[node].x * fy - p.nodes[node].y * fx;
    scale += Math.abs(fx) + Math.abs(fy);
  }

  const span = Math.max(
    ...p.nodes.map((a) => Math.max(...p.nodes.map((b) => Math.hypot(a.x - b.x, a.y - b.y)))),
  );
  const umax = Math.max(...p.nodes.map((_, i) => Math.hypot(u[2 * i], u[2 * i + 1])));
  const scaleSuggestion = umax > 0 ? niceScale((0.1 * span) / umax) : 1;
  if (umax > 0.05 * span) warnings.push(`Los desplazamientos (${fmt(umax)}) son grandes frente al tamaño de la armadura: la teoría lineal puede no ser válida.`);

  return {
    problem: p,
    K: ds.K,
    F: ds.F,
    system: ds.system,
    beta: ds.beta,
    u,
    bars,
    reactions,
    equilibrium: { sumFx, sumFy, sumM, scale: Math.max(scale, 1e-300) },
    scaleSuggestion,
    residualNorm: ds.residualNorm,
    warnings,
  };
}

/** Redondea a 1, 2 o 5 × 10^n. */
function niceScale(v: number): number {
  const e = Math.floor(Math.log10(v));
  const m = v / Math.pow(10, e);
  const nice = m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10;
  return nice * Math.pow(10, e);
}
