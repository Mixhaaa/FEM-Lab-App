/** Puntos para dibujar la solución MEF tal como es: recta en lineales, parábola en cuadráticos. */
import { formaCuadratica, type Solution1D } from '../core';

/** x e y de la solución MEF. En cuadráticos agrega `muestras` puntos dentro de cada elemento. */
export function curvaMEF(sol: Solution1D, muestras = 12): { x: number[]; y: number[] } {
  if (sol.mesh.orden !== 2) return { x: sol.mesh.nodes, y: sol.u };
  const x: number[] = [];
  const y: number[] = [];
  sol.elements.forEach((el, e) => {
    const ue = el.dofs.map((d) => sol.u[d]);
    for (let s = e === 0 ? 0 : 1; s <= muestras; s++) {
      const xi = -1 + (2 * s) / muestras;
      x.push((el.xa + el.xb) / 2 + (el.h / 2) * xi);
      y.push(formaCuadratica(xi).N.reduce((acc, n, a) => acc + n * ue[a], 0));
    }
  });
  return { x, y };
}

/** Escalera (lineales) o rectas por elemento (cuadráticos) para una magnitud derivada. */
export function curvaPorElemento(elementos: { xa: number; xb: number; extremos: Record<string, [number, number]> }[], id: string) {
  const x: number[] = [];
  const y: number[] = [];
  for (const el of elementos) {
    x.push(el.xa, el.xb);
    y.push(el.extremos[id][0], el.extremos[id][1]);
  }
  return { x, y };
}

/** Nombre del tipo de elemento para los textos. */
export const nombreElementos = (orden?: 1 | 2, plural = true) =>
  orden === 2 ? (plural ? 'elementos cuadráticos' : 'elemento cuadrático') : plural ? 'elementos lineales' : 'elemento lineal';
