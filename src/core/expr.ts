/**
 * Lectura de expresiones escritas por el usuario con math.js.
 * Solo se permite la variable x y las constantes pi y e.
 */
import {
  create,
  // Lectura y compilación de expresiones
  parseDependencies,
  compileDependencies,
  evaluateDependencies,
  // Constantes
  piDependencies,
  eDependencies,
  // Operadores
  addDependencies,
  subtractDependencies,
  multiplyDependencies,
  divideDependencies,
  powDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
  modDependencies,
  largerDependencies,
  smallerDependencies,
  largerEqDependencies,
  smallerEqDependencies,
  equalDependencies,
  unequalDependencies,
  andDependencies,
  orDependencies,
  notDependencies,
  // Funciones que se pueden escribir en las expresiones
  sinDependencies,
  cosDependencies,
  tanDependencies,
  secDependencies,
  cscDependencies,
  cotDependencies,
  asinDependencies,
  acosDependencies,
  atanDependencies,
  atan2Dependencies,
  sinhDependencies,
  coshDependencies,
  tanhDependencies,
  asinhDependencies,
  acoshDependencies,
  atanhDependencies,
  expDependencies,
  logDependencies,
  log10Dependencies,
  log2Dependencies,
  sqrtDependencies,
  cbrtDependencies,
  nthRootDependencies,
  absDependencies,
  signDependencies,
  floorDependencies,
  ceilDependencies,
  roundDependencies,
  maxDependencies,
  minDependencies,
  type MathNode,
  type EvalFunction,
} from 'mathjs';
import { FemError } from './errors';

// Solo las partes de math.js que usa la app (la versión completa pesa mucho más)
const math = create(
  {
    parseDependencies,
    compileDependencies,
    evaluateDependencies,
      piDependencies,
    eDependencies,
    addDependencies,
    subtractDependencies,
    multiplyDependencies,
    divideDependencies,
    powDependencies,
    unaryMinusDependencies,
    unaryPlusDependencies,
    modDependencies,
    largerDependencies,
    smallerDependencies,
    largerEqDependencies,
    smallerEqDependencies,
    equalDependencies,
    unequalDependencies,
    andDependencies,
    orDependencies,
    notDependencies,
    sinDependencies,
    cosDependencies,
    tanDependencies,
    secDependencies,
    cscDependencies,
    cotDependencies,
    asinDependencies,
    acosDependencies,
    atanDependencies,
    atan2Dependencies,
    sinhDependencies,
    coshDependencies,
    tanhDependencies,
    asinhDependencies,
    acoshDependencies,
    atanhDependencies,
    expDependencies,
    logDependencies,
    log10Dependencies,
    log2Dependencies,
    sqrtDependencies,
    cbrtDependencies,
    nthRootDependencies,
    absDependencies,
    signDependencies,
    floorDependencies,
    ceilDependencies,
    roundDependencies,
    maxDependencies,
    minDependencies,
  },
  {},
);

export type Fn = (x: number) => number;

const ALLOWED_SYMBOLS = new Set(['x', 'pi', 'e', 'PI', 'E']);

export interface CompiledExpr {
  source: string;
  fn: Fn;
  /** True si la expresión no depende de x. */
  constant: boolean;
  node: MathNode;
}

function normalize(src: string): string {
  // Acepta coma decimal ("2,5") solo cuando no hay ambigüedad con argumentos de funciones.
  let s = src.trim();
  if (!s.includes('(') && /^\s*-?\d+,\d+\s*$/.test(s)) s = s.replace(',', '.');
  // "**" estilo Python/MATLAB → "^"
  s = s.replace(/\*\*/g, '^');
  return s;
}

/** Árbol de una expresión sin validar sus símbolos (lo usa la exportación de código). */
export function parseExpr(src: string): MathNode {
  return math.parse(normalize(String(src)));
}

/**
 * Compila una expresión en x. Lanza FemError con un mensaje claro si no es válida.
 * @param nombre nombre del campo para el mensaje (ej. "k(x)").
 */
export function compileExpr(src: string, nombre = 'la expresión'): CompiledExpr {
  if (src === undefined || src === null || String(src).trim() === '') {
    throw new FemError(`${nombre} está vacía. Escribe un número o una expresión en x (por ejemplo "0").`, nombre);
  }
  const s = normalize(String(src));
  let node: MathNode;
  try {
    node = math.parse(s);
  } catch (e) {
    throw new FemError(`${nombre} no es una expresión válida: "${src}". ${traducir((e as Error).message)}`, nombre);
  }

  let usesX = false;
  const unknown: string[] = [];
  node.traverse((n: MathNode, path: string, parent: MathNode | null) => {
    if ((n as { isSymbolNode?: boolean }).isSymbolNode) {
      const isFnName = parent && (parent as { isFunctionNode?: boolean }).isFunctionNode && path === 'fn';
      const name = (n as unknown as { name: string }).name;
      if (isFnName) {
        if (typeof (math as unknown as Record<string, unknown>)[name] !== 'function') unknown.push(`${name}()`);
        return;
      }
      if (name === 'x') usesX = true;
      else if (!ALLOWED_SYMBOLS.has(name)) unknown.push(name);
    }
    if ((n as { isAssignmentNode?: boolean }).isAssignmentNode || (n as { isFunctionAssignmentNode?: boolean }).isFunctionAssignmentNode) {
      unknown.push('asignaciones (=)');
    }
  });
  if (unknown.length) {
    const lista = [...new Set(unknown)].join(', ');
    throw new FemError(
      `${nombre}: "${src}" usa ${lista}, que no se reconoce. Solo puedes usar la variable x, las constantes pi y e, y funciones como sin, cos, exp, sqrt, sinh, log.`,
      nombre,
    );
  }

  let code: EvalFunction;
  try {
    code = node.compile();
  } catch (e) {
    throw new FemError(`${nombre} no se pudo compilar: ${traducir((e as Error).message)}`, nombre);
  }
  const fn: Fn = (x: number) => {
    const v = code.evaluate({ x });
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object' && 'toNumber' in v) return (v as { toNumber(): number }).toNumber();
    if (v && typeof v === 'object' && 're' in v && 'im' in v) {
      const c = v as { re: number; im: number };
      if (Math.abs(c.im) < 1e-14 * Math.max(1, Math.abs(c.re))) return c.re;
      throw new FemError(`${nombre} da un número complejo en x = ${fmt(x)} (por ejemplo, raíz de un negativo).`, nombre);
    }
    if (typeof v === 'boolean') return v ? 1 : 0;
    throw new FemError(`${nombre} no devuelve un número en x = ${fmt(x)}.`, nombre);
  };

  return { source: String(src), fn, constant: !usesX, node };
}

/** Evalúa y verifica que el resultado sea finito. */
export function evalChecked(ce: CompiledExpr, x: number, nombre: string): number {
  let v: number;
  try {
    v = ce.fn(x);
  } catch (e) {
    if (e instanceof FemError) throw e;
    throw new FemError(`${nombre} no se pudo evaluar en x = ${fmt(x)}: ${traducir((e as Error).message)}`, nombre);
  }
  if (!Number.isFinite(v)) {
    throw new FemError(`${nombre} = "${ce.source}" no es finita en x = ${fmt(x)} (división por cero o desbordamiento).`, nombre);
  }
  return v;
}


/** Convierte un texto a número aceptando expresiones constantes ("2*pi", "1e-3"). */
export function parseNumber(src: string | number, nombre: string): number {
  if (typeof src === 'number') {
    if (!Number.isFinite(src)) throw new FemError(`${nombre} debe ser un número finito.`, nombre);
    return src;
  }
  const ce = compileExpr(src, nombre);
  if (!ce.constant) throw new FemError(`${nombre} debe ser un número, no puede depender de x.`, nombre);
  return evalChecked(ce, 0, nombre);
}

export function fmt(x: number, digits = 4): string {
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e-3 && a < 1e5) return String(+x.toFixed(digits));
  return x.toExponential(digits - 1);
}

function traducir(msg: string): string {
  return msg
    .replace(/Unexpected end of expression/i, 'La expresión termina de forma inesperada.')
    .replace(/Parenthesis \) expected/i, 'Falta cerrar un paréntesis ")".')
    .replace(/Unexpected operator/i, 'Operador inesperado')
    .replace(/Value expected/i, 'Se esperaba un valor')
    .replace(/Undefined symbol/i, 'Símbolo no definido')
    .replace(/Syntax error in part/i, 'Error de sintaxis en')
    .replace(/\(char (\d+)\)/i, '(carácter $1)');
}
