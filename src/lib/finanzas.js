import { supabase } from './supabase';

export const nombreCategoria = valor => String(valor || '').trim().replace(/\s+/g, ' ');
export const claveCategoria = (nombre, ingreso) => `${ingreso ? 'ingreso' : 'gasto'}:${nombreCategoria(nombre).normalize('NFC').toLocaleLowerCase('es')}`;
export const dinero = centimos => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(centimos / 100);
export const centimos = valor => Math.round(Number(valor) * 100);
export const fechaHoy = () => fechaRegistro({ created_at: new Date().toISOString() });

export function fechaRegistro(movimiento) {
  if (movimiento.fecha) return movimiento.fecha;
  if (!movimiento.created_at) return '';
  const date = new Date(movimiento.created_at);
  if (Number.isNaN(date.getTime())) return '';
  const partes = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const parte = tipo => partes.find(p => p.type === tipo).value;
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

export function mostrarFecha(fecha) {
  return fecha ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(`${fecha}T12:00:00`)) : 'Sin fecha';
}

export function agruparMovimientos(movimientos) {
  const grupos = new Map();
  for (const m of movimientos) {
    const ingreso = m.tipo === 'ingreso';
    const nombre = nombreCategoria(m.categoria) || nombreCategoria(m.concepto) || 'Sin categoría';
    const key = claveCategoria(nombre, ingreso);
    if (!grupos.has(key)) grupos.set(key, { key, nombre, ingreso, total: 0, registros: [] });
    const grupo = grupos.get(key);
    grupo.total += centimos(m.cantidad);
    grupo.registros.push({ ...m, fecha: fechaRegistro(m) });
  }
  for (const g of grupos.values()) g.registros.sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.created_at || '').localeCompare(String(a.created_at || '')) || Number(b.id) - Number(a.id));
  const orden = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
  return [...grupos.values()].sort((a, b) => orden.compare(a.nombre, b.nombre));
}

export function importeValido(texto) {
  const value = String(texto).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const cantidad = Number(value);
  return cantidad > 0 && cantidad <= 999999999 ? cantidad : null;
}

export function crearRepositorioFinanzas(client = supabase) {
  async function listar() {
    const filas = [];
    for (let inicio = 0; ; inicio += 500) {
      const { data, error } = await client.from('finanzas').select('*').order('fecha', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).range(inicio, inicio + 499);
      if (error) throw error;
      filas.push(...data);
      if (data.length < 500) return filas;
    }
  }
  async function escribir(datos, id) {
    const consulta = id == null ? client.from('finanzas').insert(datos) : client.from('finanzas').update(datos).eq('id', id);
    const { data, error } = await consulta.select('*').single();
    if (error) throw error;
    return data;
  }
  async function borrar(id) {
    const { data, error } = await client.from('finanzas').delete().eq('id', id).select('id').single();
    if (error || !data) throw error || new Error('El movimiento ya no existe.');
  }
  return { listar, escribir, borrar };
}
export const repositorioFinanzas = crearRepositorioFinanzas();
