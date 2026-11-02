import { useEffect, useMemo, useState } from 'react';
import { compileExpr } from '../../core';
import { APOYOS, EJEMPLOS_ARMADURA, SISTEMAS, type EstadoArmadura, type TipoApoyo } from '../../templates';
import { Aviso, Badge, Boton, Campo, Card, CardHeader, cx, Icon, Kpi, Segmentos, Seccion, Selector, Tabla } from '../components/base';
import { PlanoArmadura, type Seleccion } from '../components/PlanoArmadura';
import { PanelMatrices } from '../components/PanelMatrices';
import { PanelExportar } from '../components/PanelExportar';
import { archivosArmadura } from '../exportables';
import { Pagina, TituloPagina } from '../components/Shell';
import { conPrefijo, fmtNum, snap, sub } from '../format';
import { useResultadoArmadura } from '../resultado';
import { ir } from '../router';
import { useApp } from '../store';

function num(v: string): number {
  try {
    const ce = compileExpr(v);
    return ce.constant ? ce.fn(0) : NaN;
  } catch {
    return NaN;
  }
}
function errNum(v: string): string | null {
  try {
    const ce = compileExpr(v, 'El valor');
    return ce.constant ? null : 'Debe ser un número.';
  } catch (e) {
    return (e as Error).message.replace(/^El valor /, '');
  }
}

export function Armadura() {
  const tipo = useApp((s) => s.tipo);
  const cargar = useApp((s) => s.cargar);
  const e = useApp((s) => s.armadura);
  const setA = useApp((s) => s.setArmadura);
  const ejemplo = useApp((s) => s.ejemplo.armadura);
  const restablecer = useApp((s) => s.restablecer);

  // Al abrir esta pestaña, la armadura pasa a ser el problema activo
  useEffect(() => {
    if (tipo !== 'armadura') useApp.setState({ tipo: 'armadura' });
  }, [tipo]);

  const r = useResultadoArmadura();
  const sol = r.ok ? r.res.sol : undefined;
  const un = r.ok ? r.res.unidades : { long: e.sistema === 'SI' ? 'm' : 'mm', fuerza: 'N', esfuerzo: e.sistema === 'SI' ? 'Pa' : 'MPa', area: e.sistema === 'SI' ? 'm²' : 'mm²' };
  const coords = useMemo(() => e.nodos.map((n) => ({ x: num(n.x), y: num(n.y) })), [e.nodos]);
  const coordsOk = coords.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const [verDef, setVerDef] = useState(true);
  const [verF, setVerF] = useState(true);
  const [factor, setFactor] = useState(1);
  const [sel, setSel] = useState<Seleccion>(null);
  const escala = (sol?.scaleSuggestion ?? 1) * factor;

  const upd = (f: (e: EstadoArmadura) => void) =>
    setA((p) => {
      const c = structuredClone(p);
      f(c);
      return c;
    });
  const nodos = e.nodos.map((_, i) => ({ valor: i, texto: `Nodo ${i + 1}` }));
  const escalaF = sol ? Math.max(...sol.bars.map((b) => Math.abs(b.N)), ...sol.F.map(Math.abs), 1e-300) : 1;
  const escalaU = sol ? Math.max(...sol.u.map(Math.abs), 1e-300) : 1;
  const escalaS = sol ? Math.max(...sol.bars.map((b) => Math.abs(b.sigma)), 1e-300) : 1;
  const etiquetasGdl = e.nodos.flatMap((_, i) => [`${i + 1}x`, `${i + 1}y`]);

  const quitarNodo = (i: number) =>
    upd((c) => {
      c.nodos.splice(i, 1);
      const m = (k: number) => (k > i ? k - 1 : k);
      c.barras = c.barras.filter((b) => b.i !== i && b.j !== i).map((b) => ({ ...b, i: m(b.i), j: m(b.j) }));
      c.apoyos = c.apoyos.filter((a) => a.nodo !== i).map((a) => ({ ...a, nodo: m(a.nodo) }));
      c.cargas = c.cargas.filter((a) => a.nodo !== i).map((a) => ({ ...a, nodo: m(a.nodo) }));
      setSel(null);
    });

  return (
    <Pagina amplia>
      <TituloPagina
        etiquetas={
          <>
            <Badge>Estructuras 2D</Badge>
            <Badge tono="neutral">2 grados de libertad por nodo</Badge>
          </>
        }
        titulo="Armadura plana 2D"
        subtitulo="Toca un nodo o una barra para ver sus datos. Las barras se colorean según su fuerza axial."
      />

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start lg:gap-x-6 lg:gap-y-4">
      <div className="flex min-w-0 flex-col gap-4 lg:col-start-1">
      <Card className="flex flex-col gap-3 p-3">
        <div className="overflow-hidden rounded-xl border border-line bg-inset">
          {coordsOk ? (
            <PlanoArmadura e={e} coords={coords} sol={sol} escala={escala} verDeformada={verDef} verFuerzas={verF} sel={sel} onSel={setSel} />
          ) : (
            <p className="p-8 text-center font-mono text-mini text-ink-3">Revisa las coordenadas de los nodos.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={verF}
            onClick={() => setVerF(!verF)}
            className={cx('flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-mini', verF ? 'border-accent bg-accent-bg text-accent-soft' : 'border-line text-ink-2')}
          >
            <Icon name="palette" className="text-[15px]" /> Fuerzas
          </button>
          <button
            type="button"
            aria-pressed={verDef}
            onClick={() => setVerDef(!verDef)}
            className={cx('flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-mini', verDef ? 'border-accent bg-accent-bg text-accent-soft' : 'border-line text-ink-2')}
          >
            <Icon name="timeline" className="text-[15px]" /> Deformada
          </button>
          {verF && sol && (
            <span className="flex items-center gap-2 font-mono text-mini text-ink-2">
              <span className="flex items-center gap-1">
                <span className="h-1 w-4 rounded bg-amber" /> tracción
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1 w-4 rounded bg-compress" /> compresión
              </span>
            </span>
          )}
        </div>
        {verDef && sol && (
          <div className="flex items-center gap-3">
            <label htmlFor="escala-def" className="shrink-0 font-mono text-mini text-ink-2">
              Escala ×{fmtNum(escala, 3)}
            </label>
            <input
              id="escala-def"
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={factor}
              onChange={(ev) => setFactor(Number(ev.target.value))}
              className="h-2 w-full cursor-pointer accent-[var(--accent)]"
            />
          </div>
        )}
        <Inspector e={e} sel={sel} un={un} sol={sol} escalaF={escalaF} escalaU={escalaU} />
      </Card>

      {!r.ok && (
        <Aviso tipo="error" titulo="No se pudo resolver la armadura">
          {r.error.message}
        </Aviso>
      )}
      {r.ok && r.res.sol.warnings.length > 0 && (
        <Aviso tipo="aviso" titulo="Avisos">
          <ul className="list-disc space-y-0.5 pl-4">
            {r.res.sol.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Aviso>
      )}

      {r.ok && (
        <div className="grid grid-cols-2 gap-3">
          {r.res.kpis.map((k, i) => {
            const p = conPrefijo(snap(k.valor, k.unidad === un.long ? escalaU : escalaF), k.unidad);
            return <Kpi key={k.id} titulo={k.nombre} simbolo={k.simbolo} valor={fmtNum(p.valor, 4)} unidad={p.unidad} detalle={k.detalle} icon="pin_drop" tono={i % 3 === 1 ? 'amber' : 'accent'} />;
          })}
        </div>
      )}
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1">
      <div className="flex flex-col gap-2.5">
        <Seccion icon="functions" titulo="1. Ejemplo, unidades y método" subtitulo="Casos precargados">
          <Selector
            label="Ejemplo precargado"
            value={EJEMPLOS_ARMADURA.some((x) => x.id === ejemplo) ? ejemplo : ''}
            onChange={(id) => id && cargar('armadura', id)}
            opciones={[{ valor: '', texto: '— Personalizado —' }, ...EJEMPLOS_ARMADURA.map((x) => ({ valor: x.id, texto: x.nombre }))]}
          />
          <Segmentos label="Sistema de unidades" value={e.sistema} onChange={(v) => upd((c) => void (c.sistema = v))} opciones={(['SI', 'mm'] as const).map((x) => ({ valor: x, texto: SISTEMAS[x].nombre }))} />
          <Segmentos
            label="Apoyos"
            value={e.metodo}
            onChange={(v) => upd((c) => void (c.metodo = v))}
            opciones={[
              { valor: 'eliminacion', texto: 'Eliminación' },
              { valor: 'penalizacion', texto: 'Penalización' },
            ]}
          />
        </Seccion>

        <Seccion icon="scatter_plot" titulo="2. Nodos" subtitulo={`${e.nodos.length} nodos · coordenadas en ${un.long}`} abierta={false} resumen={`${e.nodos.length} nodos`}>
          {e.nodos.map((n, i) => (
            <div key={i} className={cx('grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2 rounded-lg border bg-inset p-2.5', sel?.tipo === 'nodo' && sel.i === i ? 'border-accent' : 'border-line')}>
              <span className="mb-2.5 w-7 text-center font-mono text-cuerpo font-bold text-accent-soft">{i + 1}</span>
              <Campo label="x" value={n.x} unidad={un.long} inputMode="decimal" error={errNum(n.x)} onChange={(v) => upd((c) => void (c.nodos[i].x = v))} />
              <Campo label="y" value={n.y} unidad={un.long} inputMode="decimal" error={errNum(n.y)} onChange={(v) => upd((c) => void (c.nodos[i].y = v))} />
              <Quitar label={`Quitar nodo ${i + 1}`} onClick={() => quitarNodo(i)} />
            </div>
          ))}
          <Boton variante="secundario" icon="add" onClick={() => upd((c) => void c.nodos.push({ x: '0', y: '0' }))}>
            Agregar nodo
          </Boton>
          <p className="text-mini text-ink-3">Al quitar un nodo también se quitan sus barras, apoyos y cargas.</p>
        </Seccion>

        <Seccion icon="timeline" titulo="3. Barras" subtitulo={`${e.barras.length} barras · E en ${un.esfuerzo}, A en ${un.area}`} abierta={false} resumen={`${e.barras.length} barras`}>
          {e.barras.map((b, k) => (
            <div key={k} className={cx('flex flex-col gap-2 rounded-lg border bg-inset p-2.5', sel?.tipo === 'barra' && sel.i === k ? 'border-accent' : 'border-line')}>
              <div className="grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2">
                <span className="mb-2.5 w-7 text-center font-mono text-cuerpo font-bold text-accent-soft">{k + 1}</span>
                <Selector label="Nodo i" value={b.i} onChange={(v) => upd((c) => void (c.barras[k].i = v))} opciones={nodos} />
                <Selector label="Nodo j" value={b.j} onChange={(v) => upd((c) => void (c.barras[k].j = v))} opciones={nodos} />
                <Quitar label={`Quitar barra ${k + 1}`} onClick={() => upd((c) => void c.barras.splice(k, 1))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Campo label="E" value={b.E} unidad={un.esfuerzo} inputMode="decimal" error={errNum(b.E)} onChange={(v) => upd((c) => void (c.barras[k].E = v))} />
                <Campo label="A" value={b.A} unidad={un.area} inputMode="decimal" error={errNum(b.A)} onChange={(v) => upd((c) => void (c.barras[k].A = v))} />
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Boton
              variante="secundario"
              icon="add"
              disabled={e.nodos.length < 2}
              onClick={() =>
                upd((c) => {
                  const ult = c.barras[c.barras.length - 1];
                  c.barras.push({ i: 0, j: 1, E: ult?.E ?? (c.sistema === 'SI' ? '200e9' : '200000'), A: ult?.A ?? (c.sistema === 'SI' ? '0.001' : '1000') });
                })
              }
            >
              Agregar barra
            </Boton>
            {e.barras.length > 1 && (
              <Boton
                variante="fantasma"
                icon="content_copy"
                onClick={() =>
                  upd((c) => {
                    for (const b of c.barras) {
                      b.E = c.barras[0].E;
                      b.A = c.barras[0].A;
                    }
                  })
                }
              >
                Usar E y A de la barra 1 en todas
              </Boton>
            )}
          </div>
        </Seccion>

        <Seccion icon="change_history" titulo="4. Apoyos" subtitulo={`${e.apoyos.length} apoyo(s)`} abierta={false} resumen={`${e.apoyos.length} apoyo(s)`}>
          {e.apoyos.map((a, k) => (
            <div key={k} className="grid grid-cols-[1fr_1.4fr_auto] items-end gap-2 rounded-lg border border-line bg-inset p-2.5">
              <Selector label="Nodo" value={a.nodo} onChange={(v) => upd((c) => void (c.apoyos[k].nodo = v))} opciones={nodos} />
              <Selector
                label="Tipo"
                value={a.tipo}
                onChange={(v) => upd((c) => void (c.apoyos[k].tipo = v as TipoApoyo))}
                opciones={(Object.keys(APOYOS) as TipoApoyo[]).map((t) => ({ valor: t, texto: APOYOS[t].nombre }))}
              />
              <Quitar label={`Quitar apoyo ${k + 1}`} onClick={() => upd((c) => void c.apoyos.splice(k, 1))} />
            </div>
          ))}
          <Boton variante="secundario" icon="add" onClick={() => upd((c) => void c.apoyos.push({ nodo: 0, tipo: 'articulado' }))}>
            Agregar apoyo
          </Boton>
          <p className="text-mini text-ink-3">Articulado: restringe u_x y u_y. Rodillo horizontal: se desliza en x. Rodillo vertical: se desliza en y.</p>
        </Seccion>

        <Seccion icon="south" titulo="5. Cargas nodales" subtitulo={`${e.cargas.length} carga(s) · Fy positiva hacia arriba`} tono="amber" abierta={false} resumen={`${e.cargas.length} carga(s)`}>
          {e.cargas.map((a, k) => (
            <div key={k} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2 rounded-lg border border-line bg-inset p-2.5">
              <Selector label="Nodo" value={a.nodo} onChange={(v) => upd((c) => void (c.cargas[k].nodo = v))} opciones={nodos} />
              <Campo label="Fx" value={a.Fx} unidad={un.fuerza} inputMode="decimal" error={errNum(a.Fx)} onChange={(v) => upd((c) => void (c.cargas[k].Fx = v))} />
              <Campo label="Fy" value={a.Fy} unidad={un.fuerza} inputMode="decimal" error={errNum(a.Fy)} onChange={(v) => upd((c) => void (c.cargas[k].Fy = v))} />
              <Quitar label={`Quitar carga ${k + 1}`} onClick={() => upd((c) => void c.cargas.splice(k, 1))} />
            </div>
          ))}
          <Boton variante="secundario" icon="add" onClick={() => upd((c) => void c.cargas.push({ nodo: Math.max(0, c.nodos.length - 1), Fx: '0', Fy: '-1000' }))}>
            Agregar carga
          </Boton>
        </Seccion>
      </div>
      {r.ok && <PanelExportar archivos={archivosArmadura(r.res, ejemplo)} />}

      <div className="flex flex-col gap-2.5">
        <Boton variante="secundario" icon="functions" onClick={() => ir('paso')}>
          Ver la solución paso a paso
        </Boton>
        <Boton variante="fantasma" icon="restart_alt" onClick={restablecer}>
          Restablecer el ejemplo
        </Boton>
      </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:col-start-1">
      {sol && (
        <>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-s1 p-4">
              <div className="flex items-center gap-2">
                <Icon name="table_chart" className="text-[22px] text-accent-hover" />
                <h3 className="font-heading text-seccion font-bold text-ink">Fuerzas en las barras</h3>
              </div>
              <Badge>{sol.bars.length} barras</Badge>
            </div>
            <Tabla
              cabecera={['Barra', 'Nodos', `L [${un.long}]`, `N [${un.fuerza}]`, `σ [${un.esfuerzo}]`, 'ε', 'Estado']}
              alinear={['left', 'center', 'right', 'right', 'right', 'right', 'left']}
              filas={sol.bars.map((b) => [
                <span key="id" className="font-bold text-accent-soft">{b.id}</span>,
                `${b.i + 1}–${b.j + 1}`,
                fmtNum(b.L, 5),
                <span key="N" className={b.estado === 'tracción' ? 'text-amber-soft' : b.estado === 'compresión' ? 'text-compress' : 'text-ink-3'}>{fmtNum(snap(b.N, escalaF), 6)}</span>,
                fmtNum(snap(b.sigma, escalaS), 5),
                fmtNum(snap(b.strain, escalaU), 4),
                b.estado,
              ])}
            />
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line bg-s1 p-4">
              <Icon name="open_with" className="text-[22px] text-accent-hover" />
              <h3 className="font-heading text-seccion font-bold text-ink">Desplazamientos y reacciones</h3>
            </div>
            <Tabla
              cabecera={['Nodo', `uₓ [${un.long}]`, `u_y [${un.long}]`, `Rₓ [${un.fuerza}]`, `R_y [${un.fuerza}]`]}
              alinear={['left', 'right', 'right', 'right', 'right']}
              filas={e.nodos.map((_, i) => {
                const rc = sol.reactions.find((x) => x.node === i);
                const R = (v: number | null | undefined) => (v === null || v === undefined ? '—' : <span key="r" className="text-amber-soft">{fmtNum(snap(v, escalaF), 6)}</span>);
                return [
                  <span key="n" className="font-bold text-accent-soft">N{sub(i + 1)}</span>,
                  fmtNum(snap(sol.u[2 * i], escalaU), 5),
                  fmtNum(snap(sol.u[2 * i + 1], escalaU), 5),
                  R(rc?.Rx),
                  R(rc?.Ry),
                ];
              })}
            />
          </Card>

          <Card className="flex flex-col gap-3 p-4">
            <CardHeader
              icon="balance"
              title="Equilibrio global"
              subtitle="Cargas + reacciones"
              right={
                <Badge tono={Math.abs(sol.equilibrium.sumFx) + Math.abs(sol.equilibrium.sumFy) <= 1e-8 * sol.equilibrium.scale ? 'ok' : 'danger'}>
                  {Math.abs(sol.equilibrium.sumFx) + Math.abs(sol.equilibrium.sumFy) <= 1e-8 * sol.equilibrium.scale ? 'Cumple' : 'No cumple'}
                </Badge>
              }
            />
            <div className="grid grid-cols-3 gap-2 font-mono text-mini">
              {(
                [
                  ['ΣFx', sol.equilibrium.sumFx],
                  ['ΣFy', sol.equilibrium.sumFy],
                  ['ΣM₀', sol.equilibrium.sumM],
                ] as const
              ).map(([n, v]) => (
                <div key={n} className="rounded-lg border border-line bg-inset p-2 text-center">
                  <span className="block text-ink-2">{n}</span>
                  <span className="text-ink">{fmtNum(snap(v, sol.equilibrium.scale), 3)}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {sol && (
        <Seccion icon="grid_4x4" titulo="Matrices [K] y {F}" subtitulo="Estructura tipo spy, matriz global y matrices de cada barra" abierta={false} resumen={`${sol.K.length}×${sol.K.length}`}>
          <PanelMatrices
            sistemas={[
              { id: 'global', nombre: 'K global', descripcion: `${sol.K.length} grados de libertad (2 por nodo), antes de imponer los apoyos.`, K: sol.K, F: sol.F, etiquetas: etiquetasGdl },
              {
                id: 'resuelto',
                nombre: 'Sistema resuelto',
                descripcion: e.metodo === 'eliminacion' ? 'Sin las filas y columnas de los grados de libertad restringidos.' : 'Con la penalización β en la diagonal de los apoyos.',
                K: sol.system.K,
                F: sol.system.F,
                etiquetas: sol.system.free.map((d) => etiquetasGdl[d]),
              },
            ]}
            u={sol.u}
            etiquetasU={etiquetasGdl}
            elementos={sol.bars.map((b) => ({ nombre: `Barra ${b.id}: nodos ${b.i + 1}–${b.j + 1}`, Ke: b.ke, gdl: b.dofs.map((d) => etiquetasGdl[d]) }))}
          />
        </Seccion>
      )}
      </div>
      </div>

    </Pagina>
  );
}

function Quitar({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-2 hover:border-danger hover:text-danger"
    >
      <Icon name="delete" className="text-[18px]" />
    </button>
  );
}

function Inspector({
  e,
  sel,
  un,
  sol,
  escalaF,
  escalaU,
}: {
  e: EstadoArmadura;
  sel: Seleccion;
  un: { long: string; fuerza: string; esfuerzo: string };
  sol?: import('../../core').TrussSolution;
  escalaF: number;
  escalaU: number;
}) {
  if (!sel) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line bg-s1 px-3 py-2">
        <Icon name="touch_app" className="text-[18px] text-accent-hover" />
        <span className="font-mono text-mini text-ink-2">Toca un nodo o una barra del plano.</span>
      </div>
    );
  }
  if (sel.tipo === 'nodo') {
    const n = e.nodos[sel.i];
    if (!n) return null;
    const ap = e.apoyos.find((a) => a.nodo === sel.i);
    const rc = sol?.reactions.find((x) => x.node === sel.i);
    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl border border-accent/50 bg-accent-bg px-3 py-2 font-mono text-mini">
        <span className="col-span-2 font-bold text-accent-soft">
          Nodo {sel.i + 1} · ({n.x}, {n.y}) {un.long}
          {ap ? ` · ${APOYOS[ap.tipo].nombre}` : ''}
        </span>
        {sol && (
          <>
            <span className="text-ink-2">uₓ = {fmtNum(snap(sol.u[2 * sel.i], escalaU), 5)}</span>
            <span className="text-ink-2">u_y = {fmtNum(snap(sol.u[2 * sel.i + 1], escalaU), 5)}</span>
            {rc && <span className="text-amber-soft">Rₓ = {rc.Rx === null ? '—' : fmtNum(snap(rc.Rx, escalaF), 5)}</span>}
            {rc && <span className="text-amber-soft">R_y = {rc.Ry === null ? '—' : fmtNum(snap(rc.Ry, escalaF), 5)}</span>}
          </>
        )}
      </div>
    );
  }
  const b = sol?.bars[sel.i];
  const bb = e.barras[sel.i];
  if (!bb) return null;
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl border border-accent/50 bg-accent-bg px-3 py-2 font-mono text-mini">
      <span className="col-span-2 font-bold text-accent-soft">
        Barra {sel.i + 1} · nodos {bb.i + 1}–{bb.j + 1}
      </span>
      {b && (
        <>
          <span className="text-ink-2">L = {fmtNum(b.L, 5)} {un.long}</span>
          <span className="text-ink-2">θ = {fmtNum((Math.atan2(b.s, b.c) * 180) / Math.PI, 4)}°</span>
          <span className={b.estado === 'compresión' ? 'text-compress' : 'text-amber-soft'}>
            N = {fmtNum(snap(b.N, escalaF), 5)} {un.fuerza}
          </span>
          <span className="text-ink-2">{b.estado}</span>
          <span className="col-span-2 text-ink-2">
            σ = {fmtNum(b.sigma, 5)} {un.esfuerzo}
          </span>
        </>
      )}
    </div>
  );
}
