/** Plantilla general: la ecuación modelo con k, b, c, f escritos directamente. Incluye el ejemplo de clase. */
import { fmt } from '../core';
import { campo, expr, fDirichlet, fNeumann, fRobin, kpiMaxU, kpiMinU, kpiMaxAbsElem } from './comun';
import type { Plantilla1D } from './types';

export const EXACTA_CLASE = '0.1*x^3 + 0.006*x - 0.106*sinh(10*x)/sinh(10)';

export const general: Plantilla1D = {
  tipo: '1d',
  id: 'general',
  nombre: 'EDO general de 2.º orden',
  categoria: 'matematica',
  descripcion: 'La ecuación modelo −(k u′)′ + b u′ + c u = f con coeficientes escritos directamente, por tramos y con cualquier frontera.',
  icono: 'function',
  ecuacion: String.raw`-\frac{d}{dx}\left[k(x)\,\frac{du}{dx}\right] + b(x)\,\frac{du}{dx} + c(x)\,u = f(x)`,
  sistemas: ['SI'],
  unidadLongitud: '',
  camposTramo: [
    expr('k', 'k(x)', 'Coeficiente de difusión', '', '1', { positivo: true }),
    expr('b', 'b(x)', 'Coeficiente de convección', '', '0'),
    expr('c', 'c(x)', 'Coeficiente de reacción', '', '0'),
    expr('f', 'f(x)', 'Término fuente', '', '0'),
  ],
  camposGlobales: [],
  coeficientes: (v) => ({ k: v.k, b: v.b, c: v.c, f: v.f }),
  traduccion: { k: 'k(x)', b: 'b(x)', c: 'c(x)', f: 'f(x)' },
  fronteras: [
    fDirichlet('dirichlet', 'Dirichlet', 'u', '', '0', 'Valor impuesto: u = ū.'),
    fNeumann('neumann', 'Neumann', campo('q', 'q', 'Flujo k·∂u/∂n', '', '0'), undefined, 'k·∂u/∂n = q, con n la normal exterior (n = −1 en x0, n = +1 en xL).'),
    fRobin(
      'robin',
      'Robin',
      [campo('h', 'h', 'Coeficiente h', '', '1'), campo('g', 'g', 'Valor g', '', '0')],
      (v) => ({ h: v.h, g: v.g }),
      (v) => `k·∂u/∂n + ${fmt(v.h)}·u = ${fmt(v.g)}`,
      'k·∂u/∂n + h·u = g.',
    ),
  ],
  incognita: { id: 'u', simbolo: 'u', nombre: 'Solución', unidad: '' },
  derivada: { id: 'du', simbolo: "u'", nombre: 'Derivada', unidad: '' },
  derivadas: [
    { id: 'du', simbolo: "u'", nombre: 'Derivada u′', unidad: '', calc: (c) => c.du },
    { id: 'flujo', simbolo: "k·u'", nombre: 'Flujo k·u′', unidad: '', calc: (c) => c.kdu },
  ],
  reaccion: { id: 'R', simbolo: 'k∂u/∂n', nombre: 'Flujo en el apoyo k·∂u/∂n', unidad: '' },
  cargaPuntual: { id: 'P', simbolo: 'P', nombre: 'Fuente puntual', unidad: '' },
  kpis: [
    kpiMaxU('umax', 'u_max', 'Valor máximo de u', ''),
    kpiMinU('umin', 'u_min', 'Valor mínimo de u', ''),
    kpiMaxAbsElem('du', 'dumax', "|u'|_max", 'Derivada máxima', ''),
  ],
  ejemplos: [
    {
      id: 'clase',
      nombre: 'Ejemplo de clase: −u″ + 100u = 10x³',
      descripcion: 'u(0) = u(1) = 0 con 3 elementos. Solución: u = 0.1x³ + 0.006x − 0.106·sinh(10x)/sinh(10).',
      estado: {
        x0: '0',
        xL: '1',
        tramos: [{ fin: '1', valores: { k: '1', b: '0', c: '100', f: '10*x^3' } }],
        izquierda: { opcion: 'dirichlet', valores: { valor: '0' } },
        derecha: { opcion: 'dirichlet', valores: { valor: '0' } },
        malla: { tipo: 'uniforme', ne: 3, ratio: 4, hacia: 'derecha', nodos: '' },
        exacta: EXACTA_CLASE,
      },
    },
    {
      id: 'conveccion-difusion',
      nombre: 'Convección-difusión: −u″ + 40u′ = 0',
      descripcion: 'Capa límite cerca de x = 1: con 10 elementos el Péclet de malla es 2 y la solución oscila. Prueba refinar o usar la malla geométrica hacia la derecha.',
      estado: {
        x0: '0',
        xL: '1',
        tramos: [{ fin: '1', valores: { k: '1', b: '40', c: '0', f: '0' } }],
        izquierda: { opcion: 'dirichlet', valores: { valor: '0' } },
        derecha: { opcion: 'dirichlet', valores: { valor: '1' } },
        malla: { tipo: 'uniforme', ne: 10, ratio: 4, hacia: 'derecha', nodos: '' },
      },
    },
    {
      id: 'k-variable',
      nombre: 'Coeficiente variable: −((1 + x)u′)′ = 1',
      descripcion: 'u(0) = u(1) = 0. Solución: u = ln(1 + x)/ln 2 − x.',
      estado: {
        x0: '0',
        xL: '1',
        tramos: [{ fin: '1', valores: { k: '1 + x', b: '0', c: '0', f: '1' } }],
        izquierda: { opcion: 'dirichlet', valores: { valor: '0' } },
        derecha: { opcion: 'dirichlet', valores: { valor: '0' } },
        malla: { tipo: 'uniforme', ne: 4, ratio: 4, hacia: 'derecha', nodos: '' },
        exacta: 'log(1 + x)/log(2) - x',
      },
    },
    {
      id: 'robin',
      nombre: 'Fronteras mixtas: Neumann y Robin',
      descripcion: '−u″ + u = 1 con −u′(0) = 1 y u′(1) + 2u(1) = 0.',
      estado: {
        x0: '0',
        xL: '1',
        tramos: [{ fin: '1', valores: { k: '1', b: '0', c: '1', f: '1' } }],
        izquierda: { opcion: 'neumann', valores: { q: '1' } },
        derecha: { opcion: 'robin', valores: { h: '2', g: '0' } },
        malla: { tipo: 'uniforme', ne: 6, ratio: 4, hacia: 'derecha', nodos: '' },
      },
    },
  ],
};
