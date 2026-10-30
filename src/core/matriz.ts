/** Propiedades de una matriz para mostrarlas junto al gráfico tipo spy. */

export interface InfoMatriz {
  filas: number;
  columnas: number;
  /** Número de entradas distintas de cero. */
  nnz: number;
  /** nnz / (filas·columnas). */
  densidad: number;
  /** max |i − j| entre las entradas no nulas. */
  anchoBanda: number;
  simetrica: boolean;
  diagonalDominante: boolean;
  /** Coordenadas (fila, columna) de las entradas no nulas. */
  noNulos: [number, number][];
}

export function infoMatriz(M: number[][], tolRel = 1e-12): InfoMatriz {
  const filas = M.length;
  const columnas = M[0]?.length ?? 0;
  let escala = 0;
  for (const r of M) for (const v of r) escala = Math.max(escala, Math.abs(v));
  const tol = tolRel * escala;
  const noNulos: [number, number][] = [];
  let anchoBanda = 0;
  let simetrica = filas === columnas;
  let dominante = filas === columnas;
  for (let i = 0; i < filas; i++) {
    let fuera = 0;
    for (let j = 0; j < columnas; j++) {
      const v = M[i][j];
      if (Math.abs(v) > tol) {
        noNulos.push([i, j]);
        anchoBanda = Math.max(anchoBanda, Math.abs(i - j));
      }
      if (simetrica && j > i && Math.abs(v - M[j][i]) > 1e-10 * Math.max(escala, 1e-300)) simetrica = false;
      if (j !== i) fuera += Math.abs(v);
    }
    if (dominante && Math.abs(M[i][i]) < fuera * (1 - 1e-12)) dominante = false;
  }
  return {
    filas,
    columnas,
    nnz: noNulos.length,
    densidad: filas * columnas ? noNulos.length / (filas * columnas) : 0,
    anchoBanda,
    simetrica,
    diagonalDominante: dominante,
    noNulos,
  };
}
