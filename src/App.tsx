import { useEffect } from 'react';
import { Encabezado, NavInferior } from './ui/components/Shell';
import { useTema } from './ui/components/Grafica';
import { Armadura } from './ui/pages/Armadura';
import { Config } from './ui/pages/Config';
import { Inicio } from './ui/pages/Inicio';
import { Paso1D } from './ui/pages/Paso1D';
import { PasoArmadura, PasoResortes } from './ui/pages/PasoDirecto';
import { Resultados } from './ui/pages/Resultados';
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
} as const;

export default function App() {
  const ruta = useRuta();
  const tema = useTema();

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
      <div id="contenido" key={ruta} tabIndex={-1} className="outline-none">
        {ruta === 'inicio' && <Inicio />}
        {ruta === 'config' && <Config />}
        {ruta === 'resultados' && <Resultados />}
        {ruta === 'paso' && <Paso />}
        {ruta === 'armadura' && <Armadura />}
      </div>
      <NavInferior ruta={ruta} />
    </>
  );
}
