/** Encuentra el primer campo con un error de escritura, para nombrarlo y llevar al usuario hasta él. */
import { unidad, valorPorDefecto, type Estado1D, type Plantilla1D } from '../templates';
import { explicarExpresion } from './explicarError';
import { ir } from './router';

export interface ErrorDeCampo {
  /** id del elemento <input> en la página de Configuración. */
  id: string;
  /** Nombre del campo como lo ve el usuario. */
  campo: string;
  mensaje: string;
}

export const idCampo = {
  x0: 'campo-x0',
  xL: 'campo-xL',
  tramo: (i: number, id: string) => `campo-t${i}-${id}`,
  global: (id: string) => `campo-g-${id}`,
  frontera: (lado: string, id: string) => `campo-f-${lado}-${id}`,
  carga: (i: number, c: 'x' | 'P') => `campo-c${i}-${c}`,
  exacta: 'campo-exacta',
};

export function primerErrorDeCampo(t: Plantilla1D, e: Estado1D): ErrorDeCampo | null {
  const revisar = (id: string, campo: string, valor: string, numero: boolean): ErrorDeCampo | null => {
    const x = explicarExpresion(valor, numero);
    return x ? { id, campo, mensaje: x.mensaje } : null;
  };
  const multi = e.tramos.length > 1;
  const lista: (() => ErrorDeCampo | null)[] = [
    () => revisar(idCampo.x0, 'Inicio x₀', e.x0, true),
    () => revisar(idCampo.xL, 'Final xL', e.xL, true),
    ...t.camposGlobales.map((c) => () => revisar(idCampo.global(c.id), `${c.nombre} ${c.simbolo}`, e.globales[c.id] ?? valorPorDefecto(c, e.sistema), true)),
    ...e.tramos.flatMap((tr, i) =>
      t.camposTramo.map((c) => () => revisar(idCampo.tramo(i, c.id), `${c.nombre} ${c.simbolo}${multi ? ` (tramo ${i + 1})` : ''}`, tr.valores[c.id] ?? valorPorDefecto(c, e.sistema), c.tipo === 'numero')),
    ),
    ...(['izquierda', 'derecha'] as const).flatMap((lado) => {
      const op = t.fronteras.find((o) => o.id === e[lado].opcion);
      return (op?.campos ?? []).map((c) => () => {
        const u = unidad(c.unidad, e.sistema);
        return revisar(idCampo.frontera(lado, c.id), `${c.nombre} en el extremo ${lado}${u && u !== '—' ? ` [${u}]` : ''}`, e[lado].valores[c.id] ?? valorPorDefecto(c, e.sistema), true);
      });
    }),
    ...e.cargas.flatMap((cg, i) => [
      () => revisar(idCampo.carga(i, 'x'), `Posición de la carga ${i + 1}`, cg.x, true),
      () => revisar(idCampo.carga(i, 'P'), `Valor de la carga ${i + 1}`, cg.P, true),
    ]),
    () => (e.exacta.trim() ? revisar(idCampo.exacta, 'Solución analítica', e.exacta, false) : null),
  ];
  for (const f of lista) {
    const r = f();
    if (r) return r;
  }
  return null;
}

/** Lleva a Configuración y pone el foco en el campo indicado. */
export function irAlCampo(id: string) {
  ir('config');
  let intentos = 0;
  const buscar = () => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ block: 'center' });
      el.focus();
    } else if (intentos++ < 20) {
      // El campo puede estar dentro de una sección plegada: se pide abrirlas y se reintenta
      window.dispatchEvent(new Event('femlab:abrir-secciones'));
      setTimeout(buscar, 100);
    }
  };
  setTimeout(buscar, 50);
}
