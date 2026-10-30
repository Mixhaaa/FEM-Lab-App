/**
 * Matriz y vector elemental del elemento lineal de 2 nodos, integrados con Gauss.
 *
 *   N1 = (xb - x)/h,  N2 = (x - xa)/h,  N1' = -1/h,  N2' = 1/h
 *   x(ξ) = (xa+xb)/2 + (h/2) ξ,   dx = (h/2) dξ
 *   Ke_ij = Σ_g w_g [ k N_i' N_j' + b N_i N_j' + c N_i N_j ] (h/2)
 *   Fe_i  = Σ_g w_g [ f N_i ] (h/2)
 */
import { evalChecked, fmt, type CompiledExpr } from './expr';
import { FemError } from './errors';
import { gaussRule } from './quadrature';
import type { ElementResult, GaussPointData } from './types';

export interface RegionCoeffs {
  k: CompiledExpr;
  b: CompiledExpr;
  c: CompiledExpr;
  f: CompiledExpr;
  /** Sufijo para mensajes: "" o " en el tramo 2". */
  etiqueta: string;
}

export function computeElement(
  id: number,
  nodes: [number, number],
  xa: number,
  xb: number,
  region: number,
  co: RegionCoeffs,
  ng: number,
): ElementResult {
  const h = xb - xa;
  const { xi, w } = gaussRule(ng);
  const dN = [-1 / h, 1 / h];
  const KeK = [
    [0, 0],
    [0, 0],
  ];
  const KeB = [
    [0, 0],
    [0, 0],
  ];
  const KeC = [
    [0, 0],
    [0, 0],
  ];
  const Fe = [0, 0];
  const gauss: GaussPointData[] = [];
  const J = h / 2;

  for (let g = 0; g < xi.length; g++) {
    const x = (xa + xb) / 2 + J * xi[g];
    const N: [number, number] = [(xb - x) / h, (x - xa) / h];
    const k = evalChecked(co.k, x, `k(x)${co.etiqueta}`);
    const b = evalChecked(co.b, x, `b(x)${co.etiqueta}`);
    const c = evalChecked(co.c, x, `c(x)${co.etiqueta}`);
    const f = evalChecked(co.f, x, `f(x)${co.etiqueta}`);
    if (!(k > 0)) {
      throw new FemError(
        `k(x)${co.etiqueta} debe ser positiva en todo el dominio, pero k(${fmt(x)}) = ${fmt(k)}. Revisa la expresión "${co.k.source}".`,
        'k',
      );
    }
    gauss.push({ xi: xi[g], w: w[g], x, N, k, b, c, f });
    for (let i = 0; i < 2; i++) {
      Fe[i] += w[g] * f * N[i] * J;
      for (let j = 0; j < 2; j++) {
        KeK[i][j] += w[g] * k * dN[i] * dN[j] * J;
        KeB[i][j] += w[g] * b * N[i] * dN[j] * J;
        KeC[i][j] += w[g] * c * N[i] * N[j] * J;
      }
    }
  }
  const Ke = [0, 1].map((i) => [0, 1].map((j) => KeK[i][j] + KeB[i][j] + KeC[i][j]));
  return { id, nodes, xa, xb, h, region, Ke, KeK, KeB, KeC, Fe, gauss };
}
