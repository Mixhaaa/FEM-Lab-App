declare module 'plotly.js-dist-min' {
  // Tipos mínimos que usa FEM Lab
  export interface PlotlyHTMLElement extends HTMLDivElement {
    on(event: 'plotly_click', cb: (e: { points: { pointIndex: number; curveNumber: number; x: number; y: number }[] }) => void): void;
    removeAllListeners?(event: string): void;
  }
  const Plotly: {
    react(el: HTMLElement, data: unknown[], layout: unknown, config?: unknown): Promise<PlotlyHTMLElement>;
    purge(el: HTMLElement): void;
    toImage(el: HTMLElement, opts: { format: 'png' | 'svg'; width?: number; height?: number; scale?: number }): Promise<string>;
    Plots: { resize(el: HTMLElement): void };
  };
  export default Plotly;
}
