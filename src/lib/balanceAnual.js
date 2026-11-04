export function balanceAnual(movimientos, hoy, obtenerFecha = m => m.fecha || '') {
  const year = Number(hoy.slice(0, 4));
  const desde = `${year}-01-01`, hasta = `${year + 1}-01-01`;
  let gastos = 0, ingresos = 0;
  for (const movimiento of movimientos) {
    const fecha = obtenerFecha(movimiento);
    if (fecha < desde || fecha >= hasta) continue;
    const importe = Math.round(Number(movimiento.cantidad) * 100);
    if (movimiento.tipo === 'ingreso') ingresos += importe;
    else gastos += importe;
  }
  return { year, gastos, ingresos, balance: ingresos - gastos };
}
