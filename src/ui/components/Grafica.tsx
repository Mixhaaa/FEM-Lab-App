/** Gráfica con Plotly (cargado bajo demanda) adaptada al tema. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PlotlyHTMLElement } from 'plotly.js-basic-dist-min';
import { useApp } from '../store';
import { Tabla } from './base';

type Plotly = (typeof import('plotly.js-basic-dist-min'))['default'];
let cargando: Promise<Plotly> | null = null;
export function cargarPlotly(): Promise<Plotly> {
  cargando ??= import('plotly.js-basic-dist-min').then((m) => m.default);
  return cargando;
}

export function colores(el?: Element | null) {
  const cs = getComputedStyle(el ?? document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    ink: v('--ink'),
    ink2: v('--ink-2'),
    ink3: v('--ink-3'),
    grid: v('--plot-grid'),
    line: v('--line-strong'),
    accent: v('--accent'),
    accentHover: v('--accent-hover'),
    amber: v('--amber'),
    exact: v('--plot-exact'),
    compress: v('--compress'),
    bg: v('--inset'),
    s2: v('--s2'),
    rose: v('--rose'),
  };
}
export type Colores = ReturnType<typeof colores>;

function suscribirEsquema(cb: () => void) {
  const mq = window.matchMedia?.('(prefers-color-scheme: light)');
  mq?.addEventListener('change', cb);
  return () => mq?.removeEventListener('change', cb);
}
const sistemaClaro = () => !!window.matchMedia?.('(prefers-color-scheme: light)').matches;

function suscribirAncho(cb: () => void) {
  const mq = window.matchMedia?.('(min-width: 1024px)');
  mq?.addEventListener('change', cb);
  return () => mq?.removeEventListener('change', cb);
}
/** true en pantallas de escritorio (≥ 1024 px, el punto «lg» del diseño). Evita montar lo que el celular no muestra. */
export function useEsEscritorio(): boolean {
  return useSyncExternalStore(suscribirAncho, () => !!window.matchMedia?.('(min-width: 1024px)').matches, () => false);
}

/** Tema efectivo ('dark' | 'light'); se actualiza si cambia la preferencia o el sistema. */
export function useTema(): 'dark' | 'light' {
  const tema = useApp((s) => s.tema);
  const claro = useSyncExternalStore(suscribirEsquema, sistemaClaro, () => false);
  if (tema === 'oscuro') return 'dark';
  if (tema === 'claro') return 'light';
  return claro ? 'light' : 'dark';
}

export function layoutBase(c: Colores, extra: Record<string, unknown> = {}) {
  const grande = document.documentElement.dataset.presentacion === '1';
  const fs = grande ? 15 : 11;
  const eje = {
    gridcolor: c.grid,
    zerolinecolor: c.line,
    linecolor: c.line,
    tickfont: { color: c.ink2, size: fs },
    title: { font: { color: c.ink2, size: fs + 1 } },
    automargin: true,
    exponentformat: 'power',
  };
  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'JetBrains Mono Variable, JetBrains Mono, monospace', color: c.ink2, size: fs },
    margin: { l: 52, r: 14, t: 10, b: 44 },
    showlegend: false,
    hovermode: 'closest',
    hoverlabel: { bgcolor: c.s2, bordercolor: c.accent, font: { color: c.ink, family: 'JetBrains Mono Variable, monospace' } },
    dragmode: false,
    ...extra,
    xaxis: { ...eje, ...((extra.xaxis as object) ?? {}) },
    yaxis: { ...eje, ...((extra.yaxis as object) ?? {}) },
  };
}

export function Grafica({
  data,
  layout,
  alto = 260,
  ancho,
  onPunto,
  etiqueta,
  resumen,
  valores,
}: {
  /** Recibe los colores del tema y devuelve las trazas. */
  data: (c: Colores) => unknown[];
  layout?: (c: Colores) => Record<string, unknown>;
  alto?: number;
  /** Ancho fijo en px (por defecto ocupa el ancho del contenedor). */
  ancho?: number;
  onPunto?: (p: { curva: number; indice: number; x: number; y: number }) => void;
  etiqueta: string;
  /** Frase que resume lo que muestra la gráfica (máximo, mínimo, comparación), para lectores de pantalla. */
  resumen?: string;
  /** Los mismos datos como tabla, que se muestra plegada debajo de la gráfica. */
  valores?: { cabecera: string[]; filas: string[][]; alinear?: ('left' | 'right' | 'center')[] };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tema = useTema();
  const presentacion = useApp((s) => s.presentacion);
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const onPuntoRef = useRef(onPunto);
  useEffect(() => {
    onPuntoRef.current = onPunto;
  }, [onPunto]);

  useEffect(() => {
    let vivo = true;
    cargarPlotly()
      .then(async (Plotly) => {
        if (!vivo || !ref.current) return;
        const c = colores(ref.current);
        const el = (await Plotly.react(ref.current, data(c), layoutBase(c, layout?.(c) ?? {}), {
          displaylogo: false,
          responsive: true,
          displayModeBar: false,
          scrollZoom: false,
        })) as PlotlyHTMLElement;
        el.removeAllListeners?.('plotly_click');
        el.on('plotly_click', (e) => {
          const p = e.points?.[0];
          if (p) onPuntoRef.current?.({ curva: p.curveNumber, indice: p.pointIndex, x: p.x, y: p.y });
        });
        setEstado('ok');
      })
      .catch(() => vivo && setEstado('error'));
    return () => {
      vivo = false;
    };
  }, [data, layout, tema, presentacion]);

  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el) cargarPlotly().then((P) => P.purge(el));
    };
  }, []);

  const grafica = (
    <div className="relative w-full" style={{ height: alto, ...(ancho ? { width: ancho, minWidth: ancho } : {}) }} role="img" aria-label={resumen ? `${etiqueta}. ${resumen}` : etiqueta}>
      <div ref={ref} className="h-full w-full" />
      {estado !== 'ok' && (
        <div role="status" className="absolute inset-0 flex items-center justify-center font-mono text-mini text-ink-2">
          {estado === 'cargando' ? 'Cargando gráfica…' : 'No se pudo cargar la gráfica. Los valores están en la tabla.'}
        </div>
      )}
    </div>
  );
  if (!valores) return grafica;
  return (
    <div className="flex w-full flex-col gap-2">
      {grafica}
      <details className="no-print group rounded-lg border border-line bg-s2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-detalle font-semibold text-ink-2 hover:text-ink">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px] transition-transform group-open:rotate-90">chevron_right</span>
          Ver los valores en una tabla ({valores.filas.length} filas)
        </summary>
        <Tabla etiqueta={`Valores de: ${etiqueta}`} cabecera={valores.cabecera} filas={valores.filas} alinear={valores.alinear} className="max-h-72 overflow-y-auto border-t border-line" />
      </details>
    </div>
  );
}
