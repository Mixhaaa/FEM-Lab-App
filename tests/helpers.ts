import type { Problem1D, Region } from '../src/core';

/** Problema con un solo tramo y valores por defecto razonables. */
export function problema(
  over: Partial<Problem1D> & { k?: string; b?: string; c?: string; f?: string } = {},
): Problem1D {
  const x0 = over.x0 ?? 0;
  const xL = over.xL ?? 1;
  const region: Region = { x0, x1: xL, k: over.k ?? '1', b: over.b ?? '0', c: over.c ?? '0', f: over.f ?? '0' };
  return {
    x0,
    xL,
    regions: over.regions ?? [region],
    loads: over.loads ?? [],
    bcLeft: over.bcLeft ?? { type: 'dirichlet', value: 0 },
    bcRight: over.bcRight ?? { type: 'dirichlet', value: 0 },
    mesh: over.mesh ?? { type: 'uniforme', ne: 10 },
    gaussPoints: over.gaussPoints ?? 3,
    bcMethod: over.bcMethod ?? 'eliminacion',
    penaltyExp: over.penaltyExp ?? 8,
    solver: over.solver ?? 'auto',
    orden: over.orden,
    exact: over.exact,
  };
}

/** Máximo error relativo en los nodos frente a una función exacta. */
export function maxRelErr(nodes: number[], u: number[], exact: (x: number) => number): number {
  const scale = Math.max(...nodes.map((x) => Math.abs(exact(x))), 1e-300);
  return Math.max(...nodes.map((x, i) => Math.abs(u[i] - exact(x)))) / scale;
}

/** Ejemplo de clase: -u'' + 100u = 10x³, u(0) = u(1) = 0. */
export const EXACTA_CLASE = '0.1*x^3 + 0.006*x - 0.106*sinh(10*x)/sinh(10)';
export function ejemploClase(ne: number, extra: Partial<Problem1D> = {}): Problem1D {
  return problema({ k: '1', c: '100', f: '10*x^3', mesh: { type: 'uniforme', ne }, exact: EXACTA_CLASE, ...extra });
}
