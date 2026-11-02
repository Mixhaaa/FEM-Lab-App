/**
 * Explica en lenguaje normal por qué una expresión no es válida y cómo corregirla.
 * Solo trabaja sobre el texto escrito: no cambia cómo se calcula nada.
 */
import { compileExpr } from '../core';

/** Nombres que suelen escribirse en español o en otros programas, y su equivalente. */
const SINONIMOS: Record<string, string> = {
  sen: 'sin',
  tg: 'tan',
  ln: 'log',
  raiz: 'sqrt',
  sqr: 'sqrt',
  senh: 'sinh',
  arcsen: 'asin',
  arcsin: 'asin',
  arccos: 'acos',
  arctan: 'atan',
  abs: 'abs',
};

export interface Explicacion {
  /** Qué está mal y cómo corregirlo, en una o dos frases. */
  mensaje: string;
}

export const EJEMPLOS_EXPRESION = '10*x^3 · 2 + sin(x) · exp(-x) · 0.001*(1 - x/2)';

/**
 * Devuelve null si el texto es válido. `numero` = el campo debe ser constante (no puede tener x).
 */
export function explicarExpresion(texto: string, numero = false): Explicacion | null {
  const s = (texto ?? '').trim();
  if (s === '') {
    return { mensaje: numero ? 'Está vacío. Escribe un número, por ejemplo 0 o 210e9.' : 'Está vacío. Escribe un número o una expresión en x, por ejemplo 0, 5 o 10*x^3.' };
  }
  let error: Error | null = null;
  let constante = true;
  let valor = 0;
  try {
    const ce = compileExpr(s, 'El valor');
    constante = ce.constant;
    valor = ce.fn(ce.constant ? 0 : 0.5);
  } catch (e) {
    error = e as Error;
  }
  if (!error) {
    if (numero && !constante) return { mensaje: 'Aquí va un número fijo, sin x. Por ejemplo 210e9 o 0.0025.' };
    if (!Number.isFinite(valor)) return { mensaje: 'Da un resultado infinito o indefinido (¿una división entre cero?). Revisa los denominadores.' };
    return null;
  }

  // 1. Coma decimal
  if (/\d,\d/.test(s) && !/[a-z]\s*\(/i.test(s)) {
    return { mensaje: `Usa punto decimal, no coma: escribe ${s.replace(/(\d),(\d)/g, '$1.$2')}.` };
  }
  // 2. Paréntesis
  const abre = (s.match(/\(/g) ?? []).length;
  const cierra = (s.match(/\)/g) ?? []).length;
  if (abre > cierra) return { mensaje: `Falta cerrar ${abre - cierra === 1 ? 'un paréntesis' : `${abre - cierra} paréntesis`} con «)». Ejemplo: sin(x) o 2*(1 - x).` };
  if (cierra > abre) return { mensaje: 'Hay un «)» de más, o falta abrir un paréntesis con «(». Ejemplo: 2*(1 - x).' };
  // 3. Termina en un operador
  const final = s.match(/([+\-*/^])\s*$/);
  if (final) {
    if (final[1] === '^') return { mensaje: 'Falta el exponente después de «^». Ejemplo: x^3.' };
    return { mensaje: `La expresión termina en «${final[1]}»: falta lo que va después. Ejemplo: 10*x o 1 - x.` };
  }
  // 4. Empieza con un operador que no puede ir al inicio
  const inicio = s.match(/^([*/^])/);
  if (inicio) return { mensaje: `No puede empezar con «${inicio[1]}». Ejemplo: 10*x^3.` };
  // 5. Dos operadores seguidos
  const doble = s.match(/([*/^+-])\s*([*/^])/);
  if (doble) return { mensaje: `Hay dos operadores seguidos («${doble[1]}${doble[2]}»). Deja solo uno: por ejemplo 2*x en vez de 2**x.` };
  // 6. Nombres desconocidos (variables o funciones)
  const usa = /usa (.+?), que no se reconoce/.exec(error.message)?.[1];
  if (usa) {
    const nombres = usa.split(', ');
    const fn = nombres.find((n) => n.endsWith('()'));
    if (fn) {
      const nombre = fn.slice(0, -2);
      if (nombre === 'x') return { mensaje: 'Para multiplicar por x escribe el asterisco: x*(1 - x), no x(1 - x).' };
      const sugerida = SINONIMOS[nombre.toLowerCase()];
      if (sugerida) return { mensaje: `«${nombre}» no existe aquí: escribe ${sugerida}(…). Por ejemplo ${sugerida}(x).` };
      return { mensaje: `La función «${nombre}» no está disponible. Puedes usar sin, cos, tan, exp, log (natural), log10, sqrt, sinh, cosh, abs.` };
    }
    const v = nombres[0];
    if (/^[a-zA-Z]$/.test(v)) return { mensaje: `Solo puedes usar la variable x (escribiste «${v}»). Si tu ecuación usa ${v}, escríbela con x.` };
    return { mensaje: `«${v}» no se reconoce. Solo puedes usar x, los números, pi, e y funciones como sin(x) o exp(x).` };
  }
  return { mensaje: `No se entiende la expresión. Revisa operadores y paréntesis. Ejemplos válidos: ${EJEMPLOS_EXPRESION}.` };
}
