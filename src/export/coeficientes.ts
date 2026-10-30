/**
 * Variables físicas con nombre (E, A, k, h, ...) y coeficientes k, b, c, f escritos en función de ellas,
 * para que el código exportado se lea como el de clase.
 */
import { compileExpr } from '../core';
import { unidad, valorPorDefecto, type CampoDef, type Resultado1D } from '../templates';
import { exprA, type Lenguaje } from './expresiones';

/** Nombres que ya usa el script (no se pueden usar para variables físicas). */
const RENOMBRAR: Record<string, string> = {
  k: 'kt',
  b: 'bv',
  c: 'cv',
  f: 'fv',
  h: 'hc',
  P: 'Per',
  e: 'ev',
  n: 'nv',
  w: 'wv',
  g: 'gv',
  N: 'Nv',
  u: 'uv',
  x: 'xv',
  R: 'Rv',
};

export interface Definicion {
  nombre: string;
  /** Valor (expresión ya traducida) o cuerpo de la función. */
  valor: string;
  funcion: boolean;
  comentario: string;
}

export interface CoeficientesExportados {
  definiciones: Definicion[][]; // por tramo (índice 0 = globales)
  tramos: { k: string; b: string; c: string; f: string }[];
}

const comentario = (c: CampoDef, sistema: Parameters<typeof unidad>[1]) => {
  const u = unidad(c.unidad, sistema);
  return `${c.nombre}${u && u !== '—' ? ` [${u}]` : ''}`;
};

export function coeficientesNombrados(res: Resultado1D, L: Lenguaje): CoeficientesExportados {
  const t = res.plantilla;
  const p = res.problem;
  const e = res.estado;
  const conX = (s: string) => (/\bx\b/.test(s) ? s : s === '0' ? '0*x' : `${s} + 0*x`);

  if (t.id === 'general') {
    return {
      definiciones: [[]],
      tramos: p.regions.map((r) => ({
        k: conX(exprA(r.k, L)),
        b: conX(exprA(r.b, L)),
        c: conX(exprA(r.c, L)),
        f: conX(exprA(r.f, L)),
      })),
    };
  }

  const multi = e.tramos.length > 1;
  const simbolos = new Set<string>();
  const funciones = new Set<string>();
  const globales: Definicion[] = t.camposGlobales.map((c) => {
    const nombre = RENOMBRAR[c.id] ?? c.id;
    simbolos.add(nombre);
    return { nombre, valor: exprA(e.globales[c.id] ?? valorPorDefecto(c, e.sistema), L), funcion: false, comentario: comentario(c, e.sistema) };
  });
  const definiciones: Definicion[][] = [globales];
  const tramos = e.tramos.map((tr, i) => {
    const defs: Definicion[] = [];
    const mapa: Record<string, string> = {};
    for (const g of globales) mapa[t.camposGlobales.find((c) => (RENOMBRAR[c.id] ?? c.id) === g.nombre)!.id] = `(${g.nombre})`;
    for (const c of t.camposTramo) {
      const src = tr.valores[c.id] ?? valorPorDefecto(c, e.sistema);
      const nombre = `${RENOMBRAR[c.id] ?? c.id}${multi ? `_${i + 1}` : ''}`;
      const fn = !compileExpr(src).constant;
      (fn ? funciones : simbolos).add(nombre);
      defs.push({ nombre, valor: exprA(src, L), funcion: fn, comentario: comentario(c, e.sistema) });
      mapa[c.id] = fn ? `(${nombre}(x))` : `(${nombre})`;
    }
    definiciones.push(defs);
    const co = t.coeficientes(mapa);
    const ctx = { simbolos, funciones };
    return {
      k: conX(exprA(co.k, L, ctx)),
      b: conX(exprA(co.b, L, ctx)),
      c: conX(exprA(co.c, L, ctx)),
      f: conX(exprA(co.f, L, ctx)),
    };
  });
  return { definiciones, tramos };
}
