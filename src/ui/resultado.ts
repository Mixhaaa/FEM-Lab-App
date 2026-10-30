/** Hooks que resuelven el problema activo a partir del estado (memorizados). */
import { useDeferredValue, useMemo } from 'react';
import {
  plantilla1D,
  resolverArmadura,
  resolverPlantilla1D,
  resolverResortes,
  type Resultado1D,
  type ResultadoArmadura,
  type ResultadoResortes,
} from '../templates';
import { useApp } from './store';

export type Intento<T> = { ok: true; res: T } | { ok: false; error: Error & { campo?: string } };

function intentar<T>(f: () => T): Intento<T> {
  try {
    return { ok: true, res: f() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export function useResultado1D(): Intento<Resultado1D> {
  // Diferido: escribir en un campo no espera a que termine el cálculo
  const e = useDeferredValue(useApp((s) => s.e1d));
  return useMemo(
    () =>
      intentar(() => {
        const t = plantilla1D(e.plantilla);
        if (!t) throw new Error('Plantilla desconocida.');
        return resolverPlantilla1D(t, e);
      }),
    [e],
  );
}

export function useResultadoArmadura(): Intento<ResultadoArmadura> {
  const e = useApp((s) => s.armadura);
  return useMemo(() => intentar(() => resolverArmadura(e)), [e]);
}

export function useResultadoResortes(): Intento<ResultadoResortes> {
  const e = useApp((s) => s.resortes);
  return useMemo(() => intentar(() => resolverResortes(e)), [e]);
}
