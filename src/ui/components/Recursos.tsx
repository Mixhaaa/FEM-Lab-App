/** Contenido de referencia: formulario de matrices elementales y glosario. */
import { gaussRule } from '../../core';
import { fmtFijo } from '../format';
import { Desplazable, Tabla } from './base';
import { Tex } from './Tex';

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-inset p-3">
      <p className="mb-1 text-detalle font-semibold text-accent-soft">{titulo}</p>
      <Desplazable etiqueta={titulo} className="text-cuerpo text-ink">
        {children}
      </Desplazable>
    </div>
  );
}

export function Formulario() {
  return (
    <div className="flex flex-col gap-3">
      <Bloque titulo="Elemento lineal general (k, b, c, f constantes)">
        <Tex display>{String.raw`\mathbf{K}^e = \frac{k}{h}\begin{bmatrix}1&-1\\-1&1\end{bmatrix} + \frac{b}{2}\begin{bmatrix}-1&1\\-1&1\end{bmatrix} + \frac{c\,h}{6}\begin{bmatrix}2&1\\1&2\end{bmatrix}`}</Tex>
        <Tex display>{String.raw`\mathbf{F}^e = \frac{f\,h}{2}\begin{bmatrix}1\\1\end{bmatrix}`}</Tex>
      </Bloque>
      <Bloque titulo="Elemento cuadrático (3 nodos: inicio, centro, fin)">
        <Tex display>{String.raw`N_1 = \tfrac{1}{2}\xi(\xi - 1),\quad N_2 = 1 - \xi^2,\quad N_3 = \tfrac{1}{2}\xi(\xi + 1),\qquad x = x_m + \tfrac{h}{2}\,\xi`}</Tex>
        <Tex display>{String.raw`\mathbf{K}^e = \frac{k}{3h}\begin{bmatrix}7&-8&1\\-8&16&-8\\1&-8&7\end{bmatrix} + \frac{b}{6}\begin{bmatrix}-3&4&-1\\-4&0&4\\1&-4&3\end{bmatrix} + \frac{c\,h}{30}\begin{bmatrix}4&2&-1\\2&16&2\\-1&2&4\end{bmatrix}`}</Tex>
        <Tex display>{String.raw`\mathbf{F}^e = \frac{f\,h}{6}\begin{bmatrix}1\\4\\1\end{bmatrix}`}</Tex>
      </Bloque>
      <Bloque titulo="Coeficientes variables (cuadratura de Gauss)">
        <Tex display>{String.raw`K^e_{ij} = \sum_{g} w_g\left[k\,N_i'N_j' + b\,N_i N_j' + c\,N_i N_j\right]_{x_g}\frac{h}{2}`}</Tex>
        <Tex display>{String.raw`F^e_i = \sum_g w_g\,f(x_g)\,N_i(x_g)\,\frac{h}{2},\qquad x_g = \frac{x_1+x_2}{2} + \frac{h}{2}\,\xi_g`}</Tex>
      </Bloque>
      <Bloque titulo="Barra con carga axial">
        <Tex display>{String.raw`\mathbf{k}^e = \frac{EA}{L}\begin{bmatrix}1&-1\\-1&1\end{bmatrix},\qquad \sigma = E\,\frac{u_2-u_1}{L}`}</Tex>
      </Bloque>
      <Bloque titulo="Barra de armadura 2D (c = cos θ, s = sen θ)">
        <Tex display>{String.raw`\mathbf{k}^e = \frac{EA}{L}\begin{bmatrix} c^2 & cs & -c^2 & -cs\\ cs & s^2 & -cs & -s^2\\ -c^2 & -cs & c^2 & cs\\ -cs & -s^2 & cs & s^2\end{bmatrix}`}</Tex>
        <Tex display>{String.raw`N = \frac{EA}{L}\begin{bmatrix}-c & -s & c & s\end{bmatrix}\mathbf{u}^e`}</Tex>
      </Bloque>
      <Bloque titulo="Resorte">
        <Tex display>{String.raw`\mathbf{k}^e = k\begin{bmatrix}1&-1\\-1&1\end{bmatrix},\qquad f = k\,(u_j - u_i)`}</Tex>
      </Bloque>
      <Bloque titulo="Puntos y pesos de Gauss-Legendre en [−1, 1]">
        <Tabla
          cabecera={['n', 'ξ', 'w']}
          alinear={['center', 'right', 'right']}
          filas={[1, 2, 3].flatMap((n) => {
            const r = gaussRule(n);
            return r.xi.map((x, i) => [i === 0 ? String(n) : '', fmtFijo(x, 6), fmtFijo(r.w[i], 6)]);
          })}
        />
        <p className="mt-2 text-mini text-ink-2">Con n puntos se integran exactamente polinomios de grado 2n − 1. La app admite de 1 a 5 puntos.</p>
      </Bloque>
      <Bloque titulo="Fronteras (normal exterior n)">
        <Tex display>{String.raw`\text{Neumann: } k\frac{\partial u}{\partial n} = q \;\Rightarrow\; F_{\text{ext}} \mathrel{+}= q`}</Tex>
        <Tex display>{String.raw`\text{Robin: } k\frac{\partial u}{\partial n} + h\,u = g \;\Rightarrow\; K_{\text{ext}} \mathrel{+}= h,\; F_{\text{ext}} \mathrel{+}= g`}</Tex>
        <Tex display>{String.raw`\text{Penalización: } K_{ii} \mathrel{+}= \beta,\; F_i \mathrel{+}= \beta\,\bar u,\quad \beta = 10^{p}\max|K_{ii}|`}</Tex>
      </Bloque>
    </div>
  );
}

const GLOSARIO: [string, string][] = [
  [String.raw`x_0,\ x_L`, 'Extremos del dominio.'],
  [String.raw`N_e,\ h_e`, 'Número de elementos y longitud del elemento e.'],
  [String.raw`N_1(x),\ N_2(x)`, 'Funciones de forma lineales ("sombrero") del elemento: valen 1 en su nodo y 0 en el otro.'],
  [String.raw`N_1,\ N_2,\ N_3`, 'Funciones de forma cuadráticas: parábolas que valen 1 en su nodo (inicio, centro o fin) y 0 en los otros dos.'],
  [String.raw`\xi \in [-1, 1]`, 'Coordenada natural del elemento; x = x_m + (h/2)ξ.'],
  [String.raw`J = h/2`, 'Jacobiano de la transformación: dx = J dξ.'],
  [String.raw`\mathbf{K}^e,\ \mathbf{F}^e`, 'Matriz y vector elementales (2×2 y 2×1 en 1D).'],
  [String.raw`\mathbf{K},\ \mathbf{F}`, 'Matriz de rigidez global y vector de cargas global (Kglob y Vglob en MATLAB).'],
  ['\\text{Mnod},\\ \\text{Melem}', 'Tabla de nodos (número, coordenada) y tabla de conectividad (elemento, nodo 1, nodo 2).'],
  [String.raw`\bar u`, 'Valor prescrito en una frontera Dirichlet.'],
  [String.raw`\beta`, 'Número de penalización: un número grande que obliga a u_i ≈ ū.'],
  [String.raw`R = k\,\partial u/\partial n`, 'Reacción en un apoyo: lo que el apoyo aporta al dominio (fuerza hacia +x, calor que entra, ...).'],
  [String.raw`Pe = |b|h/(2k)`, 'Número de Péclet de malla; si es mayor que 1, la solución puede oscilar.'],
  [String.raw`\|e\|_{L^2},\ |e|_{H^1}`, 'Normas del error: disminuyen como h² y h con elementos lineales, y como h³ y h² con cuadráticos.'],
];

export function Glosario() {
  return (
    <div className="flex flex-col divide-y divide-line rounded-xl border border-line bg-inset">
      {GLOSARIO.map(([s, d]) => (
        <div key={s} className="flex items-start gap-3 px-3 py-3">
          <span className="w-32 shrink-0 text-accent-soft">
            <Tex>{s}</Tex>
          </span>
          <span className="text-detalle leading-snug text-ink-2">{d}</span>
        </div>
      ))}
    </div>
  );
}
