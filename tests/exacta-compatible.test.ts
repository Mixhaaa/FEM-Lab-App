/** La solución analítica escrita solo se usa si corresponde al problema actual. */
import { describe, expect, it } from 'vitest';
import { aplicarEjemplo, estadoPorDefecto, PLANTILLAS_1D, plantilla1D, resolverPlantilla1D } from '../src/templates';

describe('Solución analítica escrita', () => {
  it('ningún ejemplo incluido da una falsa alarma', () => {
    for (const t of PLANTILLAS_1D) {
      for (const ej of t.ejemplos) {
        for (const sistema of ['SI', 'mm'] as const) {
          const e = aplicarEjemplo(t, estadoPorDefecto(t, sistema), ej.id);
          if (!e.exacta?.trim()) continue;
          const r = resolverPlantilla1D(t, e);
          expect(r.avisos.filter((a) => a.includes('no corresponde')), `${t.id}/${ej.id}/${sistema}`).toEqual([]);
          expect(r.exacta?.origen, `${t.id}/${ej.id}/${sistema}`).toBe('usuario');
        }
      }
    }
  });

  it('si se cambia el dominio del ejemplo de clase, no se usa la fórmula vieja', () => {
    const t = plantilla1D('general')!;
    const e = aplicarEjemplo(t, estadoPorDefecto(t), 'clase');
    e.x0 = '-1';
    e.xL = '2';
    const r = resolverPlantilla1D(t, e);
    expect(r.avisos.some((a) => a.includes('no corresponde a este problema'))).toBe(true);
    // f = 10x³ no es constante, así que no hay solución automática: no se compara con nada
    expect(r.exacta).toBeUndefined();
    expect(r.sol.error).toBeUndefined();
  });

  it('con coeficientes constantes usa la solución automática en su lugar', () => {
    const t = plantilla1D('general')!;
    const e = aplicarEjemplo(t, estadoPorDefecto(t), 'clase');
    e.tramos[0].valores.f = '10';
    e.xL = '2';
    const r = resolverPlantilla1D(t, e);
    expect(r.exacta?.origen).toBe('automatica');
    expect(r.sol.error!.maxNodal).toBeLessThan(0.05);
  });

  it('detecta una fórmula que cumple las fronteras pero no la ecuación', () => {
    const t = plantilla1D('general')!;
    const e = aplicarEjemplo(t, estadoPorDefecto(t), 'clase');
    e.tramos[0].valores.c = '99';
    const r = resolverPlantilla1D(t, e);
    expect(r.avisos.some((a) => a.includes('no cumple la ecuación'))).toBe(true);
  });
});
