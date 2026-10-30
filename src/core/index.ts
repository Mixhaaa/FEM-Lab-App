/** Núcleo de cálculo de FEM Lab (TypeScript puro, sin dependencias de la interfaz). */
export * from './types';
export { FemError } from './errors';
export { compileExpr, evalChecked, parseNumber, fmt, derivativeExpr } from './expr';
export { gaussRule, integrate } from './quadrature';
export { buildMesh, uniformNodes, geometricNodes, MAX_ELEMENTOS } from './mesh';
export { computeElement } from './element1d';
export { thomas, thomasMatrix, gaussSolve } from './solvers';
export { solve1D, computeError } from './fem1d';
export { convergenceStudy, fitSlope } from './convergence';
export type { ConvergenceResult, ConvergenceRow } from './convergence';
export { solveTruss, trussBarStiffness } from './truss2d';
export type { TrussProblem, TrussSolution, TrussNode, TrussBar, TrussSupport, TrussLoad, TrussBarResult } from './truss2d';
export { solveSprings } from './springs';
export type { SpringProblem, SpringSolution, Spring } from './springs';
export { directStiffness } from './directStiffness';
