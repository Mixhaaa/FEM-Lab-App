/** Memoria de cálculo imprimible (Guardar como PDF desde el navegador). */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { compileExpr } from '../../core';
import { APOYOS, EJEMPLOS_ARMADURA, SISTEMAS, unidad, valorPorDefecto, type Resultado1D } from '../../templates';
import { Aviso, Boton, Tabla } from '../components/base';
import { DiagramaResortes } from '../components/DiagramaResortes';
import { Grafica, type Colores } from '../components/Grafica';
import { MatrizTabla, VectorTabla } from '../components/Matriz';
import { PlanoArmadura } from '../components/PlanoArmadura';
import { Tex } from '../components/Tex';
import { conPrefijo, fmtNum, snap } from '../format';
import { useResultado1D, useResultadoArmadura, useResultadoResortes } from '../resultado';
import { ir } from '../router';
import { useApp } from '../store';

const URL_APP = 'https://mixhaaa.github.io/FEM-Lab-App/';

function Barra({ volver }: { volver: 'resultados' | 'armadura' }) {
  return (
    <div className="no-print sticky top-16 z-40 -mx-4 mb-4 flex items-center justify-between gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur-md">
      <Boton variante="fantasma" icon="chevron_left" onClick={() => ir(volver)}>
        Volver
      </Boton>
      <Boton variante="primario" icon="print" onClick={() => window.print()}>
        Imprimir / Guardar PDF
      </Boton>
    </div>
  );
}

function Hoja({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  const [fecha] = useState(() => new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }));
  return (
    <article data-theme="light" className="reporte mx-auto w-full max-w-[210mm] rounded-xl bg-bg p-6 text-ink shadow-card sm:p-10">
      <header className="mb-6 flex items-start justify-between gap-4 border-b-2 border-accent pb-4">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="h-12 w-12" />
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-accent-soft">FEM Lab · Memoria de cálculo</p>
            <h1 className="font-heading text-2xl font-bold leading-tight text-ink">{titulo}</h1>
            <p className="text-sm text-ink-2">{subtitulo}</p>
          </div>
        </div>
        <div className="shrink-0 text-right font-mono text-[11px] text-ink-2">
          <p>{fecha}</p>
          <p>Diseño por Elementos Finitos</p>
          <p>Universidad Distrital · 2026-1</p>
        </div>
      </header>
      <div className="flex flex-col gap-6">{children}</div>
      <footer className="mt-8 border-t border-line pt-3 text-center font-mono text-[10px] text-ink-3">
        Generado con FEM Lab · elementos finitos lineales · {URL_APP}
      </footer>
    </article>
  );
}

function S({ n, titulo, children, salto }: { n: number; titulo: string; children: ReactNode; salto?: boolean }) {
  return (
    <section className={salto ? 'salto' : undefined}>
      <h2 className="mb-2 flex items-baseline gap-2 font-heading text-lg font-bold text-ink">
        <span className="font-mono text-sm text-accent-soft">{n}.</span> {titulo}
      </h2>
      <div className="flex flex-col gap-3 text-sm text-ink">{children}</div>
    </section>
  );
}

const Fx = ({ children }: { children: string }) => (
  <div className="scroll-x text-[13px]">
    <Tex display>{children}</Tex>
  </div>
);

/** Si hay muchas filas, toma una muestra uniforme (incluye siempre la primera y la última). */
function muestra<T>(filas: T[], max: number): { filas: T[]; recortado: boolean } {
  if (filas.length <= max) return { filas, recortado: false };
  const paso = (filas.length - 1) / (max - 1);
  return { filas: Array.from({ length: max }, (_, i) => filas[Math.round(i * paso)]), recortado: true };
}

export function Reporte() {
  const tipo = useApp((s) => s.tipo);
  if (tipo === 'armadura') return <ReporteArmadura />;
  if (tipo === 'resortes') return <ReporteResortes />;
  return <Reporte1D />;
}

function Contenedor({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-4xl flex-col px-4 pb-28 pt-16 print:p-0">{children}</main>;
}

function Reporte1D() {
  const r = useResultado1D();
  const ejemplo = useApp((s) => s.ejemplo['1d']);
  if (!r.ok) {
    return (
      <Contenedor>
        <Barra volver="resultados" />
        <Aviso tipo="error" titulo="No hay resultados para el reporte">
          {r.error.message}
        </Aviso>
      </Contenedor>
    );
  }
  const res = r.res;
  const t = res.plantilla;
  const s = res.estado.sistema;
  const sol = res.sol;
  const ej = t.ejemplos.find((e) => e.id === ejemplo);
  const ul = unidad(t.unidadLongitud, s);
  const ui = unidad(t.incognita.unidad, s);
  const uMax = Math.max(...sol.u.map(Math.abs), 1e-300);
  const hs = sol.elements.map((e) => e.h);
  const nodal = muestra(
    sol.mesh.nodes.map((_, i) => i),
    61,
  );
  const elems = muestra(res.elementos, 40);
  const n = sol.mesh.nodes.length;

  return (
    <Contenedor>
      <Barra volver="resultados" />
      <Hoja titulo={ej?.nombre ?? t.nombre} subtitulo={`${t.nombre} · método de elementos finitos con elementos lineales`}>
        <S n={1} titulo="Planteamiento">
          <p>Ecuación gobernante:</p>
          <Fx>{t.ecuacion}</Fx>
          <p>
            Se resuelve como el problema modelo <Tex>{String.raw`-(k\,u')' + b\,u' + c\,u = f`}</Tex> en <Tex>{`[${fmtNum(res.problem.x0)},\\ ${fmtNum(res.problem.xL)}]`}</Tex>
            {t.id !== 'general' && (
              <>
                {' '}con <Tex>{`k = ${t.traduccion.k},\\; b = ${t.traduccion.b},\\; c = ${t.traduccion.c},\\; f = ${t.traduccion.f}`}</Tex>
              </>
            )}
            . La solución aproximada es lineal en cada elemento: <Tex>{String.raw`u_h(x) = \sum_i u_i\,N_i(x)`}</Tex>.
          </p>
        </S>

        <S n={2} titulo="Datos">
          <Tabla
            cabecera={['Tramo', `Desde${ul ? ` [${ul}]` : ''}`, `Hasta${ul ? ` [${ul}]` : ''}`, ...t.camposTramo.map((c) => `${c.simbolo}${unidad(c.unidad, s) && unidad(c.unidad, s) !== '—' ? ` [${unidad(c.unidad, s)}]` : ''}`)]}
            filas={res.problem.regions.map((rg, i) => [
              rg.nombre ?? `${i + 1}`,
              fmtNum(rg.x0, 6),
              fmtNum(rg.x1, 6),
              ...t.camposTramo.map((c) => res.estado.tramos[i].valores[c.id] ?? valorPorDefecto(c, s)),
            ])}
          />
          {t.camposGlobales.length > 0 && (
            <p>
              {t.camposGlobales.map((c) => `${c.nombre} ${c.simbolo} = ${res.estado.globales[c.id]} ${unidad(c.unidad, s)}`).join(' · ')}
            </p>
          )}
          <Tabla
            cabecera={['Extremo', 'Condición', 'Forma matemática']}
            filas={(['izquierda', 'derecha'] as const).map((lado) => {
              const op = t.fronteras.find((o) => o.id === res.estado[lado].opcion)!;
              const bc = lado === 'izquierda' ? res.problem.bcLeft : res.problem.bcRight;
              const v = Object.fromEntries(op.campos.map((c) => [c.id, compileExpr(res.estado[lado].valores[c.id] ?? '0').fn(0)]));
              const mat = bc.type === 'dirichlet' ? `u = ${fmtNum(bc.value)}` : bc.type === 'neumann' ? `k·∂u/∂n = ${fmtNum(bc.q)}` : `k·∂u/∂n + ${fmtNum(bc.h)}·u = ${fmtNum(bc.g)}`;
              return [lado === 'izquierda' ? `x₀ = ${fmtNum(res.problem.x0)}` : `xL = ${fmtNum(res.problem.xL)}`, op.describir(v, { lado, xTexto: lado === 'izquierda' ? res.estado.x0 : res.estado.xL, sistema: s }), mat];
            })}
          />
          {res.problem.loads.length > 0 && <p>Cargas puntuales: {res.problem.loads.map((l) => `${fmtNum(l.P)} en x = ${fmtNum(l.x)}`).join('; ')}.</p>}
          <p>
            Malla {res.estado.malla.tipo === 'uniforme' ? 'uniforme' : res.estado.malla.tipo === 'geometrica' ? 'refinada (geométrica)' : 'manual'} de {sol.elements.length} elementos y {n} nodos (h entre {fmtNum(Math.min(...hs))} y {fmtNum(Math.max(...hs))}
            {ul ? ` ${ul}` : ''}); {res.problem.gaussPoints} puntos de Gauss por elemento; fronteras Dirichlet por {sol.bcMethod === 'eliminacion' ? 'eliminación' : `penalización (β = ${fmtNum(sol.beta ?? 0, 3)})`}; solución con {sol.solverUsed === 'thomas' ? 'el algoritmo de Thomas' : 'eliminación gaussiana'}. Unidades: {SISTEMAS[s].nombre}.
          </p>
        </S>

        <S n={3} titulo="Resultados principales">
          <Tabla
            cabecera={['Magnitud', 'Valor', 'Ubicación']}
            alinear={['left', 'right', 'right']}
            filas={[
              ...res.kpis.map((k) => {
                const p = conPrefijo(k.unidad === ui && Math.abs(k.valor.valor) < 1e-12 * uMax ? 0 : k.valor.valor, k.unidad);
                return [`${k.def.nombre} (${k.def.simbolo})`, `${fmtNum(p.valor, 5)} ${p.unidad !== '—' ? p.unidad : ''}`, k.valor.x !== undefined ? `x = ${fmtNum(k.valor.x)}` : (k.valor.detalle ?? '')];
              }),
              ...res.reacciones.map((rc) => {
                const p = conPrefijo(rc.valor, rc.unidad);
                return [`${rc.nombre} (${rc.lado})`, `${fmtNum(p.valor, 6)} ${p.unidad}`, `x = ${fmtNum(rc.x)}`];
              }),
            ]}
          />
        </S>

        <S n={4} titulo="Gráficas">
          <GraficasReporte res={res} />
        </S>

        <S n={5} titulo="Resultados nodales">
          <Tabla
            cabecera={['Nodo', `x${ul ? ` [${ul}]` : ''}`, `${t.incognita.simbolo} MEF${ui && ui !== '—' ? ` [${ui}]` : ''}`, ...(sol.error ? [`${t.incognita.simbolo} exacta`, 'Error'] : [])]}
            alinear={['left', 'right', 'right', 'right', 'right']}
            filas={nodal.filas.map((i) => [i + 1, fmtNum(sol.mesh.nodes[i], 6), fmtNum(snap(sol.u[i], uMax), 6), ...(sol.error ? [fmtNum(snap(sol.error.exactAtNodes[i], uMax), 6), fmtNum(snap(sol.error.nodal[i], uMax), 3)] : [])])}
          />
          {nodal.recortado && <p className="text-xs text-ink-2">Se muestran 61 de los {n} nodos (muestra uniforme). El CSV contiene todos.</p>}
        </S>

        <S n={6} titulo="Resultados por elemento">
          <Tabla
            cabecera={['Elem.', 'x medio', 'h', ...t.derivadas.map((d) => `${d.simbolo}${unidad(d.unidad, s) && unidad(d.unidad, s) !== '—' ? ` [${unidad(d.unidad, s)}]` : ''}`)]}
            alinear={Array(3 + t.derivadas.length).fill('right')}
            filas={elems.filas.map((el) => [el.id, fmtNum(el.xm, 5), fmtNum(el.h, 4), ...t.derivadas.map((d) => fmtNum(el.valores[d.id], 5))])}
          />
          {elems.recortado && <p className="text-xs text-ink-2">Se muestran 40 de los {res.elementos.length} elementos.</p>}
        </S>

        <S n={7} titulo="Verificación">
          <Tabla
            cabecera={['Balance global', 'Valor']}
            alinear={['left', 'right']}
            filas={[...sol.balance.terms.map((x) => [x.nombre, fmtNum(snap(x.valor, sol.balance.scale, 1e-14), 6)]), ['Suma (debe ser ≈ 0)', fmtNum(sol.balance.residual, 3)]]}
          />
          <p>
            Residuo del sistema ‖K·u − F‖ = {fmtNum(sol.residualNorm, 3)}.
            {sol.energy.aplica && ` Energía de deformación ½uᵀKu = ${fmtNum(sol.energy.U, 6)}; trabajo externo = ${fmtNum(sol.energy.W, 6)}.`}
            {sol.error && ` Frente a la solución analítica (${res.exacta?.origen === 'automatica' ? 'calculada automáticamente' : 'escrita por el usuario'}): error nodal máximo ${fmtNum(sol.error.maxNodal, 3)}, ‖e‖L² = ${fmtNum(sol.error.L2, 3)}, |e|H¹ = ${fmtNum(sol.error.H1semi, 3)}.`}
          </p>
          {res.avisos.length > 0 && <p className="text-xs text-ink-2">Avisos: {res.avisos.join(' ')}</p>}
        </S>

        {n <= 12 && (
          <S n={8} titulo="Sistema de ecuaciones">
            <p>Matriz elemental del elemento 1 y sistema global con fronteras naturales (antes de imponer Dirichlet):</p>
            <div className="grid grid-cols-[auto_1fr] gap-3">
              <MatrizTabla M={sol.elements[0].Ke} titulo="Ke (elemento 1)" sig={6} />
              <VectorTabla v={sol.elements[0].Fe} titulo="Fe (elemento 1)" sig={6} />
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-3">
              <MatrizTabla M={sol.K} titulo="K" />
              <VectorTabla v={sol.F} titulo="F" sig={6} />
              <VectorTabla v={sol.u} titulo="u" sig={6} />
            </div>
          </S>
        )}
      </Hoja>
    </Contenedor>
  );
}

function GraficasReporte({ res }: { res: Resultado1D }) {
  const t = res.plantilla;
  const s = res.estado.sistema;
  const nodos = res.sol.mesh.nodes;
  const u = res.sol.u;
  const exacta = useMemo(() => {
    if (!res.exacta) return null;
    try {
      return compileExpr(res.exacta.expr).fn;
    } catch {
      return null;
    }
  }, [res.exacta]);
  const d = t.derivadas[t.derivadas.length - 1];
  const sol = useCallback(
    (c: Colores) => {
      const tr: unknown[] = [];
      if (exacta) {
        const xs = Array.from({ length: 301 }, (_, i) => nodos[0] + ((nodos[nodos.length - 1] - nodos[0]) * i) / 300);
        tr.push({ x: xs, y: xs.map((x) => exacta(x)), type: 'scatter', mode: 'lines', name: 'Analítica', line: { color: c.ink, width: 2 } });
      }
      tr.push({ x: nodos, y: u, type: 'scatter', mode: nodos.length <= 80 ? 'lines+markers' : 'lines', name: 'MEF', line: { color: c.accent, width: 2, dash: exacta ? 'dash' : 'solid' }, marker: { size: 6, color: c.accent } });
      return tr;
    },
    [nodos, u, exacta],
  );
  const lay1 = useCallback(
    () => ({
      showlegend: !!exacta,
      legend: { orientation: 'h', x: 0, y: 1.12 },
      xaxis: { title: { text: 'x' } },
      yaxis: { title: { text: `${t.incognita.simbolo}${unidad(t.incognita.unidad, s) && unidad(t.incognita.unidad, s) !== '—' ? ` [${unidad(t.incognita.unidad, s)}]` : ''}` } },
    }),
    [exacta, t, s],
  );
  const der = useCallback(
    (c: Colores) => {
      const xs: number[] = [];
      const ys: number[] = [];
      res.elementos.forEach((el) => {
        xs.push(el.xa, el.xb);
        ys.push(el.valores[d.id], el.valores[d.id]);
      });
      return [{ x: xs, y: ys, type: 'scatter', mode: 'lines', line: { color: c.amber, width: 2 }, fill: 'tozeroy', fillcolor: 'rgba(183,121,31,0.12)' }];
    },
    [res.elementos, d.id],
  );
  const lay2 = useCallback(
    () => ({ xaxis: { title: { text: 'x' } }, yaxis: { title: { text: `${d.simbolo}${unidad(d.unidad, s) && unidad(d.unidad, s) !== '—' ? ` [${unidad(d.unidad, s)}]` : ''}` } } }),
    [d, s],
  );
  return (
    <>
      <figure className="scroll-x">
        <Grafica data={sol} layout={lay1} alto={260} ancho={680} etiqueta={`${t.incognita.nombre} contra x`} />
        <figcaption className="text-center text-xs text-ink-2">
          {t.incognita.nombre}: solución MEF{exacta ? ' y analítica' : ''}.
        </figcaption>
      </figure>
      <figure className="scroll-x">
        <Grafica data={der} layout={lay2} alto={220} ancho={680} etiqueta={`${d.nombre} por elemento`} />
        <figcaption className="text-center text-xs text-ink-2">{d.nombre} (constante en cada elemento).</figcaption>
      </figure>
    </>
  );
}

function ReporteArmadura() {
  const r = useResultadoArmadura();
  const ejemplo = useApp((s) => s.ejemplo.armadura);
  const e = useApp((s) => s.armadura);
  const coords = useMemo(() => (r.ok ? r.res.sol.problem.nodes : []), [r]);
  if (!r.ok) {
    return (
      <Contenedor>
        <Barra volver="armadura" />
        <Aviso tipo="error" titulo="No hay resultados para el reporte">
          {r.error.message}
        </Aviso>
      </Contenedor>
    );
  }
  const { sol, unidades: un } = r.res;
  const escalaF = Math.max(...sol.bars.map((b) => Math.abs(b.N)), 1e-300);
  const escalaU = Math.max(...sol.u.map(Math.abs), 1e-300);
  return (
    <Contenedor>
      <Barra volver="armadura" />
      <Hoja titulo={EJEMPLOS_ARMADURA.find((x) => x.id === ejemplo)?.nombre ?? 'Armadura plana 2D'} subtitulo="Armadura plana con elementos barra · método de rigidez directa">
        <S n={1} titulo="Modelo">
          <Fx>{String.raw`\mathbf{k}^e = \frac{EA}{L}\begin{bmatrix} c^2 & cs & -c^2 & -cs\\ cs & s^2 & -cs & -s^2\\ -c^2 & -cs & c^2 & cs\\ -cs & -s^2 & cs & s^2\end{bmatrix},\qquad N = \frac{EA}{L}\begin{bmatrix}-c & -s & c & s\end{bmatrix}\mathbf{u}^e`}</Fx>
          <div className="rounded-lg border border-line">
            <PlanoArmadura e={e} coords={coords} sol={sol} escala={sol.scaleSuggestion} verDeformada verFuerzas sel={null} onSel={() => {}} />
          </div>
          <p className="text-center text-xs text-ink-2">
            Armadura original y deformada (escala ×{fmtNum(sol.scaleSuggestion)}). Barras en tracción en ámbar y en compresión en azul.
          </p>
        </S>
        <S n={2} titulo="Datos">
          <div className="flex flex-col gap-3">
            <Tabla cabecera={['Nodo', `x [${un.long}]`, `y [${un.long}]`, 'Apoyo', `Carga (Fx, Fy) [${un.fuerza}]`]} filas={sol.problem.nodes.map((nd, i) => {
              const ap = e.apoyos.find((a) => a.nodo === i);
              const cg = sol.problem.loads.filter((l) => l.node === i);
              return [i + 1, fmtNum(nd.x, 6), fmtNum(nd.y, 6), ap ? APOYOS[ap.tipo].nombre : '—', cg.length ? cg.map((l) => `(${fmtNum(l.Fx)}, ${fmtNum(l.Fy)})`).join(' ') : '—'];
            })} />
            <Tabla cabecera={['Barra', 'Nodos', `E [${un.esfuerzo}]`, `A [${un.area}]`]} filas={sol.problem.bars.map((b, k) => [k + 1, `${b.i + 1}–${b.j + 1}`, fmtNum(b.E, 5), fmtNum(b.A, 5)])} />
          </div>
        </S>
        <S n={3} titulo="Resultados principales">
          <Tabla cabecera={['Magnitud', 'Valor', 'Ubicación']} alinear={['left', 'right', 'right']} filas={r.res.kpis.map((k) => {
            const p = conPrefijo(snap(k.valor, k.unidad === un.long ? escalaU : escalaF), k.unidad);
            return [`${k.nombre} (${k.simbolo})`, `${fmtNum(p.valor, 5)} ${p.unidad}`, k.detalle ?? ''];
          })} />
        </S>
        <S n={4} titulo="Fuerzas en las barras">
          <Tabla
            cabecera={['Barra', 'Nodos', `L [${un.long}]`, `N [${un.fuerza}]`, `σ [${un.esfuerzo}]`, 'Estado']}
            alinear={['left', 'center', 'right', 'right', 'right', 'left']}
            filas={sol.bars.map((b) => [b.id, `${b.i + 1}–${b.j + 1}`, fmtNum(b.L, 5), fmtNum(snap(b.N, escalaF), 6), fmtNum(b.sigma, 5), b.estado])}
          />
        </S>
        <S n={5} titulo="Desplazamientos y reacciones">
          <Tabla
            cabecera={['Nodo', `uₓ [${un.long}]`, `u_y [${un.long}]`, `Rₓ [${un.fuerza}]`, `R_y [${un.fuerza}]`]}
            alinear={['left', 'right', 'right', 'right', 'right']}
            filas={sol.problem.nodes.map((_, i) => {
              const rc = sol.reactions.find((x) => x.node === i);
              const R = (v: number | null | undefined) => (v === null || v === undefined ? '—' : fmtNum(snap(v, escalaF), 6));
              return [i + 1, fmtNum(snap(sol.u[2 * i], escalaU), 5), fmtNum(snap(sol.u[2 * i + 1], escalaU), 5), R(rc?.Rx), R(rc?.Ry)];
            })}
          />
          <p>
            Equilibrio global: ΣFx = {fmtNum(snap(sol.equilibrium.sumFx, sol.equilibrium.scale), 3)}, ΣFy = {fmtNum(snap(sol.equilibrium.sumFy, sol.equilibrium.scale), 3)}, ΣM = {fmtNum(snap(sol.equilibrium.sumM, sol.equilibrium.scale), 3)}. Apoyos por{' '}
            {e.metodo === 'eliminacion' ? 'eliminación' : 'penalización'}; unidades {SISTEMAS[e.sistema].nombre}.
          </p>
        </S>
        {sol.K.length <= 12 && (
          <S n={6} titulo="Matriz de rigidez global">
            <MatrizTabla M={sol.K} filas={sol.problem.nodes.flatMap((_, i) => [`${i + 1}x`, `${i + 1}y`])} columnas={sol.problem.nodes.flatMap((_, i) => [`${i + 1}x`, `${i + 1}y`])} />
          </S>
        )}
      </Hoja>
    </Contenedor>
  );
}

function ReporteResortes() {
  const r = useResultadoResortes();
  if (!r.ok) {
    return (
      <Contenedor>
        <Barra volver="resultados" />
        <Aviso tipo="error" titulo="No hay resultados para el reporte">
          {r.error.message}
        </Aviso>
      </Contenedor>
    );
  }
  const { sol, unidades: un, estado: e } = r.res;
  return (
    <Contenedor>
      <Barra volver="resultados" />
      <Hoja titulo="Sistema de resortes" subtitulo="Método de rigidez directa">
        <S n={1} titulo="Modelo">
          <Fx>{String.raw`\mathbf{k}^e = k\begin{bmatrix}1&-1\\-1&1\end{bmatrix},\qquad f = k\,(u_j - u_i)`}</Fx>
          <div className="rounded-lg border border-line p-2">
            <DiagramaResortes e={e} u={sol.u} />
          </div>
        </S>
        <S n={2} titulo="Resultados">
          <Tabla cabecera={['Nodo', `u [${un.long}]`, `Carga [${un.fuerza}]`, `Reacción [${un.fuerza}]`]} alinear={['left', 'right', 'right', 'right']} filas={sol.u.map((v, i) => [i + 1, fmtNum(v, 6), fmtNum(sol.F[i], 5), fmtNum(sol.reactions.find((x) => x.node === i)?.value ?? NaN, 6)])} />
          <Tabla cabecera={['Resorte', 'Nodos', `k [${un.rigidez}]`, `Fuerza [${un.fuerza}]`]} alinear={['left', 'center', 'right', 'right']} filas={sol.springs.map((x) => [x.id, `${x.i + 1}–${x.j + 1}`, fmtNum(x.k, 5), fmtNum(x.force, 6)])} />
          <p>Equilibrio: Σ cargas + Σ reacciones = {fmtNum(sol.equilibrium, 3)}.</p>
        </S>
        <S n={3} titulo="Matriz de rigidez global">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3">
            <MatrizTabla M={sol.K} titulo="K" />
            <VectorTabla v={sol.F} titulo="F" sig={6} />
            <VectorTabla v={sol.u} titulo="u" sig={6} />
          </div>
        </S>
      </Hoja>
    </Contenedor>
  );
}
