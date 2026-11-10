/** Catálogo de plantillas de FEM Lab. */
import { EJEMPLOS_ARMADURA, plantillaArmadura } from './armadura';
import { electrostatica } from './electrica';
import { darcy, tuberia } from './fluidos';
import { general } from './general';
import { EJEMPLOS_RESORTES, plantillaResortes } from './resortes';
import { barra, cable } from './solidos1d';
import { aleta, calor } from './termica';
import type { Plantilla1D } from './types';

export * from './types';
export * from './construir1d';
export * from './armadura';
export * from './resortes';
export { EXACTA_CLASE } from './general';
export { EPS0 } from './electrica';

export const PLANTILLAS_1D: Plantilla1D[] = [general, barra, calor, aleta, cable, darcy, tuberia, electrostatica];

export type PlantillaCualquiera = Plantilla1D | typeof plantillaArmadura | typeof plantillaResortes;

/** Todas las plantillas en el orden en que se muestran en Inicio. */
export const PLANTILLAS: PlantillaCualquiera[] = [
  barra,
  calor,
  aleta,
  cable,
  darcy,
  tuberia,
  electrostatica,
  plantillaArmadura,
  plantillaResortes,
  general,
];

export function plantilla1D(id: string): Plantilla1D | undefined {
  return PLANTILLAS_1D.find((p) => p.id === id);
}

/** Ejemplo de armadura cuyos datos coinciden con el estado actual (undefined si ya se modificó). */
export function ejemploArmaduraCoincidente(e: unknown) {
  const actual = JSON.stringify(e);
  return EJEMPLOS_ARMADURA.find((x) => JSON.stringify(x.estado) === actual);
}

/** Ejemplo de resortes cuyos datos coinciden con el estado actual (undefined si ya se modificó). */
export function ejemploResortesCoincidente(e: unknown) {
  const actual = JSON.stringify(e);
  return EJEMPLOS_RESORTES.find((x) => JSON.stringify(x.estado) === actual);
}
