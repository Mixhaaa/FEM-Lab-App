/** Validación del problema 1D con mensajes en español. */
import { compileExpr, fmt, type CompiledExpr } from './expr';
import { FemError } from './errors';
import type { RegionCoeffs } from './element1d';
import type { BoundaryCondition, Problem1D } from './types';

export interface Validated {
  coeffs: RegionCoeffs[];
  exact?: CompiledExpr;
  warnings: string[];
}

function checkNum(v: unknown, nombre: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new FemError(`${nombre} debe ser un número finito.`, nombre);
  return v;
}

function checkBC(bc: BoundaryCondition, lado: string) {
  if (!bc || !['dirichlet', 'neumann', 'robin'].includes(bc.type)) {
    throw new FemError(`Falta la condición de frontera ${lado}.`, `frontera ${lado}`);
  }
  if (bc.type === 'dirichlet') checkNum(bc.value, `El valor Dirichlet ${lado}`);
  if (bc.type === 'neumann') checkNum(bc.q, `El valor Neumann ${lado}`);
  if (bc.type === 'robin') {
    checkNum(bc.h, `El coeficiente h de Robin ${lado}`);
    checkNum(bc.g, `El valor g de Robin ${lado}`);
  }
}

export function validateProblem(p: Problem1D): Validated {
  const warnings: string[] = [];
  const x0 = checkNum(p.x0, 'x0');
  const xL = checkNum(p.xL, 'xL');
  if (!(xL > x0)) throw new FemError(`El dominio no es válido: xL (${fmt(xL)}) debe ser mayor que x0 (${fmt(x0)}).`, 'dominio');
  const L = xL - x0;
  const tol = 1e-9 * L;

  if (!p.regions || p.regions.length === 0) throw new FemError('Define al menos un tramo con sus coeficientes k, b, c y f.', 'tramos');
  const regs = p.regions;
  for (let i = 0; i < regs.length; i++) {
    const r = regs[i];
    checkNum(r.x0, `El inicio del tramo ${i + 1}`);
    checkNum(r.x1, `El final del tramo ${i + 1}`);
    if (!(r.x1 > r.x0)) throw new FemError(`El tramo ${i + 1} no es válido: su final debe ser mayor que su inicio.`, 'tramos');
    if (i > 0 && Math.abs(r.x0 - regs[i - 1].x1) > tol) {
      throw new FemError(
        `Los tramos deben ser contiguos: el tramo ${i} termina en ${fmt(regs[i - 1].x1)} y el tramo ${i + 1} empieza en ${fmt(r.x0)}.`,
        'tramos',
      );
    }
  }
  if (Math.abs(regs[0].x0 - x0) > tol || Math.abs(regs[regs.length - 1].x1 - xL) > tol) {
    throw new FemError(`Los tramos deben cubrir todo el dominio [${fmt(x0)}, ${fmt(xL)}].`, 'tramos');
  }

  const multi = regs.length > 1;
  const coeffs: RegionCoeffs[] = regs.map((r, i) => {
    const et = multi ? ` en el tramo ${i + 1}` : '';
    return {
      k: compileExpr(r.k, `k(x)${et}`),
      b: compileExpr(r.b, `b(x)${et}`),
      c: compileExpr(r.c, `c(x)${et}`),
      f: compileExpr(r.f, `f(x)${et}`),
      etiqueta: et,
    };
  });

  for (const [i, l] of (p.loads ?? []).entries()) {
    checkNum(l.x, `La posición de la carga puntual ${i + 1}`);
    checkNum(l.P, `El valor de la carga puntual ${i + 1}`);
    if (l.x < x0 - tol || l.x > xL + tol) {
      throw new FemError(`La carga puntual ${i + 1} está en x = ${fmt(l.x)}, fuera del dominio [${fmt(x0)}, ${fmt(xL)}].`, 'cargas');
    }
  }

  checkBC(p.bcLeft, 'izquierda (x0)');
  checkBC(p.bcRight, 'derecha (xL)');

  if (!Number.isInteger(p.gaussPoints) || p.gaussPoints < 1 || p.gaussPoints > 5) {
    throw new FemError('El número de puntos de Gauss debe ser un entero entre 1 y 5.', 'gauss');
  }
  if (p.bcMethod === 'penalizacion') {
    if (!Number.isFinite(p.penaltyExp) || p.penaltyExp < 2 || p.penaltyExp > 15) {
      throw new FemError('El exponente de penalización p (β = 10^p·max|Kii|) debe estar entre 2 y 15.', 'penalizacion');
    }
  }

  let exact: CompiledExpr | undefined;
  if (p.exact && p.exact.trim() !== '') exact = compileExpr(p.exact, 'La solución analítica u(x)');

  return { coeffs, exact, warnings };
}
