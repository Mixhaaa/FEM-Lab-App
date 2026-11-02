/** Formato de números para la interfaz. */

const SUP: Record<string, string> = { '-': '⁻', '+': '', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

const sup = (s: string) => s.split('').map((c) => SUP[c] ?? c).join('');

/** Número legible: notación fija si es razonable; si no, m × 10ⁿ. Usa el signo menos tipográfico. */
export function fmtNum(v: number, sig = 4): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '—';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
  if (v === 0) return '0';
  const a = Math.abs(v);
  let s: string;
  if (a >= 1e-3 && a < 1e5) {
    s = Number(v.toPrecision(sig)).toString();
  } else {
    const [m, e] = v.toExponential(sig - 1).split('e');
    s = `${Number(m)}×10${sup(String(Number(e)))}`;
  }
  return s.replace(/^-/, '−');
}

/** Número con decimales fijos (órdenes de convergencia, pesos de Gauss) y signo menos tipográfico. */
export function fmtFijo(v: number, dec: number): string {
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(dec).replace(/^-/, '−');
}

/** Número para tablas de matrices: siempre con la misma cantidad de cifras significativas. */
export function fmtMat(v: number, sig = 5): string {
  if (v === 0 || Math.abs(v) < 1e-300) return '0';
  return fmtNum(v, sig);
}

/** Lleva a cero los valores de redondeo frente a una escala. */
export function snap(v: number, escala: number, rel = 1e-11): number {
  return Math.abs(v) <= rel * Math.abs(escala) ? 0 : v;
}

const PREF: [number, string][] = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
];

/** Escoge un prefijo SI para Pa, N, W y J (solo para mostrar indicadores). */
export function conPrefijo(v: number, unidad: string): { valor: number; unidad: string } {
  if (!['Pa', 'N', 'W', 'J'].includes(unidad) || !Number.isFinite(v) || v === 0) return { valor: v, unidad };
  const a = Math.abs(v);
  for (const [f, p] of PREF) if (a >= f) return { valor: v / f, unidad: p + unidad };
  return { valor: v, unidad };
}

/** Texto de un valor con unidad. */
export function conUnidad(v: number, unidad: string, sig = 4): string {
  const u = unidad && unidad !== '—' ? ` ${unidad}` : '';
  return `${fmtNum(v, sig)}${u}`;
}

/** Subíndices numéricos (N₁, e₂). */
export function sub(n: number): string {
  return String(n)
    .split('')
    .map((c) => '₀₁₂₃₄₅₆₇₈₉'[Number(c)] ?? c)
    .join('');
}
