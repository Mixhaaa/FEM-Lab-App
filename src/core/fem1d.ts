/**
 * Solución del problema 1D:  -(k u')' + b u' + c u = f  en [x0, xL]
 * con elementos lineales, ensamblaje global, fronteras y posproceso.
 */
import { computeElement } from './element1d';
import { evalChecked, fmt } from './expr';
import { FemError } from './errors';
import { buildMesh } from './mesh';
import { integrate } from './quadrature';
import {
  copyMatrix,
  gaussSolve,
  isDiagonallyDominant,
  isTridiagonal,
  matVec,
  maxAbsDiag,
  thomasMatrix,
  zeros,
} from './solvers';
import type {
  Balance,
  BoundaryCondition,
  ElementPost,
  ElementResult,
  EnergyCheck,
  ErrorInfo,
  Problem1D,
  Reaction,
  ReducedSystem,
  Solution1D,
} from './types';
import { validateProblem } from './validate';

export function solve1D(problem: Problem1D): Solution1D {
  const { coeffs, exact, warnings } = validateProblem(problem);
  const { x0, xL } = problem;
  const L = xL - x0;
  const tol = 1e-9 * L;
  const loads = problem.loads ?? [];

  // 1. Malla
  const mesh = buildMesh(x0, xL, problem.mesh, problem.regions, loads);
  warnings.push(...mesh.warnings);
  const nodes = mesh.nodes;
  const n = nodes.length;

  // 2. Matrices elementales y ensamblaje
  const Kassembled = zeros(n);
  const Fassembled = new Array<number>(n).fill(0);
  const elements: ElementResult[] = mesh.elements.map(([i, j], e) => {
    const r = mesh.elementRegion[e];
    const el = computeElement(e + 1, [i, j], nodes[i], nodes[j], r, coeffs[r], problem.gaussPoints);
    const dofs = [i, j];
    for (let a = 0; a < 2; a++) {
      Fassembled[dofs[a]] += el.Fe[a];
      for (let b = 0; b < 2; b++) Kassembled[dofs[a]][dofs[b]] += el.Ke[a][b];
    }
    return el;
  });

  // Avisos sobre los coeficientes
  let anyC = false;
  let anyB = false;
  let negC = false;
  let maxPe = 0;
  for (const el of elements) {
    for (const g of el.gauss) {
      if (g.c !== 0) anyC = true;
      if (g.c < 0) negC = true;
      if (g.b !== 0) anyB = true;
      maxPe = Math.max(maxPe, (Math.abs(g.b) * el.h) / (2 * g.k));
    }
  }
  if (negC) warnings.push('c(x) es negativa en parte del dominio: el problema podría no tener solución única (posible resonancia).');
  if (maxPe > 1 + 1e-9) {
    warnings.push(
      `El número de Péclet de malla |b|h/(2k) llega a ${fmt(maxPe, 3)} (> 1): la solución puede oscilar. Refina la malla.`,
    );
  }

  // 3. Cargas puntuales
  const K = copyMatrix(Kassembled);
  const F = Fassembled.slice();
  const nodeAt = (x: number) => nodes.findIndex((v) => Math.abs(v - x) <= tol * 10);
  for (const l of loads) {
    const i = nodeAt(l.x);
    if (i < 0) throw new FemError(`No se encontró un nodo en x = ${fmt(l.x)} para la carga puntual.`, 'cargas');
    F[i] += l.P;
  }

  // 4. Fronteras naturales (Neumann y Robin)
  const ends: { bc: BoundaryCondition; node: number; lado: 'izquierda' | 'derecha' }[] = [
    { bc: problem.bcLeft, node: 0, lado: 'izquierda' },
    { bc: problem.bcRight, node: n - 1, lado: 'derecha' },
  ];
  for (const { bc, node } of ends) {
    if (bc.type === 'neumann') F[node] += bc.q;
    if (bc.type === 'robin') {
      K[node][node] += bc.h;
      F[node] += bc.g;
    }
  }

  // Unicidad: se necesita Dirichlet, Robin con h ≠ 0 o c ≠ 0
  const dirichlet = ends.filter((e) => e.bc.type === 'dirichlet');
  const robinH = ends.some((e) => e.bc.type === 'robin' && e.bc.h !== 0);
  if (dirichlet.length === 0 && !robinH && !anyC) {
    throw new FemError(
      'El problema no tiene ninguna condición Dirichlet (ni Robin con h ≠ 0, ni c(x) ≠ 0): la matriz K es singular y u solo quedaría definida salvo una constante. Agrega al menos una condición Dirichlet.',
      'fronteras',
    );
  }
  for (const l of loads) {
    const i = nodeAt(l.x);
    if (dirichlet.some((d) => d.node === i)) {
      warnings.push(`La carga puntual en x = ${fmt(l.x)} está sobre un apoyo con u prescrito: la absorbe la reacción.`);
    }
  }

  // 5. Fronteras Dirichlet: eliminación o penalización
  const uFixed = new Map<number, number>();
  for (const d of dirichlet) if (d.bc.type === 'dirichlet') uFixed.set(d.node, d.bc.value);

  let system: ReducedSystem;
  let beta: number | undefined;
  if (problem.bcMethod === 'penalizacion') {
    beta = Math.pow(10, problem.penaltyExp) * maxAbsDiag(K);
    const Kp = copyMatrix(K);
    const Fp = F.slice();
    for (const [i, v] of uFixed) {
      Kp[i][i] += beta;
      Fp[i] += beta * v;
    }
    system = { free: nodes.map((_, i) => i), K: Kp, F: Fp };
  } else {
    const free = nodes.map((_, i) => i).filter((i) => !uFixed.has(i));
    const Kr = free.map((i) => free.map((j) => K[i][j]));
    const Fr = free.map((i) => {
      let s = F[i];
      for (const [d, v] of uFixed) s -= K[i][d] * v;
      return s;
    });
    system = { free, K: Kr, F: Fr };
  }

  // 6. Solución
  let solverUsed: 'thomas' | 'gauss' = 'gauss';
  let us: number[] = [];
  if (system.K.length > 0) {
    const tri = isTridiagonal(system.K);
    const dom = isDiagonallyDominant(system.K);
    if (problem.solver === 'thomas') {
      if (!tri) throw new FemError('El algoritmo de Thomas requiere una matriz tridiagonal.', 'solver');
      if (!dom) warnings.push('La matriz no es diagonalmente dominante: Thomas (sin pivoteo) podría ser inestable. Prueba con Gauss.');
      solverUsed = 'thomas';
    } else if (problem.solver === 'gauss') {
      solverUsed = 'gauss';
    } else {
      solverUsed = tri && dom ? 'thomas' : 'gauss';
    }
    const scaleRef = maxAbsDiag(K);
    us = solverUsed === 'thomas' ? thomasMatrix(system.K, system.F, scaleRef) : gaussSolve(system.K, system.F, scaleRef);
  }
  const u = new Array<number>(n).fill(0);
  system.free.forEach((i, a) => (u[i] = us[a]));
  if (problem.bcMethod === 'eliminacion') for (const [i, v] of uFixed) u[i] = v;
  if (u.some((v) => !Number.isFinite(v))) {
    throw new FemError('La solución contiene valores no finitos. Revisa los datos (¿coeficientes muy grandes o una matriz casi singular?).');
  }

  const residualVec = matVec(system.K, us).map((v, i) => v - system.F[i]);
  const residualNorm = Math.sqrt(residualVec.reduce((s, v) => s + v * v, 0));

  // 7. Posproceso
  const post: ElementPost[] = elements.map((el) => {
    const [i, j] = el.nodes;
    const du = (u[j] - u[i]) / el.h;
    const xm = (el.xa + el.xb) / 2;
    const k = evalChecked(coeffs[el.region].k, xm, 'k(x)');
    return { id: el.id, xm, h: el.h, du, k, kdu: k * du };
  });
  const nodalFlux = nodes.map((_, i) => {
    const adj = post.filter((_, e) => mesh.elements[e][0] === i || mesh.elements[e][1] === i);
    return adj.reduce((s, p) => s + p.kdu, 0) / adj.length;
  });

  const Ku = matVec(K, u);
  const reactions: Reaction[] = dirichlet.map((d) => ({
    node: d.node,
    x: nodes[d.node],
    lado: d.lado,
    value: Ku[d.node] - F[d.node],
  }));

  const balance = computeBalance(problem, elements, Fassembled, u, reactions, anyB, anyC);
  const energy = computeEnergy(K, F, u, reactions, anyB, uFixed);

  let error: ErrorInfo | undefined;
  if (exact) {
    error = computeError(problem.exact!, (x) => evalChecked(exact, x, 'La solución analítica'), nodes, u);
  }

  return {
    problem,
    mesh,
    elements,
    K,
    F,
    Kassembled,
    Fassembled,
    system,
    bcMethod: problem.bcMethod,
    beta,
    solverUsed,
    u,
    post,
    nodalFlux,
    reactions,
    balance,
    energy,
    residualNorm,
    error,
    warnings,
  };
}

function computeBalance(
  p: Problem1D,
  elements: ElementResult[],
  Fassembled: number[],
  u: number[],
  reactions: Reaction[],
  anyB: boolean,
  anyC: boolean,
): Balance {
  const terms: { nombre: string; valor: number }[] = [];
  terms.push({ nombre: 'Carga distribuida ∫f dx', valor: Fassembled.reduce((s, v) => s + v, 0) });
  const loads = p.loads ?? [];
  if (loads.length) terms.push({ nombre: 'Cargas puntuales ΣP', valor: loads.reduce((s, l) => s + l.P, 0) });
  const n = u.length;
  for (const [bc, node, lado] of [
    [p.bcLeft, 0, 'izquierda'],
    [p.bcRight, n - 1, 'derecha'],
  ] as const) {
    if (bc.type === 'neumann') terms.push({ nombre: `Flujo Neumann ${lado} q`, valor: bc.q });
    if (bc.type === 'robin') terms.push({ nombre: `Flujo Robin ${lado} g − h·u`, valor: bc.g - bc.h * u[node] });
  }
  for (const r of reactions) terms.push({ nombre: `Reacción ${r.lado} R`, valor: r.value });
  if (anyC) {
    let s = 0;
    for (const el of elements) {
      const ue = [u[el.nodes[0]], u[el.nodes[1]]];
      for (let a = 0; a < 2; a++) s += el.KeC[a][0] * ue[0] + el.KeC[a][1] * ue[1];
    }
    terms.push({ nombre: 'Término de reacción −∫c·u dx', valor: -s });
  }
  if (anyB) {
    let s = 0;
    for (const el of elements) {
      const ue = [u[el.nodes[0]], u[el.nodes[1]]];
      for (let a = 0; a < 2; a++) s += el.KeB[a][0] * ue[0] + el.KeB[a][1] * ue[1];
    }
    terms.push({ nombre: 'Término convectivo −∫b·u′ dx', valor: -s });
  }
  const residual = terms.reduce((s, t) => s + t.valor, 0);
  const scale = Math.max(
    terms.reduce((s, t) => s + Math.abs(t.valor), 0),
    1e-300,
  );
  return { terms, residual, scale };
}

function computeEnergy(
  K: number[][],
  F: number[],
  u: number[],
  reactions: Reaction[],
  anyB: boolean,
  uFixed: Map<number, number>,
): EnergyCheck {
  const Ku = matVec(K, u);
  const U = 0.5 * u.reduce((s, v, i) => s + v * Ku[i], 0);
  let W = 0.5 * u.reduce((s, v, i) => s + v * F[i], 0);
  for (const r of reactions) W += 0.5 * r.value * (uFixed.get(r.node) ?? 0);
  if (anyB) return { aplica: false, motivo: 'Con b(x) ≠ 0 el operador no es simétrico y no hay energía potencial asociada.', U, W };
  return { aplica: true, U, W };
}

/**
 * Errores frente a una solución exacta. u′ exacta se obtiene con diferencias centradas
 * de 4.º orden con un paso proporcional a cada elemento, para no cruzar los quiebres
 * de soluciones definidas por tramos.
 */
export function computeError(_exactSrc: string, exact: (x: number) => number, nodes: number[], u: number[]): ErrorInfo {
  const dEx = (x: number, h: number) => {
    const d = 1e-3 * h;
    return (8 * (exact(x + d) - exact(x - d)) - (exact(x + 2 * d) - exact(x - 2 * d))) / (12 * d);
  };
  return computeErrorFns(exact, dEx, nodes, u);
}

/** Errores nodal, L² y seminorma H¹ dados u exacta y su derivada. */
export function computeErrorFns(
  exact: (x: number) => number,
  /** Derivada exacta en x (h = tamaño del elemento, por si se deriva numéricamente). */
  dEx: (x: number, h: number) => number,
  nodes: number[],
  u: number[],
): ErrorInfo {
  const exactAtNodes = nodes.map(exact);
  const nodal = u.map((v, i) => v - exactAtNodes[i]);
  const maxNodal = Math.max(...nodal.map(Math.abs));
  let L2 = 0;
  let H1 = 0;
  for (let e = 0; e < nodes.length - 1; e++) {
    const a = nodes[e];
    const b = nodes[e + 1];
    const h = b - a;
    const du = (u[e + 1] - u[e]) / h;
    L2 += integrate((x) => {
      const uh = u[e] + (du * (x - a));
      return (uh - exact(x)) ** 2;
    }, a, b, 5);
    H1 += integrate((x) => (du - dEx(x, h)) ** 2, a, b, 5);
  }
  return { nodal, maxNodal, L2: Math.sqrt(L2), H1semi: Math.sqrt(H1), exactAtNodes };
}
