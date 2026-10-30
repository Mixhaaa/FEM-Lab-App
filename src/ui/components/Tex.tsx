import katex from 'katex';
import { memo } from 'react';

/** Fórmula con KaTeX. */
export const Tex = memo(function Tex({ children, display, className }: { children: string; display?: boolean; className?: string }) {
  const html = katex.renderToString(children, { displayMode: !!display, throwOnError: false, strict: 'ignore', trust: false });
  const Tag = display ? 'div' : 'span';
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});

/** Número en formato LaTeX (m \times 10^{n}). */
export function texNum(v: number, sig = 4): string {
  if (!Number.isFinite(v)) return '\\text{—}';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e-3 && a < 1e5) return String(Number(v.toPrecision(sig)));
  const [m, e] = v.toExponential(sig - 1).split('e');
  return `${Number(m)}\\times 10^{${Number(e)}}`;
}

/** Matriz o vector en LaTeX (bmatrix). */
export function texMatriz(M: number[][], sig = 4): string {
  return `\\begin{bmatrix} ${M.map((r) => r.map((v) => texNum(v, sig)).join(' & ')).join(' \\\\ ')} \\end{bmatrix}`;
}

export function texVector(v: number[], sig = 4): string {
  return texMatriz(
    v.map((x) => [x]),
    sig,
  );
}
