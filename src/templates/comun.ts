/** Piezas reutilizables para definir plantillas. */
import { fmt } from '../core';
import { unidad, type CampoDef, type KpiDef, type OpcionFrontera, type Unidad } from './types';
import { maxAbs, maxVal, minVal } from './construir1d';

export const campo = (
  id: string,
  simbolo: string,
  nombre: string,
  u: Unidad,
  porDefecto: CampoDef['porDefecto'],
  extra: Partial<CampoDef> = {},
): CampoDef => ({ id, simbolo, nombre, unidad: u, porDefecto, tipo: 'numero', ...extra });

export const expr = (
  id: string,
  simbolo: string,
  nombre: string,
  u: Unidad,
  porDefecto: CampoDef['porDefecto'],
  extra: Partial<CampoDef> = {},
): CampoDef => ({ id, simbolo, nombre, unidad: u, porDefecto, tipo: 'expresion', ...extra });

/** Valor impuesto de la incógnita (Dirichlet). */
export function fDirichlet(
  id: string,
  nombre: string,
  simbolo: string,
  u: Unidad,
  porDefecto: CampoDef['porDefecto'] = '0',
  ayuda?: string,
): OpcionFrontera {
  return {
    id,
    nombre,
    ayuda,
    campos: [campo('valor', simbolo, nombre, u, porDefecto)],
    aBC: (v) => ({ type: 'dirichlet', value: v.valor }),
    describir: (v, c) => `${simbolo}(${c.xTexto}) = ${fmt(v.valor)} ${unidad(u, c.sistema)}`.trim(),
  };
}

/** Flujo nulo (Neumann homogéneo). */
export function fNula(id: string, nombre: string, texto: string, ayuda?: string): OpcionFrontera {
  return {
    id,
    nombre,
    ayuda,
    campos: [],
    aBC: () => ({ type: 'neumann', q: 0 }),
    describir: () => texto,
  };
}

/** Flujo entrante por el extremo (Neumann): k ∂u/∂n = q·escala. */
export function fNeumann(
  id: string,
  nombre: string,
  c: CampoDef,
  /** Convierte el valor físico en q (ej. multiplicar por el área). */
  aQ: (valor: number, ctx: Parameters<OpcionFrontera['aBC']>[1]) => number = (v) => v,
  ayuda?: string,
): OpcionFrontera {
  return {
    id,
    nombre,
    ayuda,
    campos: [c],
    aBC: (v, ctx) => ({ type: 'neumann', q: aQ(v[c.id], ctx) }),
    describir: (v, ctx) => `${c.simbolo} = ${fmt(v[c.id])} ${unidad(c.unidad, ctx.sistema)}`.trim(),
  };
}

/** Condición de Robin construida a partir de campos físicos. */
export function fRobin(
  id: string,
  nombre: string,
  campos: CampoDef[],
  aHG: (v: Record<string, number>, ctx: Parameters<OpcionFrontera['aBC']>[1]) => { h: number; g: number },
  describir: OpcionFrontera['describir'],
  ayuda?: string,
): OpcionFrontera {
  return {
    id,
    nombre,
    ayuda,
    campos,
    aBC: (v, ctx) => ({ type: 'robin', ...aHG(v, ctx) }),
    describir,
  };
}

/** KPIs típicos: máximo y mínimo de la incógnita y máximo absoluto de una magnitud por elemento. */
export const kpiMaxAbsU = (id: string, simbolo: string, nombre: string, u: Unidad): KpiDef => ({
  id,
  simbolo,
  nombre,
  unidad: u,
  calc: (c) => maxAbs(c.nodos, c.u),
});
export const kpiMaxU = (id: string, simbolo: string, nombre: string, u: Unidad): KpiDef => ({
  id,
  simbolo,
  nombre,
  unidad: u,
  calc: (c) => maxVal(c.nodos, c.u),
});
export const kpiMinU = (id: string, simbolo: string, nombre: string, u: Unidad): KpiDef => ({
  id,
  simbolo,
  nombre,
  unidad: u,
  calc: (c) => minVal(c.nodos, c.u),
});
export const kpiMaxAbsElem = (magnitud: string, id: string, simbolo: string, nombre: string, u: Unidad): KpiDef => ({
  id,
  simbolo,
  nombre,
  unidad: u,
  calc: (c) => (c.porElemento[magnitud]?.length ? maxAbs(c.xm, c.porElemento[magnitud]) : null),
});
export const kpiEntrante = (lado: 'izquierda' | 'derecha', id: string, simbolo: string, nombre: string, u: Unidad): KpiDef => ({
  id,
  simbolo,
  nombre,
  unidad: u,
  calc: (c) => ({ valor: c.entrante[lado], x: lado === 'izquierda' ? c.nodos[0] : c.nodos[c.nodos.length - 1] }),
});

/** Escribe un número con precisión suficiente para usarlo dentro de una expresión. */
export const n = (v: number) => {
  const s = Number(v.toPrecision(12)).toString();
  return v < 0 ? `(${s})` : s;
};
