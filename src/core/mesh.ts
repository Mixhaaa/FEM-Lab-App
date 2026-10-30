/**
 * Generación de malla 1D: uniforme, geométrica (refinada hacia un extremo) o manual.
 * Siempre se coloca un nodo en cada cambio de tramo y en cada carga puntual,
 * para que ningún elemento quede partido entre dos materiales.
 */
import { FemError } from './errors';
import { fmt } from './expr';
import type { MeshInfo, MeshSpec, PointLoad, Region } from './types';

export const MAX_ELEMENTOS = 2000;

export function uniformNodes(x0: number, xL: number, ne: number): number[] {
  const nodes: number[] = [];
  for (let i = 0; i <= ne; i++) nodes.push(i === ne ? xL : x0 + ((xL - x0) * i) / ne);
  return nodes;
}

/** Nodos con tamaños en progresión geométrica. ratio = h_max / h_min. */
export function geometricNodes(
  x0: number,
  xL: number,
  ne: number,
  ratio: number,
  hacia: 'izquierda' | 'derecha' | 'ambos',
): number[] {
  if (ne === 1 || ratio === 1) return uniformNodes(x0, xL, ne);
  const sizes: number[] = [];
  if (hacia === 'ambos') {
    const m = Math.floor((ne - 1) / 2);
    const q = m > 0 ? Math.pow(ratio, 1 / m) : 1;
    for (let i = 0; i < ne; i++) sizes.push(Math.pow(q, Math.min(i, ne - 1 - i)));
  } else {
    const q = Math.pow(ratio, 1 / (ne - 1));
    for (let i = 0; i < ne; i++) sizes.push(Math.pow(q, i));
    if (hacia === 'derecha') sizes.reverse();
  }
  const total = sizes.reduce((a, b) => a + b, 0);
  const nodes = [x0];
  let acc = 0;
  for (let i = 0; i < ne; i++) {
    acc += sizes[i];
    nodes.push(i === ne - 1 ? xL : x0 + ((xL - x0) * acc) / total);
  }
  return nodes;
}

function breakpoints(x0: number, xL: number, regions: Region[], loads: PointLoad[], tol: number): number[] {
  const pts: number[] = [];
  for (const r of regions) {
    for (const p of [r.x0, r.x1]) if (p > x0 + tol && p < xL - tol) pts.push(p);
  }
  for (const l of loads) if (l.x > x0 + tol && l.x < xL - tol) pts.push(l.x);
  pts.sort((a, b) => a - b);
  const out: number[] = [];
  for (const p of pts) if (!out.length || Math.abs(p - out[out.length - 1]) > tol) out.push(p);
  return out;
}

const has = (nodes: number[], p: number, tol: number) => nodes.some((n) => Math.abs(n - p) <= tol);

export function buildMesh(
  x0: number,
  xL: number,
  spec: MeshSpec,
  regions: Region[],
  loads: PointLoad[],
): MeshInfo {
  const L = xL - x0;
  const tol = 1e-9 * Math.abs(L);
  const warnings: string[] = [];
  const bps = breakpoints(x0, xL, regions, loads, tol);
  let nodes: number[];
  const forced: number[] = [];

  if (spec.type === 'uniforme' || spec.type === 'geometrica') {
    const ne = spec.ne;
    if (!Number.isInteger(ne) || ne < 1) throw new FemError('El número de elementos Ne debe ser un entero mayor o igual a 1.', 'Ne');
    if (ne > MAX_ELEMENTOS) throw new FemError(`Ne = ${ne} es demasiado grande. El máximo es ${MAX_ELEMENTOS} elementos.`, 'Ne');
  }

  if (spec.type === 'uniforme') {
    const base = uniformNodes(x0, xL, spec.ne);
    if (bps.every((p) => has(base, p, tol * 10))) {
      nodes = base;
      // Ajustar exactamente a los puntos de quiebre
      for (const p of bps) {
        const i = nodes.findIndex((n) => Math.abs(n - p) <= tol * 10);
        nodes[i] = p;
      }
    } else {
      // Repartir los elementos por tramo, proporcional a la longitud (mínimo 1 por tramo)
      const cuts = [x0, ...bps, xL];
      const nseg = cuts.length - 1;
      const ne = Math.max(spec.ne, nseg);
      if (ne > spec.ne) warnings.push(`Se usaron ${ne} elementos (uno por tramo como mínimo) en lugar de ${spec.ne}.`);
      const lens = cuts.slice(1).map((c, i) => c - cuts[i]);
      const counts = lens.map(() => 1);
      let rest = ne - nseg;
      const ideal = lens.map((l) => (l / L) * ne);
      while (rest > 0) {
        let best = 0;
        let bestGap = -Infinity;
        for (let i = 0; i < nseg; i++) {
          const gap = ideal[i] - counts[i];
          if (gap > bestGap) {
            bestGap = gap;
            best = i;
          }
        }
        counts[best]++;
        rest--;
      }
      nodes = [x0];
      for (let s = 0; s < nseg; s++) {
        const seg = uniformNodes(cuts[s], cuts[s + 1], counts[s]);
        nodes.push(...seg.slice(1));
      }
      forced.push(...bps);
      warnings.push(
        `La malla uniforme no tenía nodos en x = ${bps.map((p) => fmt(p)).join(', ')}; se reparte uniformemente dentro de cada tramo.`,
      );
    }
  } else if (spec.type === 'geometrica') {
    if (!(spec.ratio >= 1)) throw new FemError('La razón de refinamiento (h_max/h_min) debe ser mayor o igual a 1.', 'ratio');
    nodes = geometricNodes(x0, xL, spec.ne, spec.ratio, spec.hacia);
    const fixed = new Set<number>([0, nodes.length - 1]);
    for (const p of bps) {
      if (has(nodes, p, tol * 10)) {
        const i = nodes.findIndex((n) => Math.abs(n - p) <= tol * 10);
        nodes[i] = p;
        fixed.add(i);
        continue;
      }
      let best = -1;
      let dist = Infinity;
      nodes.forEach((n, i) => {
        const d = Math.abs(n - p);
        if (d < dist) {
          dist = d;
          best = i;
        }
      });
      if (fixed.has(best)) {
        nodes.push(p);
        nodes.sort((a, b) => a - b);
        // reconstruir índices fijos
        const fx = [...fixed].map((i) => nodes[i]);
        fixed.clear();
        for (const v of fx) fixed.add(nodes.indexOf(v));
        fixed.add(nodes.indexOf(p));
      } else {
        nodes[best] = p;
        fixed.add(best);
      }
      forced.push(p);
    }
    if (forced.length) warnings.push(`Se ajustaron nodos a x = ${forced.map((p) => fmt(p)).join(', ')} (cambio de tramo o carga puntual).`);
  } else {
    const raw = spec.nodes.map(Number);
    if (raw.length < 2) throw new FemError('La malla manual necesita al menos 2 nodos.', 'nodos');
    if (raw.some((v) => !Number.isFinite(v))) throw new FemError('Todos los nodos manuales deben ser números.', 'nodos');
    for (let i = 1; i < raw.length; i++) {
      if (!(raw[i] > raw[i - 1])) {
        throw new FemError(
          `Los nodos manuales deben ser estrictamente crecientes (nodo ${i} = ${fmt(raw[i - 1])}, nodo ${i + 1} = ${fmt(raw[i])}).`,
          'nodos',
        );
      }
    }
    if (Math.abs(raw[0] - x0) > tol * 10 || Math.abs(raw[raw.length - 1] - xL) > tol * 10) {
      throw new FemError(`El primer nodo manual debe ser x0 = ${fmt(x0)} y el último xL = ${fmt(xL)}.`, 'nodos');
    }
    nodes = [...raw];
    nodes[0] = x0;
    nodes[nodes.length - 1] = xL;
    for (const p of bps) {
      if (!has(nodes, p, tol * 10)) {
        nodes.push(p);
        forced.push(p);
      }
    }
    nodes.sort((a, b) => a - b);
    if (forced.length) warnings.push(`Se agregaron nodos en x = ${forced.map((p) => fmt(p)).join(', ')} (cambio de tramo o carga puntual).`);
    if (nodes.length - 1 > MAX_ELEMENTOS) throw new FemError(`Demasiados nodos: el máximo es ${MAX_ELEMENTOS} elementos.`, 'nodos');
  }

  const elements: [number, number][] = [];
  const elementRegion: number[] = [];
  for (let e = 0; e < nodes.length - 1; e++) {
    elements.push([e, e + 1]);
    const xm = (nodes[e] + nodes[e + 1]) / 2;
    let r = regions.findIndex((reg) => xm >= reg.x0 - tol && xm <= reg.x1 + tol);
    if (r < 0) r = 0;
    elementRegion.push(r);
  }

  return { nodes, elements, elementRegion, forcedNodes: forced, warnings };
}
