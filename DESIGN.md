# DESIGN.md · FEM Lab

Sistema de diseño de FEM Lab. **Todo estilo de la interfaz sale de aquí**: los valores viven como
variables CSS en `src/index.css` (`:root` para oscuro y `[data-theme='light']` para claro) y se usan
con las clases de Tailwind indicadas. No se escriben colores, tamaños de letra ni radios sueltos.

Identidad: *Sahara* — siena y ámbar sobre fondos cálidos. Herramienta de cálculo: lo principal es
siempre el dato (la ecuación, el número, la gráfica); la decoración no compite con él.

---

## 1. Color

Contrastes medidos contra el fondo más exigente donde se usa cada color (WCAG 2.1 AA:
texto ≥ 4.5:1; bordes de controles, íconos y gráficos ≥ 3:1).

### Superficies

| Token | Clase | Oscuro | Claro | Uso |
|---|---|---|---|---|
| `--bg` | `bg-bg` | `#161311` | `#faf5ee` | Fondo de la página |
| `--s1` | `bg-s1` | `#1f1a17` | `#f4ede4` | Barra lateral, pies de tabla |
| `--s2` | `bg-s2` | `#231e1a` | `#fffcf8` | Tarjetas |
| `--s3` | `bg-s3` | `#2e2724` | `#f0e7dc` | Encabezados de tabla, elementos realzados |
| `--s4` | `bg-s4` | `#3a312c` | `#e6dacb` | Hover de botones secundarios |
| `--inset` | `bg-inset` | `#1a1613` | `#fffaf4` | Interior de campos, gráficas y bloques de fórmula |

### Texto

| Token | Clase | Oscuro | Claro | Contraste mínimo | Uso |
|---|---|---|---|---|---|
| `--ink` | `text-ink` | `#faf4ec` | `#2b211c` | 14:1 | Texto principal, valores |
| `--ink-2` | `text-ink-2` | `#c9b8aa` | `#64544a` | 7:1 | Texto secundario, etiquetas |
| `--ink-3` | `text-ink-3` | `#9c8e83` | `#72645b` | 4.6:1 | Ayudas y notas (nunca información esencial) |

### Acento y estados

| Token | Clase | Oscuro | Claro | Uso |
|---|---|---|---|---|
| `--accent` | `bg-accent` | `#e06d32` | `#b25d27` | Acción principal, selección activa |
| `--on-accent` | `text-on-accent` | `#1a0e07` (5.8:1) | `#ffffff` (4.7:1) | Texto sobre `--accent` |
| `--accent-hover` | `bg-accent-hover` | `#f08244` | `#9a4a17` | Hover de la acción principal, foco |
| `--accent-soft` | `text-accent-soft` | `#ffb695` | `#9a4a17` | Texto de acento (símbolos, números destacados) |
| `--accent-bg` | `bg-accent-bg` | siena 16 % | siena 12 % | Fondo de selección |
| `--amber-soft` | `text-amber-soft` | `#ffb95f` | `#8e5c11` | Encabezados de tabla, reacciones |
| `--ok` | `text-ok` | `#9ccc8a` | `#3c742f` | Verificación correcta |
| `--danger` / `--danger-bg` | `text-danger` | `#ffb4ab` | `#a1231b` | Errores |
| `--compress` | `text-compress` | `#8fb3d9` | `#3f6c99` | Compresión en armaduras (siempre junto al texto «compresión») |

### Bordes

| Token | Clase | Oscuro | Claro | Uso |
|---|---|---|---|---|
| `--line` | `border-line` | `#382f29` | `#e4d9cd` | Separadores y contorno de tarjetas (decorativo) |
| `--field` | `border-field` | `#81716a` (3.1:1) | `#8a8177` (3.1:1) | **Borde de todo control**: campos, selectores, segmentos |
| `--focus` | `outline-focus` | `#ffb695` | `#9a4a17` | Anillo de foco (2 px, separado 2 px) |

---

## 2. Tipografía

| Familia | Clase | Uso |
|---|---|---|
| **Inter** (variable, libre, incluida en la app) | `font-sans`, `font-heading` | Todo el texto |
| **JetBrains Mono** (variable, libre, incluida) | `font-mono` | Números, expresiones, código, tablas |

Las cifras usan siempre `tabular-nums` para que las columnas no salten.

| Token | Clase | Tamaño / interlineado | Peso | Uso |
|---|---|---|---|---|
| `--text-titulo` | `text-titulo` | 28 / 34 px | 700 | Título de la página (`h1`, uno por pantalla) |
| `--text-seccion` | `text-seccion` | 18 / 26 px | 600 | Título de tarjeta o sección (`h2`) |
| `--text-cuerpo` | `text-cuerpo` | 15 / 22 px | 400 | Texto normal y campos |
| `--text-detalle` | `text-detalle` | 13 / 18 px | 400–500 | Etiquetas de campo, ayudas, tablas |
| `--text-mini` | `text-mini` | 12 / 16 px | 500–600 | Chips y notas al pie. **Nunca menos de 12 px.** |
| `--text-dato` | `text-dato` | 26 / 30 px | 700 | Valor de un indicador |

Etiquetas en mayúsculas solo para el rótulo pequeño de un indicador o una tabla, nunca para frases.

---

## 3. Espaciado

Base de 4 px. Solo estos pasos (clases de Tailwind `gap-*`, `p-*`, `m-*`):

| Paso | px | Uso |
|---|---|---|
| 1 | 4 | Ícono ↔ texto dentro de un chip |
| 2 | 8 | Elementos dentro de un control |
| 3 | 12 | Campos dentro de un grupo |
| 4 | 16 | Separación entre tarjetas; relleno de tarjeta |
| 6 | 24 | Separación entre columnas en escritorio; entre secciones |
| 8 | 32 | Margen lateral en escritorio |

---

## 4. Radios y sombras

| Token | Clase | Valor | Uso |
|---|---|---|---|
| Insignia | `rounded` | 4 px | Insignias pequeñas de texto (unidades, estado) |
| Control | `rounded-lg` | 8 px | Campos, botones, segmentos, chips |
| Tarjeta | `rounded-xl` | 12 px | Tarjetas, avisos, hojas modales |
| Píldora | `rounded-full` | — | Pestañas y puntos de estado |
| `--shadow` | `shadow-card` | `0 4px 20px -2px` (oscuro) / casi nula (claro) | Solo tarjetas |

Sin brillos ni animaciones decorativas: el movimiento se reserva para indicar que algo carga.

Excepción documentada: las fórmulas de KaTeX que resaltan un valor usan el color literal `#E06D32` (KaTeX no lee variables CSS); se lee bien en ambos temas.

---

## 5. Componentes

### Botón
- **Primario** (`variante="primario"`): fondo `--accent`, texto `--on-accent`, peso 600. Uno por pantalla.
- **Secundario**: fondo `--s3`, borde `--field`, texto `--ink`.
- **Fantasma**: sin fondo, texto `--ink-2`; para acciones menores.
- Alto mínimo **44 px** (también los botones de solo ícono: 44 × 44) y nombre accesible siempre.

### Campo de entrada
- Etiqueta visible encima (`text-detalle`, `--ink-2`), unida al campo con `for`/`id`.
- Caja: fondo `--inset`, borde 1 px `--field`, `rounded-lg`, alto mínimo 44 px, texto `font-mono text-cuerpo`.
- Unidad a la derecha en `--ink-2`.
- Ayuda debajo con **un ejemplo concreto** (`Ej.: 10*x^3`).
- Foco: anillo `--focus` de 2 px.
- Error: borde `--danger`, `aria-invalid`, mensaje debajo (enlazado con `aria-describedby`) que dice **qué está mal y cómo corregirlo**, con un ejemplo.
- El error se muestra tras una pausa de escritura (no con cada tecla).

### Tarjeta de resultado (indicador)
- Fondo `--s2`, borde `--line`, `rounded-xl`, relleno 16 px.
- Rótulo (`text-mini`, mayúsculas, `--ink-2`) → valor (`text-dato`, `--accent-soft` o `--ink`) con unidad (`text-detalle`, `--ink-2`) → ubicación o detalle (`text-detalle`).
- Los símbolos se escriben con subíndices reales (u<sub>máx</sub>), no con guion bajo.

### Mensaje de error
- Caja `--danger-bg` con borde `--danger`, ícono y título en `--danger`, cuerpo en `--ink`.
- `role="alert"`. Dice qué pasó, por qué y cómo corregirlo, y enlaza al campo con el problema.

### Gráfica
- Siempre con ejes con nombre y unidad, leyenda cuando hay más de una serie.
- Texto alternativo que resume el resultado (máximo, mínimo, comparación).
- Una tabla con los valores, plegable (`<details>`), debajo de la gráfica: prop `valores` de `Grafica`.
- En el celular no se monta la vista previa de Configuración (`useEsEscritorio`), para no cargar Plotly donde no se ve.

### Pestañas
- Patrón ARIA: `role="tablist"` / `tab` / `tabpanel`, flechas ← → para moverse, una sola pestaña en el orden de Tab.

### Hoja modal
- `role="dialog"` con `aria-modal`, el foco queda atrapado dentro, Esc cierra y el foco vuelve al botón que la abrió.

### Contenedor desplazable (tablas, matrices, fórmulas largas)
- Componente `Desplazable`. Solo cuando el contenido no cabe: `tabIndex=0`, `role="group"` y `aria-label`, para poder desplazarlo con las flechas del teclado.
- Se usa `group` y no `region` porque hay muchas fórmulas por pantalla y las regiones deben tener nombre único.

### Campo: área táctil
- La caja completa (44 px) pone el foco en el campo al tocarla, incluida la unidad; el `<input>` interior mide 42 px por el borde.

---

## 6. Números

- Formato único (`fmtNum`): notación decimal entre 10⁻³ y 10⁵; fuera de ese rango, `m×10ⁿ`. Signo menos tipográfico (−).
- Punto decimal en toda la app (coincide con MATLAB y con lo que se escribe en los campos).
- La unidad va siempre después del número, separada por un espacio.
- Las tablas usan la unidad base de la plantilla (N, Pa…) para poder copiarlas. Los indicadores pueden usar prefijo (kN, MPa) para leerse rápido, y la unidad mostrada siempre corresponde al número.
