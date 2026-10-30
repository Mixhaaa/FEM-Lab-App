/** Matrices y vectores escritos con la sintaxis de MATLAB/Octave. */

export function numMatlab(v: number, sig = 12): string {
  if (!Number.isFinite(v)) return v > 0 ? 'Inf' : v < 0 ? '-Inf' : 'NaN';
  if (v === 0) return '0';
  return String(Number(v.toPrecision(sig)));
}

/** "K = [a b; c d];" con una fila por línea. */
export function matrizMatlab(nombre: string, M: number[][], sig = 12): string {
  if (M.length === 0) return `${nombre} = [];`;
  const filas = M.map((r) => '    ' + r.map((v) => numMatlab(v, sig)).join('  '));
  return `${nombre} = [\n${filas.join(';\n')}\n];`;
}

/** Vector columna: "F = [a; b; c];". */
export function vectorMatlab(nombre: string, v: number[], sig = 12): string {
  return `${nombre} = [${v.map((x) => numMatlab(x, sig)).join('; ')}];`;
}
