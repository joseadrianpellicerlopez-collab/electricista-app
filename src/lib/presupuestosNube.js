import { supabase } from './supabase';

export const LEGACY_KEY = 'electricista.presupuestos.v1';
export const cacheKey = owner => `electricista.presupuestos.nube.v1.${owner}`;
export const conflicto = 'Se ha modificado desde otro dispositivo. Tu borrador sigue a salvo. Guarda una copia para conservar tus cambios.';

export function crearAlmacen(owner, client = supabase) {
  const versiones = { presupuesto_productos: new Map(), presupuestos: new Map(), presupuesto_subcategorias: new Map() };
  let cola = Promise.resolve();
  const serializar = fn => {
    const tarea = cola.catch(() => {}).then(fn);
    cola = tarea;
    return tarea;
  };
  async function listar(tabla) {
    const filas = [];
    for (let inicio = 0; ; inicio += 500) {
      const { data, error } = await client.from(tabla).select('*').eq('owner_id', owner).order('updated_at', { ascending: false }).order('id').range(inicio, inicio + 499);
      if (error) throw error;
      filas.push(...data);
      if (data.length < 500) break;
    }
    return filas;
  }
  function adoptar(data) {
    for (const fila of data.productos) versiones.presupuesto_productos.set(fila.id, fila.version);
    for (const fila of data.documentos) versiones.presupuestos.set(fila.id, fila.version);
    for (const fila of data.subcategorias || []) versiones.presupuesto_subcategorias.set(fila.id, fila.version);
  }
  async function cargar(actualizarVersiones = true) {
    const [productos, documentos, subcategorias] = await Promise.all([listar('presupuesto_productos'), listar('presupuestos'), listar('presupuesto_subcategorias')]);
    const data = { productos, documentos, subcategorias };
    if (actualizarVersiones) adoptar(data);
    return data;
  }
  function ponerVersion(id, version) { versiones.presupuestos.set(id, version); }
  function version(id) { return versiones.presupuestos.get(id) || 0; }

  function guardar(tabla, id, valores) {
    return serializar(async () => {
      const anterior = versiones[tabla].get(id) || 0;
      const payload = { ...valores, owner_id: owner, id, version: anterior + 1, updated_at: new Date().toISOString() };
      const consulta = anterior ? client.from(tabla).update(payload).eq('owner_id', owner).eq('id', id).eq('version', anterior) : client.from(tabla).insert(payload);
      const { data, error } = await consulta.select('*').maybeSingle();
      if (error?.code === '23505' && tabla === 'presupuesto_productos') throw new Error('Ya existe una tarjeta con ese nombre. Actualiza la lista para verla.');
      if (error?.code === '23505' && tabla === 'presupuesto_subcategorias') throw new Error('Ya existe una subcategoría con ese nombre. Actualiza la lista para verla.');
      if (!data && (!error || error.code === '23505')) throw new Error(conflicto);
      if (error) throw error;
      versiones[tabla].set(id, data.version);
      return data;
    });
  }
  const guardarPresupuesto = draft => guardar('presupuestos', draft.id, { contenido: draft });
  const guardarProducto = p => guardar('presupuesto_productos', p.id, { nombre: p.nombre, categoria: p.categoria, precio: p.precio, subcategoria_id: p.subcategoria_id || null });
  const guardarSubcategoria = s => guardar('presupuesto_subcategorias', s.id, { nombre: s.nombre, categoria: s.categoria });
  function borrar(tabla, id) {
    return serializar(async () => {
      const anterior = versiones[tabla].get(id);
      const { data, error } = await client.from(tabla).delete().eq('owner_id', owner).eq('id', id).eq('version', anterior || 0).select('id').maybeSingle();
      if (error?.code === '23503') throw new Error('Esta subcategoría contiene productos. Muévelos a otra subcategoría antes de borrarla.');
      if (error) throw error;
      if (!data) throw new Error('El registro ha cambiado en otro dispositivo. Actualiza la lista antes de borrarlo.');
      versiones[tabla].delete(id);
    });
  }

  async function importarLocal() {
    const marcador = `${LEGACY_KEY}.importado.${owner}`;
    if (localStorage.getItem(marcador)) return;
    const asignado = localStorage.getItem(`${LEGACY_KEY}.owner`);
    if (asignado && asignado !== owner) return;
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const origen = JSON.parse(raw);
    if (!Array.isArray(origen.productos) || !Array.isArray(origen.historial) || !Array.isArray(origen.borrador?.lineas)) throw new Error('No se ha podido recuperar la copia local. Se conserva sin modificar.');
    // Reserve this legacy copy for the first account used on this browser.
    localStorage.setItem(`${LEGACY_KEY}.owner`, owner);
    const actual = await cargar();
    const normalizar = p => `${p.categoria}:${p.nombre.trim().toLocaleLowerCase('es')}`;
    const equivalentes = new Map(actual.productos.map(p => [normalizar(p), p.id]));
    const ids = new Map();
    for (const p of origen.productos) {
      const existente = equivalentes.get(normalizar(p));
      if (existente) { ids.set(p.id, existente); continue; }
      const { error } = await client.from('presupuesto_productos').upsert({ owner_id: owner, id: p.id, nombre: p.nombre, categoria: p.categoria, precio: p.precio }, { onConflict: 'owner_id,id', ignoreDuplicates: true });
      if (error) throw error;
      equivalentes.set(normalizar(p), p.id); ids.set(p.id, p.id);
    }
    const documentos = new Map(origen.historial.map(p => [p.id, p]));
    if (origen.borrador.lineas.length || origen.borrador.cliente?.trim()) documentos.set(origen.borrador.id, origen.borrador);
    for (const p of documentos.values()) {
      const contenido = { ...p, lineas: p.lineas.map(l => ({ ...l, productoId: ids.get(l.productoId) || l.productoId })) };
      const { error } = await client.from('presupuestos').upsert({ owner_id: owner, id: p.id, contenido }, { onConflict: 'owner_id,id', ignoreDuplicates: true });
      if (error) throw error;
    }
    localStorage.setItem(marcador, '1');
  }
  return { cargar, adoptar, version, ponerVersion, guardarPresupuesto, guardarProducto, guardarSubcategoria, importarLocal, borrarSubcategoria: id => borrar('presupuesto_subcategorias', id), borrarProducto: id => borrar('presupuesto_productos', id), borrarPresupuesto: id => borrar('presupuestos', id) };
}
