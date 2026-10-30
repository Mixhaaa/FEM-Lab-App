import type { ReactNode } from 'react';
import { ir, type Ruta } from '../router';
import { useApp } from '../store';
import { cx, Icon, IconBoton } from './base';
import { useTema } from './Grafica';

const NAV: { ruta: Ruta; texto: string; icon: string }[] = [
  { ruta: 'inicio', texto: 'Inicio', icon: 'folder_open' },
  { ruta: 'config', texto: 'Config', icon: 'tune' },
  { ruta: 'resultados', texto: 'Resultados', icon: 'monitoring' },
  { ruta: 'paso', texto: 'Paso a paso', icon: 'functions' },
  { ruta: 'armadura', texto: 'Armadura 2D', icon: 'architecture' },
];

export function Encabezado() {
  const setTema = useApp((s) => s.setTema);
  const efectivo = useTema();
  return (
    <header className="pt-safe fixed top-0 z-50 w-full border-b border-line bg-bg/90 shadow-[0_4px_20px_rgb(0_0_0/0.25)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
        <button type="button" onClick={() => ir('inicio')} className="flex min-w-0 items-center gap-2.5 text-left" aria-label="FEM Lab, ir al inicio">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="h-9 w-9 shrink-0 drop-shadow-[0_2px_4px_rgb(224_109_50/0.3)]" />
          <div className="flex min-w-0 flex-col leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-heading text-[17px] font-bold tracking-tight text-ink">FEM Lab</span>
              <span className="rounded border border-accent/30 bg-s3 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-accent-soft">1D/2D</span>
            </div>
            <span className="truncate text-xs text-ink-2">Elementos finitos lineales</span>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full border border-accent/40 bg-s2 px-2.5 py-1 min-[380px]:flex" aria-hidden="true">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
            <span className="font-mono text-[11px] font-bold tracking-tight text-accent-soft">K·u=F</span>
          </div>
          <IconBoton
            icon={efectivo === 'dark' ? 'light_mode' : 'dark_mode'}
            label={efectivo === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            onClick={() => setTema(efectivo === 'dark' ? 'claro' : 'oscuro')}
          />
        </div>
      </div>
    </header>
  );
}

export function NavInferior({ ruta }: { ruta: Ruta }) {
  return (
    <nav aria-label="Secciones" className="pb-safe fixed bottom-0 z-50 w-full border-t border-line bg-bg/95 shadow-[0_-4px_20px_rgb(0_0_0/0.3)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-around px-1">
        {NAV.map((n) => {
          const act = n.ruta === ruta;
          return (
            <a
              key={n.ruta}
              href={`#/${n.ruta}`}
              aria-current={act ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                ir(n.ruta);
              }}
              className={cx(
                'flex min-h-[46px] min-w-[58px] flex-col items-center justify-center rounded-xl px-1.5 py-1 transition-colors',
                act ? 'bg-accent font-bold text-on-accent shadow-glow' : 'text-ink-2 hover:bg-s2 hover:text-ink',
              )}
            >
              <Icon name={n.icon} className="text-[21px]" fill={act} />
              <span className="mt-0.5 whitespace-nowrap font-mono text-[10px] tracking-tight">{n.texto}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

export function Pagina({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-28 pt-20">{children}</main>;
}

/** Encabezado de página: etiquetas, título y subtítulo. */
export function TituloPagina({ etiquetas, titulo, subtitulo }: { etiquetas?: ReactNode; titulo: string; subtitulo?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      {etiquetas && <div className="flex flex-wrap items-center gap-1.5">{etiquetas}</div>}
      <h1 className="font-heading text-2xl font-bold tracking-tight text-ink">{titulo}</h1>
      {subtitulo && <div className="text-sm text-ink-2">{subtitulo}</div>}
    </div>
  );
}
