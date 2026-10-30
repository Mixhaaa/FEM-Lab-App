/**
 * Demostración del ejemplo de clase en la terminal:
 *   -u'' + 100u = 10x³,  u(0) = u(1) = 0,  Ne = 3
 * Imprime Mnod, Melem, Ke, Kglob, Vglob y u para compararlos con MATLAB.
 * Uso:  npm run demo:clase            (Ne = 3)
 *       npm run demo:clase -- 6       (otro Ne)
 */
import { solve1D, type Problem1D } from '../src/core';

const ne = Number(process.argv[2] ?? 3);
const problema: Problem1D = {
  x0: 0,
  xL: 1,
  regions: [{ x0: 0, x1: 1, k: '1', b: '0', c: '100', f: '10*x^3' }],
  loads: [],
  bcLeft: { type: 'dirichlet', value: 0 },
  bcRight: { type: 'dirichlet', value: 0 },
  mesh: { type: 'uniforme', ne },
  gaussPoints: 3,
  bcMethod: 'eliminacion',
  penaltyExp: 8,
  solver: 'auto',
  exact: '0.1*x^3 + 0.006*x - 0.106*sinh(10*x)/sinh(10)',
};

const s = solve1D(problema);
const n = (v: number) => (Math.abs(v) < 1e-15 ? '0' : Number.isInteger(v) ? String(v) : v.toFixed(6)).padStart(12);
const mat = (nombre: string, A: number[][]) => {
  console.log(`${nombre} =`);
  for (const r of A) console.log('  ' + r.map(n).join(''));
  console.log();
};
const vec = (nombre: string, v: number[]) => mat(nombre, v.map((x) => [x]));

console.log(`\nEjemplo de clase:  -u'' + 100u = 10x^3,  u(0)=u(1)=0,  Ne = ${ne}\n`);
mat('Mnod  [nodo  x]', s.mesh.nodes.map((x, i) => [i + 1, x]));
mat('Melem [elem  nodo1  nodo2]', s.mesh.elements.map(([a, b], e) => [e + 1, a + 1, b + 1]));
mat('Ke (elemento 1)', s.elements[0].Ke);
vec('Fe (elemento 1)', s.elements[0].Fe);
mat('Kglob', s.K);
vec('Vglob', s.F);
console.log(`Fronteras por ${s.bcMethod}, solución con ${s.solverUsed === 'thomas' ? 'algoritmo de Thomas' : 'eliminación gaussiana'}\n`);
const ex = s.error!.exactAtNodes;
console.log('   nodo           x       u_MEF     u_exacta       error');
s.u.forEach((u, i) =>
  console.log(`${String(i + 1).padStart(7)}${n(s.mesh.nodes[i])}${n(u)}${n(ex[i])}${(u - ex[i]).toExponential(2).padStart(12)}`),
);
console.log(`\nReacciones: ${s.reactions.map((r) => `R(x=${r.x}) = ${r.value.toFixed(6)}`).join(',  ')}`);
console.log(`Error nodal máximo = ${s.error!.maxNodal.toExponential(3)},  error L2 = ${s.error!.L2.toExponential(3)}\n`);
