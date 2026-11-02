/**
 * Línea base de resultados: -T'' + 100T = 10x³ en [0,1], T(0) = T(1) = 0, con 4, 8 y 16 elementos.
 * Imprime los valores nodales y el error máximo contra la solución analítica, con 17 cifras.
 * Uso: npm run linea-base   (la salida debe ser idéntica antes y después de cambios de diseño)
 */
import { solve1D, type Problem1D } from '../src/core';

const exacta = '0.1*x^3 + 0.006*x - 0.106*sinh(10*x)/sinh(10)';
for (const ne of [4, 8, 16]) {
  const p: Problem1D = {
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
    exact: exacta,
  };
  const s = solve1D(p);
  console.log(`Ne = ${ne}`);
  s.mesh.nodes.forEach((x, i) => console.log(`  x = ${x.toPrecision(17)}  T = ${s.u[i].toPrecision(17)}`));
  console.log(`  error nodal máximo = ${s.error!.maxNodal.toPrecision(17)}`);
}
