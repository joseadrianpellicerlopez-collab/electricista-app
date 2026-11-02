export function trimestreActual(fecha) {
  const [year, month] = fecha.split('-').map(Number);
  const numero = Math.floor((month - 1) / 3) + 1;
  const mes = (numero - 1) * 3 + 1;
  const desde = `${year}-${String(mes).padStart(2, '0')}-01`;
  const hasta = numero === 4 ? `${year + 1}-01-01` : `${year}-${String(mes + 3).padStart(2, '0')}-01`;
  const meses = ['enero–marzo', 'abril–junio', 'julio–septiembre', 'octubre–diciembre'];
  return { desde, hasta, etiqueta: `${numero}.º trimestre de ${year} · ${meses[numero - 1]}` };
}
