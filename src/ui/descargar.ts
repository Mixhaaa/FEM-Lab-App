/** Descarga de archivos generados en el navegador. */

export function descargar(nombre: string, contenido: string, tipo = 'text/plain;charset=utf-8') {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nombre válido como identificador de MATLAB: minúsculas, sin tildes, guiones bajos. */
export function nombreBase(...partes: string[]): string {
  const s = partes
    .filter(Boolean)
    .join('_')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[a-z]/.test(s) ? s : `femlab_${s}`;
}
