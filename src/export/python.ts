/** Código Python (NumPy + Matplotlib) equivalente al problema resuelto en FEM Lab. */
import { gaussRule, type BoundaryCondition } from '../core';
import { APOYOS, unidad, type Resultado1D, type ResultadoArmadura, type ResultadoResortes } from '../templates';
import { coeficientesNombrados, type Definicion } from './coeficientes';
import { exprA } from './expresiones';
import { URL_APP } from './matlab';
import { numMatlab as num } from './matlab-texto';

function encabezado(titulo: string, lineas: string[]): string {
  return [
    `"""FEM Lab - ${titulo}`,
    '',
    ...lineas,
    `Generado el ${new Date().toISOString().slice(0, 10)} con FEM Lab (${URL_APP}).`,
    'Requiere NumPy; las gráficas usan Matplotlib si está instalado.',
    '"""',
    'import numpy as np',
    '',
    'try:',
    '    import matplotlib.pyplot as plt',
    'except ImportError:  # sin Matplotlib solo se imprimen los resultados',
    '    plt = None',
    '',
  ].join('\n');
}

const lista = (v: number[]) => `[${v.map((x) => num(x, 15)).join(', ')}]`;
const imprimir = (nombre: string, v: string) => `print('${nombre} =', ', '.join(f'{v:.12e}' for v in ${v}))`;

export function python1D(res: Resultado1D): string {
  const p = res.problem;
  const t = res.plantilla;
  const nodos = res.sol.mesh.nodes;
  const cuad = res.sol.mesh.orden === 2;
  const ne = res.sol.mesh.elements.length;
  const vertices = cuad ? nodos.filter((_, i) => i % 2 === 0) : nodos;
  const ui = unidad(t.incognita.unidad, res.estado.sistema);
  const L: string[] = [];
  L.push(
    encabezado(t.nombre, [
      `Problema modelo: -(k u')' + b u' + c u = f   en [${num(p.x0)}, ${num(p.xL)}]`,
      `Incógnita: ${t.incognita.nombre} ${t.incognita.simbolo}${ui && ui !== '—' ? ` [${ui}]` : ''}`,
      `Elementos lineales de 2 nodos y cuadratura de Gauss de ${p.gaussPoints} punto(s).`,
    ]),
  );
  L.push('# 1. Datos del problema');
  L.push(`x0, xL = ${num(p.x0)}, ${num(p.xL)}`);
  L.push(`Ne = ${ne}  # número de elementos`);
  const co = coeficientesNombrados(res, 'python');
  const def = (d: Definicion) => L.push(`${d.nombre} = ${d.funcion ? `lambda x: ${d.valor}` : d.valor}  # ${d.comentario}`);
  if (co.definiciones[0].length) {
    L.push('# Parámetros globales');
    co.definiciones[0].forEach(def);
  }
  if (p.regions.length === 1) {
    co.definiciones[1]?.forEach(def);
    for (const c of ['k', 'b', 'c', 'f'] as const) L.push(`${c} = lambda x: ${co.tramos[0][c]}`);
  } else {
    p.regions.forEach((r, i) => {
      L.push(`# Tramo ${i + 1}${r.nombre ? ` (${r.nombre})` : ''}: x en [${num(r.x0)}, ${num(r.x1)}]`);
      co.definiciones[i + 1]?.forEach(def);
      for (const c of ['k', 'b', 'c', 'f'] as const) L.push(`${c}${i + 1} = lambda x: ${co.tramos[i][c]}`);
    });
    const cortes = p.regions.slice(0, -1).map((r) => num(r.x1));
    const mascara = (i: number) => {
      if (i === 0) return `(x < ${cortes[0]})`;
      if (i === p.regions.length - 1) return `(x >= ${cortes[i - 1]})`;
      return `((x >= ${cortes[i - 1]}) & (x < ${cortes[i]}))`;
    };
    for (const c of ['k', 'b', 'c', 'f'] as const) {
      L.push(`${c} = lambda x: ${p.regions.map((_, i) => `${mascara(i)}*${c}${i + 1}(x)`).join(' + ')}`);
    }
  }
  if (p.loads.length) L.push(`Pcarga = [${p.loads.map((l) => `(${num(l.x)}, ${num(l.P)})`).join(', ')}]  # (posición, valor)`);
  if (res.exacta) L.push(`uex = lambda x: ${exprA(res.exacta.expr, 'python')}  # solución analítica`);
  L.push('');
  if (cuad) {
    L.push('# 2. Malla: Mnod = [nodo, x], Melem = [elemento, nodo1, nodo_centro, nodo3] (numeración desde 1, como en MATLAB)');
    L.push(`xv = np.array(${lista(vertices)})  # extremos de los elementos`);
    L.push('n = 2 * Ne + 1');
    L.push('xn = np.zeros(n)');
    L.push('xn[0::2] = xv  # extremos');
    L.push('xn[1::2] = (xv[:-1] + xv[1:]) / 2  # centro de cada elemento');
    L.push('Mnod = np.column_stack([np.arange(1, n + 1), xn])');
    L.push('Melem = np.column_stack([np.arange(1, Ne + 1), np.arange(1, n - 1, 2), np.arange(2, n, 2), np.arange(3, n + 1, 2)])');
  } else {
    L.push('# 2. Malla: Mnod = [nodo, x], Melem = [elemento, nodo1, nodo2] (numeración desde 1, como en MATLAB)');
    L.push(`xn = np.array(${lista(nodos)})`);
    L.push('n = len(xn)');
    L.push('Mnod = np.column_stack([np.arange(1, n + 1), xn])');
    L.push('Melem = np.column_stack([np.arange(1, Ne + 1), np.arange(1, Ne + 1), np.arange(2, Ne + 2)])');
  }
  L.push('');
  const g = gaussRule(p.gaussPoints);
  L.push('# 3. Cuadratura de Gauss en [-1, 1]');
  L.push(`xi = np.array(${lista(g.xi)})`);
  L.push(`w = np.array(${lista(g.w)})`);
  L.push('');
  L.push('# 4. Matrices elementales y ensamblaje');
  L.push('Kglob = np.zeros((n, n))');
  L.push('Vglob = np.zeros(n)');
  L.push('for e in range(Ne):');
  if (cuad) {
    L.push('    idx = Melem[e, 1:4] - 1  # nodos del elemento (desde 0): inicio, centro, fin');
    L.push('    x1, x3 = xn[idx[0]], xn[idx[2]]');
    L.push('    h = x3 - x1');
    L.push('    Ke = np.zeros((3, 3))');
    L.push('    Fe = np.zeros(3)');
    L.push('    for g in range(len(xi)):');
    L.push('        s = xi[g]');
    L.push('        xg = (x1 + x3) / 2 + h / 2 * s');
    L.push('        N = np.array([s * (s - 1) / 2, 1 - s**2, s * (s + 1) / 2])  # funciones de forma cuadráticas');
    L.push('        dN = np.array([s - 0.5, -2 * s, s + 0.5]) * 2 / h  # derivadas dN/dx');
  } else {
    L.push('    n1, n2 = Melem[e, 1] - 1, Melem[e, 2] - 1  # índices desde 0');
    L.push('    x1, x2 = xn[n1], xn[n2]');
    L.push('    h = x2 - x1');
    L.push('    Ke = np.zeros((2, 2))');
    L.push('    Fe = np.zeros(2)');
    L.push('    for g in range(len(xi)):');
    L.push('        xg = (x1 + x2) / 2 + h / 2 * xi[g]');
    L.push('        N = np.array([(x2 - xg) / h, (xg - x1) / h])');
    L.push('        dN = np.array([-1 / h, 1 / h])');
  }
  L.push('        Ke += w[g] * (k(xg) * np.outer(dN, dN) + b(xg) * np.outer(N, dN) + c(xg) * np.outer(N, N)) * h / 2');
  L.push('        Fe += w[g] * f(xg) * N * h / 2');
  if (!cuad) L.push('    idx = [n1, n2]');
  L.push('    Kglob[np.ix_(idx, idx)] += Ke');
  L.push('    Vglob[idx] += Fe');
  L.push('');
  L.push('# 5. Cargas puntuales y fronteras naturales');
  if (p.loads.length) {
    L.push('for xP, P in Pcarga:');
    L.push('    Vglob[np.argmin(np.abs(xn - xP))] += P');
  }
  const nat = (bc: BoundaryCondition, nodo: string, lado: string) => {
    if (bc.type === 'neumann') L.push(`Vglob[${nodo}] += ${num(bc.q)}  # Neumann en ${lado}`);
    if (bc.type === 'robin') {
      L.push(`Kglob[${nodo}, ${nodo}] += ${num(bc.h)}  # Robin en ${lado}`);
      L.push(`Vglob[${nodo}] += ${num(bc.g)}`);
    }
  };
  nat(p.bcLeft, '0', 'x0');
  nat(p.bcRight, '-1', 'xL');
  const fijos: string[] = [];
  const valores: string[] = [];
  if (p.bcLeft.type === 'dirichlet') {
    fijos.push('0');
    valores.push(num(p.bcLeft.value));
  }
  if (p.bcRight.type === 'dirichlet') {
    fijos.push('n - 1');
    valores.push(num(p.bcRight.value));
  }
  if (fijos.length) L.push('K0, V0 = Kglob.copy(), Vglob.copy()  # copias para las reacciones');
  L.push('');
  L.push('# 6. Fronteras Dirichlet y solución');
  if (fijos.length === 0) L.push('u = np.linalg.solve(Kglob, Vglob)');
  else {
    L.push(`fijos = [${fijos.join(', ')}]`);
    L.push(`ubar = np.array([${valores.join(', ')}])`);
    if (p.bcMethod === 'penalizacion') {
      L.push(`beta = 10**${p.penaltyExp} * np.max(np.abs(np.diag(Kglob)))  # penalización`);
      L.push('for i, d in enumerate(fijos):');
      L.push('    Kglob[d, d] += beta');
      L.push('    Vglob[d] += beta * ubar[i]');
      L.push('u = np.linalg.solve(Kglob, Vglob)');
    } else {
      L.push('libres = [i for i in range(n) if i not in fijos]  # eliminación');
      L.push('u = np.zeros(n)');
      L.push('u[fijos] = ubar');
      L.push('u[libres] = np.linalg.solve(Kglob[np.ix_(libres, libres)], Vglob[libres] - Kglob[np.ix_(libres, fijos)] @ ubar)');
    }
  }
  L.push('');
  L.push('# 7. Posproceso');
  if (cuad) {
    L.push('i1, ic, i3 = Melem[:, 1] - 1, Melem[:, 2] - 1, Melem[:, 3] - 1');
    L.push('du = (u[i3] - u[i1]) / (xn[i3] - xn[i1])  # derivada en el centro de cada elemento');
    L.push('xm = xn[ic]');
  } else {
    L.push('du = np.diff(u) / np.diff(xn)  # derivada en cada elemento');
    L.push('xm = (xn[:-1] + xn[1:]) / 2');
  }
  L.push('flujo = k(xm) * du  # k du/dx en cada elemento');
  L.push(imprimir('u', 'u'));
  if (fijos.length) {
    L.push('R = (K0 @ u - V0)[fijos]  # reacciones (k du/dn en los apoyos)');
    L.push(imprimir('Reacciones', 'R'));
  }
  if (res.exacta) L.push("print(f'Error nodal máximo = {np.max(np.abs(u - uex(xn))):.4e}')");
  L.push('');
  L.push('# 8. Gráficas');
  L.push('if plt is not None:');
  L.push('    plt.figure(); plt.spy(Kglob, markersize=6); plt.title("Estructura de Kglob")');
  if (cuad) {
    L.push('    plt.figure()');
    L.push('    s = np.linspace(-1, 1, 13)');
    L.push('    for e in range(Ne):  # parábola dentro de cada elemento');
    L.push('        a, m, z = Melem[e, 1:4] - 1');
    L.push('        xs = (xn[a] + xn[z]) / 2 + (xn[z] - xn[a]) / 2 * s');
    L.push('        us = s * (s - 1) / 2 * u[a] + (1 - s**2) * u[m] + s * (s + 1) / 2 * u[z]');
    L.push("        plt.plot(xs, us, 'C0-', label='MEF' if e == 0 else None)");
    L.push("    plt.plot(xn, u, 'C0o', label='Nodos')");
  } else {
    L.push("    plt.figure(); plt.plot(xn, u, 'o-', label='MEF')");
  }
  if (res.exacta) L.push("    xx = np.linspace(x0, xL, 300); plt.plot(xx, uex(xx), label='Analítica')");
  L.push(`    plt.xlabel('x'); plt.ylabel('${t.incognita.simbolo}'); plt.title('${t.incognita.nombre}'); plt.grid(True); plt.legend()`);
  L.push('    plt.show()');
  return L.join('\n') + '\n';
}

export function pythonArmadura(res: ResultadoArmadura): string {
  const e = res.estado;
  const pr = res.sol.problem;
  const un = res.unidades;
  const L: string[] = [];
  L.push(encabezado('Armadura plana 2D', [`Unidades: longitudes en ${un.long}, fuerzas en ${un.fuerza}, E en ${un.esfuerzo}, A en ${un.area}.`]));
  L.push('# Nodos: [nodo, x, y]; barras: [barra, nodo_i, nodo_j, E, A] (numeración desde 1)');
  L.push(`Mnod = np.array([${pr.nodes.map((nd, i) => `[${i + 1}, ${num(nd.x)}, ${num(nd.y)}]`).join(', ')}])`);
  L.push(`Melem = np.array([${pr.bars.map((b, k) => `[${k + 1}, ${b.i + 1}, ${b.j + 1}, ${num(b.E)}, ${num(b.A)}]`).join(', ')}])`);
  L.push('nn, nb = len(Mnod), len(Melem)');
  L.push('ngdl = 2 * nn');
  const fijos = e.apoyos.flatMap((a) => [...(APOYOS[a.tipo].ux ? [2 * a.nodo] : []), ...(APOYOS[a.tipo].uy ? [2 * a.nodo + 1] : [])]).sort((a, b) => a - b);
  L.push(`fijos = [${fijos.join(', ')}]  # grados de libertad restringidos (desde 0: 2*nodo = ux, 2*nodo+1 = uy)`);
  L.push('Vglob = np.zeros(ngdl)');
  for (const c of pr.loads) {
    if (c.Fx) L.push(`Vglob[${2 * c.node}] += ${num(c.Fx)}  # Fx en el nodo ${c.node + 1}`);
    if (c.Fy) L.push(`Vglob[${2 * c.node + 1}] += ${num(c.Fy)}  # Fy en el nodo ${c.node + 1}`);
  }
  L.push('');
  L.push('def geometria(e):');
  L.push('    i, j = int(Melem[e, 1]) - 1, int(Melem[e, 2]) - 1');
  L.push('    dx, dy = Mnod[j, 1] - Mnod[i, 1], Mnod[j, 2] - Mnod[i, 2]');
  L.push('    Le = np.hypot(dx, dy)');
  L.push('    return i, j, Le, dx / Le, dy / Le');
  L.push('');
  L.push('Kglob = np.zeros((ngdl, ngdl))');
  L.push('for e in range(nb):');
  L.push('    i, j, Le, c, s = geometria(e)');
  L.push('    E, A = Melem[e, 3], Melem[e, 4]');
  L.push('    T = np.array([-c, -s, c, s])');
  L.push('    ke = E * A / Le * np.outer(T, T)');
  L.push('    gdl = [2 * i, 2 * i + 1, 2 * j, 2 * j + 1]');
  L.push('    Kglob[np.ix_(gdl, gdl)] += ke');
  L.push('K0, V0 = Kglob.copy(), Vglob.copy()');
  L.push('');
  if (e.metodo === 'penalizacion') {
    L.push(`beta = 10**${e.penalizacion} * np.max(np.abs(np.diag(Kglob)))`);
    L.push('for d in fijos:');
    L.push('    Kglob[d, d] += beta');
    L.push('u = np.linalg.solve(Kglob, Vglob)');
  } else {
    L.push('libres = [d for d in range(ngdl) if d not in fijos]');
    L.push('u = np.zeros(ngdl)');
    L.push('u[libres] = np.linalg.solve(Kglob[np.ix_(libres, libres)], Vglob[libres])');
  }
  L.push('');
  L.push('N = np.zeros(nb)');
  L.push('for e in range(nb):');
  L.push('    i, j, Le, c, s = geometria(e)');
  L.push('    E, A = Melem[e, 3], Melem[e, 4]');
  L.push('    N[e] = E * A / Le * np.array([-c, -s, c, s]) @ u[[2 * i, 2 * i + 1, 2 * j, 2 * j + 1]]  # > 0 tracción');
  L.push('sigma = N / Melem[:, 4]');
  L.push('R = (K0 @ u - V0)[fijos]');
  L.push(imprimir('u', 'u'));
  L.push(imprimir('N', 'N'));
  L.push('');
  L.push('if plt is not None:');
  L.push(`    escala = ${num(res.sol.scaleSuggestion)}`);
  L.push('    plt.figure()');
  L.push('    for e in range(nb):');
  L.push('        i, j = int(Melem[e, 1]) - 1, int(Melem[e, 2]) - 1');
  L.push("        plt.plot(Mnod[[i, j], 1], Mnod[[i, j], 2], 'k-')");
  L.push("        plt.plot(Mnod[[i, j], 1] + escala * u[[2 * i, 2 * j]], Mnod[[i, j], 2] + escala * u[[2 * i + 1, 2 * j + 1]], 'r--')");
  L.push("    plt.axis('equal'); plt.grid(True); plt.title(f'Armadura y deformada (x{escala:g})'); plt.show()");
  return L.join('\n') + '\n';
}

export function pythonResortes(res: ResultadoResortes): string {
  const e = res.estado;
  const pr = res.sol.problem;
  const L: string[] = [];
  L.push(encabezado('Sistema de resortes', [`Unidades: desplazamientos en ${res.unidades.long}, fuerzas en ${res.unidades.fuerza}.`]));
  L.push(`nn = ${pr.nNodes}`);
  L.push(`Melem = np.array([${pr.springs.map((s, k) => `[${k + 1}, ${s.i + 1}, ${s.j + 1}, ${num(s.k)}]`).join(', ')}])  # [resorte, i, j, k]`);
  L.push(`fijos = [${pr.fixed.map((f) => f.node).join(', ')}]  # desde 0`);
  L.push(`ubar = np.array([${pr.fixed.map((f) => num(f.value)).join(', ')}])`);
  L.push('Vglob = np.zeros(nn)');
  for (const c of pr.loads) L.push(`Vglob[${c.node}] += ${num(c.P)}`);
  L.push('Kglob = np.zeros((nn, nn))');
  L.push('for _, i, j, kk in Melem:');
  L.push('    idx = [int(i) - 1, int(j) - 1]');
  L.push('    Kglob[np.ix_(idx, idx)] += kk * np.array([[1, -1], [-1, 1]])');
  L.push('K0, V0 = Kglob.copy(), Vglob.copy()');
  if (e.metodo === 'penalizacion') {
    L.push(`beta = 10**${e.penalizacion} * np.max(np.abs(np.diag(Kglob)))`);
    L.push('for i, d in enumerate(fijos):');
    L.push('    Kglob[d, d] += beta');
    L.push('    Vglob[d] += beta * ubar[i]');
    L.push('u = np.linalg.solve(Kglob, Vglob)');
  } else {
    L.push('libres = [d for d in range(nn) if d not in fijos]');
    L.push('u = np.zeros(nn)');
    L.push('u[fijos] = ubar');
    L.push('u[libres] = np.linalg.solve(Kglob[np.ix_(libres, libres)], Vglob[libres] - Kglob[np.ix_(libres, fijos)] @ ubar)');
  }
  L.push('f = Melem[:, 3] * (u[Melem[:, 2].astype(int) - 1] - u[Melem[:, 1].astype(int) - 1])  # > 0 tracción');
  L.push('R = (K0 @ u - V0)[fijos]');
  L.push(imprimir('u', 'u'));
  L.push(imprimir('f', 'f'));
  return L.join('\n') + '\n';
}
