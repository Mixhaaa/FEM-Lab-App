/** Puntos para dibujar la solución MEF tal como es: recta en lineales, parábola en cuadráticos, cúbica en cúbicos. */
import { formaLagrange, type OrdenElemento, type Solution1D } from '../core';

/** x e y de la solución MEF. Con orden 2 o 3 agrega `muestras` puntos dentro de cada elemento. */
export function curvaMEF(sol: Solution1D, muestras = 12): { x: number[]; y: number[] } {
  if (sol.mesh.orden === 1) return { x: sol.mesh.nodes, y: sol.u };
  const x: number[] = [];
  const y: number[] = [];
  sol.elements.forEach((el, e) => {
    const ue = el.dofs.map((d) => sol.u[d]);
    for (let s = e === 0 ? 0 : 1; s <= muestras; s++) {
      const xi = -1 + (2 * s) / muestras;
      x.push((el.xa + el.xb) / 2 + (el.h / 2) * xi);
      y.push(formaLagrange(el.orden, xi).N.reduce((acc, n, a) => acc + n * ue[a], 0));
    }
  });
  return { x, y };
}

/** Una magnitud derivada a lo largo de todos los elementos: escalones (lineales), rectas (cuadráticos) o parábolas (cúbicos). */
export function curvaPorElemento(elementos: { perfil: { x: number[]; valores: Record<string, number[]> } }[], id: string) {
  const x: number[] = [];
  const y: number[] = [];
  for (const el of elementos) {
    x.push(...el.perfil.x);
    y.push(...el.perfil.valores[id]);
  }
  return { x, y };
}

/** «elementos lineales», «elemento cúbico», … */
export const nombreElementos = (orden: OrdenElemento = 1, plural = true) => {
  const adj = { 1: 'lineal', 2: 'cuadrático', 3: 'cúbico' }[orden];
  return plural ? `elementos ${adj}${orden === 1 ? 'es' : 's'}` : `elemento ${adj}`;
};

/** Adjetivo del orden: «lineal», «cuadrático/a», «cúbico/a». */
export const adjetivoOrden = (orden: OrdenElemento = 1, femenino = false) =>
  orden === 1 ? 'lineal' : `${orden === 2 ? 'cuadrátic' : 'cúbic'}${femenino ? 'a' : 'o'}`;

/** Cómo es u dentro de un elemento, y cómo es su derivada. */
export const FORMA_U: Record<OrdenElemento, string> = { 1: 'una recta', 2: 'una parábola', 3: 'una curva cúbica' };
export const FORMA_DU: Record<OrdenElemento, string> = { 1: 'constante', 2: 'una recta', 3: 'una parábola' };

/** Órdenes teóricos del error: L² ~ h^(p+1), H¹ ~ h^p. */
export const ORDEN_ERROR: Record<OrdenElemento, { L2: string; H1: string }> = {
  1: { L2: 'h²', H1: 'h' },
  2: { L2: 'h³', H1: 'h²' },
  3: { L2: 'h⁴', H1: 'h³' },
};
