import { lazy, Suspense, useEffect, useState } from 'react';
import { Encabezado, NavInferior, NavLateral } from './ui/components/Shell';
import { useTema } from './ui/components/Grafica';
import { Inicio } from './ui/pages/Inicio';

// Cada sección se descarga cuando se abre por primera vez (la carga inicial es más liviana)
const Config = lazy(() => import('./ui/pages/Config').then((m) => ({ default: m.Config })));
const Resultados = lazy(() => import('./ui/pages/Resultados').then((m) => ({ default: m.Resultados })));
const Paso1D = lazy(() => import('./ui/pages/Paso1D').then((m) => ({ default: m.Paso1D })));
const PasoArmadura = lazy(() => import('./ui/pages/PasoDirecto').then((m) => ({ default: m.PasoArmadura })));
const PasoResortes = lazy(() => import('./ui/pages/PasoDirecto').then((m) => ({ default: m.PasoResortes })));
const Armadura = lazy(() => import('./ui/pages/Armadura').then((m) => ({ default: m.Armadura })));
const Reporte = lazy(() => import('./ui/pages/Reporte').then((m) => ({ default: m.Reporte })));

function Cargando() {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-2 px-4 pt-20">
      <h1 className="sr-only">FEM Lab</h1>
      <p role="status" className="text-cuerpo text-ink-2">
        Cargando la sección…
      </p>
    </main>
  );
}
import { usePresentacion } from './ui/presentacion';
import { useRuta } from './ui/router';
import { useApp } from './ui/store';

function Paso() {
  const tipo = useApp((s) => s.tipo);
  if (tipo === 'armadura') return <PasoArmadura />;
  if (tipo === 'resortes') return <PasoResortes />;
  return <Paso1D />;
}

const TITULOS = {
  inicio: 'Inicio',
  config: 'Configuración',
  resultados: 'Resultados',
  paso: 'Paso a paso',
  armadura: 'Armadura 2D',
  reporte: 'Reporte',
} as const;

export default function App() {
  const ruta = useRuta();
  const tema = useTema();
  const presentacion = usePresentacion();
  const [ayuda, setAyuda] = useState(false);
  const [prevPres, setPrevPres] = useState(presentacion);
  if (prevPres !== presentacion) {
    setPrevPres(presentacion);
    setAyuda(presentacion);
  }
  useEffect(() => {
    if (!ayuda) return;
    const id = setTimeout(() => setAyuda(false), 5000);
    return () => clearTimeout(id);
  }, [ayuda]);

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'dark' ? '#161311' : '#faf5ee');
  }, [tema]);

  useEffect(() => {
    document.title = `${TITULOS[ruta]} · FEM Lab`;
  }, [ruta]);

  return (
    <>
      <button
        type="button"
        onClick={() => document.getElementById('contenido')?.focus()}
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent"
      >
        Saltar al contenido
      </button>
      <Encabezado />
      {ruta !== 'reporte' && <NavLateral ruta={ruta} />}
      <div id="contenido" key={ruta} tabIndex={-1} className={ruta === 'reporte' ? 'outline-none' : 'outline-none lg:pl-60'}>
        <Suspense fallback={<Cargando />}>
          {ruta === 'inicio' && <Inicio />}
          {ruta === 'config' && <Config />}
          {ruta === 'resultados' && <Resultados />}
          {ruta === 'paso' && <Paso />}
          {ruta === 'armadura' && <Armadura />}
          {ruta === 'reporte' && <Reporte />}
        </Suspense>
      </div>
      <NavInferior ruta={ruta} />
      {ayuda && (
        <div role="status" className="no-print fixed inset-x-0 bottom-20 z-[65] lg:bottom-8 mx-auto w-fit max-w-[92vw] rounded-xl border border-accent/50 bg-s3 px-4 py-2.5 text-center font-mono text-mini text-ink shadow-card">
          Modo presentación · ← → avanzan en el paso a paso y en las pestañas · 1–5 cambian de sección · Esc para salir
        </div>
      )}
    </>
  );
}
