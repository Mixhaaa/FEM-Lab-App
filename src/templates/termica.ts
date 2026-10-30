/** Plantillas térmicas: conducción de calor 1D y aleta con convección. */
import { fmt } from '../core';
import { campo, expr, fDirichlet, fNeumann, fNula, fRobin, kpiEntrante, kpiMaxAbsElem, kpiMaxU, kpiMinU, n } from './comun';
import type { KpiDef, Plantilla1D } from './types';

const K_UNI = 'W/(m·K)';
const H_UNI = 'W/(m²·K)';

/** Solución exacta de una pared de dos capas con convección en ambas caras. */
function paredCompuesta(k1: number, L1: number, k2: number, L2: number, h1: number, Ti: number, h2: number, Te: number) {
  const q = (Ti - Te) / (1 / h1 + L1 / k1 + L2 / k2 + 1 / h2);
  const T0 = Ti - q / h1;
  const T1 = T0 - (q * L1) / k1;
  return `x <= ${n(L1)} ? ${n(T0)} - ${n(q / k1)}*x : ${n(T1)} - ${n(q / k2)}*(x - ${n(L1)})`;
}

export const calor: Plantilla1D = {
  tipo: '1d',
  id: 'calor',
  nombre: 'Conducción de calor 1D',
  categoria: 'termica',
  descripcion: 'Temperatura y flujo de calor en paredes simples o compuestas, con generación interna y temperaturas, flujos o convección en los extremos.',
  icono: 'thermostat',
  ecuacion: String.raw`-\frac{d}{dx}\left[k\,A\,\frac{dT}{dx}\right] = \dot{q}(x)\,A`,
  sistemas: ['SI'],
  unidadLongitud: 'm',
  camposTramo: [
    expr('k', 'k', 'Conductividad térmica', K_UNI, '15', { positivo: true }),
    expr('A', 'A', 'Área transversal', 'm²', '1', { positivo: true, ayuda: 'Usa 1 para obtener resultados por unidad de área.' }),
    expr('Q', 'q̇(x)', 'Generación interna de calor', 'W/m³', '0'),
  ],
  camposGlobales: [],
  coeficientes: (v) => ({ k: `${v.k}*${v.A}`, b: '0', c: '0', f: `${v.Q}*${v.A}` }),
  traduccion: { k: 'k\\,A', b: '0', c: '0', f: '\\dot{q}(x)\\,A' },
  fronteras: [
    fDirichlet('temperatura', 'Temperatura impuesta', 'T', '°C', '100'),
    fNula('aislado', 'Aislado (adiabático)', 'Extremo aislado (q = 0)'),
    fNeumann(
      'flujo',
      'Flujo de calor entrante',
      campo('qs', "q''", 'Flujo de calor que entra', 'W/m²', '1000'),
      (v, ctx) => v * ctx.campo('A'),
      'Positivo si el calor entra al dominio.',
    ),
    fRobin(
      'conveccion',
      'Convección',
      [campo('h', 'h', 'Coeficiente de convección', H_UNI, '25', { noNegativo: true }), campo('Tinf', 'T∞', 'Temperatura del fluido', '°C', '25')],
      (v, ctx) => ({ h: v.h * ctx.campo('A'), g: v.h * ctx.campo('A') * v.Tinf }),
      (v) => `Convección: h = ${fmt(v.h)} ${H_UNI}, T∞ = ${fmt(v.Tinf)} °C`,
      'El calor que entra es h·A·(T∞ − T).',
    ),
  ],
  incognita: { id: 'T', simbolo: 'T', nombre: 'Temperatura', unidad: '°C' },
  derivada: { id: 'dT', simbolo: 'dT/dx', nombre: 'Gradiente térmico', unidad: '°C/m' },
  derivadas: [
    { id: 'grad', simbolo: 'dT/dx', nombre: 'Gradiente térmico', unidad: '°C/m', calc: (c) => c.du },
    { id: 'qs', simbolo: "q''", nombre: 'Flujo de calor por área (hacia +x)', unidad: 'W/m²', latex: "q''", calc: (c) => -c.campo('k') * c.du },
    { id: 'Qx', simbolo: 'Q', nombre: 'Calor que fluye (hacia +x)', unidad: 'W', calc: (c) => -c.kdu },
  ],
  reaccion: { id: 'R', simbolo: 'Q_ext', nombre: 'Calor que entra por el extremo', unidad: 'W' },
  cargaPuntual: { id: 'P', simbolo: 'Q_p', nombre: 'Fuente puntual de calor', unidad: 'W' },
  kpis: [
    kpiMaxU('Tmax', 'T_max', 'Temperatura máxima', '°C'),
    kpiMinU('Tmin', 'T_min', 'Temperatura mínima', '°C'),
    kpiMaxAbsElem('qs', 'qmax', "q''_max", 'Flujo de calor máximo', 'W/m²'),
    kpiEntrante('izquierda', 'Qizq', 'Q_izq', 'Calor que entra por la izquierda', 'W'),
    kpiEntrante('derecha', 'Qder', 'Q_der', 'Calor que entra por la derecha', 'W'),
  ],
  ejemplos: [
    {
      id: 'generacion',
      nombre: 'Placa con generación interna y convección',
      descripcion: 'L = 5 cm, k = 15 W/(m·K), q̇ = 200 kW/m³, T(0) = 100 °C y convección a 25 °C a la derecha.',
      estado: {
        x0: '0',
        xL: '0.05',
        tramos: [{ fin: '0.05', valores: { k: '15', A: '1', Q: '2e5' } }],
        izquierda: { opcion: 'temperatura', valores: { valor: '100' } },
        derecha: { opcion: 'conveccion', valores: { h: '50', Tinf: '25' } },
        malla: { tipo: 'uniforme', ne: 5, ratio: 4, hacia: 'derecha', nodos: '' },
      },
    },
    {
      id: 'compuesta',
      nombre: 'Pared compuesta: ladrillo + aislante',
      descripcion: 'Ladrillo de 20 cm (k = 0.72) y aislante de 5 cm (k = 0.04), aire interior a 22 °C y exterior a −5 °C.',
      estado: {
        x0: '0',
        xL: '0.25',
        tramos: [
          { nombre: 'Ladrillo', fin: '0.2', valores: { k: '0.72', A: '1', Q: '0' } },
          { nombre: 'Aislante', fin: '0.25', valores: { k: '0.04', A: '1', Q: '0' } },
        ],
        izquierda: { opcion: 'conveccion', valores: { h: '10', Tinf: '22' } },
        derecha: { opcion: 'conveccion', valores: { h: '25', Tinf: '-5' } },
        malla: { tipo: 'uniforme', ne: 5, ratio: 4, hacia: 'derecha', nodos: '' },
        exacta: paredCompuesta(0.72, 0.2, 0.04, 0.05, 10, 22, 25, -5),
      },
    },
    {
      id: 'temperaturas',
      nombre: 'Barra con temperaturas en ambos extremos',
      descripcion: 'Conducción pura: el perfil es lineal y el flujo es constante.',
      estado: {
        x0: '0',
        xL: '0.5',
        tramos: [{ fin: '0.5', valores: { k: '45', A: '0.001', Q: '0' } }],
        izquierda: { opcion: 'temperatura', valores: { valor: '150' } },
        derecha: { opcion: 'temperatura', valores: { valor: '30' } },
        malla: { tipo: 'uniforme', ne: 4, ratio: 4, hacia: 'derecha', nodos: '' },
      },
    },
  ],
};

const theta = (c: Parameters<KpiDef['calc']>[0]) => c.u[0] - c.global('Tinf');

export const aleta: Plantilla1D = {
  tipo: '1d',
  id: 'aleta',
  nombre: 'Aleta con convección',
  categoria: 'termica',
  descripcion: 'Distribución de temperatura, calor disipado, eficiencia y efectividad de aletas de sección constante o variable.',
  icono: 'heat',
  ecuacion: String.raw`-\frac{d}{dx}\left[k\,A_c(x)\,\frac{dT}{dx}\right] + h\,P(x)\,(T - T_\infty) = 0`,
  sistemas: ['SI'],
  unidadLongitud: 'm',
  camposTramo: [
    expr('k', 'k', 'Conductividad térmica', K_UNI, '200', { positivo: true }),
    expr('A', 'A_c(x)', 'Área transversal', 'm²', 'pi*0.005^2/4', { positivo: true }),
    expr('P', 'P(x)', 'Perímetro', 'm', 'pi*0.005', { positivo: true }),
    expr('h', 'h', 'Coeficiente de convección', H_UNI, '25', { noNegativo: true }),
  ],
  camposGlobales: [campo('Tinf', 'T∞', 'Temperatura del fluido', '°C', '25')],
  coeficientes: (v) => ({ k: `${v.k}*${v.A}`, b: '0', c: `${v.h}*${v.P}`, f: `${v.h}*${v.P}*${v.Tinf}` }),
  traduccion: { k: 'k\\,A_c(x)', b: '0', c: 'h\\,P(x)', f: 'h\\,P(x)\\,T_\\infty' },
  fronteras: [
    fDirichlet('temperatura', 'Temperatura impuesta (base)', 'T', '°C', '100'),
    fNula('adiabatica', 'Punta adiabática', 'Punta adiabática (dT/dx = 0)'),
    fRobin(
      'conveccion',
      'Punta con convección',
      [campo('hp', 'h_p', 'Coeficiente de convección en la punta', H_UNI, '25', { noNegativo: true })],
      (v, ctx) => ({ h: v.hp * ctx.campo('A'), g: v.hp * ctx.campo('A') * ctx.global('Tinf') }),
      (v) => `Punta con convección h_p = ${fmt(v.hp)} ${H_UNI}`,
    ),
  ],
  incognita: { id: 'T', simbolo: 'T', nombre: 'Temperatura', unidad: '°C' },
  derivada: { id: 'dT', simbolo: 'dT/dx', nombre: 'Gradiente térmico', unidad: '°C/m' },
  derivadas: [
    { id: 'grad', simbolo: 'dT/dx', nombre: 'Gradiente térmico', unidad: '°C/m', calc: (c) => c.du },
    { id: 'qs', simbolo: "q''", nombre: 'Flujo de calor por área (hacia +x)', unidad: 'W/m²', calc: (c) => -c.campo('k') * c.du },
    { id: 'Qx', simbolo: 'Q', nombre: 'Calor conducido (hacia +x)', unidad: 'W', calc: (c) => -c.kdu },
  ],
  reaccion: { id: 'R', simbolo: 'Q_b', nombre: 'Calor que entra por el extremo', unidad: 'W' },
  cargaPuntual: null,
  kpis: [
    kpiEntrante('izquierda', 'Qb', 'Q_aleta', 'Calor disipado por la aleta (entra por la base)', 'W'),
    {
      id: 'Qconv',
      simbolo: 'Q_conv',
      nombre: 'Calor perdido por convección lateral',
      unidad: 'W',
      calc: (c) => ({ valor: c.integrar((_x, T, campo) => campo('h') * campo('P') * (T - c.global('Tinf'))) }),
    },
    {
      id: 'Tpunta',
      simbolo: 'T_punta',
      nombre: 'Temperatura en la punta',
      unidad: '°C',
      calc: (c) => ({ valor: c.u[c.u.length - 1], x: c.nodos[c.nodos.length - 1] }),
    },
    {
      id: 'eta',
      simbolo: 'η',
      nombre: 'Eficiencia de la aleta',
      unidad: '—',
      calc: (c) => {
        const th = theta(c);
        if (th === 0 || c.fronteras.izquierda.type !== 'dirichlet') return null;
        let hA = c.integrar((_x, _T, campo) => campo('h') * campo('P'));
        const tip = c.fronteras.derecha;
        if (tip.type === 'robin') hA += tip.h;
        return { valor: c.entrante.izquierda / (hA * th), detalle: 'Q / (h·A_sup·θ_b)' };
      },
    },
    {
      id: 'efect',
      simbolo: 'ε_f',
      nombre: 'Efectividad de la aleta',
      unidad: '—',
      calc: (c) => {
        const th = theta(c);
        if (th === 0 || c.fronteras.izquierda.type !== 'dirichlet') return null;
        const x0 = c.nodos[0];
        return { valor: c.entrante.izquierda / (c.campoEn('h', x0) * c.campoEn('A', x0) * th), detalle: 'Q / (h·A_c·θ_b)' };
      },
    },
  ],
  ejemplos: [
    {
      id: 'pin-adiabatica',
      nombre: 'Aleta de pin con punta adiabática',
      descripcion: 'D = 5 mm, L = 10 cm, k = 200 W/(m·K), h = 25 W/(m²·K), T_b = 100 °C y T∞ = 25 °C.',
      estado: {
        x0: '0',
        xL: '0.1',
        tramos: [{ fin: '0.1', valores: { k: '200', A: 'pi*0.005^2/4', P: 'pi*0.005', h: '25' } }],
        globales: { Tinf: '25' },
        izquierda: { opcion: 'temperatura', valores: { valor: '100' } },
        derecha: { opcion: 'adiabatica', valores: {} },
        malla: { tipo: 'uniforme', ne: 8, ratio: 4, hacia: 'derecha', nodos: '' },
      },
    },
    {
      id: 'pin-conveccion',
      nombre: 'Aleta de pin con convección en la punta',
      descripcion: 'La misma aleta, pero la punta también pierde calor por convección.',
      estado: {
        x0: '0',
        xL: '0.1',
        tramos: [{ fin: '0.1', valores: { k: '200', A: 'pi*0.005^2/4', P: 'pi*0.005', h: '25' } }],
        globales: { Tinf: '25' },
        izquierda: { opcion: 'temperatura', valores: { valor: '100' } },
        derecha: { opcion: 'conveccion', valores: { hp: '25' } },
        malla: { tipo: 'uniforme', ne: 8, ratio: 4, hacia: 'derecha', nodos: '' },
      },
    },
    {
      id: 'trapezoidal',
      nombre: 'Aleta recta de perfil trapezoidal',
      descripcion: 'Espesor que disminuye a la mitad (por metro de ancho); sin solución analítica sencilla.',
      estado: {
        x0: '0',
        xL: '0.04',
        tramos: [{ fin: '0.04', valores: { k: '180', A: '0.004*(1 - 0.5*x/0.04)', P: '2', h: '40' } }],
        globales: { Tinf: '20' },
        izquierda: { opcion: 'temperatura', valores: { valor: '120' } },
        derecha: { opcion: 'adiabatica', valores: {} },
        malla: { tipo: 'uniforme', ne: 10, ratio: 4, hacia: 'derecha', nodos: '' },
      },
    },
  ],
};
