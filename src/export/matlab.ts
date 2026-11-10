/**
 * Código MATLAB/Octave equivalente al problema resuelto en FEM Lab,
 * con el estilo del curso: Mnod, Melem, Kglob, Vglob, spy, linsolve y plot.
 */
import { gaussRule, type BoundaryCondition } from '../core';
import { APOYOS, ejemploCoincidente, unidad, type EstadoArmadura, type EstadoResortes, type Resultado1D, type ResultadoArmadura, type ResultadoResortes } from '../templates';
import { coeficientesNombrados, type Definicion } from './coeficientes';
import { exprA } from './expresiones';
import { numMatlab as num } from './matlab-texto';

export const URL_APP = 'https://mixhaaa.github.io/FEM-Lab-App/';

function fecha(): string {
  return new Date().toISOString().slice(0, 10);
}

function encabezado(titulo: string, lineas: string[]): string {
  return [
    '%% ==================================================================',
    `%  FEM Lab - ${titulo}`,
    ...lineas.map((l) => `%  ${l}`),
    `%  Generado el ${fecha()} con FEM Lab (${URL_APP})`,
    '%  Funciona en MATLAB y en GNU Octave.',
    '%% ==================================================================',
    'clear; clc; close all;',
    '',
  ].join('\n');
}

/** ¿Los nodos son equiespaciados entre x0 y xL? */
function esUniforme(nodos: number[]): boolean {
  const h = (nodos[nodos.length - 1] - nodos[0]) / (nodos.length - 1);
  return nodos.every((x, i) => Math.abs(x - (nodos[0] + i * h)) <= 1e-10 * Math.abs(nodos[nodos.length - 1] - nodos[0]));
}

function vectorFila(v: number[]): string {
  return `[${v.map((x) => num(x, 15)).join(' ')}]`;
}

export function matlab1D(res: Resultado1D): string {
  const p = res.problem;
  const t = res.plantilla;
  const sol = res.sol;
  const nodos = sol.mesh.nodes;
  const cuad = sol.mesh.orden === 2;
  const ne = sol.mesh.elements.length;
  const vertices = cuad ? nodos.filter((_, i) => i % 2 === 0) : nodos;
  const ej = ejemploCoincidente(t, res.estado);
  const L: string[] = [];
  const ui = unidad(t.incognita.unidad, res.estado.sistema);

  L.push(
    encabezado(t.nombre, [
      ...(ej ? [`Ejemplo: ${ej.nombre}`] : []),
      `Problema modelo: -(k u')' + b u' + c u = f   en [${num(p.x0)}, ${num(p.xL)}]`,
      `Incógnita: ${t.incognita.nombre} ${t.incognita.simbolo}${ui && ui !== '—' ? ` [${ui}]` : ''}`,
      `${cuad ? 'Elementos cuadráticos de 3 nodos (inicio, centro, fin)' : 'Elementos lineales de 2 nodos'} y cuadratura de Gauss de ${p.gaussPoints} punto(s).`,
    ]),
  );

  L.push('%% 1. Datos del problema');
  L.push(`x0 = ${num(p.x0)};  xL = ${num(p.xL)};`);
  L.push(`Ne = ${ne};                       % número de elementos`);
  const co = coeficientesNombrados(res, 'matlab');
  const def = (d: Definicion) => L.push(`${d.nombre} = ${d.funcion ? `@(x) ${d.valor}` : d.valor};   % ${d.comentario}`);
  if (co.definiciones[0].length) {
    L.push('% Parámetros globales');
    co.definiciones[0].forEach(def);
  }
  if (p.regions.length === 1) {
    co.definiciones[1]?.forEach(def);
    for (const c of ['k', 'b', 'c', 'f'] as const) L.push(`${c} = @(x) ${co.tramos[0][c]};`);
  } else {
    p.regions.forEach((r, i) => {
      L.push(`% Tramo ${i + 1}${r.nombre ? ` (${r.nombre})` : ''}: x en [${num(r.x0)}, ${num(r.x1)}]`);
      co.definiciones[i + 1]?.forEach(def);
      for (const c of ['k', 'b', 'c', 'f'] as const) L.push(`${c}${i + 1} = @(x) ${co.tramos[i][c]};`);
    });
    const cortes = p.regions.slice(0, -1).map((r) => num(r.x1));
    const mascara = (i: number) => {
      if (i === 0) return `(x < ${cortes[0]})`;
      if (i === p.regions.length - 1) return `(x >= ${cortes[i - 1]})`;
      return `(x >= ${cortes[i - 1]} & x < ${cortes[i]})`;
    };
    L.push('% Coeficientes del problema modelo por tramos');
    for (const c of ['k', 'b', 'c', 'f'] as const) {
      L.push(`${c} = @(x) ${p.regions.map((_, i) => `${mascara(i)}.*${c}${i + 1}(x)`).join(' + ')};`);
    }
  }
  if (p.loads.length) {
    L.push(`Pcarga = [${p.loads.map((l) => `${num(l.x)} ${num(l.P)}`).join('; ')}];   % [posición, valor] de las cargas puntuales`);
  }
  if (res.exacta) L.push(`uex = @(x) ${exprA(res.exacta.expr, 'matlab')};   % solución analítica`);
  L.push('');

  if (cuad) {
    L.push('%% 2. Malla: Mnod = [nodo x], Melem = [elemento nodo1 nodo_centro nodo3]');
    if (esUniforme(vertices)) L.push("xv = linspace(x0, xL, Ne+1)';          % extremos de los elementos");
    else L.push(`xv = ${vectorFila(vertices)}';   % extremos de los elementos (incluye cambios de tramo y cargas)`);
    L.push('n = 2*Ne + 1;');
    L.push('xn = zeros(n, 1);');
    L.push('xn(1:2:n) = xv;                          % extremos');
    L.push('xn(2:2:n) = (xv(1:end-1) + xv(2:end))/2;  % centro de cada elemento');
    L.push("Mnod = [(1:n)', xn];");
    L.push("Melem = [(1:Ne)', (1:2:n-2)', (2:2:n-1)', (3:2:n)'];");
  } else {
    L.push('%% 2. Malla: Mnod = [nodo x], Melem = [elemento nodo1 nodo2]');
    if (esUniforme(nodos)) L.push('xn = linspace(x0, xL, Ne+1)\';');
    else L.push(`xn = ${vectorFila(nodos)}';   % nodos (incluye cambios de tramo y cargas puntuales)`);
    L.push('n = numel(xn);');
    L.push('Mnod = [(1:n)\', xn];');
    L.push('Melem = [(1:Ne)\', (1:Ne)\', (2:Ne+1)\'];');
  }
  L.push('');

  const g = gaussRule(p.gaussPoints);
  L.push('%% 3. Cuadratura de Gauss en [-1, 1]');
  L.push(`xi = ${vectorFila(g.xi)};`);
  L.push(`w  = ${vectorFila(g.w)};`);
  L.push('');

  L.push('%% 4. Matrices elementales y ensamblaje');
  L.push('Kglob = zeros(n, n);');
  L.push('Vglob = zeros(n, 1);');
  if (cuad) {
    L.push('for e = 1:Ne');
    L.push('    nd = Melem(e, 2:4);                     % nodos del elemento: inicio, centro, fin');
    L.push('    x1 = Mnod(nd(1), 2);  x3 = Mnod(nd(3), 2);  h = x3 - x1;');
    L.push('    Ke = zeros(3, 3);  Fe = zeros(3, 1);');
    L.push('    for g = 1:numel(xi)');
    L.push('        s  = xi(g);');
    L.push('        xg = (x1 + x3)/2 + h/2*s;');
    L.push('        N  = [s*(s-1)/2, 1 - s^2, s*(s+1)/2];   % funciones de forma cuadráticas');
    L.push('        dN = [s - 1/2, -2*s, s + 1/2]*2/h;      % derivadas dN/dx');
    L.push("        Ke = Ke + w(g)*(k(xg)*(dN'*dN) + b(xg)*(N'*dN) + c(xg)*(N'*N))*h/2;");
    L.push("        Fe = Fe + w(g)*f(xg)*N'*h/2;");
    L.push('    end');
    L.push('    Kglob(nd, nd) = Kglob(nd, nd) + Ke;');
    L.push('    Vglob(nd) = Vglob(nd) + Fe;');
    L.push('end');
  }
  if (!cuad) L.push('for e = 1:Ne');
  if (!cuad) L.push('    n1 = Melem(e, 2);  n2 = Melem(e, 3);');
  if (!cuad) {
    L.push('    x1 = Mnod(n1, 2);  x2 = Mnod(n2, 2);  h = x2 - x1;');
    L.push('    Ke = zeros(2, 2);  Fe = zeros(2, 1);');
    L.push('    for g = 1:numel(xi)');
    L.push('        xg = (x1 + x2)/2 + h/2*xi(g);');
    L.push('        N  = [(x2 - xg)/h, (xg - x1)/h];     % funciones de forma');
    L.push('        dN = [-1/h, 1/h];                     % derivadas');
    L.push("        Ke = Ke + w(g)*(k(xg)*(dN'*dN) + b(xg)*(N'*dN) + c(xg)*(N'*N))*h/2;");
    L.push("        Fe = Fe + w(g)*f(xg)*N'*h/2;");
    L.push('    end');
    L.push('    Kglob([n1 n2], [n1 n2]) = Kglob([n1 n2], [n1 n2]) + Ke;');
    L.push('    Vglob([n1 n2]) = Vglob([n1 n2]) + Fe;');
    L.push('end');
  }
  L.push('');

  L.push('%% 5. Cargas puntuales y fronteras naturales');
  if (p.loads.length) {
    L.push('for i = 1:size(Pcarga, 1)');
    L.push('    [~, nodo] = min(abs(xn - Pcarga(i, 1)));');
    L.push('    Vglob(nodo) = Vglob(nodo) + Pcarga(i, 2);');
    L.push('end');
  }
  const nat = (bc: BoundaryCondition, nodo: string, lado: string) => {
    if (bc.type === 'neumann') L.push(`Vglob(${nodo}) = Vglob(${nodo}) + ${num(bc.q)};   % Neumann en ${lado}: k*du/dn = q`);
    if (bc.type === 'robin') {
      L.push(`Kglob(${nodo}, ${nodo}) = Kglob(${nodo}, ${nodo}) + ${num(bc.h)};   % Robin en ${lado}: k*du/dn + h*u = g`);
      L.push(`Vglob(${nodo}) = Vglob(${nodo}) + ${num(bc.g)};`);
    }
  };
  nat(p.bcLeft, '1', 'x0');
  nat(p.bcRight, 'n', 'xL');
  if (p.bcLeft.type === 'dirichlet' || p.bcRight.type === 'dirichlet') L.push('K0 = Kglob;  V0 = Vglob;   % copias para calcular las reacciones');
  L.push('');

  L.push('%% 6. Fronteras Dirichlet y solución');
  L.push('figure; spy(Kglob); title(\'Estructura de Kglob\');');
  const fijos: string[] = [];
  const valores: string[] = [];
  if (p.bcLeft.type === 'dirichlet') {
    fijos.push('1');
    valores.push(num(p.bcLeft.value));
  }
  if (p.bcRight.type === 'dirichlet') {
    fijos.push('n');
    valores.push(num(p.bcRight.value));
  }
  if (fijos.length === 0) {
    L.push('u = linsolve(Kglob, Vglob);');
  } else if (p.bcMethod === 'penalizacion') {
    L.push(`beta = 10^${p.penaltyExp}*max(abs(diag(Kglob)));   % penalización`);
    L.push(`fijos = [${fijos.join(' ')}];  ubar = [${valores.join('; ')}];`);
    L.push('for i = 1:numel(fijos)');
    L.push('    Kglob(fijos(i), fijos(i)) = Kglob(fijos(i), fijos(i)) + beta;');
    L.push('    Vglob(fijos(i)) = Vglob(fijos(i)) + beta*ubar(i);');
    L.push('end');
    L.push('u = linsolve(Kglob, Vglob);');
  } else {
    L.push(`fijos = [${fijos.join(' ')}];  ubar = [${valores.join('; ')}];   % eliminación`);
    L.push('libres = setdiff(1:n, fijos);');
    L.push('u = zeros(n, 1);  u(fijos) = ubar;');
    L.push('u(libres) = linsolve(Kglob(libres, libres), Vglob(libres) - Kglob(libres, fijos)*ubar);');
  }
  L.push('');

  L.push('%% 7. Posproceso');
  if (cuad) {
    L.push('h  = xn(Melem(:, 4)) - xn(Melem(:, 2));');
    L.push('du = (u(Melem(:, 4)) - u(Melem(:, 2)))./h;   % derivada en el centro de cada elemento');
    L.push('xm = xn(Melem(:, 3));');
  } else {
    L.push('h  = diff(xn);');
    L.push('du = diff(u)./h;                       % derivada en cada elemento');
    L.push('xm = (xn(1:end-1) + xn(2:end))/2;');
  }
  L.push('flujo = k(xm).*du;                     % k*du/dx en cada elemento');
  if (fijos.length) L.push('R = K0*u - V0;  R = R(fijos);          % reacciones (k*du/dn en los apoyos)');
  L.push("disp('    nodo        x              u');");
  L.push("disp([Mnod, u]);");
  L.push("fprintf('u = %s\\n', sprintf('%.12e, ', u));");
  if (fijos.length) L.push("fprintf('Reacciones: %s\\n', sprintf('%.6e  ', R));");
  if (res.exacta) {
    L.push("fprintf('Error nodal máximo = %.4e\\n', max(abs(u - uex(xn))));");
  }
  L.push('');
  L.push('%% 8. Gráficas');
  if (cuad) {
    L.push('% Parábola dentro de cada elemento');
    L.push('s = linspace(-1, 1, 13);  xs = [];  us = [];');
    L.push('for e = 1:Ne');
    L.push('    nd = Melem(e, 2:4);');
    L.push('    xs = [xs, (xn(nd(1)) + xn(nd(3)))/2 + (xn(nd(3)) - xn(nd(1)))/2*s];');
    L.push('    us = [us, s.*(s-1)/2*u(nd(1)) + (1 - s.^2)*u(nd(2)) + s.*(s+1)/2*u(nd(3))];');
    L.push('end');
    L.push("figure; plot(xs, us, '-', 'LineWidth', 1.5); hold on; grid on;");
    L.push("plot(xn, u, 'o');");
  } else {
    L.push("figure; plot(xn, u, 'o-', 'LineWidth', 1.5); hold on; grid on;");
  }
  if (res.exacta) {
    L.push('xx = linspace(x0, xL, 300);');
    L.push("plot(xx, uex(xx), 'LineWidth', 1.5);");
    L.push(cuad ? "legend('MEF', 'Nodos', 'Analítica');" : "legend('MEF', 'Analítica');");
  }
  L.push(`xlabel('x'); ylabel('${t.incognita.simbolo}'); title('${t.incognita.nombre}');`);
  if (cuad) {
    L.push("figure; plot(xm, flujo, 'o-', 'LineWidth', 1.5); grid on;");
    L.push("xlabel('x'); ylabel('k du/dx'); title('Flujo en el centro de cada elemento');");
  } else {
    L.push("figure; stairs(xn, [flujo; flujo(end)], 'LineWidth', 1.5); grid on;");
    L.push("xlabel('x'); ylabel('k du/dx'); title('Flujo por elemento');");
  }
  return L.join('\n') + '\n';
}

export function matlabArmadura(res: ResultadoArmadura): string {
  const e: EstadoArmadura = res.estado;
  const pr = res.sol.problem;
  const un = res.unidades;
  const L: string[] = [];
  L.push(encabezado('Armadura plana 2D', [`Unidades: longitudes en ${un.long}, fuerzas en ${un.fuerza}, E en ${un.esfuerzo}, A en ${un.area}.`, 'Elementos barra de 2 nodos con 2 grados de libertad por nodo.']));
  L.push('%% 1. Nodos: Mnod = [nodo x y]');
  L.push(`Mnod = [\n${pr.nodes.map((nd, i) => `    ${i + 1}  ${num(nd.x)}  ${num(nd.y)}`).join(';\n')}\n];`);
  L.push('%% 2. Barras: Melem = [barra nodo_i nodo_j E A]');
  L.push(`Melem = [\n${pr.bars.map((b, k) => `    ${k + 1}  ${b.i + 1}  ${b.j + 1}  ${num(b.E)}  ${num(b.A)}`).join(';\n')}\n];`);
  L.push('nn = size(Mnod, 1);  nb = size(Melem, 1);  ngdl = 2*nn;');
  const fijos = e.apoyos.flatMap((a) => [...(APOYOS[a.tipo].ux ? [2 * a.nodo + 1] : []), ...(APOYOS[a.tipo].uy ? [2 * a.nodo + 2] : [])]).sort((a, b) => a - b);
  L.push(`fijos = [${fijos.join(' ')}];   % grados de libertad restringidos (2*nodo-1 = ux, 2*nodo = uy)`);
  L.push('%% 3. Cargas nodales');
  L.push('Vglob = zeros(ngdl, 1);');
  for (const c of pr.loads) {
    if (c.Fx) L.push(`Vglob(${2 * c.node + 1}) = Vglob(${2 * c.node + 1}) + ${num(c.Fx)};   % Fx en el nodo ${c.node + 1}`);
    if (c.Fy) L.push(`Vglob(${2 * c.node + 2}) = Vglob(${2 * c.node + 2}) + ${num(c.Fy)};   % Fy en el nodo ${c.node + 1}`);
  }
  L.push('');
  L.push('%% 4. Ensamblaje');
  L.push('Kglob = zeros(ngdl, ngdl);');
  L.push('for e = 1:nb');
  L.push('    i = Melem(e, 2);  j = Melem(e, 3);  E = Melem(e, 4);  A = Melem(e, 5);');
  L.push('    dx = Mnod(j, 2) - Mnod(i, 2);  dy = Mnod(j, 3) - Mnod(i, 3);');
  L.push('    Le = sqrt(dx^2 + dy^2);  c = dx/Le;  s = dy/Le;');
  L.push('    ke = E*A/Le*[ c*c  c*s -c*c -c*s;');
  L.push('                  c*s  s*s -c*s -s*s;');
  L.push('                 -c*c -c*s  c*c  c*s;');
  L.push('                 -c*s -s*s  c*s  s*s];');
  L.push('    gdl = [2*i-1, 2*i, 2*j-1, 2*j];');
  L.push('    Kglob(gdl, gdl) = Kglob(gdl, gdl) + ke;');
  L.push('end');
  L.push('K0 = Kglob;  V0 = Vglob;');
  L.push("figure; spy(Kglob); title('Estructura de Kglob');");
  L.push('');
  L.push('%% 5. Apoyos y solución');
  if (e.metodo === 'penalizacion') {
    L.push(`beta = 10^${e.penalizacion}*max(abs(diag(Kglob)));`);
    L.push('Kglob(fijos, fijos) = Kglob(fijos, fijos) + beta*eye(numel(fijos));');
    L.push('u = linsolve(Kglob, Vglob);');
  } else {
    L.push('libres = setdiff(1:ngdl, fijos);');
    L.push('u = zeros(ngdl, 1);');
    L.push('u(libres) = linsolve(Kglob(libres, libres), Vglob(libres));');
  }
  L.push('');
  L.push('%% 6. Fuerzas axiales, esfuerzos y reacciones');
  L.push('N = zeros(nb, 1);  sigma = zeros(nb, 1);');
  L.push('for e = 1:nb');
  L.push('    i = Melem(e, 2);  j = Melem(e, 3);  E = Melem(e, 4);  A = Melem(e, 5);');
  L.push('    dx = Mnod(j, 2) - Mnod(i, 2);  dy = Mnod(j, 3) - Mnod(i, 3);');
  L.push('    Le = sqrt(dx^2 + dy^2);  c = dx/Le;  s = dy/Le;');
  L.push('    gdl = [2*i-1, 2*i, 2*j-1, 2*j];');
  L.push('    N(e) = E*A/Le*[-c -s c s]*u(gdl);   % > 0 tracción');
  L.push('    sigma(e) = N(e)/A;');
  L.push('end');
  L.push('R = K0*u - V0;  R = R(fijos);');
  L.push("disp('   barra      N            sigma');");
  L.push('disp([(1:nb)\', N, sigma]);');
  L.push("fprintf('u = %s\\n', sprintf('%.12e, ', u));");
  L.push("fprintf('N = %s\\n', sprintf('%.12e, ', N));");
  L.push('');
  L.push('%% 7. Deformada');
  L.push(`escala = ${num(res.sol.scaleSuggestion)};`);
  L.push('figure; hold on; axis equal; grid on;');
  L.push('for e = 1:nb');
  L.push('    i = Melem(e, 2);  j = Melem(e, 3);');
  L.push("    plot(Mnod([i j], 2), Mnod([i j], 3), 'k-', 'LineWidth', 1.5);");
  L.push("    plot(Mnod([i j], 2) + escala*u([2*i-1 2*j-1]), Mnod([i j], 3) + escala*u([2*i 2*j]), 'r--', 'LineWidth', 1.5);");
  L.push('end');
  L.push("title(sprintf('Armadura original y deformada (escala x%g)', escala));");
  return L.join('\n') + '\n';
}

export function matlabResortes(res: ResultadoResortes): string {
  const e: EstadoResortes = res.estado;
  const pr = res.sol.problem;
  const L: string[] = [];
  L.push(encabezado('Sistema de resortes', [`Unidades: desplazamientos en ${res.unidades.long}, fuerzas en ${res.unidades.fuerza}.`]));
  L.push('%% 1. Datos: Melem = [resorte nodo_i nodo_j k]');
  L.push(`nn = ${pr.nNodes};`);
  L.push(`Melem = [\n${pr.springs.map((s, k) => `    ${k + 1}  ${s.i + 1}  ${s.j + 1}  ${num(s.k)}`).join(';\n')}\n];`);
  L.push(`fijos = [${pr.fixed.map((f) => f.node + 1).join(' ')}];  ubar = [${pr.fixed.map((f) => num(f.value)).join('; ')}];`);
  L.push('Vglob = zeros(nn, 1);');
  for (const c of pr.loads) L.push(`Vglob(${c.node + 1}) = Vglob(${c.node + 1}) + ${num(c.P)};`);
  L.push('');
  L.push('%% 2. Ensamblaje');
  L.push('Kglob = zeros(nn, nn);');
  L.push('for e = 1:size(Melem, 1)');
  L.push('    i = Melem(e, 2);  j = Melem(e, 3);  k = Melem(e, 4);');
  L.push('    Kglob([i j], [i j]) = Kglob([i j], [i j]) + k*[1 -1; -1 1];');
  L.push('end');
  L.push('K0 = Kglob;  V0 = Vglob;');
  L.push("figure; spy(Kglob); title('Estructura de Kglob');");
  L.push('');
  L.push('%% 3. Apoyos y solución');
  if (e.metodo === 'penalizacion') {
    L.push(`beta = 10^${e.penalizacion}*max(abs(diag(Kglob)));`);
    L.push('for i = 1:numel(fijos)');
    L.push('    Kglob(fijos(i), fijos(i)) = Kglob(fijos(i), fijos(i)) + beta;');
    L.push('    Vglob(fijos(i)) = Vglob(fijos(i)) + beta*ubar(i);');
    L.push('end');
    L.push('u = linsolve(Kglob, Vglob);');
  } else {
    L.push('libres = setdiff(1:nn, fijos);');
    L.push('u = zeros(nn, 1);  u(fijos) = ubar;');
    L.push('u(libres) = linsolve(Kglob(libres, libres), Vglob(libres) - Kglob(libres, fijos)*ubar);');
  }
  L.push('');
  L.push('%% 4. Fuerzas y reacciones');
  L.push('f = Melem(:, 4).*(u(Melem(:, 3)) - u(Melem(:, 2)));   % > 0 tracción');
  L.push('R = K0*u - V0;  R = R(fijos);');
  L.push("fprintf('u = %s\\n', sprintf('%.12e, ', u));");
  L.push("fprintf('f = %s\\n', sprintf('%.12e, ', f));");
  L.push("figure; plot(1:nn, u, 'o-', 'LineWidth', 1.5); grid on; xlabel('nodo'); ylabel('u');");
  return L.join('\n') + '\n';
}
