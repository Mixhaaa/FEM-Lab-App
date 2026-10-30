/** Plano SVG de una armadura 2D: barras, nodos, apoyos, cargas y deformada. */
import type { TrussSolution } from '../../core';
import type { EstadoArmadura } from '../../templates';
import { fmtNum } from '../format';

export type Seleccion = { tipo: 'nodo'; i: number } | { tipo: 'barra'; i: number } | null;

const W = 460;

export function PlanoArmadura({
  e,
  coords,
  sol,
  escala,
  verDeformada,
  verFuerzas,
  sel,
  onSel,
}: {
  e: EstadoArmadura;
  coords: { x: number; y: number }[];
  sol?: TrussSolution;
  escala: number;
  verDeformada: boolean;
  verFuerzas: boolean;
  sel: Seleccion;
  onSel: (s: Seleccion) => void;
}) {
  const def = coords.map((p, i) => ({ x: p.x + (sol ? sol.u[2 * i] * escala : 0), y: p.y + (sol ? sol.u[2 * i + 1] * escala : 0) }));
  const todos = verDeformada && sol ? [...coords, ...def] : coords;
  const xs = todos.map((p) => p.x).filter(Number.isFinite);
  const ys = todos.map((p) => p.y).filter(Number.isFinite);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const ancho = Math.max(maxX - minX, maxY - minY, 1e-9);
  const pad = 66;
  const s = (W - 2 * pad) / Math.max(maxX - minX, ancho * 0.25);
  const H = Math.min(380, Math.max(200, (maxY - minY) * s + 2 * pad + 20));
  const offY = (H - (maxY - minY) * s) / 2;
  const P = (p: { x: number; y: number }) => ({ X: pad + (p.x - minX) * s, Y: H - offY - (p.y - minY) * s });

  const Nmax = sol ? Math.max(...sol.bars.map((b) => Math.abs(b.N)), 1e-300) : 1;
  const colorBarra = (k: number) => {
    if (!sol || !verFuerzas) return 'var(--accent)';
    const b = sol.bars[k];
    if (!b || b.estado === 'nula') return 'var(--ink-3)';
    return b.N > 0 ? 'var(--amber)' : 'var(--compress)';
  };
  const grosor = (k: number) => (sol && verFuerzas && sol.bars[k] ? 1.5 + 4 * (Math.abs(sol.bars[k].N) / Nmax) : 3);
  const Fmax = Math.max(...e.cargas.map((c) => Math.hypot(Number(c.Fx) || 0, Number(c.Fy) || 0)), 1e-300);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" role="img" aria-label={`Armadura de ${coords.length} nodos y ${e.barras.length} barras`}>
      <defs>
        <marker id="flecha-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 1.5 L10 5 L0 8.5z" fill="var(--amber)" />
        </marker>
        <pattern id="rejilla" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0 L0 0 0 20" fill="none" stroke="var(--plot-grid)" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="url(#rejilla)" />

      {/* Barras */}
      {e.barras.map((b, k) => {
        const a = coords[b.i];
        const c = coords[b.j];
        if (!a || !c) return null;
        const A = P(a);
        const C = P(c);
        const activa = sel?.tipo === 'barra' && sel.i === k;
        return (
          <g key={k} onClick={() => onSel({ tipo: 'barra', i: k })} className="cursor-pointer">
            <line x1={A.X} y1={A.Y} x2={C.X} y2={C.Y} stroke="transparent" strokeWidth={16} />
            <line
              x1={A.X}
              y1={A.Y}
              x2={C.X}
              y2={C.Y}
              stroke={colorBarra(k)}
              strokeWidth={activa ? grosor(k) + 2.5 : grosor(k)}
              strokeLinecap="round"
              opacity={verDeformada && sol ? 0.45 : 1}
            />
            {coords.length <= 16 && (
              <g transform={`translate(${(A.X + C.X) / 2},${(A.Y + C.Y) / 2})`}>
                <rect x={-9} y={-7} width={18} height={13} rx={3} fill="var(--s2)" stroke={activa ? 'var(--accent-hover)' : 'var(--line)'} />
                <text y={3} textAnchor="middle" fontSize={8} fontWeight={700} fill="var(--ink-2)" fontFamily="var(--font-mono)">
                  {k + 1}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Deformada */}
      {verDeformada &&
        sol &&
        e.barras.map((b, k) => {
          const A = P(def[b.i]);
          const C = P(def[b.j]);
          return <line key={k} x1={A.X} y1={A.Y} x2={C.X} y2={C.Y} stroke={colorBarra(k)} strokeWidth={2} strokeDasharray="5 3" pointerEvents="none" />;
        })}

      {/* Apoyos */}
      {e.apoyos.map((ap, k) => {
        const p = coords[ap.nodo];
        if (!p) return null;
        const { X, Y } = P(p);
        const rot = ap.tipo === 'rodillo-y' ? 90 : 0;
        const rodillo = ap.tipo !== 'articulado';
        return (
          <g key={k} transform={`translate(${X},${Y}) rotate(${rot})`} pointerEvents="none">
            <path d="M0 0 L-11 17 L11 17 Z" fill="var(--s3)" stroke="var(--ink-2)" strokeWidth={1.4} />
            {rodillo ? (
              <>
                <circle cx={-6} cy={21} r={3} fill="none" stroke="var(--ink-2)" strokeWidth={1.2} />
                <circle cx={6} cy={21} r={3} fill="none" stroke="var(--ink-2)" strokeWidth={1.2} />
                <line x1={-14} x2={14} y1={25.5} y2={25.5} stroke="var(--ink-2)" strokeWidth={1.4} />
              </>
            ) : (
              <line x1={-14} x2={14} y1={18} y2={18} stroke="var(--ink-2)" strokeWidth={2} />
            )}
          </g>
        );
      })}

      {/* Cargas */}
      {e.cargas.map((c, k) => {
        const p = coords[c.nodo];
        const fx = Number(c.Fx) || 0;
        const fy = Number(c.Fy) || 0;
        const m = Math.hypot(fx, fy);
        if (!p || m === 0) return null;
        const { X, Y } = P(p);
        const L = 22 + 22 * (m / Fmax);
        const ux = fx / m;
        const uy = -fy / m; // y de pantalla hacia abajo
        return (
          <g key={k} pointerEvents="none">
            <line x1={X - ux * (L + 6)} y1={Y - uy * (L + 6)} x2={X - ux * 7} y2={Y - uy * 7} stroke="var(--amber)" strokeWidth={2.4} markerEnd="url(#flecha-a)" />
            <text x={X - ux * (L + 14)} y={Y - uy * (L + 14) + 3} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="var(--amber-soft)" fontFamily="var(--font-mono)">
              {fmtNum(m, 3)}
            </text>
          </g>
        );
      })}

      {/* Nodos */}
      {coords.map((p, i) => {
        const { X, Y } = P(p);
        const activo = sel?.tipo === 'nodo' && sel.i === i;
        const D = P(def[i]);
        return (
          <g key={i} onClick={() => onSel({ tipo: 'nodo', i })} className="cursor-pointer">
            {verDeformada && sol && <circle cx={D.X} cy={D.Y} r={4} fill="var(--amber)" pointerEvents="none" />}
            <circle cx={X} cy={Y} r={14} fill="transparent" />
            <circle cx={X} cy={Y} r={activo ? 9 : 7.5} fill={activo ? 'var(--accent)' : 'var(--inset)'} stroke={activo ? 'var(--amber)' : 'var(--accent-hover)'} strokeWidth={2} />
            <text x={X} y={Y + 3} textAnchor="middle" fontSize={8} fontWeight={800} fill={activo ? 'var(--on-accent)' : 'var(--ink)'} fontFamily="var(--font-mono)" pointerEvents="none">
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

