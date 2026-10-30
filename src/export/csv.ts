/** Exportación de resultados a CSV. */
import { unidad, type Resultado1D, type ResultadoArmadura, type ResultadoResortes } from '../templates';

export type FormatoCSV = 'estandar' | 'excel-es';

/** estandar: separador "," y punto decimal. excel-es: separador ";" y coma decimal (Excel en español). */
export function tablaCSV(cabecera: string[], filas: (string | number)[][], formato: FormatoCSV = 'estandar'): string {
  const sep = formato === 'excel-es' ? ';' : ',';
  const celda = (v: string | number) => {
    let s = typeof v === 'number' ? (Number.isFinite(v) ? String(Number(v.toPrecision(12))) : '') : v;
    if (typeof v === 'number' && formato === 'excel-es') s = s.replace('.', ',');
    return s.includes(sep) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM para que Excel reconozca UTF-8 (tildes y símbolos)
  return '﻿' + [cabecera, ...filas].map((f) => f.map(celda).join(sep)).join('\r\n') + '\r\n';
}

const conU = (nombre: string, u: string) => (u && u !== '—' ? `${nombre} [${u}]` : nombre);

export function csvNodos1D(res: Resultado1D, formato: FormatoCSV = 'estandar'): string {
  const t = res.plantilla;
  const s = res.estado.sistema;
  const sol = res.sol;
  const err = sol.error;
  const cab = [
    'nodo',
    conU('x', unidad(t.unidadLongitud, s)),
    conU(`${t.incognita.simbolo} MEF`, unidad(t.incognita.unidad, s)),
    ...(err ? [conU(`${t.incognita.simbolo} exacta`, unidad(t.incognita.unidad, s)), 'error'] : []),
    'k du/dx (promedio nodal)',
    ...(sol.reactions.length ? [conU(t.reaccion.simbolo, unidad(t.reaccion.unidad, s))] : []),
  ];
  const filas = sol.mesh.nodes.map((x, i) => {
    const r = sol.reactions.find((rc) => rc.node === i);
    return [
      i + 1,
      x,
      sol.u[i],
      ...(err ? [err.exactAtNodes[i], err.nodal[i]] : []),
      sol.nodalFlux[i],
      ...(sol.reactions.length ? [r ? r.value : ''] : []),
    ];
  });
  return tablaCSV(cab, filas, formato);
}

export function csvElementos1D(res: Resultado1D, formato: FormatoCSV = 'estandar'): string {
  const t = res.plantilla;
  const s = res.estado.sistema;
  const ul = unidad(t.unidadLongitud, s);
  const cab = ['elemento', 'nodo 1', 'nodo 2', conU('x inicio', ul), conU('x fin', ul), conU('h', ul), 'tramo', ...t.derivadas.map((d) => conU(d.simbolo, unidad(d.unidad, s)))];
  const filas = res.elementos.map((el, i) => [
    el.id,
    res.sol.elements[i].nodes[0] + 1,
    res.sol.elements[i].nodes[1] + 1,
    el.xa,
    el.xb,
    el.h,
    el.tramo + 1,
    ...t.derivadas.map((d) => el.valores[d.id]),
  ]);
  return tablaCSV(cab, filas, formato);
}

export function csvNodosArmadura(res: ResultadoArmadura, formato: FormatoCSV = 'estandar'): string {
  const un = res.unidades;
  const sol = res.sol;
  return tablaCSV(
    ['nodo', `x [${un.long}]`, `y [${un.long}]`, `ux [${un.long}]`, `uy [${un.long}]`, `Rx [${un.fuerza}]`, `Ry [${un.fuerza}]`],
    sol.problem.nodes.map((nd, i) => {
      const r = sol.reactions.find((x) => x.node === i);
      return [i + 1, nd.x, nd.y, sol.u[2 * i], sol.u[2 * i + 1], r?.Rx ?? '', r?.Ry ?? ''];
    }),
    formato,
  );
}

export function csvBarrasArmadura(res: ResultadoArmadura, formato: FormatoCSV = 'estandar'): string {
  const un = res.unidades;
  return tablaCSV(
    ['barra', 'nodo i', 'nodo j', `L [${un.long}]`, 'cos', 'sen', `N [${un.fuerza}]`, `sigma [${un.esfuerzo}]`, 'deformacion', 'estado'],
    res.sol.bars.map((b) => [b.id, b.i + 1, b.j + 1, b.L, b.c, b.s, b.N, b.sigma, b.strain, b.estado]),
    formato,
  );
}

export function csvNodosResortes(res: ResultadoResortes, formato: FormatoCSV = 'estandar'): string {
  const un = res.unidades;
  const sol = res.sol;
  return tablaCSV(
    ['nodo', `u [${un.long}]`, `carga [${un.fuerza}]`, `reaccion [${un.fuerza}]`],
    sol.u.map((v, i) => [i + 1, v, sol.F[i], sol.reactions.find((r) => r.node === i)?.value ?? '']),
    formato,
  );
}

export function csvResortes(res: ResultadoResortes, formato: FormatoCSV = 'estandar'): string {
  const un = res.unidades;
  return tablaCSV(
    ['resorte', 'nodo i', 'nodo j', `k [${un.rigidez}]`, `alargamiento [${un.long}]`, `fuerza [${un.fuerza}]`],
    res.sol.springs.map((s) => [s.id, s.i + 1, s.j + 1, s.k, s.elong, s.force]),
    formato,
  );
}
