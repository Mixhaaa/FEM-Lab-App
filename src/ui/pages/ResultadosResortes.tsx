import { Badge, Card, CardHeader, Icon, Kpi, Tabla } from '../components/base';
import { DiagramaResortes } from '../components/DiagramaResortes';
import { PanelMatrices } from '../components/PanelMatrices';
import { PanelExportar } from '../components/PanelExportar';
import { archivosResortes } from '../exportables';
import { useApp } from '../store';
import { Pagina } from '../components/Shell';
import { fmtNum, snap, sub } from '../format';
import { useResultadoResortes } from '../resultado';
import { SinResultado } from './Resultados';

export function ResultadosResortes() {
  const r = useResultadoResortes();
  const ejemplo = useApp((s) => s.ejemplo.resortes);
  if (!r.ok) return <SinResultado error={r.error} />;
  const { sol, unidades: un, estado: e } = r.res;
  const escalaF = Math.max(...sol.springs.map((s) => Math.abs(s.force)), 1e-300);
  const escalaU = Math.max(...sol.u.map(Math.abs), 1e-300);
  return (
    <Pagina amplia>
      <div className="flex items-center gap-3 rounded-xl border border-line bg-s2 px-4 py-3 shadow-card">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/40 bg-accent-bg text-accent-soft">
          <Icon name="linear_scale" className="text-[20px]" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-heading text-seccion font-bold text-ink">Sistema de resortes</p>
          <p className="truncate font-mono text-mini text-ink-2">
            {e.nNodos} nodos · {e.resortes.length} resortes · {e.apoyos.length} apoyo(s)
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-6">
      <Card className="flex flex-col gap-3 p-4">
        <CardHeader icon="insights" title="Configuración deformada" subtitle="Los círculos punteados marcan la posición desplazada (escala exagerada)." />
        <div className="scroll-x rounded-xl border border-line bg-inset p-2">
          <DiagramaResortes e={e} u={sol.u} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {r.res.kpis.map((k, i) => (
          <Kpi key={k.id} titulo={k.nombre} simbolo={k.simbolo} valor={fmtNum(k.valor, 5)} unidad={k.unidad} detalle={k.detalle} tono={i ? 'amber' : 'accent'} icon="pin_drop" />
        ))}
      </div>

      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line bg-s1 p-4">
          <div className="flex items-center gap-2">
            <Icon name="table_chart" className="text-[22px] text-accent-hover" />
            <h3 className="font-heading text-seccion font-bold text-ink">Desplazamientos y reacciones</h3>
          </div>
          <Badge>{e.nNodos} nodos</Badge>
        </div>
        <Tabla
          cabecera={['Nodo', `u [${un.long}]`, `Carga [${un.fuerza}]`, `Reacción [${un.fuerza}]`]}
          alinear={['left', 'right', 'right', 'right']}
          filas={sol.u.map((v, i) => {
            const reac = sol.reactions.find((x) => x.node === i);
            return [
              <span key="n" className="font-bold text-accent-soft">N{sub(i + 1)}</span>,
              fmtNum(snap(v, escalaU), 6),
              fmtNum(sol.F[i], 5),
              reac ? <span key="r" className="text-amber-soft">{fmtNum(snap(reac.value, escalaF), 6)}</span> : '—',
            ];
          })}
        />
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line bg-s1 p-4">
          <Icon name="linear_scale" className="text-[22px] text-accent-hover" />
          <h3 className="font-heading text-seccion font-bold text-ink">Fuerzas en los resortes</h3>
        </div>
        <Tabla
          cabecera={['Resorte', 'Nodos', `k [${un.rigidez}]`, `Δ = uj − ui [${un.long}]`, `f = k·Δ [${un.fuerza}]`, 'Estado']}
          alinear={['left', 'center', 'right', 'right', 'right', 'left']}
          filas={sol.springs.map((sp) => [
            <span key="k" className="font-bold text-accent-soft">k{sub(sp.id)}</span>,
            `${sp.i + 1}–${sp.j + 1}`,
            fmtNum(sp.k, 5),
            fmtNum(snap(sp.elong, escalaU), 5),
            fmtNum(snap(sp.force, escalaF), 6),
            Math.abs(sp.force) < 1e-9 * escalaF ? 'sin carga' : sp.force > 0 ? 'tracción' : 'compresión',
          ])}
        />
      </Card>

      </div>

      <PanelMatrices
        sistemas={[
          { id: 'global', nombre: 'K global', descripcion: 'Antes de imponer los apoyos.', K: sol.K, F: sol.F },
          { id: 'resuelto', nombre: 'Sistema resuelto', descripcion: 'Después de imponer los apoyos.', K: sol.system.K, F: sol.system.F, etiquetas: sol.system.free.map((i) => i + 1) },
        ]}
        u={sol.u}
        elementos={sol.springs.map((sp) => ({ nombre: `Resorte ${sp.id}: nodos ${sp.i + 1}–${sp.j + 1}`, Ke: sp.ke, gdl: [sp.i + 1, sp.j + 1] }))}
      />

      <Card className="flex flex-col gap-2 p-4">
        <CardHeader
          icon="balance"
          title="Equilibrio global"
          subtitle="Σ cargas + Σ reacciones"
          right={<Badge tono={Math.abs(sol.equilibrium) <= 1e-8 * escalaF ? 'ok' : 'danger'}>{fmtNum(snap(sol.equilibrium, escalaF), 3)}</Badge>}
        />
      </Card>
      <PanelExportar archivos={archivosResortes(r.res, ejemplo)} />
    </Pagina>
  );
}
