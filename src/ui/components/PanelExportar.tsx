/** Centro de exportación: CSV, reporte PDF, MATLAB y Python. */
import { useState } from 'react';
import type { FormatoCSV } from '../../export/csv';
import { descargar } from '../descargar';
import { ir } from '../router';
import { Card, CardHeader, cx, Icon, Segmentos } from './base';

export interface ArchivoExportable {
  id: string;
  titulo: string;
  subtitulo: string;
  icon: string;
  nombre: string;
  mime: string;
  csv?: boolean;
  generar: (formato: FormatoCSV) => string;
}

function BotonExportar({ icon, titulo, sub, onClick, color }: { icon: string; titulo: string; sub: string; onClick: () => void; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl border border-line bg-inset p-3 text-left transition hover:border-accent-hover/70 hover:bg-s3"
    >
      <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-s2 transition-transform group-hover:scale-105', color ?? 'text-accent-soft')}>
        <Icon name={icon} className="text-[22px]" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-mono text-xs font-bold text-ink">{titulo}</span>
        <span className="truncate text-[11px] text-ink-2">{sub}</span>
      </span>
    </button>
  );
}

export function PanelExportar({ archivos }: { archivos: ArchivoExportable[] }) {
  const [formato, setFormato] = useState<FormatoCSV>('estandar');
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const exportar = (a: ArchivoExportable) => {
    try {
      descargar(a.nombre, a.generar(formato), a.mime);
      setAviso({ ok: true, texto: `Listo: ${a.nombre}` });
    } catch (e) {
      setAviso({ ok: false, texto: `No se pudo generar ${a.nombre}: ${(e as Error).message}` });
    }
    setTimeout(() => setAviso(null), 4000);
  };

  return (
    <Card className="no-print flex flex-col gap-3 p-4">
      <CardHeader icon="ios_share" title="Exportación y scripts" subtitle="Resultados, memoria de cálculo y código equivalente" />
      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 min-[480px]:gap-3">
        <BotonExportar icon="picture_as_pdf" titulo="Reporte PDF" sub="Memoria de cálculo" color="text-accent" onClick={() => ir('reporte')} />
        {archivos.map((a) => (
          <BotonExportar key={a.id} icon={a.icon} titulo={a.titulo} sub={a.subtitulo} onClick={() => exportar(a)} color={a.csv ? 'text-amber-soft' : undefined} />
        ))}
      </div>
      <Segmentos
        label="Formato de los CSV"
        value={formato}
        onChange={setFormato}
        opciones={[
          { valor: 'estandar', texto: 'Estándar  , .' },
          { valor: 'excel-es', texto: 'Excel español  ; ,' },
        ]}
      />
      <p className="-mt-1 text-[11px] text-ink-3">Estándar sirve para MATLAB (readmatrix), Python y Google Sheets. «Excel en español» abre directo en Excel con coma decimal.</p>
      {aviso && (
        <div role="status" className={cx('flex items-center gap-2 rounded-xl border p-3 font-mono text-xs', aviso.ok ? 'border-ok/40 bg-ok/10 text-ink' : 'border-danger/50 bg-danger-bg text-danger')}>
          <Icon name={aviso.ok ? 'check_circle' : 'error'} className={cx('text-[18px]', aviso.ok ? 'text-ok' : 'text-danger')} />
          {aviso.texto}
        </div>
      )}
    </Card>
  );
}
