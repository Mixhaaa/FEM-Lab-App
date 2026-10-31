import { useState, type ReactNode } from 'react';
import { APOYOS } from '../../templates';
import { Badge, Boton, Card, Icon, Pildoras, Selector, Tabla } from '../components/base';
import { MatrizTabla, VectorTabla } from '../components/Matriz';
import { ListaPasos } from '../components/ListaPasos';
import { Pagina, TituloPagina } from '../components/Shell';
import { Tex, texMatriz, texNum } from '../components/Tex';
import { fmtNum, sub } from '../format';
import { useAvanzar } from '../presentacion';
import { useResultadoArmadura, useResultadoResortes } from '../resultado';
import { SinResultado } from './Resultados';

const PASOS = [
  { id: 'geometria', titulo: 'Geometría' },
  { id: 'elemento', titulo: 'Matriz elemental' },
  { id: 'ensamblaje', titulo: 'Ensamblaje' },
  { id: 'apoyos', titulo: 'Apoyos' },
  { id: 'solucion', titulo: 'Solución' },
  { id: 'fuerzas', titulo: 'Fuerzas y reacciones' },
] as const;
type PasoId = (typeof PASOS)[number]['id'];

function Paso({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent font-mono text-sm font-bold text-on-accent">{n}</span>
        <h2 className="font-heading text-lg font-bold text-ink">{titulo}</h2>
      </div>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink">{children}</div>
    </Card>
  );
}
function F({ children }: { children: string }) {
  return (
    <div className="scroll-x rounded-xl border border-line bg-inset px-3 py-2 text-[12.5px] sm:text-[15px]">
      <Tex display>{children}</Tex>
    </div>
  );
}
const P = ({ children }: { children: ReactNode }) => <p className="text-[13.5px] leading-relaxed text-ink-2">{children}</p>;

function Navegacion({ paso, setPaso }: { paso: PasoId; setPaso: (p: PasoId) => void }) {
  const idx = PASOS.findIndex((p) => p.id === paso);
  return (
    <div className="flex items-center justify-between gap-2">
      <Boton variante="secundario" icon="chevron_left" disabled={idx === 0} onClick={() => setPaso(PASOS[idx - 1].id)}>
        Anterior
      </Boton>
      <span className="font-mono text-xs text-ink-2">
        {idx + 1} / {PASOS.length}
      </span>
      <Boton variante="primario" disabled={idx === PASOS.length - 1} onClick={() => setPaso(PASOS[idx + 1].id)}>
        Siguiente <Icon name="chevron_right" className="text-[18px]" />
      </Boton>
    </div>
  );
}

export function PasoArmadura() {
  const r = useResultadoArmadura();
  const [paso, setPaso] = useState<PasoId>('geometria');
  const [barra, setBarra] = useState(0);
  useAvanzar((d) =>
    setPaso((p) => {
      const i = PASOS.findIndex((x) => x.id === p);
      return PASOS[Math.min(PASOS.length - 1, Math.max(0, i + d))].id;
    }),
  );
  if (!r.ok) return <SinResultado error={r.error} />;
  const { sol, estado: e, unidades: un } = r.res;
  const b = sol.bars[Math.min(barra, sol.bars.length - 1)];
  const gdl = (n: number) => [`${2 * n + 1}`, `${2 * n + 2}`];
  const etiquetasGdl = e.nodos.flatMap((_, i) => [`u${sub(i + 1)}ₓ`, `u${sub(i + 1)}ᵧ`]);
  const fijos = [...new Set(e.apoyos.flatMap((a) => [...(APOYOS[a.tipo].ux ? [2 * a.nodo] : []), ...(APOYOS[a.tipo].uy ? [2 * a.nodo + 1] : [])]))].sort((x, y) => x - y);
  const res = new Set(b.dofs.flatMap((I) => b.dofs.map((J) => `${I},${J}`)));

  return (
    <Pagina amplia>
      <TituloPagina etiquetas={<Badge>Rigidez directa</Badge>} titulo="Armadura 2D paso a paso" subtitulo="Matriz de cada barra en coordenadas globales, ensamblaje, apoyos y fuerzas axiales." />
      <div className="sticky top-16 z-40 -mx-4 lg:-mx-8 lg:px-8 flex flex-col gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur-md">
        <div className="lg:hidden">
          <Pildoras value={paso} onChange={setPaso} opciones={PASOS.map((p, i) => ({ valor: p.id, texto: `${i + 1}. ${p.titulo}` }))} />
        </div>
        {(paso === 'elemento' || paso === 'ensamblaje' || paso === 'fuerzas') && (
          <Selector value={Math.min(barra, sol.bars.length - 1)} onChange={setBarra} opciones={sol.bars.map((x, i) => ({ valor: i, texto: `Barra ${i + 1}: nodos ${x.i + 1}–${x.j + 1}` }))} />
        )}
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <ListaPasos pasos={PASOS} actual={paso} onChange={setPaso} />
        <div className="flex min-w-0 flex-col gap-4">
      {paso === 'geometria' && (
        <Paso n={1} titulo="Geometría y cosenos directores">
          <P>Para cada barra entre los nodos i y j se calculan la longitud y los cosenos directores:</P>
          <F>{String.raw`L = \sqrt{(x_j - x_i)^2 + (y_j - y_i)^2}, \qquad c = \cos\theta = \frac{x_j - x_i}{L}, \qquad s = \sin\theta = \frac{y_j - y_i}{L}`}</F>
          <Tabla
            cabecera={['Barra', 'Nodos', `L [${un.long}]`, 'c', 's', `EA/L [${un.fuerza}/${un.long}]`]}
            alinear={['left', 'center', 'right', 'right', 'right', 'right']}
            filas={sol.bars.map((x) => [x.id, `${x.i + 1}–${x.j + 1}`, fmtNum(x.L, 6), fmtNum(x.c, 5), fmtNum(x.s, 5), fmtNum(x.EA_L, 5)])}
          />
          <P>Cada nodo tiene dos grados de libertad: el nodo n tiene los GDL 2n − 1 (u_x) y 2n (u_y). Total: {2 * e.nodos.length} GDL.</P>
        </Paso>
      )}
      {paso === 'elemento' && (
        <Paso n={2} titulo={`Matriz de rigidez de la barra ${b.id}`}>
          <F>{String.raw`\mathbf{k}^{e} = \frac{EA}{L}\begin{bmatrix} c^2 & cs & -c^2 & -cs\\ cs & s^2 & -cs & -s^2\\ -c^2 & -cs & c^2 & cs\\ -cs & -s^2 & cs & s^2\end{bmatrix}`}</F>
          <F>{String.raw`\frac{EA}{L} = ${texNum(b.EA_L, 6)}, \quad c = ${texNum(b.c, 5)}, \quad s = ${texNum(b.s, 5)}`}</F>
          <F>{`\\mathbf{k}^{${b.id}} = ${texMatriz(b.ke, 5)}`}</F>
          <P>
            Filas y columnas corresponden a los GDL globales {[...gdl(b.i), ...gdl(b.j)].join(', ')} (nodos {b.i + 1} y {b.j + 1}).
          </P>
        </Paso>
      )}
      {paso === 'ensamblaje' && (
        <Paso n={3} titulo="Ensamblaje de K y F">
          <P>Cada kᵉ se suma en las filas y columnas de sus 4 GDL globales. En color, el aporte de la barra {b.id}:</P>
          <MatrizTabla M={sol.K} titulo={`K global (${sol.K.length}×${sol.K.length})`} filas={etiquetasGdl} columnas={etiquetasGdl} resaltar={res} max={30} />
          <VectorTabla v={sol.F} titulo="F (cargas nodales)" etiquetas={etiquetasGdl} />
        </Paso>
      )}
      {paso === 'apoyos' && (
        <Paso n={4} titulo="Apoyos">
          <P>
            GDL restringidos: {fijos.map((d) => etiquetasGdl[d]).join(', ')}.{' '}
            {sol.system.K.length < sol.K.length ? 'Por eliminación se quitan sus filas y columnas:' : `Por penalización se suma β = ${fmtNum(sol.beta ?? 0, 3)} en su diagonal:`}
          </P>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <MatrizTabla
              M={sol.system.K}
              titulo={`Sistema a resolver (${sol.system.K.length}×${sol.system.K.length})`}
              filas={sol.system.free.map((d) => etiquetasGdl[d])}
              columnas={sol.system.free.map((d) => etiquetasGdl[d])}
              max={30}
            />
            <VectorTabla v={sol.system.F} titulo="F" etiquetas={sol.system.free.map((d) => etiquetasGdl[d])} />
          </div>
        </Paso>
      )}
      {paso === 'solucion' && (
        <Paso n={5} titulo="Solución: desplazamientos nodales">
          <P>Se resuelve el sistema con eliminación gaussiana con pivoteo parcial:</P>
          <VectorTabla v={sol.u} titulo={`u [${un.long}]`} etiquetas={etiquetasGdl} sig={6} />
          <F>{String.raw`\|\mathbf{K}\mathbf{u} - \mathbf{F}\| = ${texNum(sol.residualNorm, 3)}`}</F>
        </Paso>
      )}
      {paso === 'fuerzas' && (
        <Paso n={6} titulo="Fuerzas axiales y reacciones">
          <P>La fuerza axial de la barra {b.id} sale del alargamiento proyectado sobre su eje:</P>
          <F>{String.raw`N = \frac{EA}{L}\begin{bmatrix}-c & -s & c & s\end{bmatrix}\begin{bmatrix}u_{${b.i + 1}x}\\u_{${b.i + 1}y}\\u_{${b.j + 1}x}\\u_{${b.j + 1}y}\end{bmatrix} = ${texNum(b.EA_L, 5)}\cdot(${texNum(b.elong, 5)}) = ${texNum(b.N, 6)}\ \text{${un.fuerza}}`}</F>
          <F>{String.raw`\sigma = \frac{N}{A} = ${texNum(b.sigma, 6)}\ \text{${un.esfuerzo}} \quad (${b.estado})`}</F>
          <P>Las reacciones son R = K·u − F en los GDL restringidos:</P>
          <Tabla
            cabecera={['Nodo', `Rₓ [${un.fuerza}]`, `R_y [${un.fuerza}]`]}
            alinear={['left', 'right', 'right']}
            filas={sol.reactions.map((rc) => [rc.node + 1, rc.Rx === null ? '—' : fmtNum(rc.Rx, 6), rc.Ry === null ? '—' : fmtNum(rc.Ry, 6)])}
          />
        </Paso>
      )}
      <Navegacion paso={paso} setPaso={setPaso} />
        </div>
      </div>
    </Pagina>
  );
}

export function PasoResortes() {
  const r = useResultadoResortes();
  const [paso, setPaso] = useState<PasoId>('geometria');
  const [res, setRes] = useState(0);
  useAvanzar((d) =>
    setPaso((p) => {
      const i = PASOS.findIndex((x) => x.id === p);
      return PASOS[Math.min(PASOS.length - 1, Math.max(0, i + d))].id;
    }),
  );
  if (!r.ok) return <SinResultado error={r.error} />;
  const { sol, estado: e, unidades: un } = r.res;
  const sp = sol.springs[Math.min(res, sol.springs.length - 1)];
  const etq = Array.from({ length: e.nNodos }, (_, i) => `u${sub(i + 1)}`);
  const hl = new Set([`${sp.i},${sp.i}`, `${sp.i},${sp.j}`, `${sp.j},${sp.i}`, `${sp.j},${sp.j}`]);
  return (
    <Pagina amplia>
      <TituloPagina etiquetas={<Badge>Rigidez directa</Badge>} titulo="Resortes paso a paso" subtitulo="Matriz de cada resorte, ensamblaje, apoyos y fuerzas." />
      <div className="sticky top-16 z-40 -mx-4 lg:-mx-8 lg:px-8 flex flex-col gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur-md">
        <div className="lg:hidden">
          <Pildoras value={paso} onChange={setPaso} opciones={PASOS.map((p, i) => ({ valor: p.id, texto: `${i + 1}. ${p.titulo}` }))} />
        </div>
        {(paso === 'elemento' || paso === 'ensamblaje' || paso === 'fuerzas') && (
          <Selector value={Math.min(res, sol.springs.length - 1)} onChange={setRes} opciones={sol.springs.map((x, i) => ({ valor: i, texto: `Resorte ${i + 1}: nodos ${x.i + 1}–${x.j + 1}` }))} />
        )}
      </div>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <ListaPasos pasos={PASOS} actual={paso} onChange={setPaso} />
        <div className="flex min-w-0 flex-col gap-4">
      {paso === 'geometria' && (
        <Paso n={1} titulo="Conectividad">
          <P>Cada resorte une dos nodos y cada nodo tiene un grado de libertad (desplazamiento en x).</P>
          <Tabla cabecera={['Resorte', 'Nodo i', 'Nodo j', `k [${un.rigidez}]`]} alinear={['left', 'center', 'center', 'right']} filas={sol.springs.map((x) => [x.id, x.i + 1, x.j + 1, fmtNum(x.k, 6)])} />
        </Paso>
      )}
      {paso === 'elemento' && (
        <Paso n={2} titulo={`Matriz del resorte ${sp.id}`}>
          <F>{String.raw`\mathbf{k}^{${sp.id}} = k\begin{bmatrix}1&-1\\-1&1\end{bmatrix} = ${texMatriz(sp.ke, 6)}`}</F>
          <P>
            Filas y columnas: nodos {sp.i + 1} y {sp.j + 1}.
          </P>
        </Paso>
      )}
      {paso === 'ensamblaje' && (
        <Paso n={3} titulo="Ensamblaje">
          <MatrizTabla M={sol.K} titulo="K global" filas={etq} columnas={etq} resaltar={hl} />
          <VectorTabla v={sol.F} titulo="F" etiquetas={etq} />
        </Paso>
      )}
      {paso === 'apoyos' && (
        <Paso n={4} titulo="Apoyos">
          <P>Nodos con desplazamiento impuesto: {e.apoyos.map((a) => `${a.nodo + 1} (u = ${a.valor})`).join(', ')}.</P>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <MatrizTabla M={sol.system.K} titulo="Sistema a resolver" filas={sol.system.free.map((i) => etq[i])} columnas={sol.system.free.map((i) => etq[i])} />
            <VectorTabla v={sol.system.F} titulo="F" etiquetas={sol.system.free.map((i) => etq[i])} />
          </div>
        </Paso>
      )}
      {paso === 'solucion' && (
        <Paso n={5} titulo="Solución">
          <VectorTabla v={sol.u} titulo={`u [${un.long}]`} etiquetas={etq} sig={6} />
        </Paso>
      )}
      {paso === 'fuerzas' && (
        <Paso n={6} titulo="Fuerzas y reacciones">
          <F>{String.raw`f_{${sp.id}} = k\,(u_{${sp.j + 1}} - u_{${sp.i + 1}}) = ${texNum(sp.k, 5)}\,(${texNum(sol.u[sp.j], 5)} - (${texNum(sol.u[sp.i], 5)})) = ${texNum(sp.force, 6)}\ \text{${un.fuerza}}`}</F>
          <Tabla cabecera={['Nodo', `R [${un.fuerza}]`]} alinear={['left', 'right']} filas={sol.reactions.map((rc) => [rc.node + 1, fmtNum(rc.value, 6)])} />
        </Paso>
      )}
      <Navegacion paso={paso} setPaso={setPaso} />
        </div>
      </div>
    </Pagina>
  );
}
