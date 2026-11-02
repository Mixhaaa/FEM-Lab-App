import { useCallback, useEffect, useMemo, useState } from 'react';
import { convergenceStudy, ordenesLocales, type ConvergenceResult } from '../../core';
import { unidad, type Resultado1D } from '../../templates';
import { Aviso, Badge, Card, CardHeader, Icon, Kpi, Segmentos, Tabla } from '../components/base';
import { Grafica, type Colores } from '../components/Grafica';
import { fmtFijo, fmtNum, snap, sub } from '../format';

type Estado = { tipo: 'calculando' } | { tipo: 'ok'; conv: ConvergenceResult; ms: number } | { tipo: 'error'; mensaje: string };

const ESPERADO = { nodal: 2, L2: 2, H1: 1 };

function OrdenKpi({ titulo, valor, esperado, simbolo }: { titulo: string; valor: number; esperado: number; simbolo: string }) {
  const ok = Number.isFinite(valor) && Math.abs(valor - esperado) <= 0.25;
  return (
    <Kpi
      titulo={titulo}
      simbolo={simbolo}
      valor={fmtFijo(valor, 2)}
      detalle={Number.isFinite(valor) ? `esperado ${esperado}` : 'no aplica'}
      icon={ok ? 'check_circle' : 'info'}
      tono={ok ? 'accent' : 'neutral'}
    />
  );
}

export function PestanaConvergencia({ res }: { res: Resultado1D }) {
  const [neMax, setNeMax] = useState<'64' | '128' | '256' | '512'>('256');
  // El resultado guarda la "clave" con la que se calculó; si no coincide, se está calculando
  const clave = useMemo(() => ({ problem: res.problem, exacta: res.exacta?.expr, neMax }), [res.problem, res.exacta, neMax]);
  const [hecho, setHecho] = useState<{ clave: typeof clave; estado: Estado } | null>(null);
  const estado: Estado = hecho && hecho.clave === clave ? hecho.estado : { tipo: 'calculando' };

  useEffect(() => {
    let vivo = true;
    // setTimeout: deja pintar el indicador antes del cálculo
    const id = setTimeout(() => {
      const t0 = performance.now();
      let e: Estado;
      try {
        const lista: number[] = [];
        for (let n = 2; n <= Number(clave.neMax); n *= 2) lista.push(n);
        const conv = convergenceStudy({ ...clave.problem, exact: clave.exacta }, lista);
        e = { tipo: 'ok', conv, ms: performance.now() - t0 };
      } catch (err) {
        e = { tipo: 'error', mensaje: (err as Error).message };
      }
      if (vivo) setHecho({ clave, estado: e });
    }, 30);
    return () => {
      vivo = false;
      clearTimeout(id);
    };
  }, [clave]);

  return (
    <>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <ErrorNodalActual res={res} />
      <Card className="flex flex-col gap-3 p-4">
        <CardHeader icon="query_stats" title="Estudio de convergencia" subtitle="Se resuelve con Ne = 2, 4, 8, … y se mide el error en cada malla." />
        <Segmentos
          label="Número máximo de elementos"
          value={neMax}
          onChange={setNeMax}
          opciones={(['64', '128', '256', '512'] as const).map((v) => ({ valor: v, texto: v }))}
        />
        {res.estado.malla.tipo === 'manual' && <p className="text-mini text-ink-3">Tu malla es manual: el estudio usa mallas uniformes.</p>}
        {res.estado.malla.tipo === 'geometrica' && <p className="text-mini text-ink-3">El estudio usa mallas refinadas con la misma razón y dirección que la tuya.</p>}
      </Card>
      </div>
      {estado.tipo === 'calculando' && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-line bg-s2 p-6 font-mono text-mini text-ink-2">
          <Icon name="query_stats" className="motion-safe:animate-pulse text-[20px] text-accent-hover" /> Calculando el estudio de convergencia…
        </div>
      )}
      {estado.tipo === 'error' && (
        <Aviso tipo="error" titulo="No se pudo calcular el estudio">
          {estado.mensaje}
        </Aviso>
      )}
      {estado.tipo === 'ok' && <ResultadoConvergencia conv={estado.conv} ms={estado.ms} res={res} />}
    </>
  );
}

function ResultadoConvergencia({ conv, ms, res }: { conv: ConvergenceResult; ms: number; res: Resultado1D }) {
  const rows = conv.rows;
  const h = useMemo(() => rows.map((r) => r.h), [rows]);
  const oN = ordenesLocales(h, rows.map((r) => r.maxNodal));
  const oL = ordenesLocales(h, rows.map((r) => r.L2));
  const oH = ordenesLocales(h, rows.map((r) => r.H1semi));
  const ul = unidad(res.plantilla.unidadLongitud, res.estado.sistema);

  const data = useCallback(
    (c: Colores) => {
      const series = [
        { y: rows.map((r) => r.maxNodal), nombre: 'Error nodal máx.', orden: conv.orden.nodal, color: c.accentHover, simbolo: 'circle' },
        { y: rows.map((r) => r.L2), nombre: 'Error L²', orden: conv.orden.L2, color: c.amber, simbolo: 'square' },
        { y: rows.map((r) => r.H1semi), nombre: 'Seminorma H¹', orden: conv.orden.H1, color: c.compress, simbolo: 'diamond' },
      ].filter((s) => s.y.every((v) => v > 0));
      const trazas: unknown[] = series.map((s) => ({
        x: h,
        y: s.y,
        type: 'scatter',
        mode: 'lines+markers',
        name: `${s.nombre}${Number.isFinite(s.orden) ? ` (p = ${fmtFijo(s.orden, 2)})` : ''}`,
        line: { color: s.color, width: 2 },
        marker: { color: s.color, size: 7, symbol: s.simbolo },
        hovertemplate: `h = %{x:.3g}<br>${s.nombre} = %{y:.3e}<extra></extra>`,
      }));
      // Rectas de referencia que pasan por el último punto
      const ref = (p: number, base: number[], nombre: string) => {
        const k = base[base.length - 1] / Math.pow(h[h.length - 1], p);
        trazas.push({
          x: [h[0], h[h.length - 1]],
          y: [k * Math.pow(h[0], p), base[base.length - 1]],
          type: 'scatter',
          mode: 'lines',
          name: nombre,
          line: { color: c.ink3, width: 1.2, dash: 'dot' },
          hoverinfo: 'skip',
        });
      };
      if (rows.every((r) => r.L2 > 0)) ref(2, rows.map((r) => r.L2), 'Referencia ∝ h²');
      if (rows.every((r) => r.H1semi > 0)) ref(1, rows.map((r) => r.H1semi), 'Referencia ∝ h');
      return trazas;
    },
    [rows, h, conv.orden],
  );
  const layout = useCallback(
    () => ({
      showlegend: true,
      legend: { orientation: 'h', x: 0, y: -0.28, font: { size: 10 } },
      margin: { l: 58, r: 12, t: 10, b: 96 },
      xaxis: { type: 'log', title: { text: `h ${ul ? `[${ul}]` : ''}` } },
      yaxis: { type: 'log', title: { text: 'error' } },
    }),
    [ul],
  );

  return (
    <>
      {conv.solucionExacta ? (
        <Aviso tipo="ok" titulo="El MEF es exacto en esta malla">
          La solución es lineal por tramos, así que los elementos lineales la reproducen sin error (salvo redondeo) con cualquier malla que tenga nodos en los cambios de tramo y en las cargas. No tiene sentido hablar de orden.
        </Aviso>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <OrdenKpi titulo="Orden nodal" simbolo="p" valor={conv.orden.nodal} esperado={ESPERADO.nodal} />
          <OrdenKpi titulo="Orden L²" simbolo="p" valor={conv.orden.L2} esperado={ESPERADO.L2} />
          <OrdenKpi titulo="Orden H¹" simbolo="p" valor={conv.orden.H1} esperado={ESPERADO.H1} />
        </div>
      )}
      {conv.superconvergenciaNodal && (
        <Aviso tipo="info" titulo="Superconvergencia en los nodos">
          El error en los nodos es del orden del redondeo: con k constante, b = c = 0 y f integrada con suficiente precisión, los elementos lineales dan los valores exactos en los nodos. El error dentro de los elementos sí disminuye como h² (L²) y h (H¹).
        </Aviso>
      )}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      {!conv.solucionExacta && (
        <Card className="flex flex-col gap-3 p-4">
          <CardHeader icon="show_chart" title="Error contra h (escala log-log)" subtitle="La pendiente de cada recta es el orden de convergencia p: error ≈ C·hᵖ." />
          <div className="rounded-xl border border-line bg-inset p-1">
            <Grafica
              data={data}
              layout={layout}
              alto={360}
              etiqueta="Gráfica log-log del error contra el tamaño de elemento"
              resumen={`Errores de ${rows.length} mallas, de h = ${fmtNum(h[0], 3)} a h = ${fmtNum(h[h.length - 1], 3)}. Pendientes medidas: nodal ${fmtNum(conv.orden.nodal, 3)}, L² ${fmtNum(conv.orden.L2, 3)}, H¹ ${fmtNum(conv.orden.H1, 3)}. Los valores están en la tabla «Errores por malla».`}
            />
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line bg-s1 p-4">
          <div className="flex items-center gap-2">
            <Icon name="table_chart" className="text-[22px] text-accent-hover" />
            <h3 className="font-heading text-seccion font-bold text-ink">Errores por malla</h3>
          </div>
          <Badge>{fmtNum(ms, 2)} ms</Badge>
        </div>
        <Tabla
          cabecera={['Ne', 'h', 'e nodal', 'p', 'e L²', 'p', '|e| H¹', 'p']}
          alinear={Array(8).fill('right')}
          filas={rows.map((r, i) => [
            r.ne,
            fmtNum(r.h, 4),
            fmtNum(r.maxNodal, 3),
            Number.isFinite(oN[i]) && !conv.superconvergenciaNodal && !conv.solucionExacta ? fmtFijo(oN[i], 2) : '—',
            fmtNum(r.L2, 3),
            Number.isFinite(oL[i]) && !conv.solucionExacta ? fmtFijo(oL[i], 2) : '—',
            fmtNum(r.H1semi, 3),
            Number.isFinite(oH[i]) && !conv.solucionExacta ? fmtFijo(oH[i], 2) : '—',
          ])}
        />
        <div className="border-t border-line bg-s1 px-4 py-3 text-mini leading-snug text-ink-2">
          p = orden local entre mallas consecutivas: log(eᵢ₋₁/eᵢ) / log(hᵢ₋₁/hᵢ). El orden de arriba se ajusta por mínimos cuadrados con las mallas más finas.{' '}
          {conv.referencia === 'analitica'
            ? `Referencia: solución analítica ${res.exacta?.origen === 'automatica' ? 'calculada automáticamente' : 'escrita por ti'}.`
            : `Referencia: sin solución analítica, se compara con una malla fina de ${conv.refNe} elementos.`}
        </div>
      </Card>
      </div>
    </>
  );
}

function ErrorNodalActual({ res }: { res: Resultado1D }) {
  const err = res.sol.error;
  const nodos = res.sol.mesh.nodes;
  const t = res.plantilla;
  const errores = useMemo(() => {
    const escala = Math.max(...res.sol.u.map(Math.abs), 1e-300);
    return err ? err.nodal.map((v) => snap(v, escala)) : [];
  }, [err, res.sol.u]);
  const data = useCallback(
    (c: Colores) => [
      {
        x: nodos,
        y: errores,
        type: 'scatter',
        mode: nodos.length <= 80 ? 'lines+markers' : 'lines',
        line: { color: c.rose, width: 2 },
        marker: { color: c.rose, size: 7 },
        hovertemplate: `x = %{x:.4g}<br>error = %{y:.3e}<extra></extra>`,
      },
    ],
    [nodos, errores],
  );
  const layout = useCallback(
    () => ({
      xaxis: { title: { text: 'x' } },
      yaxis: { title: { text: `${t.incognita.simbolo} MEF − ${t.incognita.simbolo} exacta` } },
    }),
    [t.incognita.simbolo],
  );
  if (!err) {
    return (
      <Aviso tipo="info" titulo="Sin solución analítica">
        No hay una solución analítica para comparar nodo a nodo (los coeficientes no son constantes o hay cargas puntuales). Puedes escribirla en Configuración → «Solución analítica». El estudio de convergencia usa igual una malla fina como referencia.
      </Aviso>
    );
  }
  const k = err.nodal.reduce((a, v, i) => (Math.abs(v) > Math.abs(err.nodal[a]) ? i : a), 0);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <CardHeader
        icon="error"
        title={`Error nodal con Ne = ${res.sol.elements.length}`}
        subtitle="Diferencia entre la solución MEF y la analítica en cada nodo"
        right={<Badge tono="neutral">máx. en N{sub(k + 1)}</Badge>}
      />
      <div className="rounded-xl border border-line bg-inset p-1">
        <Grafica
          data={data}
          layout={layout}
          alto={220}
          etiqueta="Gráfica del error nodal contra x"
          resumen={`El mayor error, ${fmtNum(err.nodal[k], 3)}, está en el nodo ${k + 1} (x = ${fmtNum(nodos[k])}).`}
          valores={{
            cabecera: ['Nodo', 'x', `${t.incognita.simbolo} MEF − ${t.incognita.simbolo} exacta`],
            alinear: ['center', 'right', 'right'],
            filas: nodos.map((x, i) => [String(i + 1), fmtNum(x), fmtNum(errores[i], 3)]),
          }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 font-mono text-mini">
        {(
          [
            ['máx |eᵢ|', err.maxNodal],
            ['‖e‖ L²', err.L2],
            ['|e| H¹', err.H1semi],
          ] as const
        ).map(([n, v]) => (
          <div key={n} className="rounded-lg border border-line bg-inset p-2 text-center">
            <span className="block text-ink-2">{n}</span>
            <span className="text-ink">{fmtNum(v, 3)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
