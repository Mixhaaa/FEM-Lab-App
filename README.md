# FEM Lab

Aplicación web para resolver problemas de ingeniería lineales con el **Método de Elementos Finitos** usando **elementos lineales**.
Materia *Diseño por Elementos Finitos* — Universidad Distrital, 2026-1.

> 🚧 En construcción. El README completo (explicación del método, capturas e instrucciones) llega al final del proyecto.

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Núcleo de cálculo 1D, armadura 2D, resortes y pruebas | ✅ |
| 2 | Plantillas de ingeniería (barra, calor, aleta, cable, Darcy, tubería, electrostática, armadura, resortes, EDO general) | ✅ |
| 3 | Interfaz móvil (Inicio, Configuración, Resultados, Paso a paso, Armadura 2D), tema oscuro y claro | ✅ |
| 4 | Resultados avanzados: matrices, spy, convergencia | ⏳ |
| 5 | Exportación (CSV, PDF, MATLAB) y modo presentación | ⏳ |
| 6 | Versión de escritorio, README y GitHub Pages | ⏳ |

## Abrir la app

En línea: **https://mixhaaa.github.io/FEM-Lab-App/** (se publica sola con cada cambio en `main`).

En tu computador (requiere Node.js 20 o superior):

```bash
npm install
npm run dev                    # abre http://localhost:5173
```

## Verificar

```bash
npm test                       # pruebas del núcleo y de las plantillas
npm run demo:clase             # ejemplo de clase con Ne = 3 (Mnod, Melem, Ke, Kglob, Vglob, u)
npm run demo:clase -- 6        # el mismo ejemplo con otro número de elementos
npm run demo:plantillas        # todos los ejemplos de las plantillas con sus resultados
npm run demo:plantillas -- aleta
```

## Estructura

```
src/core/        Núcleo de cálculo (TypeScript puro, sin interfaz)
src/templates/   Plantillas: variables físicas → k, b, c, f y resultados con unidades
src/ui/          Interfaz (React + Tailwind): páginas, componentes, estado y tema
tests/           Pruebas con Vitest contra soluciones analíticas
scripts/         Demostraciones en la terminal
```

## Convención de signos

Problema modelo en [x0, xL]:  −(k u′)′ + b u′ + c u = f.
Las fronteras usan la **normal exterior** n (n = −1 en x0, n = +1 en xL):

- Dirichlet: u = ū
- Neumann: k ∂u/∂n = q (q > 0 significa que *entra* al dominio: fuerza hacia +x, calor que entra, ...)
- Robin: k ∂u/∂n + h u = g

Las reacciones se reportan con la misma convención: R = k ∂u/∂n en el apoyo.
