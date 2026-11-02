/** Panel de matrices: spy, propiedades, tablas de K, F y u, matrices elementales y copia en formato MATLAB. */
import { useMemo, useState } from 'react';
import { infoMatriz } from '../../core';
import { matrizMatlab, vectorMatlab } from '../../export/matlab-texto';
import { fmtNum } from '../format';
import { Badge, Boton, Card, CardHeader, Selector } from './base';
import { MatrizTabla, VectorTabla } from './Matriz';
import { Spy } from './Spy';

export interface SistemaMostrado {
  id: string;
  nombre: string;
  descripcion: string;
  K: number[][];
  F: number[];
  /** Etiquetas de filas/columnas (por defecto 1..n). */
  etiquetas?: (string | number)[];
}

export interface ElementoMostrado {
  nombre: string;
  Ke: number[][];
  Fe?: number[];
  /** Grados de libertad globales a los que va (1-based). */
  gdl: (string | number)[];
}

export function BotonCopiar({ texto, etiqueta = 'Copiar' }: { texto: string; etiqueta?: string }) {
  const [ok, setOk] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setOk(true);
    setTimeout(() => setOk(false), 1500);
  };
  return (
    <Boton variante="fantasma" icon={ok ? 'check_circle' : 'content_copy'} onClick={copiar} className="px-3 text-detalle">
      {ok ? 'Copiado' : etiqueta}
    </Boton>
  );
}

export function PanelMatrices({
  sistemas,
  u,
  etiquetasU,
  elementos,
}: {
  sistemas: SistemaMostrado[];
  u: number[];
  etiquetasU?: (string | number)[];
  elementos?: ElementoMostrado[];
}) {
  const [id, setId] = useState(sistemas[0].id);
  const [el, setEl] = useState(0);
  const s = sistemas.find((x) => x.id === id) ?? sistemas[0];
  const info = useMemo(() => infoMatriz(s.K), [s.K]);
  const e = elementos?.[Math.min(el, (elementos?.length ?? 1) - 1)];
  const grande = s.K.length > 40;

  return (
    <>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <Card className="flex flex-col gap-3 p-4">
        <CardHeader icon="grid_4x4" title="Matriz global" subtitle={s.descripcion} />
        {sistemas.length > 1 && <Selector etiqueta="Versión de la matriz" value={s.id} onChange={setId} opciones={sistemas.map((x) => ({ valor: x.id, texto: x.nombre }))} />}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start lg:flex-col lg:items-center">
          <div className="w-full max-w-[340px] rounded-xl border border-line bg-inset p-2">
            <Spy info={info} M={s.K} titulo={s.nombre} />
          </div>
          <div className="flex w-full flex-col gap-2">
            <p className="text-detalle font-semibold text-ink-2">Estructura (como spy de MATLAB)</p>
            <div className="flex flex-wrap gap-2">
              <Badge>
                {info.filas} × {info.columnas}
              </Badge>
              <Badge tono="neutral">nnz = {info.nnz}</Badge>
              <Badge tono="neutral">densidad {fmtNum(100 * info.densidad, 3)} %</Badge>
              <Badge tono="neutral">ancho de banda {info.anchoBanda}</Badge>
              <Badge tono={info.simetrica ? 'ok' : 'amber'}>{info.simetrica ? 'simétrica' : 'no simétrica'}</Badge>
              <Badge tono={info.diagonalDominante ? 'ok' : 'amber'}>{info.diagonalDominante ? 'diagonal dominante' : 'no diagonal dominante'}</Badge>
            </div>
            <p className="text-mini leading-snug text-ink-2">
              {info.anchoBanda === 1
                ? 'Tridiagonal: cada nodo solo se conecta con sus vecinos, por eso se puede usar el algoritmo de Thomas.'
                : `Matriz en banda: el ancho de banda (${info.anchoBanda}) depende de cómo se numeran los nodos.`}{' '}
              <span className="text-accent-soft">●</span> positivos, <span className="text-compress">●</span> negativos.
            </p>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <CardHeader icon="table_chart" title={`K (${s.nombre.toLowerCase()})`} subtitle={grande ? 'Se muestran las primeras 40 filas y columnas; la copia incluye la matriz completa.' : 'Valores con 5 cifras significativas.'} right={<BotonCopiar texto={matrizMatlab('Kglob', s.K)} etiqueta="MATLAB" />} />
        <MatrizTabla M={s.K} filas={s.etiquetas} columnas={s.etiquetas} max={40} />
      </Card>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">

      <Card className="flex flex-col gap-3 p-4">
        <CardHeader icon="view_column" title="Vectores F y u" subtitle="Lado derecho del sistema y solución nodal" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-mini font-bold text-ink-2">F ({s.nombre.toLowerCase()})</span>
              <BotonCopiar texto={vectorMatlab('Vglob', s.F)} etiqueta="MATLAB" />
            </div>
            <VectorTabla v={s.F} etiquetas={s.etiquetas} sig={6} />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-mini font-bold text-ink-2">u (todos los nodos)</span>
              <BotonCopiar texto={vectorMatlab('u', u)} etiqueta="MATLAB" />
            </div>
            <VectorTabla v={u} etiquetas={etiquetasU} sig={6} />
          </div>
        </div>
      </Card>

      {elementos && elementos.length > 0 && e && (
        <Card className="flex flex-col gap-3 p-4">
          <CardHeader icon="grid_view" title="Matrices elementales" subtitle="Antes de ensamblarse en K" right={<BotonCopiar texto={matrizMatlab('Ke', e.Ke)} etiqueta="MATLAB" />} />
          <Selector etiqueta="Elemento" value={Math.min(el, elementos.length - 1)} onChange={setEl} opciones={elementos.map((x, i) => ({ valor: i, texto: x.nombre }))} />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <MatrizTabla M={e.Ke} titulo={`Ke · GDL globales ${e.gdl.join(', ')}`} filas={e.gdl} columnas={e.gdl} sig={6} />
            {e.Fe && <VectorTabla v={e.Fe} titulo="Fe" etiquetas={e.gdl} sig={6} />}
          </div>
        </Card>
      )}
      </div>
    </>
  );
}
