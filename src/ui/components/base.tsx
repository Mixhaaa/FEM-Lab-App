/** Componentes base con el estilo Sahara (Stitch). */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function Icon({ name, className, fill }: { name: string; className?: string; fill?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx('material-symbols-outlined', className)}
      style={fill ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}
    >
      {name}
    </span>
  );
}

export function Card({ children, className, as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' }) {
  return <As className={cx('rounded-xl border border-line bg-s2 shadow-card', className)}>{children}</As>;
}

export function CardHeader({
  icon,
  title,
  subtitle,
  right,
  className,
}: {
  icon?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <Icon name={icon} className="text-[22px] text-accent-hover" />}
        <div className="min-w-0">
          <h2 className="font-heading text-seccion font-bold leading-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-mini text-ink-2">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

type Tono = 'accent' | 'neutral' | 'amber' | 'ok' | 'danger' | 'compress';
const TONOS: Record<Tono, string> = {
  accent: 'border-accent/40 bg-accent-bg text-accent-soft',
  neutral: 'border-line bg-s3 text-ink-2',
  amber: 'border-amber/40 bg-amber/10 text-amber-soft',
  ok: 'border-ok/40 bg-ok/10 text-ok',
  danger: 'border-danger/40 bg-danger-bg text-danger',
  compress: 'border-compress/40 bg-compress/10 text-compress',
};

export function Badge({ children, tono = 'accent', className }: { children: ReactNode; tono?: Tono; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-mini font-semibold', TONOS[tono], className)}>
      {children}
    </span>
  );
}

/** Símbolo con subíndice real: «u_max» → u<sub>máx</sub>, «Q_{ext}» → Q<sub>ext</sub>. */
export function Simbolo({ s }: { s: string }) {
  const i = s.indexOf('_');
  if (i <= 0) return <>{s}</>;
  const sub = s
    .slice(i + 1)
    .replace(/[{}]/g, '')
    .replace(/^max$/, 'máx')
    .replace(/^min$/, 'mín');
  return (
    <>
      {s.slice(0, i)}
      <sub className="text-[0.75em]">{sub}</sub>
    </>
  );
}

export function Dot({ className }: { className?: string }) {
  return <span className={cx('inline-block h-2 w-2 rounded-full bg-accent-hover', className)} />;
}

type Variante = 'primario' | 'secundario' | 'fantasma';
export function Boton({
  children,
  onClick,
  variante = 'secundario',
  icon,
  className,
  disabled,
  type = 'button',
  title,
}: {
  children?: ReactNode;
  onClick?: () => void;
  variante?: Variante;
  icon?: string;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
  title?: string;
}) {
  const v: Record<Variante, string> = {
    primario:
      'bg-accent text-on-accent border-accent-hover hover:bg-accent-hover font-bold',
    secundario: 'bg-s3 text-ink border-line hover:border-accent hover:bg-s4 font-semibold',
    fantasma: 'bg-transparent text-ink-2 border-transparent hover:text-ink hover:bg-accent-bg font-semibold',
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-cuerpo transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        v[variante],
        className,
      )}
    >
      {icon && <Icon name={icon} className="text-[18px]" />}
      {children}
    </button>
  );
}

export function IconBoton({ icon, label, onClick, className, activo }: { icon: string; label: string; onClick?: () => void; className?: string; activo?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition',
        activo ? 'border-accent bg-accent-bg text-accent-soft' : 'border-line bg-s2 text-ink-2 hover:text-ink hover:border-accent/60',
        className,
      )}
    >
      <Icon name={icon} className="text-[20px]" />
    </button>
  );
}

/** Campo de texto con unidad a la derecha y mensaje de error. */
export function Campo({
  label,
  value,
  onChange,
  unidad,
  ayuda,
  error,
  placeholder,
  inputMode,
  className,
  mono = true,
  id: idFijo,
  onBlur,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  unidad?: string;
  ayuda?: ReactNode;
  error?: string | null;
  placeholder?: string;
  inputMode?: 'decimal' | 'text' | 'numeric';
  className?: string;
  mono?: boolean;
  /** Id estable (permite enlazar el campo desde un aviso de error). */
  id?: string;
  onBlur?: () => void;
}) {
  const auto = useId();
  const id = idFijo ?? auto;
  const idNota = `${id}-nota`;
  return (
    <div className={cx('flex min-w-0 flex-col gap-1', className)}>
      <label htmlFor={id} className="text-detalle font-medium text-ink-2">
        {label}
      </label>
      <div
        onMouseDown={(ev) => {
          // Toda la caja de 44 px recibe el toque, no solo el texto
          if (!(ev.target instanceof HTMLInputElement)) {
            ev.preventDefault();
            document.getElementById(id)?.focus();
          }
        }}
        className={cx(
          'flex min-h-11 cursor-text items-stretch rounded-lg border bg-inset px-3 transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
          error ? 'border-danger' : 'border-field',
        )}
      >
        <input
          id={id}
          value={value}
          placeholder={placeholder}
          inputMode={inputMode ?? 'text'}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error || ayuda ? idNota : undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={cx('w-full min-w-0 bg-transparent py-2 text-cuerpo text-ink placeholder:text-ink-3 focus:outline-none', mono && 'font-mono')}
        />
        {unidad && unidad !== '—' && <span className="flex shrink-0 items-center pl-2 font-mono text-detalle text-ink-2">{unidad}</span>}
      </div>
      {error ? (
        <span id={idNota} className="flex items-start gap-1 text-detalle text-danger">
          <Icon name="error" className="mt-px text-[16px]" />
          <span>{error}</span>
        </span>
      ) : (
        ayuda && (
          <span id={idNota} className="text-detalle text-ink-3">
            {ayuda}
          </span>
        )
      )}
    </div>
  );
}

/** Lista desplegable. Si no tiene etiqueta visible, `etiqueta` es obligatoria (nombre para lectores de pantalla). */
export function Selector<T extends string | number>({
  label,
  etiqueta,
  value,
  onChange,
  opciones,
  className,
}: {
  label?: ReactNode;
  etiqueta?: string;
  value: T;
  onChange: (v: T) => void;
  opciones: { valor: T; texto: string }[];
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx('flex min-w-0 flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-detalle font-medium text-ink-2">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          aria-label={label ? undefined : etiqueta}
          value={String(value)}
          onChange={(e) => {
            const o = opciones.find((op) => String(op.valor) === e.target.value);
            if (o) onChange(o.valor);
          }}
          className="min-h-11 w-full appearance-none rounded-lg border border-field bg-inset py-2 pl-3 pr-9 font-mono text-cuerpo text-ink"
        >
          {opciones.map((o) => (
            <option key={String(o.valor)} value={String(o.valor)}>
              {o.texto}
            </option>
          ))}
        </select>
        <Icon name="expand_more" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[20px] text-ink-2" />
      </div>
    </div>
  );
}

/** Control segmentado (pocas opciones excluyentes). Se usa con Tab para entrar y flechas para elegir. */
export function Segmentos<T extends string>({
  value,
  onChange,
  opciones,
  className,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  opciones: { valor: T; texto: string; icon?: string }[];
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mover = (d: number) => {
    const i = opciones.findIndex((o) => o.valor === value);
    const j = (i + d + opciones.length) % opciones.length;
    onChange(opciones[j].valor);
    requestAnimationFrame(() => (ref.current?.querySelectorAll('button')[j] as HTMLButtonElement | undefined)?.focus());
  };
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {label && <span className="text-detalle font-medium text-ink-2">{label}</span>}
      <div
        ref={ref}
        role="radiogroup"
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            mover(1);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            mover(-1);
          }
        }}
        className="flex gap-1 rounded-lg border border-field bg-inset p-1"
      >
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={o.valor === value}
            tabIndex={o.valor === value ? 0 : -1}
            onClick={() => onChange(o.valor)}
            className={cx(
              'flex min-h-11 flex-1 items-center justify-center gap-1 rounded px-2 font-mono text-detalle transition',
              o.valor === value ? 'bg-accent font-semibold text-on-accent' : 'text-ink-2 hover:bg-s3 hover:text-ink',
            )}
          >
            {o.icon && <Icon name={o.icon} className="text-[16px]" />}
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Sección plegable numerada (acordeón de Configuración). */
export function Seccion({
  icon,
  titulo,
  subtitulo,
  children,
  abierta = true,
  tono = 'accent',
  resumen,
}: {
  icon: string;
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  abierta?: boolean;
  tono?: 'accent' | 'amber';
  resumen?: ReactNode;
}) {
  const [open, setOpen] = useState(abierta);
  const id = useId();
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-s2 shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-s3"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cx(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-s1',
              tono === 'amber' ? 'border-amber/30 text-amber-soft' : 'border-accent/30 text-accent-soft',
            )}
          >
            <Icon name={icon} className="text-[20px]" />
          </span>
          <div className="min-w-0">
            <span className="block truncate text-cuerpo font-bold text-ink">{titulo}</span>
            {subtitulo && <span className="block truncate text-mini text-ink-2">{open || !resumen ? subtitulo : resumen}</span>}
          </div>
        </div>
        <Icon name="expand_more" className={cx('text-ink-2 transition-transform', open ? '' : '-rotate-90')} />
      </button>
      {open && (
        <div id={id} className="flex flex-col gap-3 px-4 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}

export function Aviso({ tipo = 'aviso', children, titulo }: { tipo?: 'aviso' | 'error' | 'info' | 'ok'; children: ReactNode; titulo?: string }) {
  const est = {
    aviso: { c: 'border-amber/40 bg-amber/10', i: 'warning', t: 'text-amber-soft' },
    error: { c: 'border-danger/50 bg-danger-bg', i: 'error', t: 'text-danger' },
    info: { c: 'border-line bg-s1', i: 'info', t: 'text-accent-soft' },
    ok: { c: 'border-ok/40 bg-ok/10', i: 'check_circle', t: 'text-ok' },
  }[tipo];
  return (
    <div role={tipo === 'error' ? 'alert' : undefined} className={cx('flex gap-3 rounded-xl border p-3', est.c)}>
      <Icon name={est.i} className={cx('mt-px text-[18px]', est.t)} />
      <div className="min-w-0 text-detalle leading-snug text-ink">
        {titulo && <p className={cx('mb-0.5 font-bold', est.t)}>{titulo}</p>}
        {children}
      </div>
    </div>
  );
}

/** Indicador grande (KPI). */
export function Kpi({
  titulo,
  simbolo,
  valor,
  unidad,
  detalle,
  icon,
  tono = 'accent',
}: {
  titulo: string;
  simbolo?: string;
  valor: string;
  unidad?: string;
  detalle?: ReactNode;
  icon?: string;
  tono?: 'accent' | 'amber' | 'neutral';
}) {
  const color = tono === 'accent' ? 'text-accent-hover' : tono === 'amber' ? 'text-amber-soft' : 'text-ink';
  return (
    <div className="relative flex min-w-0 flex-col justify-between overflow-hidden rounded-xl border border-line bg-s2 p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-mini font-semibold uppercase tracking-wide text-ink-2">{titulo}</span>
        {simbolo && (
          <Badge tono={tono === 'amber' ? 'amber' : tono === 'neutral' ? 'neutral' : 'accent'}>
            <Simbolo s={simbolo} />
          </Badge>
        )}
      </div>
      <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-1">
        <span className={cx('break-all font-heading text-dato font-bold tracking-tight', color)}>{valor}</span>
        {unidad && unidad !== '—' && <span className="font-mono text-mini font-medium text-ink-2">{unidad}</span>}
      </div>
      {detalle && (
        <span className="mt-1 flex items-center gap-1 font-mono text-mini text-ink-2">
          {icon && <Icon name={icon} className="text-detalle text-accent-hover" />}
          {detalle}
        </span>
      )}
    </div>
  );
}

/** Hoja inferior modal (en móvil) / diálogo centrado (en pantallas grandes). */
export function Hoja({ abierta, onClose, titulo, etiqueta, children }: { abierta: boolean; onClose: () => void; titulo: string; etiqueta?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  useEffect(() => {
    if (!abierta) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // El foco queda atrapado dentro de la hoja mientras está abierta
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.hasAttribute('disabled'));
        if (f.length === 0) return;
        const primero = f[0];
        const ultimo = f[f.length - 1];
        const dentro = ref.current.contains(document.activeElement);
        if (e.shiftKey && (document.activeElement === primero || !dentro)) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && (document.activeElement === ultimo || !dentro)) {
          e.preventDefault();
          primero.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [abierta, onClose]);
  if (!abierta) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-bg/80 backdrop-blur-md sm:items-center" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${idTitulo}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="pb-safe flex max-h-[88dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-xl border-t border-accent/40 bg-s2 p-6 shadow-2xl focus:outline-none sm:rounded-xl sm:border"
      >
        <div className="mx-auto h-1 w-12 rounded-full bg-line-strong sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            {etiqueta && <Badge>{etiqueta}</Badge>}
            <h2 id={idTitulo} className="mt-1 font-heading text-seccion font-bold text-ink">{titulo}</h2>
          </div>
          <IconBoton icon="close" label="Cerrar" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Contenedor con desplazamiento horizontal. Si el contenido no cabe, se vuelve un grupo con nombre
 * que recibe el foco, para poder desplazarlo con las flechas del teclado. (Grupo y no región: hay
 * muchas fórmulas por pantalla y las regiones son puntos de referencia que deben tener nombre único.)
 */
export function Desplazable({ etiqueta, children, className }: { etiqueta: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [desborda, setDesborda] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setDesborda(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} role={desborda ? 'group' : undefined} aria-label={desborda ? etiqueta : undefined} tabIndex={desborda ? 0 : undefined} className={cx('scroll-x', className)}>
      {children}
    </div>
  );
}

/** Tabla compacta con encabezado estilo Stitch. */
export function Tabla({
  cabecera,
  filas,
  alinear,
  resaltar,
  className,
  etiqueta,
}: {
  cabecera: ReactNode[];
  filas: ReactNode[][];
  alinear?: ('left' | 'right' | 'center')[];
  resaltar?: number;
  className?: string;
  /** Nombre de la tabla para lectores de pantalla. */
  etiqueta?: string;
}) {
  return (
    <Desplazable etiqueta={etiqueta ?? `Tabla: ${cabecera.filter((c): c is string => typeof c === 'string' && c !== '').join(', ')}`} className={cx('w-full', className)}>
      <table className="w-full border-collapse text-left font-mono text-mini">
        <thead>
          <tr className="border-b border-line-strong bg-s3 text-amber-soft">
            {cabecera.map((c, i) => (
              <th key={i} scope="col" className={cx('whitespace-nowrap px-3 py-3 font-semibold', alinear?.[i] === 'right' && 'text-right', alinear?.[i] === 'center' && 'text-center')}>
                {c === '' || c == null ? <span className="sr-only">Columna {i + 1}</span> : c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, r) => (
            <tr key={r} className={cx('border-b border-line/60 transition-colors hover:bg-s3/60', r === resaltar ? 'bg-accent-bg' : r % 2 ? 'bg-s1/40' : '')}>
              {f.map((c, i) => (
                <td key={i} className={cx('whitespace-nowrap px-3 py-2 text-ink', alinear?.[i] === 'right' && 'text-right', alinear?.[i] === 'center' && 'text-center')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Desplazable>
  );
}

/** Ids de una pestaña y de su panel (patrón ARIA de pestañas). */
const idPestana = (base: string, valor: string) => `${base}-tab-${valor}`;
const idPanel = (base: string) => `${base}-panel`;

/**
 * Pestañas tipo píldora con desplazamiento horizontal.
 * Patrón ARIA: una sola pestaña en el orden de Tab; ← → Inicio Fin para moverse.
 * El contenido va en <PanelPestanas base=… valor=…>.
 */
export function Pildoras<T extends string>({
  value,
  onChange,
  opciones,
  base,
  etiqueta,
}: {
  value: T;
  onChange: (v: T) => void;
  opciones: { valor: T; texto: string; icon?: string }[];
  base: string;
  etiqueta: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ir = (j: number) => {
    onChange(opciones[j].valor);
    requestAnimationFrame(() => (ref.current?.querySelectorAll('[role="tab"]')[j] as HTMLElement | undefined)?.focus());
  };
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={etiqueta}
      onKeyDown={(e) => {
        const i = opciones.findIndex((o) => o.valor === value);
        const n = opciones.length;
        const j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
        if (j >= 0) {
          e.preventDefault();
          ir(j);
        }
      }}
      className="no-scrollbar flex items-center gap-2 overflow-x-auto py-0.5"
    >
      {opciones.map((o) => {
        const act = o.valor === value;
        return (
          <button
            key={o.valor}
            id={idPestana(base, o.valor)}
            role="tab"
            aria-selected={act}
            aria-controls={idPanel(base)}
            tabIndex={act ? 0 : -1}
            type="button"
            onClick={() => onChange(o.valor)}
            className={cx(
              'flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 font-mono text-detalle transition',
              act ? 'bg-accent font-semibold text-on-accent' : 'border border-field bg-s2 text-ink-2 hover:bg-s3 hover:text-ink',
            )}
          >
            {o.icon && <Icon name={o.icon} className="text-[16px]" />}
            {o.texto}
          </button>
        );
      })}
    </div>
  );
}

/** Panel que muestra el contenido de la pestaña activa. */
export function PanelPestanas({ base, valor, children, className }: { base: string; valor: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={idPanel(base)} aria-labelledby={idPestana(base, valor)} className={cx('flex min-w-0 flex-col gap-4', className)}>
      {children}
    </div>
  );
}
