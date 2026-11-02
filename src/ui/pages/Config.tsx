import { useCallback, useMemo, useState } from 'react';
import { compileExpr, MAX_ELEMENTOS } from '../../core';
import {
  CATEGORIAS,
  PLANTILLAS_1D,
  plantilla1D,
  SISTEMAS,
  unidad,
  valorPorDefecto,
  type CampoDef,
  type Estado1D,
  type Plantilla1D,
  type Resultado1D,
  type SistemaUnidades,
} from '../../templates';
import { Aviso, Badge, Boton, Campo, cx, Desplazable, Icon, Segmentos, Seccion, Selector } from '../components/base';
import { DiagramaMalla } from '../components/DiagramaMalla';
import { Columnas, Pagina, TituloPagina } from '../components/Shell';
import { Tex } from '../components/Tex';
import { conPrefijo, fmtNum } from '../format';
import { Grafica, useEsEscritorio, type Colores } from '../components/Grafica';
import { useResultado1D } from '../resultado';
import { ir } from '../router';
import { useApp } from '../store';
import { ConfigResortes } from './ConfigResortes';
import { explicarExpresion } from '../explicarError';
import { idCampo, irAlCampo, primerErrorDeCampo } from '../validacionCampos';

/** Error de una expresión escrita en un campo, explicado en lenguaje normal (o null si es válida). */
function errorCampo(valor: string, tipo: 'numero' | 'expresion'): string | null {
  return explicarExpresion(valor, tipo === 'numero')?.mensaje ?? null;
}

function CampoFisico({ def, valor, onChange, sistema, id }: { def: CampoDef; valor: string; onChange: (v: string) => void; sistema: SistemaUnidades; id?: string }) {
  const err = useMemo(() => errorCampo(valor, def.tipo), [valor, def.tipo]);
  return (
    <Campo
      id={id}
      label={
        <>
          {def.nombre} <span className="text-accent-soft">{def.simbolo}</span>
        </>
      }
      value={valor}
      onChange={onChange}
      unidad={unidad(def.unidad, sistema)}
      ayuda={[def.ayuda, def.tipo === 'expresion' ? 'Número o expresión en x. Ej.: 10*x^3 o 2 + sin(x)' : `Número. Ej.: ${valorPorDefecto(def, sistema)}`].filter(Boolean).join(' · ')}
      error={err}
      inputMode={def.tipo === 'numero' ? 'decimal' : 'text'}
    />
  );
}

export function Config() {
  const tipo = useApp((s) => s.tipo);
  if (tipo === 'resortes') return <ConfigResortes />;
  if (tipo === 'armadura') {
    return (
      <Pagina>
        <TituloPagina titulo="Configuración del problema" subtitulo="La armadura 2D se configura en su propia pestaña, con el plano interactivo." />
        <Boton variante="primario" icon="architecture" onClick={() => ir('armadura')}>
          Ir a Armadura 2D
        </Boton>
      </Pagina>
    );
  }
  return <Config1D />;
}

function Config1D() {
  const e = useApp((s) => s.e1d);
  const set1D = useApp((s) => s.set1D);
  const cargar = useApp((s) => s.cargar);
  const restablecer = useApp((s) => s.restablecer);
  const ejemploId = useApp((s) => s.ejemplo['1d']);
  const t = plantilla1D(e.plantilla)!;
  const r = useResultado1D();
  const escritorio = useEsEscritorio();
  // Último resultado válido: el esquema se mantiene mientras se corrige un dato
  const [ultimo, setUltimo] = useState<Resultado1D | null>(null);
  if (r.ok && r.res !== ultimo) setUltimo(r.res);
  const vista = r.ok ? r.res : ultimo;
  const s = e.sistema;
  const L = Number(e.xL) - Number(e.x0);

  const upd = (f: (e: Estado1D) => void) =>
    set1D((prev) => {
      const c = structuredClone(prev);
      f(c);
      return c;
    });

  return (
    <Pagina amplia>
      <TituloPagina
        etiquetas={
          <>
            <Badge>Fase 01 · Modelado</Badge>
            <Badge tono="neutral">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {CATEGORIAS[t.categoria]}
            </Badge>
          </>
        }
        titulo="Configuración del problema"
        subtitulo={<span className="font-mono text-mini">{t.nombre} · elementos lineales de Lagrange</span>}
      />

      <Columnas
        fija="principal"
        anchoLateral="lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        principal={
          <>
      {/* Esquema + formulación */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-s2 p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Icon name="domain_verification" className="text-[18px] text-accent-soft" />
            <span className="font-mono text-mini font-bold uppercase tracking-wider text-ink">Malla · dominio [{e.x0}, {e.xL}]</span>
          </div>
          {vista && (
            <Badge>
              h = {fmtNum(Math.max(...vista.sol.elements.map((el) => el.h)), 3)}
              {unidad(t.unidadLongitud, s) && ` ${unidad(t.unidadLongitud, s)}`}
            </Badge>
          )}
        </div>
        <Desplazable etiqueta="Diagrama de la malla" className="rounded-lg border border-line bg-inset p-2">
          {vista ? (
            <DiagramaMalla problem={vista.problem} nodos={vista.sol.mesh.nodes} etiquetaCarga={etiquetaCarga(t)} fuerzaX={t.id === 'barra'} simbolo={t.incognita.simbolo} />
          ) : (
            <p className="p-6 text-center font-mono text-mini text-ink-3">Corrige los datos para ver la malla.</p>
          )}
        </Desplazable>
        <div className="flex flex-col gap-1 rounded-lg border border-line bg-s3 p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-mini font-bold uppercase tracking-wider text-accent-soft">Formulación fuerte</span>
            <span className="font-mono text-mini text-ink-2">{t.nombre}</span>
          </div>
          <Desplazable etiqueta="Ecuación del problema" className="text-detalle text-ink">
            <Tex display>{t.ecuacion}</Tex>
          </Desplazable>
          {vista && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(['izquierda', 'derecha'] as const).map((lado) => {
                const op = t.fronteras.find((o) => o.id === e[lado].opcion);
                if (!op) return null;
                const v = Object.fromEntries(op.campos.map((c) => [c.id, Number(compileSafe(e[lado].valores[c.id]))]));
                return (
                  <Badge key={lado} tono="neutral">
                    {lado === 'izquierda' ? 'x0' : 'xL'}: {op.describir(v, { lado, xTexto: lado === 'izquierda' ? e.x0 : e.xL, sistema: s })}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {!r.ok && (
        <AvisoErrorCampo t={t} e={e} mensajeCalculo={r.error.message} />
      )}
      {r.ok && r.res.avisos.length > 0 && (
        <Aviso tipo="aviso" titulo="Avisos">
          <ul className="list-disc space-y-0.5 pl-4">
            {r.res.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Aviso>
      )}

            {r.ok && escritorio && <VistaPrevia res={r.res} />}
          </>
        }
        lateral={
          <>
      <div className="flex flex-col gap-2.5">
        {/* 1. Plantilla */}
        <Seccion icon="functions" titulo="1. Plantilla y ecuación" subtitulo="Modelo físico, ejemplo y unidades" resumen={t.nombre}>
          <Selector
            label="Plantilla"
            value={t.id}
            onChange={(id) => cargar(id)}
            opciones={PLANTILLAS_1D.map((p) => ({ valor: p.id, texto: p.nombre }))}
          />
          <Selector
            label="Ejemplo precargado"
            value={t.ejemplos.some((x) => x.id === ejemploId) ? ejemploId : ''}
            onChange={(id) => id && cargar(t.id, id)}
            opciones={[{ valor: '', texto: '— Personalizado —' }, ...t.ejemplos.map((x) => ({ valor: x.id, texto: x.nombre }))]}
          />
          {t.sistemas.length > 1 && (
            <Segmentos
              label="Sistema de unidades"
              value={s}
              onChange={(v) => upd((c) => void (c.sistema = v))}
              opciones={t.sistemas.map((x) => ({ valor: x, texto: SISTEMAS[x].nombre }))}
            />
          )}
          {t.sistemas.length > 1 && <p className="-mt-1 text-mini text-ink-3">Cambiar el sistema solo cambia las unidades que se muestran: escribe los valores en esas unidades.</p>}
          {t.id !== 'general' && <div className="rounded-lg border border-line bg-inset p-3">
            <p className="mb-1 font-mono text-mini font-bold uppercase tracking-wider text-ink-2">Traducción al problema modelo</p>
            <Tex display>{String.raw`-(k\,u')' + b\,u' + c\,u = f`}</Tex>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-cuerpo">
              {(['k', 'b', 'c', 'f'] as const).map((k) => (
                <Tex key={k}>{`${k} = ${t.traduccion[k]}`}</Tex>
              ))}
            </div>
          </div>}
        </Seccion>

        {/* 2. Dominio y malla */}
        <Seccion icon="straighten" titulo="2. Dominio y malla" subtitulo="Longitud, número de elementos y cuadratura" resumen={`${e.malla.tipo} · Ne = ${e.malla.ne}`}>
          <div className="grid grid-cols-2 gap-2.5">
            <CampoFisico def={{ id: 'x0', simbolo: 'x₀', nombre: 'Inicio', unidad: t.unidadLongitud, porDefecto: '0', tipo: 'numero' }} valor={e.x0} onChange={(v) => upd((c) => void (c.x0 = v))} sistema={s} id={idCampo.x0} />
            <CampoFisico def={{ id: 'xL', simbolo: 'xL', nombre: 'Final', unidad: t.unidadLongitud, porDefecto: '1', tipo: 'numero' }} valor={e.xL} onChange={(v) => upd((c) => void (c.xL = v))} sistema={s} id={idCampo.xL} />
          </div>
          <Segmentos
            label="Tipo de malla"
            value={e.malla.tipo}
            onChange={(v) => upd((c) => void (c.malla.tipo = v))}
            opciones={[
              { valor: 'uniforme', texto: 'Uniforme' },
              { valor: 'geometrica', texto: 'Refinada' },
              { valor: 'manual', texto: 'Manual' },
            ]}
          />
          {e.malla.tipo !== 'manual' ? (
            <NumeroElementos ne={e.malla.ne} L={L} unidadL={unidad(t.unidadLongitud, s)} onChange={(ne) => upd((c) => void (c.malla.ne = ne))} />
          ) : (
            <Campo
              label="Nodos (separados por espacios o comas)"
              value={e.malla.nodos}
              onChange={(v) => upd((c) => void (c.malla.nodos = v))}
              placeholder={`${e.x0} 0.1 0.25 0.5 ${e.xL}`}
              ayuda="Deben ir de x₀ a xL en orden creciente. Los cambios de tramo y las cargas puntuales se agregan solos."
            />
          )}
          {e.malla.tipo === 'geometrica' && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Campo
                label="Razón h_max / h_min"
                value={String(e.malla.ratio)}
                inputMode="decimal"
                onChange={(v) => upd((c) => void (c.malla.ratio = Number(v.replace(',', '.')) || 1))}
                error={e.malla.ratio >= 1 ? null : 'Debe ser mayor o igual a 1.'}
              />
              <Segmentos
                label="Refinar hacia"
                value={e.malla.hacia}
                onChange={(v) => upd((c) => void (c.malla.hacia = v))}
                opciones={[
                  { valor: 'izquierda', texto: 'x₀' },
                  { valor: 'ambos', texto: 'Ambos' },
                  { valor: 'derecha', texto: 'xL' },
                ]}
              />
            </div>
          )}
          <Segmentos
            label="Puntos de Gauss por elemento"
            value={String(e.gauss) as '1' | '2' | '3' | '4' | '5'}
            onChange={(v) => upd((c) => void (c.gauss = Number(v)))}
            opciones={['1', '2', '3', '4', '5'].map((g) => ({ valor: g as '1', texto: g }))}
          />
          <p className="-mt-1 text-mini text-ink-3">Con n puntos se integran exactamente polinomios de grado 2n − 1 (3 puntos: grado 5).</p>
        </Seccion>

        {/* 3. Propiedades por tramos */}
        <Seccion icon="layers" titulo="3. Propiedades por tramos" subtitulo="Coeficientes físicos de cada región" resumen={`${e.tramos.length} tramo(s)`}>
          <AyudaExpresiones />
          {t.camposGlobales.length > 0 && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {t.camposGlobales.map((c) => (
                <CampoFisico key={c.id} id={idCampo.global(c.id)} def={c} valor={e.globales[c.id] ?? valorPorDefecto(c, s)} onChange={(v) => upd((x) => void (x.globales[c.id] = v))} sistema={s} />
              ))}
            </div>
          )}
          {e.tramos.map((_, i) => (
            <TramoEditor key={i} t={t} e={e} i={i} upd={upd} />
          ))}
          <Boton
            variante="secundario"
            icon="add"
            onClick={() =>
              upd((c) => {
                // Divide el último tramo por la mitad
                const ini = c.tramos.length > 1 ? Number(c.tramos[c.tramos.length - 2].fin) : Number(c.x0);
                const fin = Number(c.xL);
                const mitad = Number.isFinite(ini + fin) ? String(+((ini + fin) / 2).toPrecision(6)) : c.xL;
                const ultimo = c.tramos[c.tramos.length - 1];
                ultimo.fin = mitad;
                c.tramos.push({ fin: c.xL, valores: { ...ultimo.valores }, nombre: `Tramo ${c.tramos.length + 1}` });
              })
            }
          >
            Agregar tramo
          </Boton>
        </Seccion>

        {/* 4. Cargas puntuales */}
        {t.cargaPuntual && (
          <Seccion icon="north_east" titulo="4. Cargas puntuales" subtitulo={t.cargaPuntual.nombre} tono="amber" abierta={e.cargas.length > 0} resumen={`${e.cargas.length} carga(s)`}>
            {e.cargas.length === 0 && <p className="text-mini text-ink-3">No hay cargas puntuales. Se colocará un nodo en cada posición que agregues.</p>}
            {e.cargas.map((cg, i) => (
              <div key={i} className="flex items-end gap-2 rounded-lg border border-line bg-inset p-2.5">
                <CampoFisico
                  def={{ id: 'x', simbolo: 'x', nombre: 'Posición', unidad: t.unidadLongitud, porDefecto: '0', tipo: 'numero' }}
                  valor={cg.x}
                  id={idCampo.carga(i, 'x')}
                  onChange={(v) => upd((c) => void (c.cargas[i].x = v))}
                  sistema={s}
                />
                <CampoFisico
                  def={{ id: 'P', simbolo: t.cargaPuntual!.simbolo, nombre: 'Valor', unidad: t.cargaPuntual!.unidad, porDefecto: '0', tipo: 'numero' }}
                  valor={cg.P}
                  id={idCampo.carga(i, 'P')}
                  onChange={(v) => upd((c) => void (c.cargas[i].P = v))}
                  sistema={s}
                />
                <button
                  type="button"
                  aria-label={`Quitar carga ${i + 1}`}
                  onClick={() => upd((c) => void c.cargas.splice(i, 1))}
                  className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-field text-ink-2 hover:border-danger hover:text-danger"
                >
                  <Icon name="delete" className="text-[18px]" />
                </button>
              </div>
            ))}
            <Boton variante="secundario" icon="add" onClick={() => upd((c) => void c.cargas.push({ x: String(+((Number(c.x0) + Number(c.xL)) / 2).toPrecision(6)), P: '1' }))}>
              Agregar carga puntual
            </Boton>
          </Seccion>
        )}

        {/* 5. Fronteras */}
        <Seccion icon="border_all" titulo={`${t.cargaPuntual ? 5 : 4}. Condiciones de frontera`} subtitulo="Dirichlet, Neumann y Robin en cada extremo">
          {(['izquierda', 'derecha'] as const).map((lado) => (
            <FronteraEditor key={lado} t={t} e={e} lado={lado} upd={upd} />
          ))}
          <p className="text-detalle leading-snug text-ink-2">
            <strong className="font-semibold text-ink">Signos:</strong> <Tex>{String.raw`k\,\partial u/\partial n`}</Tex> usa la normal que apunta hacia afuera del dominio (n = −1 en x₀, n = +1 en xL). Un valor positivo significa que entra al dominio.
          </p>
        </Seccion>

        {/* 6. Solución */}
        <Seccion icon="tune" titulo={`${t.cargaPuntual ? 6 : 5}. Solución analítica y solucionador`} subtitulo="Fronteras esenciales y método de solución" abierta={!!(e.exacta.trim() && errorCampo(e.exacta, 'expresion'))} resumen={`${e.metodo} · ${e.solver}`}>
          <Campo
            id={idCampo.exacta}
            label="Solución analítica u(x) (opcional)"
            value={e.exacta}
            onChange={(v) => upd((c) => void (c.exacta = v))}
            placeholder={r.ok && r.res.exacta?.origen === 'automatica' ? 'Automática (coeficientes constantes)' : 'Por ejemplo: x*(1-x)/2'}
            error={e.exacta.trim() ? errorCampo(e.exacta, 'expresion') : null}
            ayuda={
              r.ok && r.res.exacta?.origen === 'automatica'
                ? 'Se calculó automáticamente porque los coeficientes son constantes. Escribe otra si quieres.'
                : 'Si la escribes, se compara con el MEF y se usa en el estudio de convergencia.'
            }
          />
          <Segmentos
            label="Fronteras Dirichlet"
            value={e.metodo}
            onChange={(v) => upd((c) => void (c.metodo = v))}
            opciones={[
              { valor: 'eliminacion', texto: 'Eliminación' },
              { valor: 'penalizacion', texto: 'Penalización' },
            ]}
          />
          {e.metodo === 'penalizacion' && (
            <Campo
              label="Exponente p (β = 10^p · max|Kii|)"
              value={String(e.penalizacion)}
              inputMode="numeric"
              onChange={(v) => upd((c) => void (c.penalizacion = Number(v) || 8))}
              error={e.penalizacion >= 2 && e.penalizacion <= 15 ? null : 'Usa un valor entre 2 y 15.'}
            />
          )}
          <Segmentos
            label="Solucionador"
            value={e.solver}
            onChange={(v) => upd((c) => void (c.solver = v))}
            opciones={[
              { valor: 'auto', texto: 'Automático' },
              { valor: 'thomas', texto: 'Thomas' },
              { valor: 'gauss', texto: 'Gauss' },
            ]}
          />
          <p className="-mt-1 text-mini text-ink-3">Automático usa Thomas si K es tridiagonal y diagonalmente dominante; si no, eliminación gaussiana con pivoteo.</p>
        </Seccion>
      </div>

      <div className="flex flex-col gap-2.5 pt-1">
        <button
          type="button"
          disabled={!r.ok}
          onClick={() => ir('resultados')}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-hover px-4 py-3.5 font-bold text-on-accent shadow-glow transition active:scale-[0.99] disabled:opacity-50"
        >
          <Icon name="play_circle" className="text-[20px]" />
          <span className="text-cuerpo tracking-wide">Resolver sistema [K]{'{u}'} = {'{F}'}</span>
        </button>
        <Boton variante="secundario" icon="restart_alt" onClick={restablecer}>
          Restablecer el ejemplo
        </Boton>
      </div>
          </>
        }
      />
    </Pagina>
  );
}

function compileSafe(v: string | undefined) {
  try {
    return compileExpr(v ?? '0').fn(0);
  } catch {
    return NaN;
  }
}

function etiquetaCarga(t: Plantilla1D) {
  if (t.id === 'aleta') return 'h·P·T∞ · término de convección';
  const id = t.camposTramo.find((c) => c.tipo === 'expresion' && /^(q|p|Q|r|rho|ql|f)$/.test(c.id));
  return id ? `${id.simbolo} · ${id.nombre.toLowerCase()}` : 'f(x)';
}

function NumeroElementos({ ne, L, unidadL, onChange }: { ne: number; L: number; unidadL: string; onChange: (n: number) => void }) {
  const [texto, setTexto] = useState(String(ne));
  const [prev, setPrev] = useState(ne);
  if (prev !== ne) {
    setPrev(ne);
    setTexto(String(ne));
  }
  const n = Number(texto);
  const err = Number.isInteger(n) && n >= 1 && n <= MAX_ELEMENTOS ? null : `Ne debe ser un entero entre 1 y ${MAX_ELEMENTOS}.`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between rounded-lg border border-line bg-inset p-3">
        <div>
          <span className="block font-mono text-mini uppercase text-ink-2">Longitud L</span>
          <span className="font-mono text-seccion font-bold text-ink">
            {fmtNum(L)} <span className="text-mini font-normal text-ink-2">{unidadL}</span>
          </span>
        </div>
        <div className="text-right">
          <span className="block font-mono text-mini text-ink-2">PASO h = L/Ne</span>
          <span className="font-mono text-seccion font-bold text-accent-soft">
            {Number.isFinite(L / ne) ? fmtNum(L / ne) : '—'} <span className="text-mini font-normal text-ink-2">{unidadL}</span>
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="ne-slider" className="text-mini font-bold text-ink">
          Número de elementos (Ne)
        </label>
        <div className="flex items-center gap-1.5">
          <input
            aria-label="Número de elementos"
            value={texto}
            inputMode="numeric"
            onChange={(e) => {
              setTexto(e.target.value);
              const v = Number(e.target.value);
              if (Number.isInteger(v) && v >= 1 && v <= MAX_ELEMENTOS) onChange(v);
            }}
            className={cx('min-h-11 w-24 rounded-lg border bg-inset px-3 text-right font-mono text-cuerpo font-bold text-ink', err ? 'border-danger' : 'border-field')}
          />
          <Badge>{ne + 1} nodos</Badge>
        </div>
      </div>
      <input
        id="ne-slider"
        type="range"
        min={1}
        max={64}
        step={1}
        value={Math.min(ne, 64)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full cursor-pointer accent-[var(--accent)]"
      />
      <div className="flex justify-between px-0.5 font-mono text-mini text-ink-2">
        <span>1</span>
        <span>deslizador hasta 64 · escribe hasta {MAX_ELEMENTOS}</span>
        <span>64</span>
      </div>
      {err && <span className="text-mini text-danger">{err}</span>}
    </div>
  );
}

function TramoEditor({ t, e, i, upd }: { t: Plantilla1D; e: Estado1D; i: number; upd: (f: (e: Estado1D) => void) => void }) {
  const tr = e.tramos[i];
  const ultimo = i === e.tramos.length - 1;
  const ini = i === 0 ? e.x0 : e.tramos[i - 1].fin;
  const multi = e.tramos.length > 1;
  return (
    <div className={cx('flex flex-col gap-2.5', multi && 'rounded-lg border border-line bg-inset p-3')}>
      {multi && (
        <div className="flex items-center justify-between gap-2">
          <input
            aria-label={`Nombre del tramo ${i + 1}`}
            value={tr.nombre ?? `Tramo ${i + 1}`}
            onChange={(ev) => upd((c) => void (c.tramos[i].nombre = ev.target.value))}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-field bg-inset px-3 text-cuerpo font-semibold text-ink"
          />
          <button
            type="button"
            aria-label={`Quitar tramo ${i + 1}`}
            onClick={() =>
              upd((c) => {
                c.tramos.splice(i, 1);
                c.tramos[c.tramos.length - 1].fin = c.xL;
              })
            }
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-field text-ink-2 hover:border-danger hover:text-danger"
          >
            <Icon name="delete" className="text-[18px]" />
          </button>
        </div>
      )}
      {multi && (
        <div className="grid grid-cols-2 gap-2.5">
          <Campo label="Desde" value={ini} onChange={() => {}} unidad={unidad(t.unidadLongitud, e.sistema)} ayuda="Fin del tramo anterior" />
          {ultimo ? (
            <Campo label="Hasta" value={e.xL} onChange={() => {}} unidad={unidad(t.unidadLongitud, e.sistema)} ayuda="Termina en xL" />
          ) : (
            <CampoFisico
              def={{ id: 'fin', simbolo: '', nombre: 'Hasta', unidad: t.unidadLongitud, porDefecto: '1', tipo: 'numero' }}
              valor={tr.fin}
              onChange={(v) => upd((c) => void (c.tramos[i].fin = v))}
              sistema={e.sistema}
            />
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {t.camposTramo.map((c) => (
          <CampoFisico key={c.id} id={idCampo.tramo(i, c.id)} def={c} valor={tr.valores[c.id] ?? valorPorDefecto(c, e.sistema)} onChange={(v) => upd((x) => void (x.tramos[i].valores[c.id] = v))} sistema={e.sistema} />
        ))}
      </div>
    </div>
  );
}

function FronteraEditor({ t, e, lado, upd }: { t: Plantilla1D; e: Estado1D; lado: 'izquierda' | 'derecha'; upd: (f: (e: Estado1D) => void) => void }) {
  const fe = e[lado];
  const op = t.fronteras.find((o) => o.id === fe.opcion) ?? t.fronteras[0];
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-line bg-inset p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-mini font-bold text-ink">
          {lado === 'izquierda' ? `Extremo izquierdo · x = ${e.x0}` : `Extremo derecho · x = ${e.xL}`}
        </span>
        <Badge tono={op.campos.length === 0 ? 'neutral' : 'accent'}>{tipoBC(op.aBC)}</Badge>
      </div>
      <Selector
        etiqueta={`Tipo de condición en el extremo ${lado}`}
        value={op.id}
        onChange={(id) =>
          upd((c) => {
            const nueva = t.fronteras.find((o) => o.id === id)!;
            c[lado] = { opcion: id, valores: Object.fromEntries(nueva.campos.map((x) => [x.id, valorPorDefecto(x, c.sistema)])) };
          })
        }
        opciones={t.fronteras.map((o) => ({ valor: o.id, texto: o.nombre }))}
      />
      {op.ayuda && <p className="-mt-1 text-detalle text-ink-2">{op.ayuda}</p>}
      {op.ayuda?.includes('∂u/∂n') && (
        <p className="-mt-1 text-detalle text-ink-2">
          {lado === 'izquierda' ? 'En x₀ la normal exterior apunta hacia −x, así que k·∂u/∂n = −k·u′(x₀).' : 'En xL la normal exterior apunta hacia +x, así que k·∂u/∂n = k·u′(xL).'}
        </p>
      )}
      {op.campos.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {op.campos.map((c) => (
            <CampoFisico key={c.id} id={idCampo.frontera(lado, c.id)} def={c} valor={fe.valores[c.id] ?? valorPorDefecto(c, e.sistema)} onChange={(v) => upd((x) => void (x[lado].valores[c.id] = v))} sistema={e.sistema} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Guía corta para escribir números y expresiones. */
function AyudaExpresiones() {
  const filas: [string, string][] = [
    ['Operaciones', '+  −  *  /  ^   (2*x, x^2, (1 - x)/2)'],
    ['Decimales', 'Con punto: 0.25 · notación científica: 210e9 = 210×10⁹'],
    ['Funciones', 'sin cos tan exp log (natural) log10 sqrt abs sinh cosh'],
    ['Constantes', 'pi, e'],
    ['Variable', 'Solo x. Escribe siempre el *: 3*x, no 3x'],
  ];
  return (
    <details className="group rounded-lg border border-line bg-s1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-detalle font-semibold text-ink-2 hover:text-ink">
        <Icon name="help" className="text-[18px]" />
        Cómo escribir valores y expresiones
        <Icon name="expand_more" className="ml-auto text-[18px] transition-transform group-open:rotate-180" />
      </summary>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-line px-3 py-3 text-detalle">
        {filas.map(([n, d]) => (
          <div key={n} className="contents">
            <dt className="font-semibold text-ink">{n}</dt>
            <dd className="font-mono text-ink-2">{d}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** Tipo matemático de una opción (se averigua aplicándola con valores de prueba). */
function tipoBC(aBC: Plantilla1D['fronteras'][number]['aBC']): string {
  try {
    const bc = aBC(new Proxy({}, { get: () => 1 }) as Record<string, number>, { lado: 'izquierda', x: 0, campo: () => 1, global: () => 1 });
    return { dirichlet: 'Dirichlet', neumann: 'Neumann', robin: 'Robin' }[bc.type];
  } catch {
    return '';
  }
}


/** Texto con su unidad entre corchetes, si la tiene. */
const conU = (txt: string, x?: string) => (x && x !== '—' ? `${txt} [${x}]` : txt);

/** Vista previa de la solución mientras se editan los datos (solo en pantallas grandes). */
function VistaPrevia({ res }: { res: Resultado1D }) {
  const t = res.plantilla;
  const nodos = res.sol.mesh.nodes;
  const u = res.sol.u;
  const exacta = useMemo(() => {
    if (!res.exacta) return null;
    try {
      return compileExpr(res.exacta.expr).fn;
    } catch {
      return null;
    }
  }, [res.exacta]);
  const data = useCallback(
    (c: Colores) => {
      const tr: unknown[] = [];
      if (exacta) {
        const xs = Array.from({ length: 201 }, (_, i) => nodos[0] + ((nodos[nodos.length - 1] - nodos[0]) * i) / 200);
        tr.push({ x: xs, y: xs.map((x) => exacta(x)), type: 'scatter', mode: 'lines', name: 'Analítica', line: { color: c.exact, width: 2 }, hoverinfo: 'skip' });
      }
      tr.push({
        x: nodos,
        y: u,
        type: 'scatter',
        mode: nodos.length <= 60 ? 'lines+markers' : 'lines',
        name: 'MEF',
        line: { color: c.accentHover, width: 2, dash: exacta ? 'dash' : 'solid' },
        marker: { color: c.bg, size: 7, line: { color: c.accentHover, width: 2 } },
        hovertemplate: `x = %{x:.4g}<br>${t.incognita.simbolo} = %{y:.5g}<extra></extra>`,
      });
      return tr;
    },
    [nodos, u, exacta, t.incognita.simbolo],
  );
  const ux = unidad(t.unidadLongitud, res.estado.sistema);
  const un = unidad(t.incognita.unidad, res.estado.sistema);
  const layout = useCallback(
    () => ({ margin: { l: 52, r: 10, t: 6, b: 40 }, xaxis: { title: { text: conU('x', ux) } }, yaxis: { title: { text: conU(t.incognita.simbolo, un) } } }),
    [ux, un, t.incognita.simbolo],
  );
  const err = res.sol.error;
  const iMx = u.indexOf(Math.max(...u));
  return (
    <section aria-labelledby="titulo-vista-previa" className="flex flex-col gap-3 rounded-xl border border-line bg-s2 p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon name="insights" className="text-[18px] text-accent-soft" />
          <h2 id="titulo-vista-previa" className="text-cuerpo font-bold text-ink">
            Vista previa: {t.incognita.nombre}
          </h2>
        </div>
        <div className="flex items-center gap-3 font-mono text-mini text-ink-2" aria-hidden="true">
          {exacta && (
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-[var(--plot-exact)]" /> Analítica
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-accent-hover" /> MEF
          </span>
        </div>
      </div>
      <div className="rounded-lg border border-line bg-inset p-1">
        <Grafica
          data={data}
          layout={layout}
          alto={220}
          etiqueta={`Vista previa de ${t.incognita.nombre} contra x`}
          resumen={`Solución MEF con ${nodos.length} nodos; máximo ${fmtNum(u[iMx], 5)} en x = ${fmtNum(nodos[iMx])}.${exacta ? ' Se compara con la solución analítica.' : ''}`}
          valores={{
            cabecera: ['Nodo', conU('x', ux), conU(`${t.incognita.simbolo} MEF`, un), ...(err ? [conU(`${t.incognita.simbolo} analítica`, un)] : [])],
            alinear: ['center', 'right', 'right', 'right'],
            filas: nodos.map((x, i) => [String(i + 1), fmtNum(x), fmtNum(u[i], 6), ...(err ? [fmtNum(err.exactAtNodes[i], 6)] : [])]),
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {res.kpis.slice(0, 4).map((k) => {
          const p = conPrefijo(k.valor.valor, k.unidad);
          return (
            <div key={k.def.id} className="rounded-lg border border-line bg-inset px-3 py-2">
              <p className="truncate font-mono text-mini uppercase text-ink-2">{k.def.nombre}</p>
              <p className="font-heading text-seccion font-bold text-accent-hover">
                {fmtNum(p.valor, 4)} <span className="font-mono text-mini font-normal text-ink-2">{p.unidad !== '—' ? p.unidad : ''}</span>
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Aviso de error que dice qué campo revisar y lleva hasta él. */
export function AvisoErrorCampo({ t, e, mensajeCalculo }: { t: Plantilla1D; e: Estado1D; mensajeCalculo: string }) {
  const err = primerErrorDeCampo(t, e);
  if (!err) {
    return (
      <Aviso tipo="error" titulo="El problema no se puede resolver así">
        {mensajeCalculo}
      </Aviso>
    );
  }
  return (
    <Aviso tipo="error" titulo={`Revisa el campo «${err.campo}»`}>
      <p>{err.mensaje}</p>
      <button type="button" onClick={() => irAlCampo(err.id)} className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg border border-danger px-3 font-semibold text-danger hover:bg-danger-bg">
        <Icon name="arrow_forward" className="text-[18px]" /> Ir al campo
      </button>
    </Aviso>
  );
}
