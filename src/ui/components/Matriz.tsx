/** Matriz o vector como tabla HTML desplazable, con índices y celdas resaltadas. */
import { cx, Desplazable } from './base';
import { fmtMat } from '../format';

export function MatrizTabla({
  M,
  titulo,
  filas,
  columnas,
  resaltar,
  max = 40,
  sig = 5,
}: {
  M: number[][];
  titulo?: string;
  /** Etiquetas de fila (por defecto 1..n). */
  filas?: (string | number)[];
  columnas?: (string | number)[];
  /** Celdas a resaltar como "fila,columna" (0-based). */
  resaltar?: Set<string>;
  /** Máximo de filas/columnas a mostrar. */
  max?: number;
  sig?: number;
}) {
  const n = M.length;
  const m = M[0]?.length ?? 0;
  const nn = Math.min(n, max);
  const mm = Math.min(m, max);
  const fl = filas ?? Array.from({ length: n }, (_, i) => i + 1);
  const cl = columnas ?? Array.from({ length: m }, (_, j) => j + 1);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {titulo && <span className="font-mono text-mini font-bold text-ink-2">{titulo}</span>}
      <Desplazable etiqueta={titulo ?? `Matriz de ${n} × ${m}`} className="max-h-[360px] overflow-y-auto rounded-lg border border-line bg-inset">
        <table className="border-collapse font-mono text-mini">
          <thead className="sticky top-0 z-10">
            <tr className="bg-s3 text-amber-soft">
              <th className="sticky left-0 bg-s3 px-2 py-1">
                <span className="sr-only">Fila</span>
              </th>
              {cl.slice(0, mm).map((c, j) => (
                <th key={j} scope="col" className="px-2 py-1 text-right font-semibold">
                  {c === '' ? <span className="sr-only">Valor</span> : c}
                </th>
              ))}
              {m > mm && <th className="px-2 py-1 text-ink-3">…<span className="sr-only"> columnas omitidas</span></th>}
            </tr>
          </thead>
          <tbody>
            {M.slice(0, nn).map((row, i) => (
              <tr key={i} className="border-t border-line/50">
                <th scope="row" className="sticky left-0 bg-s3 px-2 py-1 text-right font-semibold text-amber-soft">
                  {fl[i]}
                </th>
                {row.slice(0, mm).map((v, j) => (
                  <td
                    key={j}
                    className={cx(
                      'whitespace-nowrap px-2 py-1 text-right',
                      resaltar?.has(`${i},${j}`) ? 'bg-accent-bg font-bold text-accent-soft' : v === 0 ? 'text-ink-3' : 'text-ink',
                    )}
                  >
                    {fmtMat(v, sig)}
                  </td>
                ))}
                {m > mm && <td className="px-2 text-ink-3">…</td>}
              </tr>
            ))}
            {n > nn && (
              <tr>
                <td colSpan={mm + 2} className="px-2 py-1 text-center text-ink-3">
                  … {n - nn} filas más
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Desplazable>
    </div>
  );
}

export function VectorTabla({ v, titulo, etiquetas, resaltar, sig }: { v: number[]; titulo?: string; etiquetas?: (string | number)[]; resaltar?: Set<number>; sig?: number }) {
  return (
    <MatrizTabla
      M={v.map((x) => [x])}
      titulo={titulo}
      filas={etiquetas}
      columnas={['']}
      resaltar={resaltar ? new Set([...resaltar].map((i) => `${i},0`)) : undefined}
      sig={sig}
    />
  );
}
