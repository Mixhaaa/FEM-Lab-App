/** Índice vertical de pasos (solo en pantallas grandes). */
import { cx } from './base';

export function ListaPasos<T extends string>({ pasos, actual, onChange }: { pasos: readonly { id: T; titulo: string }[]; actual: T; onChange: (p: T) => void }) {
  return (
    <ol aria-label="Pasos" className="hidden flex-col gap-1 lg:sticky lg:top-40 lg:flex">
      {pasos.map((p, i) => {
        const act = p.id === actual;
        return (
          <li key={p.id}>
            <button
              type="button"
              aria-current={act ? 'step' : undefined}
              onClick={() => onChange(p.id)}
              className={cx(
                'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-cuerpo transition',
                act ? 'bg-accent-bg font-bold text-ink' : 'text-ink-2 hover:bg-s2 hover:text-ink',
              )}
            >
              <span
                className={cx(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-mini font-bold',
                  act ? 'bg-accent text-on-accent' : 'border border-line bg-s2 text-ink-2',
                )}
              >
                {i + 1}
              </span>
              {p.titulo}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
