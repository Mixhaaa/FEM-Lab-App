/** Mensajes de error en lenguaje normal (solo texto: no cambian ningún cálculo). */
import { describe, expect, it } from 'vitest';
import { explicarExpresion } from '../src/ui/explicarError';

const m = (s: string, numero = false) => explicarExpresion(s, numero)?.mensaje ?? null;

describe('explicarExpresion', () => {
  it('expresiones válidas no dan error', () => {
    for (const s of ['10*x^3', '2 + sin(x)', 'exp(-x)', '0.001*(1 - x/2)', 'pi', '5']) expect(m(s)).toBeNull();
  });
  it('explica qué falta y da un ejemplo', () => {
    expect(m('10*x^')).toMatch(/Falta el exponente después de «\^»\. Ejemplo: x\^3/);
    expect(m('10*x*')).toMatch(/termina en «\*»/);
    expect(m('sin(x')).toMatch(/Falta cerrar un paréntesis/);
    expect(m('2*(1-x))')).toMatch(/«\)» de más/);
    expect(m('2,5*x')).toMatch(/punto decimal.*2\.5\*x/);
    expect(m('3*t')).toMatch(/Solo puedes usar la variable x \(escribiste «t»\)/);
    expect(m('sen(x)')).toMatch(/escribe sin\(…\)/);
    expect(m('ln(x)')).toMatch(/escribe log\(…\)/);
    expect(m('x(1-x)')).toMatch(/x\*\(1 - x\)/);
    expect(m('')).toMatch(/vacío/);
    expect(m('1/(x-0.5)')).toMatch(/infinito/);
  });
  it('campos que deben ser un número fijo', () => {
    expect(m('210e9', true)).toBeNull();
    expect(m('2*x', true)).toMatch(/número fijo, sin x/);
  });
});
