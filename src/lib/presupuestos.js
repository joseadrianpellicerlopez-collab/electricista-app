export const CATEGORIAS = [
  { id: 'climatizacion', nombre: 'Climatización', icono: '❄️' },
  { id: 'electricidad', nombre: 'Electricidad', icono: '⚡' },
  { id: 'otros', nombre: 'Otros servicios', icono: '🛠️' },
];

export const euros = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value / 100);

const ordenAlfabetico = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
export const compararNombre = (a, b) => ordenAlfabetico.compare(a.nombre.trim(), b.nombre.trim());

export function decimal(value) {
  const text = String(value).trim().replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(text) ? Number(text) : NaN;
}

export function calcular(lineas, iva) {
  const importes = lineas.map(linea => Math.round(linea.precio * decimal(linea.cantidad)));
  const base = importes.reduce((sum, value) => sum + value, 0);
  const impuesto = Math.round(base * iva / 100);
  return { importes, base, impuesto, total: base + impuesto };
}

export function validarPresupuesto(draft) {
  if (!draft.cliente.trim()) return 'Escribe el nombre del cliente.';
  if (!draft.numero.trim()) return 'Escribe el número o referencia del presupuesto.';
  if (!draft.fecha) return 'Selecciona la fecha.';
  if (!draft.lineas.length) return 'Añade al menos un producto o servicio.';
  if (String(draft.iva).trim() === '' || !Number.isFinite(Number(draft.iva)) || draft.iva < 0 || draft.iva > 100) return 'Revisa el porcentaje de IVA.';
  if (draft.lineas.some(l => !l.nombre.trim() || !Number.isSafeInteger(l.precio) || l.precio < 0 || !Number.isFinite(decimal(l.cantidad)) || decimal(l.cantidad) <= 0)) return 'Todas las cantidades deben ser mayores que cero, con un máximo de dos decimales.';
  const total = calcular(draft.lineas, Number(draft.iva));
  if (!Number.isSafeInteger(total.total) || total.total > 99999999999) return 'El importe es demasiado grande. Revisa los precios y cantidades.';
  return '';
}

export function nuevoPresupuesto() {
  const date = new Date();
  const fecha = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { id: crypto.randomUUID(), numero: `P-${fecha.replaceAll('-', '')}-${Date.now().toString().slice(-5)}`, fecha, cliente: '', nif: '', direccion: '', contacto: '', observaciones: '', pago: '', iva: 21, lineas: [] };
}

export function partirTexto(texto, max = 48) {
  const resultado = [];
  for (const parrafo of String(texto || '').split('\n')) {
    let resto = parrafo;
    while (resto.length > max) {
      const espacio = resto.lastIndexOf(' ', max);
      const corte = espacio > max / 2 ? espacio : max;
      resultado.push(resto.slice(0, corte));
      resto = resto.slice(corte).trimStart();
    }
    resultado.push(resto);
  }
  return resultado;
}

export function paginar(lineas) {
  const paginas = [];
  let pagina = [], huecos = 0;
  for (const linea of lineas) {
    const alto = partirTexto(linea.nombre).length;
    if (huecos + alto > 25 && pagina.length) { paginas.push(pagina); pagina = []; huecos = 0; }
    pagina.push(linea); huecos += alto;
  }
  if (pagina.length) paginas.push(pagina);
  return paginas;
}
