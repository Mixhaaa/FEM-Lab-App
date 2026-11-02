import { compileExpr } from '../../core';
import { EJEMPLOS_RESORTES, SISTEMAS, UNIDADES_RESORTES, type EstadoResortes } from '../../templates';
import { Aviso, Badge, Boton, Campo, Desplazable, Icon, Segmentos, Seccion, Selector } from '../components/base';
import { DiagramaResortes } from '../components/DiagramaResortes';
import { Columnas, Pagina, TituloPagina } from '../components/Shell';
import { useResultadoResortes } from '../resultado';
import { ir } from '../router';
import { useApp } from '../store';

function errNum(v: string): string | null {
  try {
    const ce = compileExpr(v, 'El valor');
    return ce.constant ? null : 'Debe ser un número.';
  } catch (e) {
    return (e as Error).message.replace(/^El valor /, '');
  }
}

function Quitar({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-field text-ink-2 hover:border-danger hover:text-danger"
    >
      <Icon name="delete" className="text-[18px]" />
    </button>
  );
}

export function ConfigResortes() {
  const e = useApp((s) => s.resortes);
  const setR = useApp((s) => s.setResortes);
  const cargar = useApp((s) => s.cargar);
  const ejemplo = useApp((s) => s.ejemplo.resortes);
  const restablecer = useApp((s) => s.restablecer);
  const r = useResultadoResortes();
  const un = UNIDADES_RESORTES[e.sistema];
  const upd = (f: (e: EstadoResortes) => void) =>
    setR((p) => {
      const c = structuredClone(p);
      f(c);
      return c;
    });
  const nodos = Array.from({ length: e.nNodos }, (_, i) => ({ valor: i, texto: String(i + 1) }));

  return (
    <Pagina amplia>
      <TituloPagina
        etiquetas={
          <>
            <Badge>Fase 01 · Modelado</Badge>
            <Badge tono="neutral">Rigidez directa</Badge>
          </>
        }
        titulo="Sistema de resortes"
        subtitulo="Resortes lineales: cada uno aporta k[1 −1; −1 1] a la matriz global."
      />
      <Columnas
        fija="principal"
        anchoLateral="lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        principal={
          <>
      <Desplazable etiqueta="Diagrama de los resortes" className="rounded-xl border border-line bg-s2 p-3 shadow-card">
        <div className="rounded-lg border border-line bg-inset p-2">
          <DiagramaResortes e={e} />
        </div>
      </Desplazable>
      {!r.ok && (
        <Aviso tipo="error" titulo="Hay un dato por corregir">
          {r.error.message}
        </Aviso>
      )}
          </>
        }
        lateral={
          <>
      <div className="flex flex-col gap-3">
        <Seccion icon="functions" titulo="1. Ejemplo y unidades" subtitulo="Casos precargados">
          <Selector
            label="Ejemplo precargado"
            value={EJEMPLOS_RESORTES.some((x) => x.id === ejemplo) ? ejemplo : ''}
            onChange={(id) => id && cargar('resortes', id)}
            opciones={[{ valor: '', texto: '— Personalizado —' }, ...EJEMPLOS_RESORTES.map((x) => ({ valor: x.id, texto: x.nombre }))]}
          />
          <Segmentos label="Sistema de unidades" value={e.sistema} onChange={(v) => upd((c) => void (c.sistema = v))} opciones={(['SI', 'mm'] as const).map((x) => ({ valor: x, texto: SISTEMAS[x].nombre }))} />
        </Seccion>

        <Seccion icon="linear_scale" titulo="2. Nodos y resortes" subtitulo={`${e.nNodos} nodos · ${e.resortes.length} resortes`}>
          <div className="flex items-center justify-between rounded-lg border border-line bg-inset p-3">
            <span className="text-cuerpo font-bold text-ink">Número de nodos</span>
            <div className="flex items-center gap-2">
              <Boton variante="secundario" icon="remove" className="h-9 min-h-0 w-9 px-0" title="Quitar nodo" disabled={e.nNodos <= 2} onClick={() => upd((c) => {
                c.nNodos--;
                c.resortes = c.resortes.filter((s) => s.i < c.nNodos && s.j < c.nNodos);
                c.apoyos = c.apoyos.filter((a) => a.nodo < c.nNodos);
                c.cargas = c.cargas.filter((a) => a.nodo < c.nNodos);
              })} />
              <span className="w-8 text-center font-mono text-seccion font-bold text-accent-soft">{e.nNodos}</span>
              <Boton variante="secundario" icon="add" className="h-9 min-h-0 w-9 px-0" title="Agregar nodo" disabled={e.nNodos >= 30} onClick={() => upd((c) => void c.nNodos++)} />
            </div>
          </div>
          {e.resortes.map((s, k) => (
            <div key={k} className="grid grid-cols-[1fr_1fr_1.2fr_auto] items-end gap-2 rounded-lg border border-line bg-inset p-3">
              <Selector label={`k${k + 1}: nodo i`} value={s.i} onChange={(v) => upd((c) => void (c.resortes[k].i = v))} opciones={nodos} />
              <Selector label="nodo j" value={s.j} onChange={(v) => upd((c) => void (c.resortes[k].j = v))} opciones={nodos} />
              <Campo label="Rigidez k" value={s.k} unidad={un.rigidez} inputMode="decimal" error={errNum(s.k)} onChange={(v) => upd((c) => void (c.resortes[k].k = v))} />
              <Quitar label={`Quitar resorte ${k + 1}`} onClick={() => upd((c) => void c.resortes.splice(k, 1))} />
            </div>
          ))}
          <Boton variante="secundario" icon="add" onClick={() => upd((c) => void c.resortes.push({ i: Math.max(0, c.nNodos - 2), j: c.nNodos - 1, k: '1000' }))}>
            Agregar resorte
          </Boton>
        </Seccion>

        <Seccion icon="lock" titulo="3. Apoyos" subtitulo="Nodos con desplazamiento impuesto">
          {e.apoyos.map((a, k) => (
            <div key={k} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-lg border border-line bg-inset p-3">
              <Selector label="Nodo" value={a.nodo} onChange={(v) => upd((c) => void (c.apoyos[k].nodo = v))} opciones={nodos} />
              <Campo label="Desplazamiento" value={a.valor} unidad={un.long} inputMode="decimal" error={errNum(a.valor)} onChange={(v) => upd((c) => void (c.apoyos[k].valor = v))} />
              <Quitar label={`Quitar apoyo ${k + 1}`} onClick={() => upd((c) => void c.apoyos.splice(k, 1))} />
            </div>
          ))}
          <Boton variante="secundario" icon="add" onClick={() => upd((c) => void c.apoyos.push({ nodo: 0, valor: '0' }))}>
            Agregar apoyo
          </Boton>
        </Seccion>

        <Seccion icon="north_east" titulo="4. Cargas nodales" subtitulo="Positivas hacia +x" tono="amber">
          {e.cargas.map((a, k) => (
            <div key={k} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-lg border border-line bg-inset p-3">
              <Selector label="Nodo" value={a.nodo} onChange={(v) => upd((c) => void (c.cargas[k].nodo = v))} opciones={nodos} />
              <Campo label="Fuerza P" value={a.P} unidad={un.fuerza} inputMode="decimal" error={errNum(a.P)} onChange={(v) => upd((c) => void (c.cargas[k].P = v))} />
              <Quitar label={`Quitar carga ${k + 1}`} onClick={() => upd((c) => void c.cargas.splice(k, 1))} />
            </div>
          ))}
          <Boton variante="secundario" icon="add" onClick={() => upd((c) => void c.cargas.push({ nodo: c.nNodos - 1, P: '100' }))}>
            Agregar carga
          </Boton>
        </Seccion>

        <Seccion icon="tune" titulo="5. Método" subtitulo="Cómo se imponen los apoyos" abierta={false}>
          <Segmentos
            value={e.metodo}
            onChange={(v) => upd((c) => void (c.metodo = v))}
            opciones={[
              { valor: 'eliminacion', texto: 'Eliminación' },
              { valor: 'penalizacion', texto: 'Penalización' },
            ]}
          />
        </Seccion>
      </div>
      <div className="flex flex-col gap-3 pt-1">
        <Boton variante="primario" icon="play_circle" disabled={!r.ok} onClick={() => ir('resultados')} className="py-4">
          Resolver sistema [K]{'{u}'} = {'{F}'}
        </Boton>
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
