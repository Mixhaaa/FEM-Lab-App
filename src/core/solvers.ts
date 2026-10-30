/**
 * Solucionadores de sistemas lineales:
 *  - Algoritmo de Thomas para matrices tridiagonales.
 *  - Eliminación gaussiana con pivoteo parcial (aprovecha la banda de la matriz).
 */
import { FemError } from './errors';

export function zeros(n: number, m = n): number[][] {
  return Array.from({ length: n }, () => new Array<number>(m).fill(0));
}

export function copyMatrix(A: number[][]): number[][] {
  return A.map((r) => r.slice());
}

export function matVec(A: number[][], x: number[]): number[] {
  return A.map((row) => row.reduce((s, a, j) => s + a * x[j], 0));
}

export function maxAbsDiag(A: number[][]): number {
  let m = 0;
  for (let i = 0; i < A.length; i++) m = Math.max(m, Math.abs(A[i][i]));
  return m;
}

export function isTridiagonal(A: number[][]): boolean {
  const n = A.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (Math.abs(i - j) > 1 && A[i][j] !== 0) return false;
  return true;
}

/** Diagonal dominante por filas (condición suficiente para que Thomas sea estable). */
export function isDiagonallyDominant(A: number[][]): boolean {
  const n = A.length;
  for (let i = 0; i < n; i++) {
    let off = 0;
    for (let j = Math.max(0, i - 1); j <= Math.min(n - 1, i + 1); j++) if (j !== i) off += Math.abs(A[i][j]);
    if (Math.abs(A[i][i]) < off * (1 - 1e-12)) return false;
  }
  return true;
}

/**
 * Algoritmo de Thomas. a = subdiagonal (a[0] no se usa), b = diagonal,
 * c = superdiagonal (c[n-1] no se usa), d = lado derecho.
 */
export function thomas(a: number[], b: number[], c: number[], d: number[], scaleRef?: number): number[] {
  const n = b.length;
  const cp = new Array<number>(n).fill(0);
  const dp = new Array<number>(n).fill(0);
  const scale = scaleRef ?? Math.max(...b.map(Math.abs), 1e-300);
  if (Math.abs(b[0]) <= 1e-14 * scale) throw singular();
  cp[0] = c[0] / b[0];
  dp[0] = d[0] / b[0];
  for (let i = 1; i < n; i++) {
    const m = b[i] - a[i] * cp[i - 1];
    if (Math.abs(m) <= 1e-14 * scale) throw singular();
    cp[i] = i < n - 1 ? c[i] / m : 0;
    dp[i] = (d[i] - a[i] * dp[i - 1]) / m;
  }
  const x = new Array<number>(n).fill(0);
  x[n - 1] = dp[n - 1];
  for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
  return x;
}

export function thomasMatrix(A: number[][], F: number[], scaleRef?: number): number[] {
  const n = A.length;
  if (n === 0) return [];
  const a = A.map((r, i) => (i > 0 ? r[i - 1] : 0));
  const b = A.map((r, i) => r[i]);
  const c = A.map((r, i) => (i < n - 1 ? r[i + 1] : 0));
  return thomas(a, b, c, F.slice(), scaleRef);
}

function bandwidths(A: number[][]): { p: number; q: number } {
  const n = A.length;
  let p = 0;
  let q = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (A[i][j] !== 0) {
        if (i - j > p) p = i - j;
        if (j - i > q) q = j - i;
      }
    }
  }
  return { p, q };
}

/**
 * Eliminación gaussiana con pivoteo parcial. No modifica A ni F.
 * @param scaleRef escala para detectar pivotes nulos (por defecto max|A_ij|).
 */
export function gaussSolve(Ain: number[][], Fin: number[], scaleRef?: number): number[] {
  const n = Ain.length;
  if (n === 0) return [];
  const A = copyMatrix(Ain);
  const F = Fin.slice();
  const { p, q } = bandwidths(A);
  const qq = Math.min(n - 1, p + q); // ancho superior tras pivotear
  let scale = scaleRef ?? 0;
  if (scaleRef === undefined) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) scale = Math.max(scale, Math.abs(A[i][j]));
  if (scale === 0) throw singular();

  for (let k = 0; k < n; k++) {
    const last = Math.min(n - 1, k + p);
    let piv = k;
    let mx = Math.abs(A[k][k]);
    for (let i = k + 1; i <= last; i++) {
      if (Math.abs(A[i][k]) > mx) {
        mx = Math.abs(A[i][k]);
        piv = i;
      }
    }
    if (mx <= 1e-13 * scale) throw singular();
    if (piv !== k) {
      [A[k], A[piv]] = [A[piv], A[k]];
      [F[k], F[piv]] = [F[piv], F[k]];
    }
    const colEnd = Math.min(n - 1, k + qq);
    for (let i = k + 1; i <= last; i++) {
      const m = A[i][k] / A[k][k];
      if (m === 0) continue;
      A[i][k] = 0;
      for (let j = k + 1; j <= colEnd; j++) A[i][j] -= m * A[k][j];
      F[i] -= m * F[k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = F[i];
    const colEnd = Math.min(n - 1, i + qq);
    for (let j = i + 1; j <= colEnd; j++) s -= A[i][j] * x[j];
    x[i] = s / A[i][i];
  }
  return x;
}

function singular(): FemError {
  return new FemError(
    'La matriz K es singular: el sistema no tiene solución única. Revisa que haya al menos una condición Dirichlet (o Robin con h > 0, o c(x) > 0) y que la estructura esté bien apoyada.',
    'fronteras',
  );
}
