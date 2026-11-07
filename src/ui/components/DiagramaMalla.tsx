/** Esquema SVG de la malla 1D: tramos, nodos, elementos, apoyos, carga distribuida y cargas puntuales. */
import { compileExpr, type BoundaryCondition, type Problem1D } from '../../core';
import { fmtNum, sub } from '../format';

const X0 = 40;
const X1 = 420;
const YB = 78; // eje de la barra

function apoyo(bc: BoundaryCondition, x: number, lado: 'izq' | 'der', fuerzaX: boolean, simbolo: string) {
  const s = lado === 'izq' ? -1 : 1;
  if (bc.type === 'dirichlet') {
    const xw = x + s * 6;
    return (
      <g>
        <rect x={lado === 'izq' ? xw - 10 : xw} y={YB - 22} width={10} height={44} fill="url(#rayado)" stroke="var(--line-strong)" strokeWidth={0.75} />
        <line x1={xw} x2={xw} y1={YB - 24} y2={YB + 24} stroke="var(--ink-2)" strokeWidth={2.5} strokeLinecap="round" />
        <text x={xw + s * 6} y={YB + 38} textAnchor="middle" fontSize={8.5} fill="var(--ink-2)" fontFamily="var(--font-mono)">
          {simbolo} = {fmtNum(bc.value, 3)}
        </text>
      </g>
    );
  }
  if (bc.type === 'robin') {
    const xa = x + s * 6;
    const pts = Array.from({ length: 7 }, (_, i) => `${xa + s * i * 4},${YB + (i === 0 || i === 6 ? 0 : i % 2 ? -6 : 6)}`).join(' ');
    const xe = xa + s * 24;
    return (
      <g>
        <polyline points={pts} fill="none" stroke="var(--amber)" strokeWidth={1.6} />
        <line x1={xe} x2={xe} y1={YB - 14} y2={YB + 14} stroke="var(--ink-2)" strokeWidth={2.5} />
        <text x={xa + s * 12} y={YB + 30} textAnchor="middle" fontSize={8.5} fill="var(--amber-soft)" fontFamily="var(--font-mono)">
          Robin
        </text>
      </g>
    );
  }
  if (bc.q === 0) {
    return (
      <text x={x + s * 10} y={YB + 3} textAnchor="middle" fontSize={8.5} fill="var(--ink-3)" fontFamily="var(--font-mono)">
        libre
      </text>
    );
  }
  // Neumann. Fuerza axial: la flecha apunta hacia +x si q > 0.
  // Flujo (calor, caudal, ...): la flecha entra al dominio si q > 0.
  const haciaAfuera = fuerzaX ? (bc.q > 0) === (lado === 'der') : bc.q < 0;
  const xa = x + s * 34;
  const [from, to] = haciaAfuera ? [x + s * 4, xa] : [xa, x + s * 4];
  return (
    <g>
      <line x1={from} x2={to} y1={YB} y2={YB} stroke="var(--accent-soft)" strokeWidth={3} strokeLinecap="round" markerEnd="url(#flecha)" />
      <text
        x={lado === 'der' ? 458 : 2}
        y={YB - 12}
        textAnchor={lado === 'der' ? 'end' : 'start'}
        fontSize={9}
        fontWeight={700}
        fill="var(--accent-soft)"
        fontFamily="var(--font-mono)"
      >
        {fuerzaX ? 'F' : 'q'}={fmtNum(bc.q, 3)}
      </text>
    </g>
  );
}

export function DiagramaMalla({
  problem,
  nodos,
  etiquetaCarga = 'f(x)',
  fuerzaX = false,
  simbolo = 'u',
  orden = 1,
}: {
  problem: Problem1D;
  nodos: number[];
  etiquetaCarga?: string;
  /** True si las condiciones Neumann son fuerzas axiales (barra): la flecha apunta hacia +x. */
  fuerzaX?: boolean;
  /** Símbolo de la incógnita (u, T, h, φ, ...). */
  simbolo?: string;
  /** 2 = elementos cuadráticos: los nodos impares son el centro de cada elemento. */
  orden?: 1 | 2;
}) {
  const { x0, xL } = problem;
  const X = (x: number) => X0 + ((x - x0) / (xL - x0)) * (X1 - X0);
  const n = nodos.length;
  const ne = (n - 1) / orden;
  const vertices = orden === 2 ? nodos.filter((_, i) => i % 2 === 0) : nodos;
  const conNumeros = n <= 25;
  const esCentro = (i: number) => orden === 2 && i % 2 === 1;

  // Perfil de la carga distribuida
  const muestras: { x: number; f: number }[] = [];
  for (const r of problem.regions) {
    let fn: ((x: number) => number) | null = null;
    try {
      fn = compileExpr(r.f).fn;
    } catch {
      fn = null;
    }
    for (let i = 0; i <= 24; i++) {
      const x = r.x0 + ((r.x1 - r.x0) * i) / 24;
      let v = 0;
      try {
        v = fn ? fn(x) : 0;
      } catch {
        v = 0;
      }
      muestras.push({ x, f: Number.isFinite(v) ? v : 0 });
    }
  }
  const fmax = Math.max(...muestras.map((m) => Math.abs(m.f)), 0);
  const hayCarga = fmax > 0;
  const Y = (f: number) => YB - 12 - (Math.abs(f) / (fmax || 1)) * 30;
  const flechas = hayCarga ? muestras.filter((_, i) => i % 6 === 3) : [];

  return (
    <svg viewBox="0 0 460 140" className="h-auto w-full min-w-[320px] select-none" role="img" aria-label={`Malla de ${ne} elementos${orden === 2 ? ' cuadráticos' : ''} y ${n} nodos entre x = ${x0} y x = ${xL}`}>
      <defs>
        <pattern id="rayado" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--line-strong)" strokeWidth="1.5" />
        </pattern>
        <marker id="flecha" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 1.5 L10 5 L0 8.5z" fill="var(--accent-soft)" />
        </marker>
        <marker id="flecha-c" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 2 L8 5 L0 8z" fill="var(--accent)" />
        </marker>
      </defs>

      {/* Cuadrícula */}
      {[30, 50].map((y) => (
        <line key={y} x1={X0} x2={X1} y1={y} y2={y} stroke="var(--plot-grid)" strokeWidth={0.75} />
      ))}

      {/* Carga distribuida */}
      {hayCarga && (
        <g>
          <polygon
            points={`${X(muestras[0].x)},${YB - 12} ${muestras.map((m) => `${X(m.x)},${Y(m.f)}`).join(' ')} ${X(muestras[muestras.length - 1].x)},${YB - 12}`}
            fill="var(--accent)"
            opacity={0.16}
          />
          <polyline points={muestras.map((m) => `${X(m.x)},${Y(m.f)}`).join(' ')} fill="none" stroke="var(--accent-soft)" strokeDasharray="3 2" strokeWidth={1.4} />
          {flechas.map((m, i) =>
            m.f === 0 ? null : (
              <line
                key={i}
                x1={X(m.x)}
                x2={X(m.x)}
                y1={m.f > 0 ? Y(m.f) : YB - 10}
                y2={m.f > 0 ? YB - 10 : Y(m.f)}
                stroke="var(--accent)"
                strokeWidth={1.2}
                markerEnd="url(#flecha-c)"
              />
            ),
          )}
          <text x={(X0 + X1) / 2} y={16} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--amber-soft)" fontFamily="var(--font-mono)">
            {etiquetaCarga}
          </text>
        </g>
      )}

      {/* Tramos */}
      {problem.regions.map((r, i) => (
        <g key={i}>
          <rect
            x={X(r.x0)}
            y={YB - 4}
            width={Math.max(1, X(r.x1) - X(r.x0))}
            height={8}
            rx={2}
            fill={i % 2 ? 'var(--s4)' : 'var(--accent-bg)'}
            stroke="var(--accent)"
            strokeWidth={1.4}
          />
          {problem.regions.length > 1 && (
            <text x={(X(r.x0) + X(r.x1)) / 2} y={YB + 30} textAnchor="middle" fontSize={8} fill="var(--ink-3)" fontFamily="var(--font-mono)">
              {r.nombre || `Tramo ${i + 1}`}
            </text>
          )}
        </g>
      ))}

      {/* Elementos */}
      {ne <= 12 &&
        vertices.slice(1).map((x, e) => (
          <text key={e} x={(X(vertices[e]) + X(x)) / 2} y={YB + 18} textAnchor="middle" fontSize={8.5} fontWeight={600} fill="var(--ink-2)" fontFamily="var(--font-mono)">
            e{sub(e + 1)}
          </text>
        ))}

      {/* Nodos */}
      {nodos.map((x, i) =>
        conNumeros ? (
          <g key={i}>
            {esCentro(i) ? (
              <rect x={X(x) - 5} y={YB - 5} width={10} height={10} rx={2} fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth={1.4} />
            ) : (
              <circle cx={X(x)} cy={YB} r={ne <= 12 ? 7 : 4.5} fill="var(--inset)" stroke="var(--accent)" strokeWidth={1.8} />
            )}
            {ne <= 6 || (ne <= 12 && !esCentro(i)) ? (
              <text x={X(x)} y={YB + 3} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="var(--ink)" fontFamily="var(--font-mono)">
                {i + 1}
              </text>
            ) : null}
          </g>
        ) : (
          <line key={i} x1={X(x)} x2={X(x)} y1={YB - 6} y2={YB + 6} stroke="var(--accent)" strokeWidth={1} />
        ),
      )}

      {/* Cargas puntuales */}
      {problem.loads.map((l, i) => {
        const x = X(l.x);
        const dir = l.P >= 0 ? 1 : -1;
        return (
          <g key={i}>
            <line x1={x - dir * 26} x2={x - dir * 4} y1={YB - 26} y2={YB - 26} stroke="var(--amber)" strokeWidth={2.4} markerEnd="url(#flecha)" />
            <line x1={x} x2={x} y1={YB - 30} y2={YB - 8} stroke="var(--amber)" strokeWidth={0.8} strokeDasharray="2 2" />
            <text x={x} y={YB - 34} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="var(--amber-soft)" fontFamily="var(--font-mono)">
              P={fmtNum(l.P, 3)}
            </text>
          </g>
        );
      })}

      {apoyo(problem.bcLeft, X0, 'izq', fuerzaX, simbolo)}
      {apoyo(problem.bcRight, X1, 'der', fuerzaX, simbolo)}

      {/* Cota */}
      <line x1={X0} x2={X1} y1={124} y2={124} stroke="var(--line)" strokeDasharray="2 2" />
      <text x={X0} y={136} textAnchor="middle" fontSize={8} fill="var(--ink-2)" fontFamily="var(--font-mono)">
        x={fmtNum(x0)}
      </text>
      <text x={X1} y={136} textAnchor="middle" fontSize={8} fill="var(--ink-2)" fontFamily="var(--font-mono)">
        x={fmtNum(xL)}
      </text>
      <text x={(X0 + X1) / 2} y={136} textAnchor="middle" fontSize={8} fill="var(--ink-3)" fontFamily="var(--font-mono)">
        {ne} elementos{orden === 2 ? ' cuadráticos' : ''} · {n} nodos
      </text>
    </svg>
  );
}
