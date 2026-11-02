/** Gráfica con Plotly (cargado bajo demanda) adaptada al tema. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PlotlyHTMLElement } from 'plotly.js-basic-dist-min';
import { useApp } from '../store';

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
}: {
  /** Recibe los colores del tema y devuelve las trazas. */
  data: (c: Colores) => unknown[];
  layout?: (c: Colores) => Record<string, unknown>;
  alto?: number;
  /** Ancho fijo en px (por defecto ocupa el ancho del contenedor). */
  ancho?: number;
  onPunto?: (p: { curva: number; indice: number; x: number; y: number }) => void;
  etiqueta: string;
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

  return (
    <div className="relative w-full" style={{ height: alto, ...(ancho ? { width: ancho, minWidth: ancho } : {}) }} role="img" aria-label={etiqueta}>
      <div ref={ref} className="h-full w-full" />
      {estado !== 'ok' && (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-mini text-ink-3">
          {estado === 'cargando' ? 'Cargando gráfica…' : 'No se pudo cargar la gráfica.'}
        </div>
      )}
    </div>
  );
}
