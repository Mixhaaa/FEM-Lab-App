import { useState, type ReactNode } from 'react';
import { compileExpr, type BoundaryCondition } from '../../core';
import { unidad, type Resultado1D } from '../../templates';
import { Aviso, Badge, Boton, Card, cx, Desplazable, Icon, PanelPestanas, Pildoras, Selector, Tabla } from '../components/base';
import { MatrizTabla, VectorTabla } from '../components/Matriz';
import { ListaPasos } from '../components/ListaPasos';
import { Pagina, TituloPagina } from '../components/Shell';
import { Tex, texMatriz, texNum, texVector } from '../components/Tex';
import { fmtFijo, fmtNum, sub } from '../format';
import { useAvanzar } from '../presentacion';
import { useResultado1D } from '../resultado';
import { SinResultado } from './Resultados';

const PASOS = [
  { id: 'problema', titulo: 'Problema', icon: 'flag' },
  { id: 'debil', titulo: 'Forma débil', icon: 'integration_instructions' },
  { id: 'malla', titulo: 'Discretización', icon: 'straighten' },
  { id: 'forma', titulo: 'Funciones de forma', icon: 'show_chart' },
  { id: 'elemental', titulo: 'Ke y Fe', icon: 'grid_4x4' },
  { id: 'ensamblaje', titulo: 'Ensamblaje', icon: 'join' },
  { id: 'fronteras', titulo: 'Fronteras', icon: 'border_all' },
  { id: 'solucion', titulo: 'Solución', icon: 'calculate' },
  { id: 'posproceso', titulo: 'Posproceso', icon: 'insights' },
] as const;
type PasoId = (typeof PASOS)[number]['id'];

const ACC = '#E06D32';
const hl = (s: string) => `\\textcolor{${ACC}}{${s}}`;

/** Convierte una expresión de math.js a LaTeX. */
export function exprTex(src: string): string {
  try {
    return compileExpr(src).node.toTex({ parenthesis: 'auto', implicit: 'hide' });
  } catch {
    return `\\text{${src.replace(/[{}\\]/g, '')}}`;
  }
}

const xTex = (x: number) => texNum(x, 6);

export function bcTex(bc: BoundaryCondition, x: number): string {
  if (bc.type === 'dirichlet') return `u(${xTex(x)}) = ${texNum(bc.value, 6)}`;
  if (bc.type === 'neumann') return `\\left.k\\,\\frac{\\partial u}{\\partial n}\\right|_{x=${xTex(x)}} = ${texNum(bc.q, 6)}`;
  return `\\left.\\left(k\\,\\frac{\\partial u}{\\partial n} + ${texNum(bc.h, 6)}\\,u\\right)\\right|_{x=${xTex(x)}} = ${texNum(bc.g, 6)}`;
}

function Paso({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent font-mono text-cuerpo font-bold text-on-accent">{n}</span>
        <h2 className="font-heading text-seccion font-bold text-ink">{titulo}</h2>
      </div>
      <div className="flex flex-col gap-3 text-cuerpo leading-relaxed text-ink">{children}</div>
    </Card>
  );
}

function Formula({ children, titulo }: { children: string; titulo?: string }) {
  return (
    <div className="rounded-xl border border-line bg-inset px-3 py-2">
      {titulo && <p className="mb-1 text-detalle font-semibold text-accent-soft">{titulo}</p>}
      <Desplazable etiqueta={titulo ?? 'Fórmula'} className="text-detalle text-ink sm:text-cuerpo">
        <Tex display>{children}</Tex>
      </Desplazable>
    </div>
  );
}

const P = ({ children }: { children: ReactNode }) => <p className="text-detalle leading-relaxed text-ink-2">{children}</p>;

export function Paso1D() {
  const r = useResultado1D();
  const [paso, setPaso] = useState<PasoId>('problema');
  const [elem, setElem] = useState(0);
  useAvanzar((d) =>
    setPaso((p) => {
      const i = PASOS.findIndex((x) => x.id === p);
      return PASOS[Math.min(PASOS.length - 1, Math.max(0, i + d))].id;
    }),
  );
  if (!r.ok) return <SinResultado error={r.error} />;
  const res = r.res;
  const ne = res.sol.elements.length;
  const e = Math.min(elem, ne - 1);
  const idx = PASOS.findIndex((p) => p.id === paso);
  const usaElemento = ['forma', 'elemental', 'ensamblaje', 'posproceso'].includes(paso);

  return (
    <Pagina amplia>
      <TituloPagina
        etiquetas={
          <>
            <Badge>Modo didáctico</Badge>
            <Badge tono="neutral">{res.plantilla.nombre}</Badge>
          </>
        }
        titulo="Solución paso a paso"
        subtitulo="Cada paso usa los números de tu problema. Cambia los datos en Configuración y todo se recalcula."
      />
      <div className="sticky top-16 z-40 -mx-4 lg:-mx-8 lg:px-8 flex flex-col gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur-md">
        <div className="lg:hidden">
          <Pildoras base="pasos" etiqueta="Pasos" value={paso} onChange={setPaso} opciones={PASOS.map((p, i) => ({ valor: p.id, texto: `${i + 1}. ${p.titulo}` }))} />
        </div>
        {usaElemento && (
          <Selector
            etiqueta="Elemento que se explica"
            value={e}
            onChange={setElem}
            opciones={res.sol.elements.map((el, i) => ({ valor: i, texto: `Elemento e${sub(i + 1)}: nodos ${el.nodes[0] + 1}–${el.nodes[1] + 1}, x ∈ [${fmtNum(el.xa)}, ${fmtNum(el.xb)}]` }))}
          />
        )}
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <ListaPasos pasos={PASOS} actual={paso} onChange={setPaso} />
        <PanelPestanas base="pasos" valor={paso}>
      {paso === 'problema' && <PasoProblema res={res} />}
      {paso === 'debil' && <PasoDebil res={res} />}
      {paso === 'malla' && <PasoMalla res={res} />}
      {paso === 'forma' && <PasoForma res={res} e={e} />}
      {paso === 'elemental' && <PasoElemental res={res} e={e} />}
      {paso === 'ensamblaje' && <PasoEnsamblaje res={res} e={e} />}
      {paso === 'fronteras' && <PasoFronteras res={res} />}
      {paso === 'solucion' && <PasoSolucion res={res} />}
      {paso === 'posproceso' && <PasoPosproceso res={res} e={e} />}

      <div className="flex items-center justify-between gap-2">
        <Boton variante="secundario" icon="chevron_left" disabled={idx === 0} onClick={() => setPaso(PASOS[idx - 1].id)}>
          Anterior
        </Boton>
        <span className="font-mono text-mini text-ink-2">
          {idx + 1} / {PASOS.length}
        </span>
        <Boton variante="primario" disabled={idx === PASOS.length - 1} onClick={() => setPaso(PASOS[idx + 1].id)}>
          Siguiente <Icon name="chevron_right" className="text-[18px]" />
        </Boton>
      </div>
        </PanelPestanas>
      </div>
    </Pagina>
  );
}

function PasoProblema({ res }: { res: Resultado1D }) {
  const t = res.plantilla;
  const p = res.problem;
  return (
    <Paso n={1} titulo="Planteamiento del problema">
      <P>Ecuación gobernante de la plantilla «{t.nombre}»:</P>
      <Formula>{t.ecuacion}</Formula>
      <P>Se escribe como el problema modelo que resuelve FEM Lab:</P>
      <Formula>{String.raw`-\frac{d}{dx}\left(k(x)\,\frac{du}{dx}\right) + b(x)\,\frac{du}{dx} + c(x)\,u = f(x), \qquad x\in[${xTex(p.x0)},\,${xTex(p.xL)}]`}</Formula>
      {t.id !== 'general' && (
        <div className="grid grid-cols-2 gap-1 text-cuerpo">
          {(['k', 'b', 'c', 'f'] as const).map((k) => (
            <Tex key={k}>{`${k} = ${t.traduccion[k]}`}</Tex>
          ))}
        </div>
      )}
      {p.regions.map((rg, i) => (
        <Formula key={i} titulo={p.regions.length > 1 ? `${rg.nombre ?? `Tramo ${i + 1}`}: x ∈ [${fmtNum(rg.x0)}, ${fmtNum(rg.x1)}]` : 'Coeficientes con tus datos'}>
          {String.raw`\begin{aligned} k(x) &= ${exprTex(rg.k)} & b(x) &= ${exprTex(rg.b)} \\ c(x) &= ${exprTex(rg.c)} & f(x) &= ${exprTex(rg.f)} \end{aligned}`}
        </Formula>
      ))}
      <P>Condiciones de frontera (n es la normal exterior: n = −1 en x₀ y n = +1 en xL, así que ∂u/∂n = −u′ en x₀ y ∂u/∂n = u′ en xL):</P>
      <Formula>{String.raw`${bcTex(p.bcLeft, p.x0)} \qquad ${bcTex(p.bcRight, p.xL)}`}</Formula>
      {p.loads.length > 0 && (
        <>
          <P>Cargas puntuales (se suman directamente al vector F en el nodo correspondiente):</P>
          <Formula>{p.loads.map((l) => `P = ${texNum(l.P, 5)} \\text{ en } x = ${xTex(l.x)}`).join(',\\quad ')}</Formula>
        </>
      )}
    </Paso>
  );
}

function PasoDebil({ res }: { res: Resultado1D }) {
  const p = res.problem;
  const extremos = [
    { bc: p.bcLeft, x: p.x0, nombre: 'x_0' },
    { bc: p.bcRight, x: p.xL, nombre: 'x_L' },
  ];
  let lhs = String.raw`\int_{x_0}^{x_L}\left(k\,u'\,v' + b\,u'\,v + c\,u\,v\right)dx`;
  let rhs = String.raw`\int_{x_0}^{x_L} f\,v\,dx`;
  for (const { bc, nombre } of extremos) {
    if (bc.type === 'neumann' && bc.q !== 0) rhs += ` + ${texNum(bc.q, 5)}\\,v(${nombre})`;
    if (bc.type === 'robin') {
      lhs += ` + ${texNum(bc.h, 5)}\\,u(${nombre})\\,v(${nombre})`;
      if (bc.g !== 0) rhs += ` + ${texNum(bc.g, 5)}\\,v(${nombre})`;
    }
  }
  if (p.loads.length) rhs += String.raw` + \sum_i P_i\,v(x_i)`;
  return (
    <Paso n={2} titulo="Formulación débil (Galerkin)">
      <P>Se multiplica la ecuación por una función de prueba v(x) y se integra en el dominio:</P>
      <Formula>{String.raw`\int_{x_0}^{x_L}\left[-(k\,u')'\,v + b\,u'\,v + c\,u\,v\right]dx = \int_{x_0}^{x_L} f\,v\,dx`}</Formula>
      <P>Integrando por partes el primer término, la segunda derivada pasa a la función de prueba y aparecen términos de frontera:</P>
      <Formula>{String.raw`-\int_{x_0}^{x_L}(k\,u')'\,v\,dx = \int_{x_0}^{x_L} k\,u'\,v'\,dx - \Big[k\,u'\,v\Big]_{x_0}^{x_L} = \int_{x_0}^{x_L} k\,u'\,v'\,dx - \left.k\frac{\partial u}{\partial n}v\right|_{x_0} - \left.k\frac{\partial u}{\partial n}v\right|_{x_L}`}</Formula>
      <P>Cada extremo se trata según su condición de frontera:</P>
      <ul className="flex flex-col gap-2">
        {extremos.map(({ bc, nombre }) => (
          <li key={nombre} className="rounded-lg border border-line bg-inset p-3 text-detalle text-ink-2">
            <b className="text-ink">
              <Tex>{nombre}</Tex>:{' '}
            </b>
            {bc.type === 'dirichlet' && (
              <>
                Dirichlet (esencial). Se elige v({nombre === 'x_0' ? 'x₀' : 'xL'}) = 0, así que el término de frontera desaparece; u = {fmtNum(bc.value)} se impone al final.
              </>
            )}
            {bc.type === 'neumann' && (
              <>
                Neumann (natural). Se reemplaza <Tex>{String.raw`k\,\partial u/\partial n`}</Tex> por q = {fmtNum(bc.q)}: aparece en el lado derecho.
              </>
            )}
            {bc.type === 'robin' && (
              <>
                Robin (natural). Se reemplaza <Tex>{String.raw`k\,\partial u/\partial n = g - h\,u`}</Tex> con h = {fmtNum(bc.h)} y g = {fmtNum(bc.g)}: <Tex>{'h\\,u\\,v'}</Tex> pasa al lado izquierdo y <Tex>{'g\\,v'}</Tex> al derecho.
              </>
            )}
          </li>
        ))}
      </ul>
      <Formula titulo="Forma débil de tu problema">{`${lhs} = ${rhs}`}</Formula>
      <P>Con Galerkin, la aproximación y la función de prueba usan las mismas funciones de forma:</P>
      <Formula>{String.raw`u_h(x) = \sum_{j=1}^{n} u_j\,N_j(x), \qquad v = N_i \;\Rightarrow\; \sum_j K_{ij}\,u_j = F_i`}</Formula>
      <Formula>{String.raw`K_{ij} = \int_{x_0}^{x_L}\left(k\,N_i'N_j' + b\,N_i N_j' + c\,N_i N_j\right)dx, \qquad F_i = \int_{x_0}^{x_L} f\,N_i\,dx + (\text{fronteras y cargas})`}</Formula>
    </Paso>
  );
}

function PasoMalla({ res }: { res: Resultado1D }) {
  const m = res.sol.mesh;
  const ul = unidad(res.plantilla.unidadLongitud, res.estado.sistema);
  const hs = res.sol.elements.map((el) => el.h);
  const uniforme = Math.max(...hs) - Math.min(...hs) < 1e-12 * Math.max(...hs);
  const lim = 30;
  return (
    <Paso n={3} titulo="Discretización del dominio">
      <P>
        El dominio se divide en N<sub>e</sub> = {m.elements.length} elementos lineales con {m.nodes.length} nodos.{' '}
        {uniforme ? `Todos los elementos miden h = ${fmtNum(hs[0])} ${ul}.` : `Los elementos miden entre ${fmtNum(Math.min(...hs))} y ${fmtNum(Math.max(...hs))} ${ul}.`}
      </P>
      {m.warnings.map((w) => (
        <Aviso key={w} tipo="info">
          {w}
        </Aviso>
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 font-mono text-mini font-bold text-ink-2">Mnod: tabla de nodos</p>
          <Tabla cabecera={['Nodo', `x ${ul ? `[${ul}]` : ''}`]} alinear={['left', 'right']} filas={m.nodes.slice(0, lim).map((x, i) => [i + 1, fmtNum(x, 6)])} />
        </div>
        <div>
          <p className="mb-1 font-mono text-mini font-bold text-ink-2">Melem: conectividad</p>
          <Tabla
            cabecera={['Elem.', 'Nodo 1', 'Nodo 2', 'h']}
            alinear={['left', 'center', 'center', 'right']}
            filas={m.elements.slice(0, lim).map(([a, b], i) => [i + 1, a + 1, b + 1, fmtNum(hs[i], 5)])}
          />
        </div>
      </div>
      {m.nodes.length > lim && <p className="text-mini text-ink-3">Se muestran las primeras {lim} filas.</p>}
      <P>La solución aproximada es una función lineal por tramos que vale u_i en cada nodo:</P>
      <Formula>{String.raw`u_h(x) = \sum_{i=1}^{${m.nodes.length}} u_i\,N_i(x)`}</Formula>
    </Paso>
  );
}

function SombreroSVG({ xa, xb }: { xa: number; xb: number }) {
  return (
    <svg viewBox="0 0 300 120" className="h-auto w-full max-w-sm" role="img" aria-label="Funciones de forma N1 y N2 del elemento">
      <line x1={30} x2={270} y1={95} y2={95} stroke="var(--line-strong)" />
      <line x1={30} x2={30} y1={20} y2={95} stroke="var(--line)" strokeDasharray="3 3" />
      <line x1={270} x2={270} y1={20} y2={95} stroke="var(--line)" strokeDasharray="3 3" />
      <polyline points="30,25 270,95" fill="none" stroke="var(--accent-hover)" strokeWidth={2.5} />
      <polyline points="30,95 270,25" fill="none" stroke="var(--amber)" strokeWidth={2.5} />
      <text x={36} y={20} fontSize={11} fill="var(--accent-soft)" fontFamily="var(--font-mono)">
        N₁
      </text>
      <text x={248} y={20} fontSize={11} fill="var(--amber-soft)" fontFamily="var(--font-mono)">
        N₂
      </text>
      <text x={30} y={112} textAnchor="middle" fontSize={10} fill="var(--ink-2)" fontFamily="var(--font-mono)">
        x₁={fmtNum(xa)}
      </text>
      <text x={270} y={112} textAnchor="middle" fontSize={10} fill="var(--ink-2)" fontFamily="var(--font-mono)">
        x₂={fmtNum(xb)}
      </text>
      <text x={20} y={28} textAnchor="end" fontSize={10} fill="var(--ink-3)" fontFamily="var(--font-mono)">
        1
      </text>
      <text x={20} y={98} textAnchor="end" fontSize={10} fill="var(--ink-3)" fontFamily="var(--font-mono)">
        0
      </text>
    </svg>
  );
}

function PasoForma({ res, e }: { res: Resultado1D; e: number }) {
  const el = res.sol.elements[e];
  const { xa, xb, h } = el;
  return (
    <Paso n={4} titulo={`Funciones de forma del elemento e${sub(e + 1)}`}>
      <P>
        En el elemento e{sub(e + 1)} (de x₁ = {fmtNum(xa)} a x₂ = {fmtNum(xb)}, h = {fmtNum(h)}) la solución es una recta. Se escribe con dos funciones de forma lineales, una por nodo:
      </P>
      <Formula>{String.raw`N_1(x) = \frac{x_2 - x}{h} = \frac{${xTex(xb)} - x}{${texNum(h, 6)}}, \qquad N_2(x) = \frac{x - x_1}{h} = \frac{x - ${xTex(xa)}}{${texNum(h, 6)}}`}</Formula>
      <div className="flex justify-center rounded-xl border border-line bg-inset p-2">
        <SombreroSVG xa={xa} xb={xb} />
      </div>
      <P>Cada una vale 1 en su nodo y 0 en el otro, y suman 1 en todo el elemento. Sus derivadas son constantes:</P>
      <Formula>{String.raw`N_1' = -\frac{1}{h} = ${texNum(-1 / h, 6)}, \qquad N_2' = \frac{1}{h} = ${texNum(1 / h, 6)}`}</Formula>
      <P>Para integrar con Gauss se usa la coordenada natural ξ ∈ [−1, 1]:</P>
      <Formula>{String.raw`x(\xi) = \frac{x_1 + x_2}{2} + \frac{h}{2}\,\xi = ${texNum((xa + xb) / 2, 6)} + ${texNum(h / 2, 6)}\,\xi, \qquad N_1 = \frac{1-\xi}{2}, \quad N_2 = \frac{1+\xi}{2}, \quad dx = \frac{h}{2}\,d\xi`}</Formula>
    </Paso>
  );
}

function constante(src: string): number | null {
  try {
    const c = compileExpr(src);
    return c.constant ? c.fn(0) : null;
  } catch {
    return null;
  }
}

function PasoElemental({ res, e }: { res: Resultado1D; e: number }) {
  const el = res.sol.elements[e];
  const rg = res.problem.regions[el.region];
  const tieneB = el.gauss.some((g) => g.b !== 0);
  const tieneC = el.gauss.some((g) => g.c !== 0);
  const kc = constante(rg.k);
  const bc = constante(rg.b);
  const cc = constante(rg.c);
  const fc = constante(rg.f);
  const ng = el.gauss.length;
  return (
    <Paso n={5} titulo={`Matriz Ke y vector Fe del elemento e${sub(e + 1)}`}>
      <P>Las integrales del elemento se calculan con {ng} punto(s) de Gauss:</P>
      <Formula>{String.raw`K^{e}_{ij} = \sum_{g=1}^{${ng}} w_g\left[k\,N_i'N_j' + b\,N_i N_j' + c\,N_i N_j\right]_{x_g}\frac{h}{2}, \qquad F^{e}_{i} = \sum_{g=1}^{${ng}} w_g\,f(x_g)\,N_i(x_g)\,\frac{h}{2}`}</Formula>
      <Tabla
        cabecera={['g', 'ξ_g', 'w_g', 'x_g', 'N₁', 'N₂', 'k', ...(tieneB ? ['b'] : []), ...(tieneC ? ['c'] : []), 'f']}
        alinear={Array(11).fill('right')}
        filas={el.gauss.map((g, i) => [
          i + 1,
          fmtFijo(g.xi, 6),
          fmtFijo(g.w, 6),
          fmtNum(g.x, 6),
          fmtNum(g.N[0], 5),
          fmtNum(g.N[1], 5),
          fmtNum(g.k, 5),
          ...(tieneB ? [fmtNum(g.b, 5)] : []),
          ...(tieneC ? [fmtNum(g.c, 5)] : []),
          fmtNum(g.f, 5),
        ])}
      />
      <P>Sumando las contribuciones de difusión (k){tieneB ? ', convección (b)' : ''}{tieneC ? ' y reacción (c)' : ''}:</P>
      <Formula>
        {[
          `\\begin{aligned}\\mathbf{K}^{e} &= \\underbrace{${texMatriz(el.KeK, 5)}}_{k}`,
          tieneB ? ` + \\underbrace{${texMatriz(el.KeB, 5)}}_{b}` : '',
          tieneC ? ` + \\underbrace{${texMatriz(el.KeC, 5)}}_{c}` : '',
          tieneB || tieneC ? ` \\\\ &= ${texMatriz(el.Ke, 5)}` : '',
          `\\end{aligned}`,
        ].join('')}
      </Formula>
      <Formula>{`\\mathbf{F}^{e} = ${texVector(el.Fe, 6)}`}</Formula>
      {kc !== null && bc !== null && cc !== null && (
        <>
          <P>Como k{tieneB ? ', b' : ''}{tieneC ? ', c' : ''} son constantes en este tramo, se puede comprobar con la fórmula cerrada:</P>
          <Formula>
            {String.raw`\begin{aligned}\mathbf{K}^e &= \frac{k}{h}\begin{bmatrix}1&-1\\-1&1\end{bmatrix}` +
              (tieneB ? String.raw` + \frac{b}{2}\begin{bmatrix}-1&1\\-1&1\end{bmatrix}` : '') +
              (tieneC ? String.raw` + \frac{c\,h}{6}\begin{bmatrix}2&1\\1&2\end{bmatrix}` : '') +
              ` \\\\ &= \\frac{${texNum(kc, 5)}}{${texNum(el.h, 5)}}\\begin{bmatrix}1&-1\\\\-1&1\\end{bmatrix}` +
              (tieneB ? ` + \\frac{${texNum(bc, 5)}}{2}\\begin{bmatrix}-1&1\\\\-1&1\\end{bmatrix}` : '') +
              (tieneC ? ` + \\frac{${texNum(cc, 5)}\\cdot ${texNum(el.h, 5)}}{6}\\begin{bmatrix}2&1\\\\1&2\\end{bmatrix}` : '') +
              ` \\\\ &= ${texMatriz(el.Ke, 5)} \\quad\\checkmark\\end{aligned}`}
          </Formula>
          {fc !== null && (
            <Formula>{String.raw`\mathbf{F}^e = \frac{f\,h}{2}\begin{bmatrix}1\\1\end{bmatrix} = \frac{${texNum(fc, 5)}\cdot ${texNum(el.h, 5)}}{2}\begin{bmatrix}1\\1\end{bmatrix} = ${texVector([(fc * el.h) / 2, (fc * el.h) / 2], 6)}`}</Formula>
          )}
        </>
      )}
      {fc === null && <P>Como f varía con x, Fe no es simplemente f·h/2: la cuadratura de Gauss pesa f con N₁ y N₂ en cada punto.</P>}
    </Paso>
  );
}

function PasoEnsamblaje({ res, e }: { res: Resultado1D; e: number }) {
  const el = res.sol.elements[e];
  const [i, j] = el.nodes;
  const resaltar = new Set([`${i},${i}`, `${i},${j}`, `${j},${i}`, `${j},${j}`]);
  const n = res.sol.mesh.nodes.length;
  return (
    <Paso n={6} titulo="Ensamblaje de la matriz global">
      <P>
        Cada matriz elemental se suma en las filas y columnas de sus nodos globales. Para e{sub(e + 1)}, Ke va a las posiciones ({i + 1}, {j + 1}). En los nodos compartidos se suman las contribuciones de los dos elementos vecinos; por eso K es tridiagonal.
      </P>
      <Formula>{String.raw`K_{${i + 1},${i + 1}} \mathrel{+}= ${texNum(el.Ke[0][0], 5)}, \quad K_{${i + 1},${j + 1}} \mathrel{+}= ${texNum(el.Ke[0][1], 5)}, \quad K_{${j + 1},${i + 1}} \mathrel{+}= ${texNum(el.Ke[1][0], 5)}, \quad K_{${j + 1},${j + 1}} \mathrel{+}= ${texNum(el.Ke[1][1], 5)}`}</Formula>
      <Formula>{String.raw`F_{${i + 1}} \mathrel{+}= ${texNum(el.Fe[0], 5)}, \qquad F_{${j + 1}} \mathrel{+}= ${texNum(el.Fe[1], 5)}`}</Formula>
      <MatrizTabla M={res.sol.Kassembled} titulo={`K ensamblada (${n}×${n}); en color, el aporte de e${sub(e + 1)}`} resaltar={resaltar} max={24} />
      <VectorTabla v={res.sol.Fassembled} titulo="F ensamblado (solo carga distribuida)" resaltar={new Set([i, j])} />
      {n > 24 && <p className="text-mini text-ink-3">Se muestran las primeras 24 filas y columnas.</p>}
    </Paso>
  );
}

function PasoFronteras({ res }: { res: Resultado1D }) {
  const p = res.problem;
  const sol = res.sol;
  const n = sol.mesh.nodes.length;
  const ext = [
    { bc: p.bcLeft, i: 0, x: p.x0 },
    { bc: p.bcRight, i: n - 1, x: p.xL },
  ];
  const dir = ext.filter((x) => x.bc.type === 'dirichlet');
  const modK = new Set<string>();
  const modF = new Set<number>();
  for (const { bc, i } of ext) {
    if (bc.type === 'robin') {
      modK.add(`${i},${i}`);
      modF.add(i);
    }
    if (bc.type === 'neumann') modF.add(i);
  }
  const nodeAt = (x: number) => sol.mesh.nodes.findIndex((v) => Math.abs(v - x) < 1e-9 * (p.xL - p.x0));
  for (const l of p.loads) modF.add(nodeAt(l.x));
  return (
    <Paso n={7} titulo="Cargas puntuales y condiciones de frontera">
      <P>Primero se agregan las condiciones naturales (Neumann y Robin) y las cargas puntuales:</P>
      <ul className="flex flex-col gap-2">
        {ext.map(({ bc, i }) => (
          <li key={i} className="rounded-lg border border-line bg-inset px-3 py-2">
            {bc.type === 'dirichlet' && <Tex>{`\\text{Nodo } ${i + 1}: \\text{ Dirichlet } u_{${i + 1}} = ${texNum(bc.value, 6)} \\text{ (se impone después)}`}</Tex>}
            {bc.type === 'neumann' && <Tex>{`\\text{Nodo } ${i + 1}: \\; F_{${i + 1}} \\mathrel{+}= q = ${texNum(bc.q, 6)}`}</Tex>}
            {bc.type === 'robin' && <Tex>{`\\text{Nodo } ${i + 1}: \\; K_{${i + 1},${i + 1}} \\mathrel{+}= h = ${texNum(bc.h, 6)}, \\quad F_{${i + 1}} \\mathrel{+}= g = ${texNum(bc.g, 6)}`}</Tex>}
          </li>
        ))}
        {p.loads.map((l, k) => (
          <li key={`P${k}`} className="rounded-lg border border-line bg-inset px-3 py-2">
            <Tex>{`\\text{Nodo } ${nodeAt(l.x) + 1}\\ (x = ${xTex(l.x)}): \\; F \\mathrel{+}= P = ${texNum(l.P, 6)}`}</Tex>
          </li>
        ))}
      </ul>
      {(modK.size > 0 || modF.size > 0) && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <MatrizTabla M={sol.K} titulo="K con fronteras naturales" resaltar={modK} max={24} />
          <VectorTabla v={sol.F} titulo="F" resaltar={modF} />
        </div>
      )}
      {dir.length === 0 && <P>No hay condiciones Dirichlet: el sistema ya es no singular gracias a Robin o a c(x) &gt; 0.</P>}
      {dir.length > 0 && sol.bcMethod === 'eliminacion' && (
        <>
          <P>
            Condiciones Dirichlet por <b className="text-ink">eliminación</b>: se quitan las filas y columnas de los nodos {dir.map((d) => d.i + 1).join(' y ')} y su efecto pasa al lado derecho:
          </P>
          <Formula>{String.raw`F_i \leftarrow F_i - \sum_{d} K_{i d}\,\bar u_d \qquad (i \text{ libre},\; d \text{ con Dirichlet})`}</Formula>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <MatrizTabla M={sol.system.K} titulo={`Sistema reducido (${sol.system.K.length}×${sol.system.K.length})`} filas={sol.system.free.map((i) => i + 1)} columnas={sol.system.free.map((i) => i + 1)} max={24} />
            <VectorTabla v={sol.system.F} titulo="F reducido" etiquetas={sol.system.free.map((i) => i + 1)} />
          </div>
        </>
      )}
      {dir.length > 0 && sol.bcMethod === 'penalizacion' && (
        <>
          <P>
            Condiciones Dirichlet por <b className="text-ink">penalización</b>, como en el código de clase: se suma un número muy grande β en la diagonal.
          </P>
          <Formula>{String.raw`\beta = 10^{${res.problem.penaltyExp}}\cdot\max_i|K_{ii}| = ${texNum(sol.beta ?? 0, 5)}, \qquad K_{dd} \mathrel{+}= \beta, \quad F_d \mathrel{+}= \beta\,\bar u_d`}</Formula>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <MatrizTabla M={sol.system.K} titulo="K penalizada" resaltar={new Set(dir.map((d) => `${d.i},${d.i}`))} max={24} />
            <VectorTabla v={sol.system.F} titulo="F penalizado" resaltar={new Set(dir.map((d) => d.i))} />
          </div>
          <P>La fila d queda dominada por β, así que u_d ≈ ū_d con un error del orden de 1/10^p.</P>
        </>
      )}
    </Paso>
  );
}

/** Pasos intermedios del algoritmo de Thomas (para mostrarlos en una tabla). */
function thomasPasos(A: number[][], d: number[]) {
  const n = A.length;
  const a = A.map((r, i) => (i > 0 ? r[i - 1] : 0));
  const b = A.map((r, i) => r[i]);
  const c = A.map((r, i) => (i < n - 1 ? r[i + 1] : 0));
  const cp: number[] = [];
  const dp: number[] = [];
  for (let i = 0; i < n; i++) {
    const m = i === 0 ? b[0] : b[i] - a[i] * cp[i - 1];
    cp.push(i < n - 1 ? c[i] / m : 0);
    dp.push(i === 0 ? d[0] / m : (d[i] - a[i] * dp[i - 1]) / m);
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) x[i] = dp[i] - (i < n - 1 ? cp[i] * x[i + 1] : 0);
  return { a, b, c, cp, dp, x };
}

function PasoSolucion({ res }: { res: Resultado1D }) {
  const sol = res.sol;
  const S = sol.system;
  const t = res.plantilla;
  const th = sol.solverUsed === 'thomas' && S.K.length <= 20 && S.K.length > 0 ? thomasPasos(S.K, S.F) : null;
  const etiquetas = S.free.map((i) => i + 1);
  return (
    <Paso n={8} titulo="Solución del sistema K·u = F">
      {sol.solverUsed === 'thomas' ? (
        <>
          <P>
            K es tridiagonal y diagonalmente dominante, así que se usa el <b className="text-ink">algoritmo de Thomas</b> (eliminación gaussiana especializada, O(n) operaciones). Con a = subdiagonal, b = diagonal y c = superdiagonal:
          </P>
          <Formula>{String.raw`c_1' = \frac{c_1}{b_1},\quad d_1' = \frac{d_1}{b_1}, \qquad c_i' = \frac{c_i}{b_i - a_i c_{i-1}'},\quad d_i' = \frac{d_i - a_i d_{i-1}'}{b_i - a_i c_{i-1}'}`}</Formula>
          <Formula>{String.raw`u_n = d_n', \qquad u_i = d_i' - c_i'\,u_{i+1}`}</Formula>
          {th && (
            <Tabla
              cabecera={['Nodo', 'a', 'b', 'c', 'd', "c′", "d′", 'u']}
              alinear={Array(8).fill('right')}
              filas={th.b.map((_, i) => [etiquetas[i], fmtNum(th.a[i], 5), fmtNum(th.b[i], 5), fmtNum(th.c[i], 5), fmtNum(S.F[i], 5), fmtNum(th.cp[i], 5), fmtNum(th.dp[i], 5), fmtNum(th.x[i], 6)])}
            />
          )}
        </>
      ) : (
        <P>
          Se usa <b className="text-ink">eliminación gaussiana con pivoteo parcial</b>: se hacen ceros debajo de la diagonal fila por fila (eligiendo el pivote más grande de cada columna) y luego se resuelve por sustitución regresiva.
        </P>
      )}
      <P>Resultado: {t.incognita.nombre.toLowerCase()} en cada nodo{sol.bcMethod === 'eliminacion' ? ' (los nodos Dirichlet toman su valor prescrito)' : ''}.</P>
      <VectorTabla v={sol.u} titulo={`u (${sol.u.length} nodos)`} etiquetas={sol.u.map((_, i) => `u${sub(i + 1)}`)} sig={6} />
      <Formula>{String.raw`\|\mathbf{K}\mathbf{u} - \mathbf{F}\| = ${texNum(sol.residualNorm, 3)}`}</Formula>
    </Paso>
  );
}

function PasoPosproceso({ res, e }: { res: Resultado1D; e: number }) {
  const sol = res.sol;
  const t = res.plantilla;
  const s = res.estado.sistema;
  const el = sol.elements[e];
  const [i, j] = el.nodes;
  const po = sol.post[e];
  const fila = res.elementos[e];
  return (
    <Paso n={9} titulo="Posproceso: derivadas, flujos y reacciones">
      <P>En cada elemento la derivada es constante (la solución es una recta):</P>
      <Formula>{String.raw`u'_{e${e + 1}} = \frac{u_{${j + 1}} - u_{${i + 1}}}{h} = \frac{${texNum(sol.u[j], 6)} - (${texNum(sol.u[i], 6)})}{${texNum(el.h, 6)}} = ${hl(texNum(po.du, 6))}`}</Formula>
      <Formula>{String.raw`k(x_m)\,u' = ${texNum(po.k, 5)} \cdot ${texNum(po.du, 5)} = ${hl(texNum(po.kdu, 6))}`}</Formula>
      <div className="flex flex-wrap gap-2">
        {t.derivadas.map((d) => (
          <Badge key={d.id} tono="neutral">
            {d.simbolo} = {fmtNum(fila.valores[d.id], 5)} {unidad(d.unidad, s) !== '—' ? unidad(d.unidad, s) : ''}
          </Badge>
        ))}
      </div>
      {sol.reactions.length > 0 && (
        <>
          <P>Las reacciones salen de la fila de K (antes de imponer Dirichlet) en cada apoyo: R = (K·u − F) en ese nodo.</P>
          {sol.reactions.map((rc) => {
            const fila = sol.K[rc.node];
            const terminos = fila
              .map((v, k) => ({ v, k }))
              .filter((x) => x.v !== 0)
              .map((x) => `(${texNum(x.v, 5)})(${texNum(sol.u[x.k], 5)})`)
              .join(' + ');
            return (
              <Formula key={rc.node} titulo={`Apoyo ${rc.lado} (nodo ${rc.node + 1})`}>
                {String.raw`R_{${rc.node + 1}} = ${terminos} - (${texNum(sol.F[rc.node], 5)}) = ${hl(texNum(rc.value, 6))}`}
              </Formula>
            );
          })}
          <P>{t.reaccion.nombre}.</P>
        </>
      )}
      <div className={cx('rounded-xl border p-3', Math.abs(sol.balance.residual) <= 1e-8 * sol.balance.scale ? 'border-ok/40 bg-ok/10' : 'border-danger/40 bg-danger-bg')}>
        <Tex>{String.raw`\text{Balance global: } \sum(\text{lo que entra}) = ${texNum(sol.balance.residual, 3)} \approx 0`}</Tex>
      </div>
      {sol.error && (
        <Formula titulo="Comparación con la solución analítica">{String.raw`\max_i |u_i - u(x_i)| = ${texNum(sol.error.maxNodal, 3)}, \qquad \|u - u_h\|_{L^2} = ${texNum(sol.error.L2, 3)}`}</Formula>
      )}
    </Paso>
  );
}
