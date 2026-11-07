/**
 * Exportación: traducción de expresiones, CSV y código MATLAB/Python.
 * El código generado se ejecuta de verdad (Python con NumPy y GNU Octave, si están instalados)
 * y debe reproducir los desplazamientos de la app.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { csvBarrasArmadura, csvElementos1D, csvNodos1D, tablaCSV } from '../src/export/csv';
import { exprA, funcionA } from '../src/export/expresiones';
import { matlab1D, matlabArmadura, matlabResortes } from '../src/export/matlab';
import { python1D, pythonArmadura, pythonResortes } from '../src/export/python';
import {
  aplicarEjemplo,
  EJEMPLOS_ARMADURA,
  EJEMPLOS_RESORTES,
  estadoPorDefecto,
  PLANTILLAS_1D,
  resolverArmadura,
  resolverPlantilla1D,
  resolverResortes,
} from '../src/templates';

const hayPython = spawnSync('python3', ['-c', 'import numpy'], { encoding: 'utf8' }).status === 0;
const hayOctave = spawnSync('octave-cli', ['--version'], { encoding: 'utf8' }).status === 0;

/** Todos los casos de prueba: cada ejemplo de cada plantilla. */
const casos = [
  ...PLANTILLAS_1D.flatMap((t) =>
    t.ejemplos.map((ej) => {
      const r = resolverPlantilla1D(t, aplicarEjemplo(t, estadoPorDefecto(t), ej.id));
      return { nombre: `${t.id}/${ej.id}`, u: r.sol.u, m: matlab1D(r), py: python1D(r) };
    }),
  ),
  ...EJEMPLOS_ARMADURA.map((ej) => {
    const r = resolverArmadura(ej.estado);
    return { nombre: `armadura/${ej.id}`, u: r.sol.u, m: matlabArmadura(r), py: pythonArmadura(r) };
  }),
  ...EJEMPLOS_RESORTES.map((ej) => {
    const r = resolverResortes(ej.estado);
    return { nombre: `resortes/${ej.id}`, u: r.sol.u, m: matlabResortes(r), py: pythonResortes(r) };
  }),
];
// Todos los ejemplos 1D con elementos cuadráticos
for (const t of PLANTILLAS_1D) {
  for (const ej of t.ejemplos) {
    const r = resolverPlantilla1D(t, { ...aplicarEjemplo(t, estadoPorDefecto(t), ej.id), orden: 2 });
    casos.push({ nombre: `${t.id}/${ej.id} (cuadráticos)`, u: r.sol.u, m: matlab1D(r), py: python1D(r) });
  }
}
// Variantes con penalización (como en el código de clase)
for (const id of ['clase', 'robin']) {
  const t = PLANTILLAS_1D.find((p) => p.id === 'general')!;
  const e = { ...aplicarEjemplo(t, estadoPorDefecto(t), id), metodo: 'penalizacion' as const };
  const r = resolverPlantilla1D(t, e);
  casos.push({ nombre: `general/${id} (penalización)`, u: r.sol.u, m: matlab1D(r), py: python1D(r) });
}

function leerVector(salida: string, nombre: string): number[] {
  const linea = salida.split(/\r?\n/).find((l) => l.startsWith(`${nombre} =`));
  if (!linea) throw new Error(`No se encontró "${nombre} =" en la salida:\n${salida}`);
  return linea
    .slice(nombre.length + 2)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
}

function compara(obtenido: number[], esperado: number[]) {
  expect(obtenido).toHaveLength(esperado.length);
  const escala = Math.max(...esperado.map(Math.abs), 1e-300);
  obtenido.forEach((v, i) => expect(Math.abs(v - esperado[i]) / escala).toBeLessThan(1e-7));
}

describe('Traducción de expresiones', () => {
  it('a MATLAB (vectorizado)', () => {
    expect(exprA('10*x^3', 'matlab')).toBe('10 .* (x .^ 3)');
    expect(exprA('2+sin(x)', 'matlab')).toBe('2 + sin(x)');
    expect(exprA('e^(-x)/pi', 'matlab')).toBe('(exp(1) .^ (-x)) ./ pi');
    expect(exprA('x <= 0.3 ? 1 : 2', 'matlab')).toBe('((x <= 0.3)).*(1) + (~((x <= 0.3))).*(2)');
    expect(exprA('-(x+1)^2', 'matlab')).toBe('-((x + 1) .^ 2)');
    expect(exprA('log(x, 2)', 'matlab')).toBe('log(x) ./ log(2)');
    expect(funcionA('5', 'matlab')).toBe('@(x) 5 + 0*x');
  });
  it('a Python (NumPy)', () => {
    expect(exprA('10*x^3', 'python')).toBe('10 * (x ** 3)');
    expect(exprA('sinh(10*x)/sinh(10)', 'python')).toBe('np.sinh(10 * x) / np.sinh(10)');
    expect(exprA('x <= 0.3 ? 1 : 2', 'python')).toBe('np.where((x <= 0.3), 1, 2)');
    expect(funcionA('1 + x', 'python')).toBe('lambda x: 1 + x');
  });
  it('una función sin traducción da un error claro', () => {
    expect(() => exprA('gamma(x)', 'matlab')).toThrowError(/gamma/);
  });
});

describe('CSV', () => {
  const t = PLANTILLAS_1D.find((p) => p.id === 'barra')!;
  const r = resolverPlantilla1D(t, aplicarEjemplo(t, estadoPorDefecto(t), 'empotrada'));
  it('tabla nodal con unidades, analítica y reacciones', () => {
    const csv = csvNodos1D(r);
    const lineas = csv.replace('﻿', '').trim().split('\r\n');
    expect(lineas[0]).toBe('nodo,x [m],u MEF [m],u exacta [m],error,k du/dx (promedio nodal),R [N]');
    expect(lineas).toHaveLength(r.sol.u.length + 1);
    expect(lineas[1].endsWith(',-27500')).toBe(true);
  });
  it('formato Excel en español: punto y coma y coma decimal', () => {
    expect(tablaCSV(['a', 'b'], [[1.5, 'x;y']], 'excel-es')).toBe('﻿a;b\r\n1,5;"x;y"\r\n');
  });
  it('tabla por elemento y barras de armadura', () => {
    expect(csvElementos1D(r).split('\r\n')[0]).toContain('σ [Pa]');
    const a = resolverArmadura(EJEMPLOS_ARMADURA[0].estado);
    expect(csvBarrasArmadura(a).split('\r\n')[1]).toContain('compresión');
  });
});

describe.skipIf(!hayPython)('El código Python exportado reproduce la app', () => {
  const dir = mkdtempSync(join(tmpdir(), 'femlab-py-'));
  for (const c of casos) {
    it(c.nombre, () => {
      const f = join(dir, `${c.nombre.replace(/[^\w]+/g, '_')}.py`);
      writeFileSync(f, c.py);
      const salida = execFileSync('python3', [f], { encoding: 'utf8', env: { ...process.env, MPLBACKEND: 'Agg' } });
      compara(leerVector(salida, 'u'), c.u);
    });
  }
});

describe.skipIf(!hayOctave)('El código MATLAB exportado reproduce la app (GNU Octave)', () => {
  it(`los ${casos.length} scripts`, { timeout: 240_000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'femlab-m-'));
    // Octave sin interfaz gráfica: las funciones de gráficas no hacen nada
    const stubs = join(dir, 'stubs');
    mkdirSync(stubs);
    for (const fn of ['figure', 'spy', 'plot', 'hold', 'grid', 'xlabel', 'ylabel', 'title', 'legend', 'stairs', 'axis']) {
      writeFileSync(join(stubs, `${fn}.m`), `function varargout = ${fn}(varargin), varargout = cell(1, nargout); end\n`);
    }
    const ordenes = [`addpath('${stubs}');`, "warning('off', 'all');"];
    casos.forEach((c, i) => {
      const f = join(dir, `caso${i}.m`);
      writeFileSync(f, c.m);
      ordenes.push(`disp('### ${i}'); run('${f}');`);
    });
    const salida = execFileSync('octave-cli', ['--no-gui', '--quiet', '--eval', ordenes.join('\n')], { encoding: 'utf8', maxBuffer: 1 << 26 });
    const partes = salida.split(/^### (\d+)$/m);
    casos.forEach((c, i) => {
      const k = partes.indexOf(String(i));
      expect(k, `sin salida para ${c.nombre}`).toBeGreaterThan(0);
      compara(leerVector(partes[k + 1], 'u'), c.u);
    });
  });
});
