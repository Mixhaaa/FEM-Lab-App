/**
 * Traduce expresiones de math.js a MATLAB/Octave (vectorizadas) y a Python/NumPy,
 * recorriendo el árbol de la expresión.
 */
import type { MathNode } from 'mathjs';
import { compileExpr, parseExpr } from '../core';

export type Lenguaje = 'matlab' | 'python';

const FUN: Record<string, { matlab: string; python: string }> = {
  sin: { matlab: 'sin', python: 'np.sin' },
  cos: { matlab: 'cos', python: 'np.cos' },
  tan: { matlab: 'tan', python: 'np.tan' },
  asin: { matlab: 'asin', python: 'np.arcsin' },
  acos: { matlab: 'acos', python: 'np.arccos' },
  atan: { matlab: 'atan', python: 'np.arctan' },
  sinh: { matlab: 'sinh', python: 'np.sinh' },
  cosh: { matlab: 'cosh', python: 'np.cosh' },
  tanh: { matlab: 'tanh', python: 'np.tanh' },
  asinh: { matlab: 'asinh', python: 'np.arcsinh' },
  acosh: { matlab: 'acosh', python: 'np.arccosh' },
  atanh: { matlab: 'atanh', python: 'np.arctanh' },
  exp: { matlab: 'exp', python: 'np.exp' },
  sqrt: { matlab: 'sqrt', python: 'np.sqrt' },
  abs: { matlab: 'abs', python: 'np.abs' },
  sign: { matlab: 'sign', python: 'np.sign' },
  floor: { matlab: 'floor', python: 'np.floor' },
  ceil: { matlab: 'ceil', python: 'np.ceil' },
  round: { matlab: 'round', python: 'np.round' },
  log10: { matlab: 'log10', python: 'np.log10' },
  log2: { matlab: 'log2', python: 'np.log2' },
  cbrt: { matlab: 'nthroot', python: 'np.cbrt' },
  atan2: { matlab: 'atan2', python: 'np.arctan2' },
  mod: { matlab: 'mod', python: 'np.mod' },
  max: { matlab: 'max', python: 'np.maximum' },
  min: { matlab: 'min', python: 'np.minimum' },
};

type Nodo = MathNode & {
  type: string;
  fn?: { name?: string } | string;
  op?: string;
  args?: Nodo[];
  value?: unknown;
  name?: string;
  content?: Nodo;
  condition?: Nodo;
  trueExpr?: Nodo;
  falseExpr?: Nodo;
  implicit?: boolean;
};

function numero(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Constante no válida: ${String(v)}`);
  const a = Math.abs(n);
  if (a !== 0 && (a >= 1e6 || a < 1e-4)) return n.toExponential().replace('e+', 'e');
  return String(n);
}

/** Variables y funciones con nombre que se permiten además de x (para el código exportado). */
export interface Contexto {
  simbolos?: Set<string>;
  funciones?: Set<string>;
}

function traducir(n: Nodo, L: Lenguaje, ctx: Contexto = {}): string {
  const t = (m: Nodo) => traducir(m, L, ctx);
  switch (n.type) {
    case 'ConstantNode':
      return typeof n.value === 'boolean' ? (n.value ? '1' : '0') : numero(n.value);
    case 'SymbolNode': {
      const s = n.name;
      if (s === 'x') return 'x';
      if (s && ctx.simbolos?.has(s)) return s;
      if (s === 'pi' || s === 'PI') return L === 'matlab' ? 'pi' : 'np.pi';
      if (s === 'e' || s === 'E') return L === 'matlab' ? 'exp(1)' : 'np.e';
      throw new Error(`Símbolo no reconocido: ${s}`);
    }
    case 'ParenthesisNode': {
      const c = t(n.content!);
      const simple = ['SymbolNode', 'ConstantNode', 'FunctionNode'].includes(n.content!.type);
      return simple || envuelto(c) ? c : `(${c})`;
    }
    case 'OperatorNode': {
      const a = n.args ?? [];
      const fn = typeof n.fn === 'string' ? n.fn : n.fn?.name;
      const bin = (mat: string, py: string) => `(${t(a[0])} ${L === 'matlab' ? mat : py} ${t(a[1])})`;
      switch (fn) {
        case 'add':
          return bin('+', '+');
        case 'subtract':
          return bin('-', '-');
        case 'multiply':
          return bin('.*', '*');
        case 'divide':
          return bin('./', '/');
        case 'pow':
          return bin('.^', '**');
        case 'unaryMinus':
          return `(-${t(a[0])})`;
        case 'unaryPlus':
          return t(a[0]);
        case 'larger':
          return bin('>', '>');
        case 'smaller':
          return bin('<', '<');
        case 'largerEq':
          return bin('>=', '>=');
        case 'smallerEq':
          return bin('<=', '<=');
        case 'equal':
          return bin('==', '==');
        case 'unequal':
          return bin('~=', '!=');
        case 'and':
          return L === 'matlab' ? bin('&', '&') : `np.logical_and(${t(a[0])}, ${t(a[1])})`;
        case 'or':
          return L === 'matlab' ? bin('|', '|') : `np.logical_or(${t(a[0])}, ${t(a[1])})`;
        case 'not':
          return L === 'matlab' ? `(~${t(a[0])})` : `np.logical_not(${t(a[0])})`;
        case 'mod':
          return L === 'matlab' ? `mod(${t(a[0])}, ${t(a[1])})` : `np.mod(${t(a[0])}, ${t(a[1])})`;
        default:
          throw new Error(`Operador no soportado: ${n.op ?? fn}`);
      }
    }
    case 'FunctionNode': {
      const nombre = typeof n.fn === 'string' ? n.fn : (n.fn as { name?: string })?.name ?? '';
      const a = (n.args ?? []).map((m) => limpiar(t(m)));
      if (ctx.funciones?.has(nombre)) return `${nombre}(${a.join(', ')})`;
      if (nombre === 'log') {
        const ln = L === 'matlab' ? 'log' : 'np.log';
        return a.length === 2 ? `(${ln}(${a[0]}) ${L === 'matlab' ? './' : '/'} ${ln}(${a[1]}))` : `${ln}(${a[0]})`;
      }
      if (nombre === 'pow') return L === 'matlab' ? `((${a[0]}).^(${a[1]}))` : `((${a[0]})**(${a[1]}))`;
      if (nombre === 'cbrt' && L === 'matlab') return `nthroot(${a[0]}, 3)`;
      if (nombre === 'nthRoot') return L === 'matlab' ? `nthroot(${a[0]}, ${a[1]})` : `np.sign(${a[0]})*np.abs(${a[0]})**(1/(${a[1]}))`;
      if (['sec', 'csc', 'cot'].includes(nombre)) {
        if (L === 'matlab') return `${nombre}(${a[0]})`;
        const base = { sec: 'np.cos', csc: 'np.sin', cot: 'np.tan' }[nombre as 'sec'];
        return `(1/${base}(${a[0]}))`;
      }
      const f = FUN[nombre];
      if (!f) throw new Error(`La función ${nombre}() no tiene traducción automática.`);
      return `${f[L]}(${a.join(', ')})`;
    }
    case 'ConditionalNode': {
      const c = t(n.condition!);
      const v = t(n.trueExpr!);
      const f = t(n.falseExpr!);
      return L === 'matlab' ? `((${c}).*(${v}) + (~(${c})).*(${f}))` : `np.where(${c}, ${v}, ${f})`;
    }
    default:
      throw new Error(`Expresión no soportada (${n.type}).`);
  }
}

/** ¿Todo el texto está dentro de un único par de paréntesis externos? */
function envuelto(r: string): boolean {
  if (!(r.startsWith('(') && r.endsWith(')'))) return false;
  let nivel = 0;
  for (let i = 0; i < r.length; i++) {
    if (r[i] === '(') nivel++;
    else if (r[i] === ')') nivel--;
    if (nivel === 0 && i < r.length - 1) return false;
  }
  return true;
}

/** Quita paréntesis externos redundantes para que el código se lea mejor. */
function limpiar(s: string): string {
  let r = s.trim();
  while (envuelto(r)) r = r.slice(1, -1).trim();
  return r;
}

export function exprA(src: string, L: Lenguaje, ctx?: Contexto): string {
  const nodo = ctx ? parseExpr(src) : compileExpr(src).node;
  return limpiar(traducir(nodo as Nodo, L, ctx));
}

/** Función anónima vectorizada: @(x) ... en MATLAB, lambda x: ... en Python. Siempre devuelve un arreglo del tamaño de x. */
export function funcionA(src: string, L: Lenguaje): string {
  const ce = compileExpr(src);
  const cuerpo = exprA(src, L);
  if (L === 'matlab') return ce.constant ? `@(x) ${cuerpo} + 0*x` : `@(x) ${cuerpo}`;
  return ce.constant ? `lambda x: ${cuerpo} + 0*x` : `lambda x: ${cuerpo}`;
}
