/**
 * Resuelve los ejemplos de las plantillas y muestra los resultados principales con unidades.
 * Uso:  npm run demo:plantillas              (todas)
 *       npm run demo:plantillas -- aleta     (una plantilla)
 */
import { fmt } from '../src/core';
import {
  aplicarEjemplo,
  EJEMPLOS_ARMADURA,
  EJEMPLOS_RESORTES,
  estadoPorDefecto,
  PLANTILLAS_1D,
  resolverArmadura,
  resolverPlantilla1D,
  resolverResortes,
} from '../src/templates';

const filtro = process.argv[2];
const linea = (s: string) => console.log(s);
const v = (x: number, u: string) => `${fmt(x, 5)} ${u}`.trim();

for (const t of PLANTILLAS_1D) {
  if (filtro && t.id !== filtro) continue;
  linea(`\n══ ${t.nombre} ══`);
  for (const ej of t.ejemplos) {
    const r = resolverPlantilla1D(t, aplicarEjemplo(t, estadoPorDefecto(t), ej.id));
    const ne = r.sol.mesh.elements.length;
    linea(`\n  ▸ ${ej.nombre}  (Ne = ${ne})`);
    for (const k of r.kpis) {
      linea(`      ${k.def.nombre.padEnd(48)} ${v(k.valor.valor, k.unidad)}${k.valor.x !== undefined ? `  en x = ${fmt(k.valor.x)}` : ''}`);
    }
    for (const re of r.reacciones) linea(`      ${`${re.nombre} (${re.lado})`.padEnd(48)} ${v(re.valor, re.unidad)}`);
    if (r.exacta && r.sol.error) {
      linea(`      ${`Error nodal máx. vs analítica (${r.exacta.origen})`.padEnd(48)} ${r.sol.error.maxNodal.toExponential(2)}`);
    }
    for (const a of r.avisos) linea(`      ⚠ ${a}`);
  }
}

if (!filtro || filtro === 'armadura') {
  linea('\n══ Armadura plana 2D ══');
  for (const ej of EJEMPLOS_ARMADURA) {
    const r = resolverArmadura(ej.estado);
    linea(`\n  ▸ ${ej.nombre}`);
    for (const b of r.sol.bars) {
      linea(`      Barra ${String(b.id).padStart(2)} (${b.i + 1}-${b.j + 1})  N = ${v(b.N, r.unidades.fuerza).padEnd(16)} σ = ${v(b.sigma, r.unidades.esfuerzo).padEnd(18)} ${b.estado}`);
    }
    for (const re of r.sol.reactions) {
      linea(`      Reacción nodo ${re.node + 1}:  Rx = ${re.Rx === null ? '—' : v(re.Rx, 'N')}   Ry = ${re.Ry === null ? '—' : v(re.Ry, 'N')}`);
    }
  }
}

if (!filtro || filtro === 'resortes') {
  linea('\n══ Sistema de resortes ══');
  for (const ej of EJEMPLOS_RESORTES) {
    const r = resolverResortes(ej.estado);
    linea(`\n  ▸ ${ej.nombre}`);
    linea(`      u = [${r.sol.u.map((x) => fmt(x, 5)).join(', ')}] ${r.unidades.long}`);
    linea(`      Fuerzas = [${r.sol.springs.map((s) => fmt(s.force, 5)).join(', ')}] N`);
  }
}
linea('');
