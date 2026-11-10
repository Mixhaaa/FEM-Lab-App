/** Cambiar la ecuación de un ejemplo: la app debe notar que ya no es el ejemplo y mostrar la ecuación real. */
import { describe, expect, it } from 'vitest';
import { matlab1D } from '../src/export/matlab';
import {
  aplicarEjemplo,
  ejemploArmaduraCoincidente,
  ejemploCoincidente,
  ejemploResortesCoincidente,
  EJEMPLOS_ARMADURA,
  EJEMPLOS_RESORTES,
  estadoPorDefecto,
  PLANTILLAS_1D,
  plantilla1D,
  resolverPlantilla1D,
} from '../src/templates';
import { ecuacionTex } from '../src/ui/ecuacion';

describe('¿Los datos siguen siendo los del ejemplo?', () => {
  it('cada ejemplo recién cargado se reconoce a sí mismo', () => {
    for (const t of PLANTILLAS_1D) {
      for (const ej of t.ejemplos) {
        const e = aplicarEjemplo(t, estadoPorDefecto(t), ej.id);
        expect(ejemploCoincidente(t, e)?.id, `${t.id}/${ej.id}`).toBe(ej.id);
      }
    }
    for (const ej of EJEMPLOS_ARMADURA) expect(ejemploArmaduraCoincidente(structuredClone(ej.estado))?.id).toBe(ej.id);
    for (const ej of EJEMPLOS_RESORTES) expect(ejemploResortesCoincidente(structuredClone(ej.estado))?.id).toBe(ej.id);
  });

  it('cambiar la malla, el tipo de elemento o el método no lo convierte en otro problema', () => {
    const t = plantilla1D('general')!;
    const e = aplicarEjemplo(t, estadoPorDefecto(t), 'clase');
    const otro = { ...e, orden: 2 as const, gauss: 4, metodo: 'penalizacion' as const, malla: { ...e.malla, ne: 40 } };
    expect(ejemploCoincidente(t, otro)?.id).toBe('clase');
  });

  it('cambiar la ecuación, el dominio, una frontera o una carga sí', () => {
    const t = plantilla1D('general')!;
    const base = () => aplicarEjemplo(t, estadoPorDefecto(t), 'clase');
    const cambios: ((e: ReturnType<typeof base>) => void)[] = [
      (e) => void (e.tramos[0].valores.c = '50'),
      (e) => void (e.tramos[0].valores.f = 'sin(x)'),
      (e) => void (e.tramos[0].valores.k = '1 + x'),
      (e) => void (e.xL = '2'),
      (e) => void (e.derecha.valores.valor = '1'),
      (e) => void e.cargas.push({ x: '0.5', P: '1' }),
    ];
    for (const cambiar of cambios) {
      const e = base();
      cambiar(e);
      expect(ejemploCoincidente(t, e)).toBeUndefined();
    }
    const a = structuredClone(EJEMPLOS_ARMADURA[0].estado);
    a.barras[0].A = '0.123';
    expect(ejemploArmaduraCoincidente(a)).toBeUndefined();
  });

  it('el código MATLAB exportado solo dice «Ejemplo» si los datos son los del ejemplo', () => {
    const t = plantilla1D('general')!;
    const e = aplicarEjemplo(t, estadoPorDefecto(t), 'clase');
    expect(matlab1D(resolverPlantilla1D(t, e))).toContain('Ejemplo: ');
    e.xL = '2';
    e.exacta = '';
    expect(matlab1D(resolverPlantilla1D(t, e))).not.toContain('Ejemplo: ');
  });
});

describe('Ecuación con los datos del usuario', () => {
  const eq = (k: string, b: string, c: string, f: string) => ecuacionTex({ k, b, c, f });
  it('ejemplo de clase', () => {
    expect(eq('1', '0', '100', '10*x^3')).toBe("-u'' + 100\\,u = 10\\cdot{ x}^{3}");
  });
  it('omite los términos nulos y respeta los signos', () => {
    expect(eq('1', '0', '0', '2')).toBe("-u'' = 2");
    expect(eq('2.5', '-3', '1', '0')).toBe("-2.5\\,u'' - 3\\,u' + u = 0");
    expect(eq('1', '1', '-4', '1')).toBe("-u'' + u' - 4\\,u = 1");
  });
  it('coeficientes variables', () => {
    const s = eq('1 + x^2', '2 - x', 'cos(x)', 'exp(x)');
    expect(s).toContain('\\frac{d}{dx}');
    expect(s).toContain("u'");
    expect(s).toContain('\\cos');
  });
  it('una expresión a medio escribir no rompe la pantalla ni la fórmula', async () => {
    const katex = (await import('katex')).default;
    for (const malo of ['10*x^', '1 +', '(', 'a_b', '50%', 'x & y', '{', 'x\\y', '#', '$', '~']) {
      const tex = eq('1', '0', '0', malo);
      // KaTeX debe poder dibujarla sin error
      expect(() => katex.renderToString(tex, { throwOnError: true, strict: 'ignore' }), malo).not.toThrow();
    }
    expect(() => eq('1 +', '0', '(', '10*x^')).not.toThrow();
  });
});
