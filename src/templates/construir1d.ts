/**
 * Convierte el estado de una plantilla 1D en un Problem1D, lo resuelve y
 * calcula las magnitudes físicas con nombre y unidad.
 */
import {
  analyticConstant,
  compileExpr,
  evalChecked,
  FemError,
  fmt,
  gaussRule,
  parseNumber,
  solve1D,
  type BoundaryCondition,
  type CompiledExpr,
  type MeshSpec,
  type Problem1D,
  type Region,
  type Solution1D,
} from '../core';
import {
  unidad,
  valorPorDefecto,
  type CampoDef,
  type ContextoFrontera,
  type Estado1D,
  type KpiDef,
  type KpiValor,
  type Plantilla1D,
  type SistemaUnidades,
} from './types';

/** Estado inicial de una plantilla: valores por defecto + su primer ejemplo. */
export function estadoPorDefecto(t: Plantilla1D, sistema?: SistemaUnidades): Estado1D {
  const s = sistema ?? t.sistemas[0];
  const valores = (campos: CampoDef[]) => Object.fromEntries(campos.map((c) => [c.id, valorPorDefecto(c, s)]));
  const fr = (i: number) => {
    const op = t.fronteras[Math.min(i, t.fronteras.length - 1)];
    return { opcion: op.id, valores: valores(op.campos) };
  };
  const base: Estado1D = {
    plantilla: t.id,
    sistema: s,
    x0: '0',
    xL: '1',
    tramos: [{ fin: '1', valores: valores(t.camposTramo) }],
    globales: valores(t.camposGlobales),
    izquierda: fr(0),
    derecha: fr(1),
    cargas: [],
    malla: { tipo: 'uniforme', ne: 8, ratio: 4, hacia: 'derecha', nodos: '' },
    gauss: 3,
    metodo: 'eliminacion',
    penalizacion: 8,
    solver: 'auto',
    exacta: '',
  };
  return t.ejemplos.length ? aplicarEjemplo(t, base, t.ejemplos[0].id) : base;
}

/** Aplica un ejemplo sobre un estado (completando los valores que el ejemplo no indique). */
export function aplicarEjemplo(t: Plantilla1D, base: Estado1D, ejemploId: string): Estado1D {
  const ej = t.ejemplos.find((e) => e.id === ejemploId);
  if (!ej) return base;
  const s = ej.estado.sistema ?? base.sistema;
  const defTramo = Object.fromEntries(t.camposTramo.map((c) => [c.id, valorPorDefecto(c, s)]));
  const completarFrontera = (f: Estado1D['izquierda']) => {
    const op = t.fronteras.find((o) => o.id === f.opcion) ?? t.fronteras[0];
    return { opcion: op.id, valores: { ...Object.fromEntries(op.campos.map((c) => [c.id, valorPorDefecto(c, s)])), ...f.valores } };
  };
  const e: Estado1D = {
    ...base,
    exacta: '',
    cargas: [],
    ...ej.estado,
    sistema: s,
    malla: { ...base.malla, ...(ej.estado.malla ?? {}) },
  };
  e.tramos = (ej.estado.tramos ?? base.tramos).map((tr) => ({ ...tr, valores: { ...defTramo, ...tr.valores } }));
  e.globales = {
    ...Object.fromEntries(t.camposGlobales.map((c) => [c.id, valorPorDefecto(c, s)])),
    ...(ej.estado.globales ?? {}),
  };
  e.izquierda = completarFrontera(ej.estado.izquierda ?? base.izquierda);
  e.derecha = completarFrontera(ej.estado.derecha ?? base.derecha);
  e.plantilla = t.id;
  return e;
}

interface Compilado {
  problem: Problem1D;
  /** Campos compilados por tramo. */
  campos: Record<string, CompiledExpr>[];
  globales: Record<string, number>;
  avisos: string[];
}

function etiqueta(c: CampoDef) {
  return `${c.nombre} (${c.simbolo})`;
}

function revisarSigno(c: CampoDef, v: number, donde: string) {
  if (c.positivo && !(v > 0)) throw new FemError(`${etiqueta(c)}${donde} debe ser mayor que cero, pero vale ${fmt(v)}.`, c.id);
  if (c.noNegativo && v < 0) throw new FemError(`${etiqueta(c)}${donde} no puede ser menor que cero, pero vale ${fmt(v)}.`, c.id);
}

export function compilarEstado(t: Plantilla1D, e: Estado1D): Compilado {
  const avisos: string[] = [];
  const x0 = parseNumber(e.x0, 'El inicio del dominio x0');
  const xL = parseNumber(e.xL, 'El final del dominio xL');
  if (!(xL > x0)) throw new FemError(`La longitud debe ser positiva: xL (${fmt(xL)}) debe ser mayor que x0 (${fmt(x0)}).`, 'dominio');
  if (e.tramos.length === 0) throw new FemError('Define al menos un tramo.', 'tramos');

  // Globales
  const globales: Record<string, number> = {};
  const globalesTxt: Record<string, string> = {};
  for (const c of t.camposGlobales) {
    const v = parseNumber(e.globales[c.id] ?? valorPorDefecto(c, e.sistema), etiqueta(c));
    revisarSigno(c, v, '');
    globales[c.id] = v;
    globalesTxt[c.id] = `(${v})`;
  }

  // Tramos
  const multi = e.tramos.length > 1;
  const regions: Region[] = [];
  const campos: Record<string, CompiledExpr>[] = [];
  let ini = x0;
  e.tramos.forEach((tr, i) => {
    const ultimo = i === e.tramos.length - 1;
    const fin = ultimo ? xL : parseNumber(tr.fin, `El final del tramo ${i + 1}`);
    if (!(fin > ini)) {
      throw new FemError(`El tramo ${i + 1} termina en ${fmt(fin)}, que no es mayor que su inicio ${fmt(ini)}.`, 'tramos');
    }
    if (!ultimo && !(fin < xL)) throw new FemError(`El tramo ${i + 1} termina en ${fmt(fin)}, fuera del dominio (xL = ${fmt(xL)}).`, 'tramos');
    const donde = multi ? ` en el tramo ${i + 1}` : '';
    const comp: Record<string, CompiledExpr> = {};
    const txt: Record<string, string> = { ...globalesTxt };
    for (const c of t.camposTramo) {
      const src = tr.valores[c.id] ?? valorPorDefecto(c, e.sistema);
      const ce = compileExpr(src, `${etiqueta(c)}${donde}`);
      if (c.tipo === 'numero' && !ce.constant) {
        throw new FemError(`${etiqueta(c)}${donde} debe ser un número constante (no puede depender de x).`, c.id);
      }
      for (let s = 0; s <= 10; s++) {
        const x = ini + ((fin - ini) * s) / 10;
        const v = evalChecked(ce, x, `${etiqueta(c)}${donde}`);
        revisarSigno(c, v, `${donde}${ce.constant ? '' : ` en x = ${fmt(x)}`}`);
        if (ce.constant) break;
      }
      comp[c.id] = ce;
      txt[c.id] = `(${ce.source})`;
    }
    const co = t.coeficientes(txt);
    regions.push({ x0: ini, x1: fin, ...co, nombre: tr.nombre });
    campos.push(comp);
    ini = fin;
  });

  const campoEnTramo = (r: number, id: string, x: number) => {
    const ce = campos[r][id];
    if (ce) return evalChecked(ce, x, id);
    if (id in globales) return globales[id];
    throw new Error(`Campo desconocido: ${id}`);
  };

  // Fronteras
  const frontera = (lado: 'izquierda' | 'derecha'): BoundaryCondition => {
    const fe = e[lado];
    const op = t.fronteras.find((o) => o.id === fe.opcion);
    if (!op) throw new FemError(`Elige una condición de frontera para el extremo ${lado}.`, `frontera ${lado}`);
    const v: Record<string, number> = {};
    for (const c of op.campos) {
      const val = parseNumber(fe.valores[c.id] ?? valorPorDefecto(c, e.sistema), `${etiqueta(c)} en el extremo ${lado}`);
      revisarSigno(c, val, ` en el extremo ${lado}`);
      v[c.id] = val;
    }
    const x = lado === 'izquierda' ? x0 : xL;
    const r = lado === 'izquierda' ? 0 : regions.length - 1;
    const ctx: ContextoFrontera = { lado, x, campo: (id) => campoEnTramo(r, id, x), global: (id) => globales[id] };
    return op.aBC(v, ctx);
  };
  const bcLeft = frontera('izquierda');
  const bcRight = frontera('derecha');

  // Cargas puntuales
  if (e.cargas.length && !t.cargaPuntual) throw new FemError('Esta plantilla no admite cargas puntuales.', 'cargas');
  const loads = e.cargas.map((c, i) => ({
    x: parseNumber(c.x, `La posición de la carga puntual ${i + 1}`),
    P: parseNumber(c.P, `El valor de la carga puntual ${i + 1}`),
  }));

  // Malla
  let mesh: MeshSpec;
  if (e.malla.tipo === 'manual') {
    const partes = e.malla.nodos.split(/[\s;,]+/).filter((s) => s.trim() !== '');
    if (partes.length < 2) throw new FemError('Escribe al menos 2 nodos para la malla manual (separados por espacios o comas).', 'nodos');
    mesh = { type: 'manual', nodes: partes.map((s, i) => parseNumber(s, `El nodo manual ${i + 1}`)) };
  } else if (e.malla.tipo === 'geometrica') {
    mesh = { type: 'geometrica', ne: e.malla.ne, ratio: e.malla.ratio, hacia: e.malla.hacia };
  } else {
    mesh = { type: 'uniforme', ne: e.malla.ne };
  }

  const problem: Problem1D = {
    x0,
    xL,
    regions,
    loads,
    bcLeft,
    bcRight,
    mesh,
    gaussPoints: e.gauss,
    bcMethod: e.metodo,
    penaltyExp: e.penalizacion,
    solver: e.solver,
  };
  return { problem, campos, globales, avisos };
}

export interface FilaElemento {
  id: number;
  xa: number;
  xb: number;
  xm: number;
  h: number;
  tramo: number;
  valores: Record<string, number>;
}

export interface ReaccionNombrada {
  lado: 'izquierda' | 'derecha';
  x: number;
  valor: number;
  nombre: string;
  simbolo: string;
  unidad: string;
}

export interface Resultado1D {
  plantilla: Plantilla1D;
  estado: Estado1D;
  problem: Problem1D;
  sol: Solution1D;
  exacta?: { expr: string; origen: 'usuario' | 'automatica' };
  elementos: FilaElemento[];
  porElemento: Record<string, number[]>;
  reacciones: ReaccionNombrada[];
  kpis: { def: KpiDef; valor: KpiValor; unidad: string }[];
  avisos: string[];
}

export function resolverPlantilla1D(t: Plantilla1D, e: Estado1D): Resultado1D {
  const { problem, campos, globales, avisos } = compilarEstado(t, e);

  let exacta: Resultado1D['exacta'];
  if (e.exacta && e.exacta.trim() !== '') exacta = { expr: e.exacta.trim(), origen: 'usuario' };
  else {
    const auto = analyticConstant(problem);
    if (auto) exacta = { expr: auto, origen: 'automatica' };
  }
  const sol = solve1D({ ...problem, exact: exacta?.expr });
  avisos.push(...sol.warnings);

  const campoEnTramo = (r: number, id: string, x: number) =>
    campos[r][id] ? evalChecked(campos[r][id], x, id) : (globales[id] ?? NaN);
  const tramoDe = (x: number) => {
    const i = problem.regions.findIndex((r) => x >= r.x0 - 1e-12 && x <= r.x1 + 1e-12);
    return i < 0 ? problem.regions.length - 1 : i;
  };
  const global = (id: string) => globales[id];

  const porElemento: Record<string, number[]> = Object.fromEntries(t.derivadas.map((d) => [d.id, [] as number[]]));
  const elementos: FilaElemento[] = sol.elements.map((el, idx) => {
    const p = sol.post[idx];
    const [i, j] = el.nodes;
    const ctx = {
      x: p.xm,
      u: (sol.u[i] + sol.u[j]) / 2,
      du: p.du,
      kdu: p.kdu,
      campo: (id: string) => campoEnTramo(el.region, id, p.xm),
      global,
    };
    const valores: Record<string, number> = {};
    for (const d of t.derivadas) {
      valores[d.id] = d.calc(ctx);
      porElemento[d.id].push(valores[d.id]);
    }
    return { id: el.id, xa: el.xa, xb: el.xb, xm: p.xm, h: el.h, tramo: el.region, valores };
  });

  const s = e.sistema;
  const reacciones: ReaccionNombrada[] = sol.reactions.map((r) => ({
    lado: r.lado,
    x: r.x,
    valor: r.value,
    nombre: t.reaccion.nombre,
    simbolo: t.reaccion.simbolo,
    unidad: unidad(t.reaccion.unidad, s),
  }));

  const n = sol.u.length;
  const entra = (bc: BoundaryCondition, node: number, lado: 'izquierda' | 'derecha') => {
    if (bc.type === 'neumann') return bc.q;
    if (bc.type === 'robin') return bc.g - bc.h * sol.u[node];
    return sol.reactions.find((r) => r.lado === lado)?.value ?? 0;
  };
  const { xi, w } = gaussRule(5);
  const integrar = (g: (x: number, u: number, campo: (id: string) => number) => number) => {
    let total = 0;
    for (const el of sol.elements) {
      const [i, j] = el.nodes;
      const J = el.h / 2;
      for (let q = 0; q < xi.length; q++) {
        const x = (el.xa + el.xb) / 2 + J * xi[q];
        const t2 = (x - el.xa) / el.h;
        const uh = sol.u[i] * (1 - t2) + sol.u[j] * t2;
        total += w[q] * J * g(x, uh, (id) => campoEnTramo(el.region, id, x));
      }
    }
    return total;
  };
  const kctx = {
    nodos: sol.mesh.nodes,
    u: sol.u,
    porElemento,
    xm: sol.post.map((p) => p.xm),
    reacciones: sol.reactions.map((r) => ({ lado: r.lado, x: r.x, valor: r.value })),
    entrante: { izquierda: entra(problem.bcLeft, 0, 'izquierda'), derecha: entra(problem.bcRight, n - 1, 'derecha') },
    integrar,
    global,
    campoEn: (id: string, x: number) => campoEnTramo(tramoDe(x), id, x),
    fronteras: { izquierda: problem.bcLeft, derecha: problem.bcRight },
  };
  const kpis: Resultado1D['kpis'] = [];
  for (const def of t.kpis) {
    const valor = def.calc(kctx);
    if (valor && Number.isFinite(valor.valor)) kpis.push({ def, valor, unidad: unidad(def.unidad, s) });
  }

  return { plantilla: t, estado: e, problem, sol, exacta, elementos, porElemento, reacciones, kpis, avisos };
}

/** Máximo en valor absoluto con su posición. */
export function maxAbs(xs: number[], vals: number[]): KpiValor {
  let k = 0;
  for (let i = 1; i < vals.length; i++) if (Math.abs(vals[i]) > Math.abs(vals[k])) k = i;
  return { valor: vals[k], x: xs[k] };
}

export function maxVal(xs: number[], vals: number[]): KpiValor {
  let k = 0;
  for (let i = 1; i < vals.length; i++) if (vals[i] > vals[k]) k = i;
  return { valor: vals[k], x: xs[k] };
}

export function minVal(xs: number[], vals: number[]): KpiValor {
  let k = 0;
  for (let i = 1; i < vals.length; i++) if (vals[i] < vals[k]) k = i;
  return { valor: vals[k], x: xs[k] };
}
