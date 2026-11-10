/** Escribe en LaTeX la ecuación que se está resolviendo, con los coeficientes que escribió el usuario. */
import { compileExpr } from '../core';

/** Número en LaTeX (m \\times 10^{n} fuera del rango habitual). Igual que texNum de components/Tex. */
function texNum(v: number, sig = 6): string {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e-3 && a < 1e5) return String(Number(v.toPrecision(sig)));
  const [m, e] = v.toExponential(sig - 1).split('e');
  return `${Number(m)}\\times 10^{${Number(e)}}`;
}

/** Convierte una expresión de math.js a LaTeX. */
export function exprTex(src: string): string {
  try {
    return compileExpr(src).node.toTex({ parenthesis: 'auto', implicit: 'hide' });
  } catch {
    // Expresión a medio escribir: se muestra tal cual, como texto (escapando lo que LaTeX interpretaría)
    const ESC: Record<string, string> = {
      '\\': '\\textbackslash ',
      '{': '\\{',
      '}': '\\}',
      '^': '\\textasciicircum ',
      '~': '\\textasciitilde ',
      _: '\\_',
      '#': '\\#',
      $: '\\$',
      '%': '\\%',
      '&': '\\&',
    };
    return `\\text{${src.replace(/[\\{}^~_#$%&]/g, (ch) => ESC[ch])}}`;
  }
}

/** Valor numérico si la expresión es constante; null si depende de x o no se puede leer. */
function constante(src: string): number | null {
  try {
    const c = compileExpr(src);
    const v = c.constant ? c.fn(0) : NaN;
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * −(k u′)′ + b u′ + c u = f con los datos de un tramo, simplificada:
 * k = 1, b = 0, c = 100, f = 10x³  →  −u″ + 100u = 10x³.
 */
export function ecuacionTex(co: { k: string; b: string; c: string; f: string }, u = 'u'): string {
  const kc = constante(co.k);
  let lhs: string;
  if (kc === 1) lhs = `-${u}''`;
  else if (kc === -1) lhs = `${u}''`;
  else if (kc !== null) lhs = `${kc < 0 ? '' : '-'}${texNum(Math.abs(kc), 6)}\\,${u}''`;
  else lhs = `-\\frac{d}{dx}\\left[\\left(${exprTex(co.k)}\\right)\\frac{d${u}}{dx}\\right]`;

  const termino = (src: string, factor: string) => {
    const v = constante(src);
    if (v === 0) return '';
    if (v !== null) return ` ${v < 0 ? '-' : '+'} ${Math.abs(v) === 1 ? '' : `${texNum(Math.abs(v), 6)}\\,`}${factor}`;
    return ` + \\left(${exprTex(src)}\\right)${factor}`;
  };
  lhs += termino(co.b, `${u}'`) + termino(co.c, u);
  return `${lhs} = ${exprTex(co.f)}`;
}
