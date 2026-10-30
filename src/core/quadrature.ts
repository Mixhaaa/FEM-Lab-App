/** Cuadratura de Gauss-Legendre en [-1, 1]. n puntos integran exactamente polinomios de grado 2n-1. */

export interface GaussRule {
  xi: number[];
  w: number[];
}

const RULES: Record<number, GaussRule> = {
  1: { xi: [0], w: [2] },
  2: { xi: [-1 / Math.sqrt(3), 1 / Math.sqrt(3)], w: [1, 1] },
  3: { xi: [-Math.sqrt(3 / 5), 0, Math.sqrt(3 / 5)], w: [5 / 9, 8 / 9, 5 / 9] },
  4: {
    xi: [
      -Math.sqrt(3 / 7 + (2 / 7) * Math.sqrt(6 / 5)),
      -Math.sqrt(3 / 7 - (2 / 7) * Math.sqrt(6 / 5)),
      Math.sqrt(3 / 7 - (2 / 7) * Math.sqrt(6 / 5)),
      Math.sqrt(3 / 7 + (2 / 7) * Math.sqrt(6 / 5)),
    ],
    w: [
      (18 - Math.sqrt(30)) / 36,
      (18 + Math.sqrt(30)) / 36,
      (18 + Math.sqrt(30)) / 36,
      (18 - Math.sqrt(30)) / 36,
    ],
  },
  5: {
    xi: [
      -(1 / 3) * Math.sqrt(5 + 2 * Math.sqrt(10 / 7)),
      -(1 / 3) * Math.sqrt(5 - 2 * Math.sqrt(10 / 7)),
      0,
      (1 / 3) * Math.sqrt(5 - 2 * Math.sqrt(10 / 7)),
      (1 / 3) * Math.sqrt(5 + 2 * Math.sqrt(10 / 7)),
    ],
    w: [
      (322 - 13 * Math.sqrt(70)) / 900,
      (322 + 13 * Math.sqrt(70)) / 900,
      128 / 225,
      (322 + 13 * Math.sqrt(70)) / 900,
      (322 - 13 * Math.sqrt(70)) / 900,
    ],
  },
};

export function gaussRule(n: number): GaussRule {
  const r = RULES[n];
  if (!r) throw new Error(`Regla de Gauss de ${n} puntos no disponible (usa 1 a 5).`);
  return r;
}

/** Integra f en [a, b] con n puntos de Gauss. */
export function integrate(f: (x: number) => number, a: number, b: number, n = 5): number {
  const { xi, w } = gaussRule(n);
  const xm = (a + b) / 2;
  const J = (b - a) / 2;
  let s = 0;
  for (let i = 0; i < xi.length; i++) s += w[i] * f(xm + J * xi[i]);
  return s * J;
}
