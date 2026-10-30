/** Estructura de una matriz al estilo spy de MATLAB (SVG). */
import type { InfoMatriz } from '../../core';

export function Spy({ info, M, titulo, porSigno = true }: { info: InfoMatriz; M: number[][]; titulo: string; porSigno?: boolean }) {
  const n = info.filas;
  const m = info.columnas;
  const T = 300;
  const pad = 26;
  const cel = (T - 2 * pad) / Math.max(n, m, 1);
  const r = Math.max(0.9, Math.min(cel * 0.38, 7));
  const X = (j: number) => pad + (j + 0.5) * cel;
  const Y = (i: number) => pad + (i + 0.5) * cel;
  const marcas = [...new Set([0, Math.floor((n - 1) / 2), n - 1])].filter((k) => k >= 0);
  return (
    <svg viewBox={`0 0 ${T} ${T + 18}`} className="h-auto w-full max-w-[340px]" role="img" aria-label={`${titulo}: ${info.filas}×${info.columnas}, ${info.nnz} entradas no nulas`}>
      <rect x={pad} y={pad} width={cel * m} height={cel * n} fill="var(--inset)" stroke="var(--line-strong)" />
      <line x1={pad} y1={pad} x2={pad + cel * Math.min(n, m)} y2={pad + cel * Math.min(n, m)} stroke="var(--line)" strokeDasharray="3 3" />
      {info.noNulos.map(([i, j]) => (
        <circle key={`${i},${j}`} cx={X(j)} cy={Y(i)} r={r} fill={porSigno && M[i][j] < 0 ? 'var(--compress)' : 'var(--accent-hover)'} />
      ))}
      {marcas.map((k) => (
        <g key={k} fontSize={9} fill="var(--ink-2)" fontFamily="var(--font-mono)">
          <text x={X(k)} y={pad - 8} textAnchor="middle">
            {k + 1}
          </text>
          <text x={pad - 6} y={Y(k) + 3} textAnchor="end">
            {k + 1}
          </text>
        </g>
      ))}
      <text x={T / 2} y={T + 10} textAnchor="middle" fontSize={10} fill="var(--ink-2)" fontFamily="var(--font-mono)">
        nz = {info.nnz}
      </text>
    </svg>
  );
}
