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
import type { ElementResult, GaussPointData, OrdenElemento } from './types';

/**
 * Funciones de forma cuadráticas en ξ ∈ [−1, 1], nodos locales en ξ = −1, 0, 1:
 *   N1 = ξ(ξ − 1)/2,  N2 = 1 − ξ²,  N3 = ξ(ξ + 1)/2
 */
export function formaCuadratica(xi: number): { N: number[]; dNdxi: number[] } {
  return {
    N: [(xi * (xi - 1)) / 2, 1 - xi * xi, (xi * (xi + 1)) / 2],
    dNdxi: [xi - 0.5, -2 * xi, xi + 0.5],
  };
}

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
  orden: OrdenElemento = 1,
  dofs: number[] = nodes,
): ElementResult {
  if (orden === 2) return elementoCuadratico(id, nodes, dofs, xa, xb, region, co, ng);
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
  return { id, nodes, dofs: [...nodes], orden: 1, xa, xb, h, region, Ke, KeK, KeB, KeC, Fe, gauss };
}

/** Coeficientes en un punto, con la revisión de k > 0. */
function coeficientesEn(co: RegionCoeffs, x: number) {
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
  return { k, b, c, f };
}

/** Elemento cuadrático de 3 nodos (inicio, centro, fin), integrado con Gauss. */
function elementoCuadratico(
  id: number,
  nodes: [number, number],
  dofs: number[],
  xa: number,
  xb: number,
  region: number,
  co: RegionCoeffs,
  ng: number,
): ElementResult {
  const h = xb - xa;
  const J = h / 2;
  const { xi, w } = gaussRule(ng);
  const z = () => [0, 0, 0].map(() => [0, 0, 0]);
  const KeK = z();
  const KeB = z();
  const KeC = z();
  const Fe = [0, 0, 0];
  const gauss: GaussPointData[] = [];
  for (let g = 0; g < xi.length; g++) {
    const x = (xa + xb) / 2 + J * xi[g];
    const { N, dNdxi } = formaCuadratica(xi[g]);
    const dN = dNdxi.map((d) => d / J);
    const { k, b, c, f } = coeficientesEn(co, x);
    gauss.push({ xi: xi[g], w: w[g], x, N, k, b, c, f });
    for (let i = 0; i < 3; i++) {
      Fe[i] += w[g] * f * N[i] * J;
      for (let j = 0; j < 3; j++) {
        KeK[i][j] += w[g] * k * dN[i] * dN[j] * J;
        KeB[i][j] += w[g] * b * N[i] * dN[j] * J;
        KeC[i][j] += w[g] * c * N[i] * N[j] * J;
      }
    }
  }
  const Ke = KeK.map((fila, i) => fila.map((v, j) => v + KeB[i][j] + KeC[i][j]));
  return { id, nodes, dofs, orden: 2, xa, xb, h, region, Ke, KeK, KeB, KeC, Fe, gauss };
}
