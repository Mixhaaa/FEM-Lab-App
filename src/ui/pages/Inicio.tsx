import { useMemo, useState } from 'react';
import {
  CATEGORIAS,
  EJEMPLOS_ARMADURA,
  EJEMPLOS_RESORTES,
  PLANTILLAS,
  plantilla1D,
  type Categoria,
  type PlantillaCualquiera,
} from '../../templates';
import { Badge, Boton, cx, Desplazable, Hoja, Icon } from '../components/base';
import { nombreElementos } from '../curvas';
import { Pagina } from '../components/Shell';
import { Tex } from '../components/Tex';
import { Formulario, Glosario } from '../components/Recursos';
import { ir } from '../router';
import { useApp } from '../store';

const ICONO_CATEGORIA: Record<Categoria, string> = {
  solidos: 'text-accent-soft',
  termica: 'text-amber',
  fluidos: 'text-bronze',
  electrica: 'text-amber-soft',
  matematica: 'text-accent-soft',
};

function rasgos(p: PlantillaCualquiera): string[] {
  if (p.tipo === '1d') return [p.incognita.nombre, ...p.derivadas.slice(-2).map((d) => d.nombre.replace(/ \(.*\)$/, ''))].slice(0, 3);
  if (p.tipo === 'armadura') return ['Desplazamientos', 'Fuerzas axiales N', 'Deformada'];
  return ['Desplazamientos', 'Fuerza en cada resorte', 'Reacciones'];
}

function ejemplosDe(p: PlantillaCualquiera) {
  if (p.tipo === '1d') return p.ejemplos;
  return p.tipo === 'armadura' ? EJEMPLOS_ARMADURA : EJEMPLOS_RESORTES;
}

export function abrirEjemplo(cargar: (p: string, e?: string) => void, plantillaId: string, ejemploId?: string, destino?: 'config' | 'resultados') {
  cargar(plantillaId, ejemploId);
  if (plantillaId === 'armadura') ir('armadura');
  else ir(destino ?? 'config');
}

export function Inicio() {
  const cargar = useApp((s) => s.cargar);
  const tipo = useApp((s) => s.tipo);
  const e1d = useApp((s) => s.e1d);
  const armadura = useApp((s) => s.armadura);
  const resortes = useApp((s) => s.resortes);
  const [filtro, setFiltro] = useState<Categoria | 'todos'>('todos');
  const [hoja, setHoja] = useState<PlantillaCualquiera | null>(null);
  const [recurso, setRecurso] = useState<'formulario' | 'glosario' | 'ejemplos' | null>(null);

  const activo = useMemo(() => {
    if (tipo === 'armadura') return { nombre: 'Armadura plana 2D', a: `${armadura.nodos.length} nodos`, b: `${armadura.barras.length} barras` };
    if (tipo === 'resortes') return { nombre: 'Sistema de resortes', a: `${resortes.nNodos} nodos`, b: `${resortes.resortes.length} resortes` };
    const t = plantilla1D(e1d.plantilla);
    const ne = e1d.malla.tipo === 'manual' ? 'malla manual' : `${e1d.malla.ne} ${nombreElementos(e1d.orden)}`;
    return { nombre: t?.nombre ?? '—', a: `[${e1d.x0}, ${e1d.xL}]`, b: ne };
  }, [tipo, e1d, armadura, resortes]);

  const categorias = useMemo(() => [...new Set(PLANTILLAS.map((p) => p.categoria))], []);
  const visibles = PLANTILLAS.filter((p) => filtro === 'todos' || p.categoria === filtro);

  return (
    <Pagina amplia>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-6">
      <div className="flex flex-col gap-4">
      {/* Estado del banco de trabajo */}
      <div className="relative overflow-hidden rounded-xl border border-line bg-s2 p-4 shadow-card">
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber" />
            <span className="text-detalle font-semibold text-amber-soft">Modelo activo</span>
          </div>
          <span className="rounded-full border border-line bg-bg px-3 py-0.5 font-mono text-mini text-ink-2">Semestre 2026-1</span>
        </div>
        <button
          type="button"
          onClick={() => ir(tipo === 'armadura' ? 'armadura' : 'config')}
          className="relative mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-inset p-3 text-left transition hover:border-accent/50"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-s3 text-accent-soft">
              <Icon name="engineering" className="text-[18px]" />
            </span>
            <span className="line-clamp-2 font-heading text-seccion font-semibold leading-tight text-ink">{activo.nombre}</span>
          </div>
          <div className="shrink-0 text-right">
            <span className="block font-mono text-mini font-semibold text-accent-soft">{activo.a}</span>
            <span className="block font-mono text-mini text-ink-2">{activo.b}</span>
          </div>
        </button>
      </div>

      {/* Bienvenida */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded bg-accent px-2 py-0.5 text-mini font-semibold text-on-accent">Simulador académico</span>
          <Badge tono="neutral">Método de Galerkin</Badge>
        </div>
        <h1 className="font-heading text-titulo font-bold tracking-tight text-ink ">Laboratorio MEF 1D y 2D</h1>
        <p className="mt-2 text-cuerpo leading-relaxed text-ink-2">
          Resuelve problemas lineales de ingeniería con elementos finitos lineales o cuadráticos: discretiza el dominio, ensambla la matriz global y resuelve{' '}
          <span className="rounded border border-accent/30 bg-s2 px-1.5 py-0.5 font-mono text-mini font-semibold text-accent-soft">K·u = F</span> paso a paso.
        </p>
      </div>

      </div>
      {/* Ejemplo de clase recomendado */}
      <div className="relative flex flex-col justify-center overflow-hidden rounded-xl border border-accent/40 bg-s2 p-4 shadow-card lg:p-6">
        <div className="relative mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded bg-accent px-2 py-0.5 text-mini font-semibold text-on-accent">Recomendado</span>
            <span className="font-mono text-mini text-accent-soft">Ejemplo de clase</span>
          </div>
          <Icon name="stars" className="text-[20px] text-amber" />
        </div>
        <h2 className="relative font-heading text-seccion font-bold text-ink">
          <span className="sr-only">Ejemplo de clase recomendado: </span>
          <Tex>{String.raw`-u'' + 100\,u = 10x^3`}</Tex>
        </h2>
        <p className="relative mb-3 mt-1 text-detalle text-ink-2">
          Con <span className="font-mono">u(0) = u(1) = 0</span> y 3 elementos. Compara la solución MEF con{' '}
          <Tex>{String.raw`u = 0.1x^3 + 0.006x - 0.106\,\frac{\sinh 10x}{\sinh 10}`}</Tex>.
        </p>
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 rounded-lg border border-accent/30 bg-bg/70 px-3 py-2 font-mono text-mini text-accent-soft">
            <Icon name="auto_graph" className="text-[14px]" /> Analítica vs MEF
          </span>
          <div className="flex gap-2">
            <Boton variante="secundario" icon="functions" onClick={() => {
                cargar('general', 'clase');
                ir('paso');
              }}>
              Paso a paso
            </Boton>
            <Boton variante="primario" icon="play_arrow" onClick={() => abrirEjemplo(cargar, 'general', 'clase', 'resultados')}>
              Abrir
            </Boton>
          </div>
        </div>
      </div>

      </div>

      {/* Filtro de plantillas */}
      <div className="pt-1">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-detalle font-semibold text-ink-2">Plantillas de ingeniería</h2>
          <span className="font-mono text-mini font-semibold text-accent-soft">{PLANTILLAS.length} modelos</span>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar plantillas por categoría">
          {(['todos', ...categorias] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={filtro === c}
              onClick={() => setFiltro(c)}
              className={cx(
                'min-h-11 shrink-0 whitespace-nowrap rounded-full px-4 font-mono text-detalle transition',
                filtro === c ? 'bg-accent font-bold text-on-accent' : 'border border-field bg-s2 text-ink-2 hover:bg-s3 hover:text-ink',
              )}
            >
              {c === 'todos' ? 'Todos' : CATEGORIAS[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibles.map((p) => (
          <article key={p.id} className="flex flex-col gap-3 rounded-xl border border-line bg-s2 p-4 shadow-card transition-colors hover:border-accent/60">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-s3', ICONO_CATEGORIA[p.categoria])}>
                  <Icon name={p.icono} className="text-[22px]" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading text-seccion font-semibold leading-tight text-ink">{p.nombre}</h3>
                  <span className="font-mono text-mini text-ink-2">{CATEGORIAS[p.categoria]}</span>
                </div>
              </div>
            </div>
            <Desplazable etiqueta={`Ecuación de ${p.nombre}`} className="rounded-lg border border-line bg-inset px-3 py-2 text-detalle text-accent-soft">
              <Tex>{p.tipo === '1d' ? p.ecuacion : p.tipo === 'armadura' ? String.raw`\mathbf{k}_e = \mathbf{T}^{T}\,\frac{EA}{L}\begin{bmatrix}1&-1\\-1&1\end{bmatrix}\mathbf{T}` : p.ecuacion}</Tex>
            </Desplazable>
            <p className="text-detalle leading-snug text-ink-2">{p.descripcion}</p>
            <div className="flex flex-wrap gap-2">
              {rasgos(p).map((r) => (
                <span key={r} className="rounded border border-line bg-s3 px-2 py-0.5 font-mono text-mini text-ink-2">
                  {r}
                </span>
              ))}
            </div>
            <div className="mt-auto flex items-center justify-between pt-1">
              <span className="font-mono text-mini text-ink-3">{ejemplosDe(p).length} ejemplos</span>
              <Boton variante={p.id === 'armadura' ? 'primario' : 'secundario'} onClick={() => setHoja(p)} className="text-detalle">
                Configurar <Icon name="chevron_right" className="text-[16px]" />
              </Boton>
            </div>
          </article>
        ))}
      </div>

      {/* Recursos */}
      <div className="pt-2">
        <div className="mb-2 flex items-center gap-2">
          <Icon name="menu_book" className="text-[22px] text-accent-soft" />
          <h2 className="font-heading text-seccion font-bold text-ink">Recursos didácticos</h2>
        </div>
        <div className="flex flex-col gap-2 lg:grid lg:grid-cols-3 lg:gap-3">
          {(
            [
              ['formulario', 'grid_4x4', 'Formulario de matrices elementales', 'Barra, elemento general, armadura, resortes y puntos de Gauss'],
              ['glosario', 'functions', 'Glosario de notación', 'Funciones de forma, Ke, Fe, ensamblaje y fronteras'],
              ['ejemplos', 'assignment_turned_in', 'Ejemplos resueltos', 'Todos los casos precargados, listos para abrir'],
            ] as const
          ).map(([id, icon, t, d]) => (
            <button
              key={id}
              type="button"
              onClick={() => setRecurso(id)}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-s2 p-4 text-left shadow-card transition hover:border-accent/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-s3 text-accent-soft">
                  <Icon name={icon} className="text-[20px]" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-mono text-detalle font-semibold text-ink">{t}</p>
                  <p className="truncate text-mini text-ink-2">{d}</p>
                </div>
              </div>
              <Icon name="arrow_forward" className="shrink-0 text-[20px] text-ink-2" />
            </button>
          ))}
        </div>
      </div>

      <p className="pb-2 text-center font-mono text-mini text-ink-3">Diseño por Elementos Finitos · Universidad Distrital · 2026-1</p>

      {/* Hoja: ejemplos de una plantilla */}
      <Hoja abierta={!!hoja} onClose={() => setHoja(null)} titulo={hoja?.nombre ?? ''} etiqueta={hoja ? CATEGORIAS[hoja.categoria] : undefined}>
        {hoja && (
          <>
            <p className="text-cuerpo leading-relaxed text-ink-2">{hoja.descripcion}</p>
            <p className="text-detalle font-semibold text-ink-2">Elige un ejemplo para empezar</p>
            <div className="flex flex-col gap-2">
              {ejemplosDe(hoja).map((ej) => (
                <button
                  key={ej.id}
                  type="button"
                  onClick={() => {
                    abrirEjemplo(cargar, hoja.id, ej.id);
                    setHoja(null);
                  }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-inset p-3 text-left transition hover:border-accent"
                >
                  <div className="min-w-0">
                    <p className="text-cuerpo font-semibold text-ink">{ej.nombre}</p>
                    <p className="mt-0.5 text-mini leading-snug text-ink-2">{ej.descripcion}</p>
                  </div>
                  <Icon name="chevron_right" className="shrink-0 text-accent-soft" />
                </button>
              ))}
            </div>
          </>
        )}
      </Hoja>

      <Hoja abierta={recurso === 'formulario'} onClose={() => setRecurso(null)} titulo="Formulario de matrices elementales" etiqueta="Referencia">
        <Formulario />
      </Hoja>
      <Hoja abierta={recurso === 'glosario'} onClose={() => setRecurso(null)} titulo="Glosario de notación" etiqueta="Referencia">
        <Glosario />
      </Hoja>
      <Hoja abierta={recurso === 'ejemplos'} onClose={() => setRecurso(null)} titulo="Ejemplos resueltos" etiqueta="Biblioteca">
        <div className="flex flex-col gap-3">
          {PLANTILLAS.map((p) => (
            <div key={p.id}>
              <p className="mb-1 flex items-center gap-2 text-detalle font-semibold text-accent-soft">
                <Icon name={p.icono} className="text-[16px]" /> {p.nombre}
              </p>
              <div className="flex flex-col gap-1">
                {ejemplosDe(p).map((ej) => (
                  <button
                    key={ej.id}
                    type="button"
                    onClick={() => {
                      abrirEjemplo(cargar, p.id, ej.id, 'resultados');
                      setRecurso(null);
                    }}
                    className="rounded-lg border border-line bg-inset px-3 py-2 text-left text-detalle text-ink transition hover:border-accent"
                  >
                    {ej.nombre}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Hoja>
    </Pagina>
  );
}
