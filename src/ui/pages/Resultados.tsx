import { useCallback, useMemo, useState } from 'react';
import { compileExpr } from '../../core';
import { unidad, type Resultado1D } from '../../templates';
import { Aviso, Badge, Boton, Card, CardHeader, Icon, Kpi, Pildoras, Selector, Tabla } from '../components/base';
import { Grafica, type Colores } from '../components/Grafica';
import { Pagina } from '../components/Shell';
import { conPrefijo, fmtNum, snap, sub } from '../format';
import { useResultado1D } from '../resultado';
import { ir } from '../router';
import { useApp } from '../store';
import { ResultadosResortes } from './ResultadosResortes';
import { PestanaConvergencia } from './Convergencia';
import { PanelMatrices } from '../components/PanelMatrices';

export function Resultados() {
  const tipo = useApp((s) => s.tipo);
  if (tipo === 'resortes') return <ResultadosResortes />;
  if (tipo === 'armadura') {
    return (
      <Pagina>
        <Aviso tipo="info" titulo="Armadura 2D">
          Los resultados de la armadura se muestran sobre el plano, en la pestaña Armadura 2D.
        </Aviso>
        <Boton variante="primario" icon="architecture" onClick={() => ir('armadura')}>
          Ir a Armadura 2D
        </Boton>
      </Pagina>
    );
  }
  return <Resultados1D />;
}

export function SinResultado({ error }: { error: Error }) {
  return (
    <Pagina>
      <Aviso tipo="error" titulo="No se pudo resolver el problema">
        {error.message}
      </Aviso>
      <Boton variante="primario" icon="tune" onClick={() => ir('config')}>
        Corregir en Configuración
      </Boton>
    </Pagina>
  );
}

type Pestana = 'solucion' | 'matrices' | 'derivadas' | 'convergencia';

function Resultados1D() {
  const r = useResultado1D();
  const [tab, setTab] = useState<Pestana>('solucion');
  if (!r.ok) return <SinResultado error={r.error} />;
  const res = r.res;
  return (
    <Pagina>
      <Banner res={res} />
      <div className="sticky top-16 z-40 -mx-4 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur-md">
        <Pildoras
          value={tab}
          onChange={setTab}
          opciones={[
            { valor: 'solucion', texto: `Solución ${res.plantilla.incognita.simbolo}(x)`, icon: 'insights' },
            { valor: 'matrices', texto: 'Matrices [K] y {F}', icon: 'grid_4x4' },
            { valor: 'derivadas', texto: 'Derivadas y reacciones', icon: 'compare_arrows' },
            { valor: 'convergencia', texto: 'Error y convergencia', icon: 'query_stats' },
          ]}
        />
      </div>
      {res.avisos.length > 0 && (
        <Aviso tipo="aviso" titulo="Avisos">
          <ul className="list-disc space-y-0.5 pl-4">
            {res.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Aviso>
      )}
      {tab === 'solucion' && <PestanaSolucion res={res} />}
      {tab === 'matrices' && <PestanaMatrices res={res} />}
      {tab === 'derivadas' && <PestanaDerivadas res={res} />}
      {tab === 'convergencia' && <PestanaConvergencia res={res} />}
    </Pagina>
  );
}

function Banner({ res }: { res: Resultado1D }) {
  const t = res.plantilla;
  const ej = t.ejemplos.find((x) => x.id === useApp.getState().ejemplo['1d']);
  const tr = res.estado.tramos[0];
  const resumen = t.camposTramo
    .slice(0, 3)
    .map((c) => `${c.simbolo.replace(/\(x\)$/, '')} = ${tr.valores[c.id]}`)
    .join(' · ');
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-s2 px-4 py-3 shadow-card">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/40 bg-accent-bg text-accent-soft">
          <Icon name="verified" className="text-[20px]" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-bold text-ink sm:text-base">{ej?.nombre ?? t.nombre}</p>
          <p className="truncate font-mono text-[11px] text-ink-2">
            {res.estado.tramos.length > 1 ? `${res.estado.tramos.length} tramos · ` : ''}
            {resumen}
          </p>
        </div>
      </div>
      <Badge className="hidden shrink-0 sm:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-hover" /> {res.sol.mesh.elements.length} el. lineales C⁰
      </Badge>
    </div>
  );
}

function PestanaSolucion({ res }: { res: Resultado1D }) {
  const t = res.plantilla;
  const s = res.estado.sistema;
  const nodos = res.sol.mesh.nodes;
  const u = res.sol.u;
  const uMax = Math.max(...u.map(Math.abs));
  const iMax = u.findIndex((v) => Math.abs(v) === uMax);
  const [sel, setSel] = useState(iMax);
  const nodoSel = Math.min(sel, nodos.length - 1);
  const un = unidad(t.incognita.unidad, s);
  const exactFn = useMemo(() => {
    if (!res.exacta) return null;
    try {
      return compileExpr(res.exacta.expr).fn;
    } catch {
      return null;
    }
  }, [res.exacta]);

  const data = useCallback(
    (c: Colores) => {
      const trazas: unknown[] = [];
      if (exactFn) {
        const N = 300;
        const xs = Array.from({ length: N + 1 }, (_, i) => nodos[0] + ((nodos[nodos.length - 1] - nodos[0]) * i) / N);
        // Incluir los nodos para que las discontinuidades de pendiente se vean bien
        const todos = [...new Set([...xs, ...nodos])].sort((a, b) => a - b);
        trazas.push({
          x: todos,
          y: todos.map((x) => {
            try {
              return exactFn(x);
            } catch {
              return null;
            }
          }),
          type: 'scatter',
          mode: 'lines',
          name: 'Analítica',
          line: { color: c.exact, width: 2.5 },
          hovertemplate: `x = %{x:.4g}<br>${t.incognita.simbolo} exacta = %{y:.5g}<extra></extra>`,
        });
      }
      trazas.push({
        x: nodos,
        y: u,
        type: 'scatter',
        mode: nodos.length <= 80 ? 'lines+markers' : 'lines',
        name: 'MEF',
        line: { color: c.accentHover, width: 2, dash: exactFn ? 'dash' : 'solid' },
        marker: { color: c.bg, size: 9, line: { color: c.accentHover, width: 2 } },
        fill: exactFn ? undefined : 'tozeroy',
        fillcolor: 'rgba(224,109,50,0.10)',
        hovertemplate: `Nodo %{pointNumber}<br>x = %{x:.4g}<br>${t.incognita.simbolo} MEF = %{y:.5g}<extra></extra>`,
      });
      trazas.push({
        x: [nodos[nodoSel]],
        y: [u[nodoSel]],
        type: 'scatter',
        mode: 'markers',
        marker: { color: c.accentHover, size: 14, line: { color: c.amber, width: 2.5 } },
        hoverinfo: 'skip',
      });
      return trazas;
    },
    [nodos, u, exactFn, nodoSel, t.incognita.simbolo],
  );
  const layout = useCallback(
    (c: Colores) => ({
      xaxis: { title: { text: `x ${unidad(t.unidadLongitud, s) ? `[${unidad(t.unidadLongitud, s)}]` : ''}` } },
      yaxis: { title: { text: `${t.incognita.simbolo}${un && un !== '—' ? ` [${un}]` : ''}` } },
      shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 0, y1: 0, line: { color: c.line, width: 1 } }],
    }),
    [t, s, un],
  );

  const err = res.sol.error;
  const normaU = useMemo(() => {
    let acc = 0;
    for (let i = 0; i < nodos.length - 1; i++) {
      const h = nodos[i + 1] - nodos[i];
      acc += (h / 3) * (u[i] ** 2 + u[i] * u[i + 1] + u[i + 1] ** 2);
    }
    return Math.sqrt(acc);
  }, [nodos, u]);

  return (
    <>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-base font-bold text-ink">{t.incognita.nombre}</h2>
              <Badge>
                {t.incognita.simbolo}(x){un && un !== '—' ? ` [${un}]` : ''}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-ink-2">
              {exactFn ? `MEF lineal por tramos vs. solución analítica ${res.exacta?.origen === 'automatica' ? '(automática)' : '(escrita)'}` : 'Solución MEF lineal por tramos'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {exactFn && (
              <span className="flex items-center gap-1.5 rounded-full border border-line bg-inset px-2.5 py-1 font-mono text-[11px] text-ink">
                <span className="h-0.5 w-3 rounded-full bg-[var(--plot-exact)]" /> Analítica
              </span>
            )}
            <span className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-bg px-2.5 py-1 font-mono text-[11px] font-semibold text-accent-soft">
              <span className="h-2 w-2 rounded-full bg-accent-hover" /> MEF ({nodos.length} nodos)
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-inset p-1">
          <Grafica
            data={data}
            layout={layout}
            alto={270}
            etiqueta={`Gráfica de ${t.incognita.nombre} contra x`}
            onPunto={(p) => p.curva === (exactFn ? 1 : 0) && setSel(p.indice)}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-s1 px-3 py-2">
          <div className="flex items-center gap-2">
            <Icon name="touch_app" className="text-[18px] text-accent-hover" />
            <span className="font-mono text-xs text-ink">
              Nodo N{sub(nodoSel + 1)}: x = {fmtNum(nodos[nodoSel])}
            </span>
          </div>
          <span className="font-mono text-xs font-bold text-accent-soft">
            {t.incognita.simbolo} = {fmtNum(u[nodoSel], 5)} {un !== '—' ? un : ''}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Boton variante="fantasma" icon="chevron_left" disabled={nodoSel === 0} onClick={() => setSel(nodoSel - 1)} className="min-h-[34px] py-1 text-xs">
            Anterior
          </Boton>
          <span className="font-mono text-[11px] text-ink-3">Toca un nodo de la gráfica</span>
          <Boton variante="fantasma" disabled={nodoSel === nodos.length - 1} onClick={() => setSel(nodoSel + 1)} className="min-h-[34px] py-1 text-xs">
            Siguiente <Icon name="chevron_right" className="text-[18px]" />
          </Boton>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {res.kpis.map((k, i) => {
          const p = conPrefijo(k.valor.valor, k.unidad);
          return (
            <Kpi
              key={k.def.id}
              titulo={k.def.nombre}
              simbolo={k.def.simbolo}
              valor={fmtNum(k.unidad === un && Math.abs(k.valor.valor) < 1e-12 * (uMax || 1) ? 0 : p.valor, 4)}
              unidad={p.unidad}
              detalle={k.valor.detalle ?? (k.valor.x !== undefined ? `en x = ${fmtNum(k.valor.x)}` : undefined)}
              icon={k.valor.x !== undefined ? 'pin_drop' : undefined}
              tono={i % 3 === 1 ? 'amber' : 'accent'}
            />
          );
        })}
        {err && (
          <Kpi
            titulo="Error global L²"
            simbolo="‖e‖"
            valor={fmtNum(err.L2, 3)}
            detalle={normaU > 0 ? `relativo: ${fmtNum((100 * err.L2) / normaU, 3)} %` : undefined}
            icon="query_stats"
            tono="neutral"
          />
        )}
      </div>

      <Card className="flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-line bg-s1 p-4">
          <div className="flex items-center gap-2">
            <Icon name="table_chart" className="text-[22px] text-accent-hover" />
            <h3 className="font-heading text-base font-bold text-ink">Resultados nodales</h3>
          </div>
          <Badge>{nodos.length} nodos</Badge>
        </div>
        <Tabla
          cabecera={[
            'Nodo',
            `x`,
            `${t.incognita.simbolo} MEF`,
            ...(err ? [`${t.incognita.simbolo} exacta`, 'Error'] : []),
          ]}
          alinear={['left', 'right', 'right', 'right', 'right']}
          resaltar={iMax}
          filas={nodos.map((x, i) => [
            <span key="n" className="font-bold text-accent-soft">N{sub(i + 1)}</span>,
            fmtNum(x),
            fmtNum(snap(u[i], uMax), 5),
            ...(err ? [fmtNum(snap(err.exactAtNodes[i], uMax), 5), fmtNum(snap(err.nodal[i], uMax), 3)] : []),
          ])}
        />
        <div className="flex items-center justify-between border-t border-line bg-s1 px-4 py-2.5">
          <span className="font-mono text-[11px] text-ink-2">Fila resaltada: |{t.incognita.simbolo}| máximo</span>
          {un && un !== '—' && <span className="font-mono text-[11px] text-ink-3">Unidades: {un}</span>}
        </div>
      </Card>
    </>
  );
}

function PestanaDerivadas({ res }: { res: Resultado1D }) {
  const t = res.plantilla;
  const s = res.estado.sistema;
  const [mag, setMag] = useState(t.derivadas[t.derivadas.length - 1].id);
  const d = t.derivadas.find((x) => x.id === mag) ?? t.derivadas[0];
  const vals = res.porElemento[d.id];
  const els = res.elementos;
  const ud = unidad(d.unidad, s);

  const data = useCallback(
    (c: Colores) => {
      const xs: number[] = [];
      const ys: number[] = [];
      els.forEach((el, i) => {
        xs.push(el.xa, el.xb);
        ys.push(vals[i], vals[i]);
      });
      return [
        {
          x: xs,
          y: ys,
          type: 'scatter',
          mode: 'lines',
          line: { color: c.amber, width: 2.2 },
          fill: 'tozeroy',
          fillcolor: 'rgba(245,158,11,0.10)',
          hovertemplate: `x = %{x:.4g}<br>${d.simbolo} = %{y:.5g}<extra></extra>`,
        },
      ];
    },
    [els, vals, d.simbolo],
  );
  const layout = useCallback(
    () => ({
      xaxis: { title: { text: `x ${unidad(t.unidadLongitud, s) ? `[${unidad(t.unidadLongitud, s)}]` : ''}` } },
      yaxis: { title: { text: `${d.simbolo}${ud && ud !== '—' ? ` [${ud}]` : ''}` } },
    }),
    [t, s, d.simbolo, ud],
  );
  const bal = res.sol.balance;
  const cierra = Math.abs(bal.residual) <= 1e-8 * bal.scale;
  const en = res.sol.energy;

  return (
    <>
      <Card className="flex flex-col gap-3 p-4">
        <CardHeader icon="stacked_line_chart" title={d.nombre} subtitle="Constante en cada elemento (derivada de una función lineal)" />
        <Selector value={d.id} onChange={setMag} opciones={t.derivadas.map((x) => ({ valor: x.id, texto: `${x.simbolo} · ${x.nombre}` }))} />
        <div className="rounded-xl border border-line bg-inset p-1">
          <Grafica data={data} layout={layout} alto={240} etiqueta={`Gráfica de ${d.nombre} por elemento`} />
        </div>
      </Card>

      {res.reacciones.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {res.reacciones.map((rc) => {
            const p = conPrefijo(rc.valor, rc.unidad);
            return (
              <Kpi
                key={rc.lado}
                titulo={`Reacción ${rc.lado}`}
                simbolo={`${t.reaccion.simbolo}`}
                valor={fmtNum(snap(p.valor, bal.scale, 1e-12), 5)}
                unidad={p.unidad}
                detalle={`en x = ${fmtNum(rc.x)}`}
                icon="lock"
                tono="amber"
              />
            );
          })}
        </div>
      )}
      {res.reacciones.length > 0 && <p className="-mt-2 text-[11px] text-ink-3">{t.reaccion.nombre}. Convención: R = k·∂u/∂n con la normal exterior.</p>}

      <Card className="flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-line bg-s1 p-4">
          <div className="flex items-center gap-2">
            <Icon name="view_column" className="text-[22px] text-accent-hover" />
            <h3 className="font-heading text-base font-bold text-ink">Resultados por elemento</h3>
          </div>
          <Badge>{els.length} elementos</Badge>
        </div>
        <Tabla
          cabecera={['Elem.', 'Nodos', 'x medio', 'h', ...t.derivadas.map((x) => `${x.simbolo}${unidad(x.unidad, s) && unidad(x.unidad, s) !== '—' ? ` [${unidad(x.unidad, s)}]` : ''}`)]}
          alinear={['left', 'center', 'right', 'right', ...t.derivadas.map(() => 'right' as const)]}
          filas={els.map((el, i) => [
            <span key="e" className="font-bold text-accent-soft">e{sub(el.id)}</span>,
            `${res.sol.elements[i].nodes[0] + 1}–${res.sol.elements[i].nodes[1] + 1}`,
            fmtNum(el.xm),
            fmtNum(el.h),
            ...t.derivadas.map((x) => fmtNum(el.valores[x.id], 5)),
          ])}
        />
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <CardHeader
          icon="balance"
          title="Balance global (equilibrio)"
          subtitle="Suma de todo lo que entra al dominio; debe ser ≈ 0"
          right={<Badge tono={cierra ? 'ok' : 'danger'}>{cierra ? 'Cierra' : 'No cierra'}</Badge>}
        />
        <Tabla
          cabecera={['Término', 'Valor']}
          alinear={['left', 'right']}
          filas={[...bal.terms.map((x) => [x.nombre, fmtNum(snap(x.valor, bal.scale, 1e-14), 6)]), [<b key="a">Suma (residuo)</b>, <b key="b">{fmtNum(bal.residual, 3)}</b>]]}
        />
        {en.aplica ? (
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-inset p-3 font-mono text-xs">
            <span className="text-ink-2">Energía de deformación ½uᵀKu</span>
            <span className="text-right text-ink">{fmtNum(en.U, 6)}</span>
            <span className="text-ink-2">Trabajo externo ½(uᵀF + Σ R·ū)</span>
            <span className="text-right text-ink">{fmtNum(en.W, 6)}</span>
          </div>
        ) : (
          <p className="text-[11px] text-ink-3">{en.motivo}</p>
        )}
      </Card>

      <Card className="flex flex-col gap-2 p-4">
        <CardHeader icon="memory" title="Detalles de la solución" />
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-xs">
          <span className="text-ink-2">Fronteras Dirichlet</span>
          <span className="text-right text-ink">{res.sol.bcMethod === 'eliminacion' ? 'Eliminación' : `Penalización (β = ${fmtNum(res.sol.beta ?? 0, 3)})`}</span>
          <span className="text-ink-2">Solucionador</span>
          <span className="text-right text-ink">{res.sol.solverUsed === 'thomas' ? 'Algoritmo de Thomas' : 'Gauss con pivoteo'}</span>
          <span className="text-ink-2">Tamaño del sistema</span>
          <span className="text-right text-ink">
            {res.sol.system.K.length} × {res.sol.system.K.length}
          </span>
          <span className="text-ink-2">Residuo ‖K·u − F‖</span>
          <span className="text-right text-ink">{fmtNum(res.sol.residualNorm, 3)}</span>
          <span className="text-ink-2">Puntos de Gauss</span>
          <span className="text-right text-ink">{res.problem.gaussPoints}</span>
        </div>
      </Card>
    </>
  );
}

function PestanaMatrices({ res }: { res: Resultado1D }) {
  const sol = res.sol;
  const n = sol.mesh.nodes.length;
  const todos = Array.from({ length: n }, (_, i) => i + 1);
  const resuelto =
    sol.bcMethod === 'eliminacion'
      ? `Sistema reducido por eliminación: se quitaron las filas y columnas de los nodos con Dirichlet (${sol.system.K.length}×${sol.system.K.length}).`
      : `Sistema penalizado: β = ${fmtNum(sol.beta ?? 0, 3)} sumado en la diagonal de los nodos con Dirichlet.`;
  return (
    <PanelMatrices
      sistemas={[
        { id: 'ensamblada', nombre: 'Ensamblada', descripcion: 'Suma de las matrices elementales, antes de cargas puntuales y fronteras.', K: sol.Kassembled, F: sol.Fassembled, etiquetas: todos },
        { id: 'naturales', nombre: 'Con fronteras naturales', descripcion: 'Con cargas puntuales y condiciones Neumann y Robin (antes de imponer Dirichlet).', K: sol.K, F: sol.F, etiquetas: todos },
        { id: 'resuelto', nombre: 'Sistema resuelto', descripcion: resuelto, K: sol.system.K, F: sol.system.F, etiquetas: sol.system.free.map((i) => i + 1) },
      ]}
      u={sol.u}
      etiquetasU={todos}
      elementos={sol.elements.map((el) => ({
        nombre: `e${sub(el.id)}: nodos ${el.nodes[0] + 1}–${el.nodes[1] + 1}, h = ${fmtNum(el.h)}`,
        Ke: el.Ke,
        Fe: el.Fe,
        gdl: [el.nodes[0] + 1, el.nodes[1] + 1],
      }))}
    />
  );
}
