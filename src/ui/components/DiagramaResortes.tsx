/** Esquema SVG de un sistema de resortes 1D. */
import type { EstadoResortes } from '../../templates';
import { fmtNum } from '../format';

export function DiagramaResortes({ e, u, escala }: { e: EstadoResortes; u?: number[]; escala?: number }) {
  const n = Math.max(2, e.nNodos);
  const X0 = 40;
  const X1 = 420;
  const Xn = (i: number) => X0 + ((X1 - X0) * i) / (n - 1);
  const YB = 70;
  // Desplazar verticalmente los resortes repetidos entre el mismo par de nodos
  const cuenta = new Map<string, number>();
  const offs = e.resortes.map((r) => {
    const k = [Math.min(r.i, r.j), Math.max(r.i, r.j)].join('-');
    const c = cuenta.get(k) ?? 0;
    cuenta.set(k, c + 1);
    return c;
  });
  const total = new Map(cuenta);
  const fijos = new Set(e.apoyos.map((a) => a.nodo));
  const umax = u ? Math.max(...u.map(Math.abs), 1e-300) : 1;
  const s = escala ?? (u ? (0.08 * (X1 - X0)) / umax : 0);

  return (
    <svg viewBox="0 0 460 140" className="h-auto w-full min-w-[320px] select-none" role="img" aria-label={`Sistema de ${e.resortes.length} resortes y ${n} nodos`}>
      <defs>
        <pattern id="rayado-r" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--line-strong)" strokeWidth="1.5" />
        </pattern>
        <marker id="flecha-r" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 1.5 L10 5 L0 8.5z" fill="var(--amber)" />
        </marker>
      </defs>
      {e.resortes.map((r, k) => {
        if (r.i >= n || r.j >= n) return null;
        const a = Xn(Math.min(r.i, r.j));
        const b = Xn(Math.max(r.i, r.j));
        const key = [Math.min(r.i, r.j), Math.max(r.i, r.j)].join('-');
        const m = total.get(key) ?? 1;
        const y = YB + (offs[k] - (m - 1) / 2) * 22;
        const zig = 10;
        const pts: string[] = [`${a},${YB}`, `${a + 8},${y}`];
        for (let z = 0; z <= zig; z++) {
          const x = a + 8 + ((b - a - 16) * z) / zig;
          pts.push(`${x},${y + (z === 0 || z === zig ? 0 : z % 2 ? -6 : 6)}`);
        }
        pts.push(`${b - 8},${y}`, `${b},${YB}`);
        return (
          <g key={k}>
            <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth={1.6} strokeLinejoin="round" />
            <text x={(a + b) / 2} y={y - 10} textAnchor="middle" fontSize={8.5} fill="var(--ink-2)" fontFamily="var(--font-mono)">
              k{k + 1}={r.k}
            </text>
          </g>
        );
      })}
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          {fijos.has(i) && (
            <g>
              <rect x={Xn(i) - 5} y={YB + 10} width={10} height={6} fill="url(#rayado-r)" />
              <line x1={Xn(i) - 9} x2={Xn(i) + 9} y1={YB + 10} y2={YB + 10} stroke="var(--ink-2)" strokeWidth={2} />
            </g>
          )}
          {u && <circle cx={Xn(i) + u[i] * s} cy={YB} r={7} fill="none" stroke="var(--amber)" strokeDasharray="2 2" strokeWidth={1.2} />}
          <circle cx={Xn(i)} cy={YB} r={8} fill="var(--inset)" stroke="var(--accent)" strokeWidth={1.8} />
          <text x={Xn(i)} y={YB + 3} textAnchor="middle" fontSize={8} fontWeight={700} fill="var(--ink)" fontFamily="var(--font-mono)">
            {i + 1}
          </text>
        </g>
      ))}
      {e.cargas.map((c, k) => {
        if (c.nodo >= n) return null;
        const P = Number(c.P);
        const dir = P >= 0 ? 1 : -1;
        const x = Xn(c.nodo);
        return (
          <g key={k}>
            <line x1={x - dir * 30} x2={x - dir * 10} y1={YB - 34} y2={YB - 34} stroke="var(--amber)" strokeWidth={2.4} markerEnd="url(#flecha-r)" />
            <text x={x} y={YB - 42} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="var(--amber-soft)" fontFamily="var(--font-mono)">
              P={Number.isFinite(P) ? fmtNum(P, 3) : c.P}
            </text>
          </g>
        );
      })}
      {u && (
        <text x={230} y={132} textAnchor="middle" fontSize={8} fill="var(--ink-3)" fontFamily="var(--font-mono)">
          ◌ posición desplazada (escala exagerada)
        </text>
      )}
    </svg>
  );
}
