/** Archivos que se pueden descargar para cada tipo de problema. */
import { csvBarrasArmadura, csvElementos1D, csvNodos1D, csvNodosArmadura, csvNodosResortes, csvResortes } from '../export/csv';
import { matlab1D, matlabArmadura, matlabResortes } from '../export/matlab';
import { python1D, pythonArmadura, pythonResortes } from '../export/python';
import { ejemploArmaduraCoincidente, ejemploCoincidente, ejemploResortesCoincidente, type Resultado1D, type ResultadoArmadura, type ResultadoResortes } from '../templates';
import type { ArchivoExportable } from './components/PanelExportar';
import { nombreBase } from './descargar';

const CSV = 'text/csv;charset=utf-8';
const TXT = 'text/plain;charset=utf-8';

function comunes(base: string, csv: [string, string, (f: Parameters<ArchivoExportable['generar']>[0]) => string][], m: () => string, py: () => string): ArchivoExportable[] {
  return [
    ...csv.map(([sufijo, sub, gen]) => ({ id: `csv-${sufijo}`, titulo: `CSV ${sufijo}`, subtitulo: sub, icon: 'csv', nombre: `${base}_${sufijo}.csv`, mime: CSV, csv: true, generar: gen })),
    { id: 'm', titulo: 'MATLAB .m', subtitulo: 'Script de clase (Octave)', icon: 'terminal', nombre: `${base}.m`, mime: TXT, generar: m },
    { id: 'py', titulo: 'Python .py', subtitulo: 'NumPy / Matplotlib', icon: 'code', nombre: `${base}.py`, mime: TXT, generar: py },
  ];
}

export function archivos1D(res: Resultado1D): ArchivoExportable[] {
  const ej = ejemploCoincidente(res.plantilla, res.estado)?.id ?? 'personalizado';
  const base = nombreBase('femlab', res.plantilla.id, ej);
  return comunes(
    base,
    [
      ['nodos', 'Resultados nodales', (f) => csvNodos1D(res, f)],
      ['elementos', 'Derivadas por elemento', (f) => csvElementos1D(res, f)],
    ],
    () => matlab1D(res),
    () => python1D(res),
  );
}

export function archivosArmadura(res: ResultadoArmadura): ArchivoExportable[] {
  const base = nombreBase('femlab', 'armadura', ejemploArmaduraCoincidente(res.estado)?.id ?? 'personalizada');
  return comunes(
    base,
    [
      ['nodos', 'Desplazamientos y reacciones', (f) => csvNodosArmadura(res, f)],
      ['barras', 'Fuerzas y esfuerzos', (f) => csvBarrasArmadura(res, f)],
    ],
    () => matlabArmadura(res),
    () => pythonArmadura(res),
  );
}

export function archivosResortes(res: ResultadoResortes): ArchivoExportable[] {
  const base = nombreBase('femlab', 'resortes', ejemploResortesCoincidente(res.estado)?.id ?? 'personalizado');
  return comunes(
    base,
    [
      ['nodos', 'Desplazamientos y reacciones', (f) => csvNodosResortes(res, f)],
      ['resortes', 'Fuerza en cada resorte', (f) => csvResortes(res, f)],
    ],
    () => matlabResortes(res),
    () => pythonResortes(res),
  );
}
