/** Estado global de la interfaz (persistido en el navegador). */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  aplicarEjemplo,
  EJEMPLOS_ARMADURA,
  EJEMPLOS_RESORTES,
  estadoArmaduraPorDefecto,
  estadoPorDefecto,
  estadoResortesPorDefecto,
  plantilla1D,
  type Estado1D,
  type EstadoArmadura,
  type EstadoResortes,
} from '../templates';

export type Tema = 'sistema' | 'oscuro' | 'claro';
export type TipoProblema = '1d' | 'armadura' | 'resortes';

export interface AppState {
  tema: Tema;
  /** Modo presentación (no se guarda). */
  presentacion: boolean;
  setPresentacion: (v: boolean) => void;
  tipo: TipoProblema;
  e1d: Estado1D;
  armadura: EstadoArmadura;
  resortes: EstadoResortes;
  /** Último ejemplo cargado por tipo, para "Restablecer". */
  ejemplo: { '1d': string; armadura: string; resortes: string };
  setTema: (t: Tema) => void;
  /** Carga una plantilla (y opcionalmente uno de sus ejemplos). */
  cargar: (plantillaId: string, ejemploId?: string) => void;
  set1D: (f: (e: Estado1D) => Estado1D) => void;
  setArmadura: (f: (e: EstadoArmadura) => EstadoArmadura) => void;
  setResortes: (f: (e: EstadoResortes) => EstadoResortes) => void;
  restablecer: () => void;
}

const general = plantilla1D('general')!;

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      tema: 'sistema',
      presentacion: false,
      setPresentacion: (presentacion) => set({ presentacion }),
      tipo: '1d',
      e1d: estadoPorDefecto(general),
      armadura: estadoArmaduraPorDefecto(),
      resortes: estadoResortesPorDefecto(),
      ejemplo: { '1d': 'clase', armadura: EJEMPLOS_ARMADURA[0].id, resortes: EJEMPLOS_RESORTES[0].id },
      setTema: (tema) => set({ tema }),
      cargar: (plantillaId, ejemploId) => {
        if (plantillaId === 'armadura') {
          const ej = EJEMPLOS_ARMADURA.find((e) => e.id === ejemploId) ?? EJEMPLOS_ARMADURA[0];
          set((s) => ({ tipo: 'armadura', armadura: structuredClone(ej.estado), ejemplo: { ...s.ejemplo, armadura: ej.id } }));
          return;
        }
        if (plantillaId === 'resortes') {
          const ej = EJEMPLOS_RESORTES.find((e) => e.id === ejemploId) ?? EJEMPLOS_RESORTES[0];
          set((s) => ({ tipo: 'resortes', resortes: structuredClone(ej.estado), ejemplo: { ...s.ejemplo, resortes: ej.id } }));
          return;
        }
        const t = plantilla1D(plantillaId);
        if (!t) return;
        const base = estadoPorDefecto(t);
        const id = ejemploId ?? t.ejemplos[0]?.id ?? '';
        const e1d = id ? aplicarEjemplo(t, base, id) : base;
        set((s) => ({ tipo: '1d', e1d, ejemplo: { ...s.ejemplo, '1d': id } }));
      },
      set1D: (f) => set((s) => ({ e1d: f(s.e1d) })),
      setArmadura: (f) => set((s) => ({ armadura: f(s.armadura) })),
      setResortes: (f) => set((s) => ({ resortes: f(s.resortes) })),
      restablecer: () => {
        const s = get();
        if (s.tipo === '1d') s.cargar(s.e1d.plantilla, s.ejemplo['1d']);
        else if (s.tipo === 'armadura') s.cargar('armadura', s.ejemplo.armadura);
        else s.cargar('resortes', s.ejemplo.resortes);
      },
    }),
    {
      name: 'femlab:v1',
      version: 1,
      storage: createJSONStorage(() => {
        try {
          const k = '__femlab_test__';
          localStorage.setItem(k, '1');
          localStorage.removeItem(k);
          return localStorage;
        } catch {
          const mem = new Map<string, string>();
          return {
            getItem: (k: string) => mem.get(k) ?? null,
            setItem: (k: string, v: string) => void mem.set(k, v),
            removeItem: (k: string) => void mem.delete(k),
          };
        }
      }),
      partialize: (s) => ({ tema: s.tema, tipo: s.tipo, e1d: s.e1d, armadura: s.armadura, resortes: s.resortes, ejemplo: s.ejemplo }),
      // Si el estado guardado corresponde a una plantilla que ya no existe, se descarta.
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState> | undefined;
        if (!p || (p.e1d && !plantilla1D(p.e1d.plantilla))) return current;
        return { ...current, ...p };
      },
    },
  ),
);

/** Tema efectivo según la preferencia y el sistema operativo. */
export function temaEfectivo(t: Tema): 'dark' | 'light' {
  if (t === 'oscuro') return 'dark';
  if (t === 'claro') return 'light';
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
