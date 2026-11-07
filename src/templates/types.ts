/**
 * Sistema de plantillas: cada plantilla traduce variables físicas (E, A, h, T∞, ...)
 * a los coeficientes k, b, c, f del problema modelo y da nombre y unidad a los resultados.
 * Todo es TypeScript puro (sin React) y serializable.
 */
import type { BCMethod, BoundaryCondition, SolverType } from '../core';

export type SistemaUnidades = 'SI' | 'mm';

export const SISTEMAS: Record<SistemaUnidades, { nombre: string; descripcion: string }> = {
  SI: { nombre: 'SI (N, m, Pa)', descripcion: 'Newton, metro, pascal' },
  mm: { nombre: 'N, mm, MPa', descripcion: 'Newton, milímetro, megapascal' },
};

/** Unidad fija o dependiente del sistema de unidades. */
export type Unidad = string | Record<SistemaUnidades, string>;

export function unidad(u: Unidad | undefined, s: SistemaUnidades): string {
  if (!u) return '';
  return typeof u === 'string' ? u : u[s];
}

export interface CampoDef {
  id: string;
  /** Símbolo corto (ej. "E", "A(x)"). */
  simbolo: string;
  nombre: string;
  unidad: Unidad;
  /** Valor por defecto por sistema de unidades o único. */
  porDefecto: string | Record<SistemaUnidades, string>;
  /** "expresion" puede depender de x; "numero" debe ser constante. */
  tipo: 'numero' | 'expresion';
  positivo?: boolean;
  noNegativo?: boolean;
  ayuda?: string;
}

export function valorPorDefecto(c: CampoDef, s: SistemaUnidades): string {
  return typeof c.porDefecto === 'string' ? c.porDefecto : c.porDefecto[s];
}

/** Lo que una condición de frontera física necesita saber del extremo. */
export interface ContextoFrontera {
  lado: 'izquierda' | 'derecha';
  x: number;
  /** Valor de un campo del tramo extremo evaluado en x. */
  campo: (id: string) => number;
  /** Valor de un campo global. */
  global: (id: string) => number;
}

export interface OpcionFrontera {
  id: string;
  nombre: string;
  /** Descripción corta del significado físico. */
  ayuda?: string;
  campos: CampoDef[];
  aBC: (v: Record<string, number>, ctx: ContextoFrontera) => BoundaryCondition;
  /** Texto para mostrar, ej. "u(0) = 0 (empotrado)". */
  describir: (v: Record<string, number>, ctx: { lado: 'izquierda' | 'derecha'; xTexto: string; sistema: SistemaUnidades }) => string;
}

export interface MagnitudDef {
  id: string;
  simbolo: string;
  nombre: string;
  unidad: Unidad;
  /** Símbolo en LaTeX (opcional). */
  latex?: string;
}

/** Datos de un elemento para calcular magnitudes derivadas. */
export interface ContextoElemento {
  x: number; // punto medio
  u: number; // u en el punto medio
  du: number; // u′ en el elemento
  kdu: number; // k(x_m)·u′
  campo: (id: string) => number;
  global: (id: string) => number;
}

export interface MagnitudElementoDef extends MagnitudDef {
  calc: (c: ContextoElemento) => number;
}

export interface KpiValor {
  valor: number;
  x?: number;
  detalle?: string;
}

export interface ContextoKpi {
  nodos: number[];
  u: number[];
  /** Magnitudes por elemento, por id. */
  porElemento: Record<string, number[]>;
  xm: number[];
  reacciones: { lado: 'izquierda' | 'derecha'; x: number; valor: number }[];
  /** Flujo entrante por cada extremo (k ∂u/∂n), sea cual sea el tipo de frontera. */
  entrante: { izquierda: number; derecha: number };
  /** Integra g(x, u_h(x), tramo) sobre el dominio con Gauss en cada elemento. */
  integrar: (g: (x: number, u: number, campo: (id: string) => number) => number) => number;
  global: (id: string) => number;
  /** Valor de un campo del tramo en x. */
  campoEn: (id: string, x: number) => number;
  fronteras: { izquierda: BoundaryCondition; derecha: BoundaryCondition };
}

export interface KpiDef extends MagnitudDef {
  calc: (c: ContextoKpi) => KpiValor | null;
}

export type Categoria = 'solidos' | 'termica' | 'fluidos' | 'electrica' | 'matematica';

export const CATEGORIAS: Record<Categoria, string> = {
  solidos: 'Sólidos y estructuras',
  termica: 'Térmica',
  fluidos: 'Fluidos',
  electrica: 'Electricidad',
  matematica: 'Matemática',
};

interface PlantillaBase {
  id: string;
  nombre: string;
  categoria: Categoria;
  descripcion: string;
  /** Nombre del ícono (Material Symbols). */
  icono: string;
  /** Ecuación gobernante en LaTeX. */
  ecuacion: string;
  sistemas: SistemaUnidades[];
}

export interface Plantilla1D extends PlantillaBase {
  tipo: '1d';
  unidadLongitud: Unidad;
  camposTramo: CampoDef[];
  camposGlobales: CampoDef[];
  /**
   * Coeficientes del problema modelo a partir de los campos (expresiones ya envueltas entre paréntesis).
   * Debe devolver expresiones en x.
   */
  coeficientes: (v: Record<string, string>) => { k: string; b: string; c: string; f: string };
  /** Cómo se escriben k, b, c, f en función de las variables físicas (LaTeX). */
  traduccion: { k: string; b: string; c: string; f: string };
  fronteras: OpcionFrontera[];
  incognita: MagnitudDef;
  /** Derivada de la incógnita (u′). */
  derivada: MagnitudDef;
  derivadas: MagnitudElementoDef[];
  reaccion: MagnitudDef;
  /** Nombre de las cargas puntuales, o null si la plantilla no las admite. */
  cargaPuntual: MagnitudDef | null;
  kpis: KpiDef[];
  ejemplos: Ejemplo1D[];
}

export interface TramoEstado {
  nombre?: string;
  /** Fin del tramo (se ignora en el último, que termina en xL). */
  fin: string;
  valores: Record<string, string>;
}

export interface FronteraEstado {
  opcion: string;
  valores: Record<string, string>;
}

export interface MallaEstado {
  tipo: 'uniforme' | 'geometrica' | 'manual';
  ne: number;
  ratio: number;
  hacia: 'izquierda' | 'derecha' | 'ambos';
  /** Nodos manuales separados por coma, espacio o punto y coma. */
  nodos: string;
}

export interface Estado1D {
  plantilla: string;
  sistema: SistemaUnidades;
  x0: string;
  xL: string;
  tramos: TramoEstado[];
  globales: Record<string, string>;
  izquierda: FronteraEstado;
  derecha: FronteraEstado;
  cargas: { x: string; P: string }[];
  malla: MallaEstado;
  gauss: number;
  metodo: BCMethod;
  penalizacion: number;
  solver: SolverType;
  /** Orden de los elementos: 1 = lineales, 2 = cuadráticos (si falta, 1). */
  orden?: 1 | 2;
  /** Solución analítica escrita por el usuario (vacía = automática si se puede). */
  exacta: string;
}

export interface Ejemplo1D {
  id: string;
  nombre: string;
  descripcion: string;
  /** Cambios sobre el estado por defecto de la plantilla. */
  estado: Partial<Estado1D>;
}
