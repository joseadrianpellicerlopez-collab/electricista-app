import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AccesoPresupuestos from '../components/AccesoPresupuestos';
import CatalogoPresupuestos from '../components/CatalogoPresupuestos';
import { cacheKey, crearAlmacen, conflicto } from '../lib/presupuestosNube';
import { CATEGORIAS, calcular, decimal, euros, nuevoPresupuesto, validarPresupuesto } from '../lib/presupuestos';

const campo = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
const boton = 'rounded-xl bg-blue-800 px-4 py-3 font-semibold text-white hover:bg-blue-900 disabled:opacity-50';

function leer(owner) {
  try {
    const raw = localStorage.getItem(cacheKey(owner));
    const data = raw ? JSON.parse(raw) : null;
    if (data && !Array.isArray(data.borrador?.lineas)) throw new Error();
    return { borrador: data?.borrador || nuevoPresupuesto(), version: data?.version || 0, pendiente: data?.pendiente || false };
  } catch {
    return { borrador: nuevoPresupuesto(), version: 0, pendiente: false, error: 'No se ha podido leer la copia local. Los datos de Supabase se cargarán al conectar.' };
  }
}

function Modal({ titulo, cerrar, ocupado, children }) {
  const ref = useRef(null), id = useId();
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!ocupado) cerrar(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 dark:bg-slate-900 dark:text-white">
    <div className="mb-5 flex items-center justify-between gap-4"><h2 id={id} className="text-xl font-bold">{titulo}</h2><button type="button" onClick={cerrar} disabled={ocupado} aria-label="Cerrar ventana" className="rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button></div>
    <fieldset disabled={ocupado} className="min-w-0">{children}</fieldset>
  </dialog>;
}

export default function Presupuestos() {
  return <AccesoPresupuestos>{user => <EditorPresupuestos key={user.id} user={user} />}</AccesoPresupuestos>;
}

function EditorPresupuestos({ user }) {
  const [inicio] = useState(() => leer(user.id));
  const [almacen] = useState(() => crearAlmacen(user.id));
  const [productos, setProductos] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [subcategoria, setSubcategoria] = useState(null);
  const [editarGrupo, setEditarGrupo] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [listo, setListo] = useState(false);
  const [pendiente, setPendiente] = useState(inicio.pendiente);
  const [ocupado, setOcupado] = useState(false);
  const cambios = useRef(0);
  const [draft, setDraft] = useState(inicio.borrador);
  const [error, setError] = useState(inicio.error || '');
  const [aviso, setAviso] = useState('');
  const [categoria, setCategoria] = useState('climatizacion');
  const [busqueda, setBusqueda] = useState('');
  const [producto, setProducto] = useState(null);
  const [linea, setLinea] = useState(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [documentos, setDocumentos] = useState(null);
  const urls = useRef([]);

  useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)), []);

  useEffect(() => {
    let activo = true;
    async function conectar() {
      try {
        await almacen.importarLocal();
        const data = await almacen.cargar();
        if (!activo) return;
        setProductos(data.productos); setSubcategorias(data.subcategorias);
        setHistorial(data.documentos.map(d => ({ ...d.contenido, guardado: d.updated_at })));
        const remoto = data.documentos.find(d => d.id === inicio.borrador.id);
        if (inicio.pendiente) {
          almacen.ponerVersion(inicio.borrador.id, inicio.version);
          setDraft(inicio.borrador);
        } else {
          const elegido = remoto || data.documentos[0];
          setDraft(elegido ? elegido.contenido : nuevoPresupuesto());
        }
        setListo(true);
        setAviso('Conectado. Tus tarjetas y presupuestos están disponibles en tu cuenta.');
      } catch {
        if (activo) setError('No se ha podido conectar o recuperar la copia local. Tus datos se conservan. Recarga para volver a intentarlo.');
      }
    }
    conectar();
    return () => { activo = false; };
  }, [almacen, inicio]);

  function guardarCache(doc, sinSincronizar) {
    try { localStorage.setItem(cacheKey(user.id), JSON.stringify({ borrador: doc, version: almacen.version(doc.id), pendiente: sinSincronizar })); }
    catch { setError('No se puede guardar la copia local en este navegador. Mantén la página abierta hasta que se confirme el guardado en Supabase.'); }
  }

  function cambiarDraft(next) {
    cambios.current += 1;
    setDraft(next); setDocumentos(null); setPendiente(true);
    guardarCache(next, true);
    setAviso('Cambios pendientes de sincronizar…');
  }
  const cambiar = (campo, value) => cambiarDraft({ ...draft, [campo]: value });

  async function guardarActual(doc = draft) {
    const secuencia = cambios.current;
    const saved = await almacen.guardarPresupuesto(doc);
    setHistorial(actual => [{ ...saved.contenido, guardado: saved.updated_at }, ...actual.filter(p => p.id !== doc.id)]);
    if (secuencia === cambios.current) {
      setPendiente(false); guardarCache(doc, false); setError('');
      setAviso('Guardado en Supabase. Disponible en tus otros dispositivos.');
    }
    return saved;
  }

  useEffect(() => {
    if (!listo || !pendiente || ocupado || generando) return;
    const timer = setTimeout(() => { guardarActual(draft).catch(e => { setError(e.message === conflicto ? conflicto : 'No se ha podido sincronizar. El borrador se conserva en este dispositivo. Pulsa Reintentar cuando tengas conexión.'); }); }, 900);
    return () => clearTimeout(timer);
    // The timeout follows the current draft; writes are serialized by the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, listo, pendiente, ocupado, generando]);

  useEffect(() => {
    if (!listo || pendiente || ocupado || generando || producto || linea || verHistorial || editarGrupo) return;
    let activo = true;
    async function refrescar() {
      if (document.visibilityState !== 'visible') return;
      const secuencia = cambios.current;
      try {
        const data = await almacen.cargar(false);
        if (!activo || cambios.current !== secuencia) return;
        almacen.adoptar(data);
        setProductos(data.productos); setSubcategorias(data.subcategorias);
        setHistorial(data.documentos.map(d => ({ ...d.contenido, guardado: d.updated_at })));
        const current = data.documentos.find(d => d.id === draft.id);
        if (current) { setDraft(current.contenido); setDocumentos(null); }
      } catch { /* Keep the local view until the next refresh or explicit retry. */ }
    }
    window.addEventListener('focus', refrescar);
    document.addEventListener('visibilitychange', refrescar);
    return () => { activo = false; window.removeEventListener('focus', refrescar); document.removeEventListener('visibilitychange', refrescar); };
  }, [almacen, listo, pendiente, ocupado, generando, producto, linea, verHistorial, editarGrupo, draft.id]);

  async function actualizar() {
    setOcupado(true);
    try {
      if (pendiente) await guardarActual();
      const data = await almacen.cargar();
      setProductos(data.productos); setSubcategorias(data.subcategorias); setHistorial(data.documentos.map(d => ({ ...d.contenido, guardado: d.updated_at })));
      const current = data.documentos.find(d => d.id === draft.id);
      if (current) { setDraft(current.contenido); guardarCache(current.contenido, false); }
      setError(''); setAviso('Actualizado desde Supabase.');
    } catch (e) { setError(e.message === conflicto ? conflicto : 'No se ha podido actualizar. Revisa tu conexión.'); }
    finally { setOcupado(false); }
  }

  async function salir() {
    setOcupado(true);
    try {
      if (pendiente) await guardarActual();
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch { setError('No se ha podido guardar y cerrar la sesión. Reintenta la sincronización antes de salir.'); setOcupado(false); }
  }

  async function abrir(p) {
    setOcupado(true);
    try {
      if (pendiente) await guardarActual();
      const data = await almacen.cargar();
      const elegido = data.documentos.find(d => d.id === p.id);
      if (!elegido) throw new Error('El presupuesto se ha borrado desde otro dispositivo. Actualiza la lista.');
      cambios.current += 1; setPendiente(false); setDraft(elegido.contenido); guardarCache(elegido.contenido, false); setDocumentos(null); setVerHistorial(false); setError('');
    } catch (e) { setError(e.message || 'No se ha podido abrir el presupuesto.'); }
    finally { setOcupado(false); }
  }

  async function borrarPresupuesto(p) {
    if (!window.confirm('¿Borrar este presupuesto de tu cuenta y de todos tus dispositivos?')) return;
    setOcupado(true);
    try {
      if (pendiente) await guardarActual();
      await almacen.borrarPresupuesto(p.id);
      setHistorial(actual => actual.filter(x => x.id !== p.id));
      if (draft.id === p.id) { const empty = nuevoPresupuesto(); cambios.current += 1; setPendiente(false); setDraft(empty); guardarCache(empty, false); setDocumentos(null); }
      setError('');
    } catch (e) { setError(e.message || 'No se ha podido borrar el presupuesto.'); }
    finally { setOcupado(false); }
  }

  async function guardarProducto(event) {
    event.preventDefault();
    const precio = decimal(producto.importe);
    if (!producto.nombre.trim() || !Number.isFinite(precio) || precio < 0 || precio > 99999999) { setError('Escribe un nombre y un precio válido, con un máximo de dos decimales.'); return; }
    const mismo = productos.some(p => p.id !== producto.id && p.categoria === producto.categoria && (p.subcategoria_id || null) === (producto.subcategoria_id || null) && p.nombre.trim().toLocaleLowerCase('es') === producto.nombre.trim().toLocaleLowerCase('es'));
    if (mismo) { setError('Ya existe una tarjeta con ese nombre en esta categoría.'); return; }
    const data = { id: producto.id || crypto.randomUUID(), nombre: producto.nombre.trim(), precio: Math.round(precio * 100), categoria: producto.categoria, subcategoria_id: producto.subcategoria_id || null };
    setOcupado(true);
    try {
      const saved = await almacen.guardarProducto(data);
      setProductos(actual => producto.id ? actual.map(p => p.id === producto.id ? saved : p) : [...actual, saved]);
      setProducto(null); setError(''); setAviso('Tarjeta guardada en Supabase. Disponible en tus otros dispositivos.');
    } catch (e) { setError(e.message || 'No se ha podido guardar la tarjeta.'); }
    finally { setOcupado(false); }
  }

  async function guardarSubcategoria(event) {
    event.preventDefault();
    const nombre = editarGrupo.nombre.trim();
    if (!nombre || nombre.length > 80) { setError('Escribe un nombre de hasta 80 caracteres.'); return; }
    if (subcategorias.some(c => c.id !== editarGrupo.id && c.categoria === editarGrupo.categoria && c.nombre.trim().toLocaleLowerCase('es') === nombre.toLocaleLowerCase('es'))) { setError('Ya existe una subcategoría con ese nombre.'); return; }
    setOcupado(true);
    try {
      const saved = await almacen.guardarSubcategoria({ ...editarGrupo, id: editarGrupo.id || crypto.randomUUID(), nombre });
      setSubcategorias(actual => editarGrupo.id ? actual.map(c => c.id === saved.id ? saved : c) : [...actual, saved]);
      setCategoria(saved.categoria); setSubcategoria(saved.id); setBusqueda(''); setEditarGrupo(null); setError(''); setAviso('Subcategoría guardada en tu cuenta. Ya puedes añadir productos dentro.');
    } catch (e) { setError(e.message || 'No se ha podido guardar la subcategoría.'); }
    finally { setOcupado(false); }
  }

  async function borrarSubcategoria() {
    if (productos.some(p => p.subcategoria_id === editarGrupo.id)) { setError('Mueve los productos a otra subcategoría antes de borrar esta.'); return; }
    if (!window.confirm(`¿Borrar la subcategoría «${editarGrupo.nombre}»?`)) return;
    setOcupado(true);
    try {
      await almacen.borrarSubcategoria(editarGrupo.id);
      setSubcategorias(actual => actual.filter(c => c.id !== editarGrupo.id));
      if (subcategoria === editarGrupo.id) setSubcategoria(null);
      setEditarGrupo(null); setError(''); setAviso('Subcategoría eliminada.');
    } catch (e) { setError(e.message || 'No se ha podido borrar la subcategoría.'); }
    finally { setOcupado(false); }
  }

  async function borrarProducto() {
    if (!window.confirm(`¿Borrar la tarjeta «${producto.nombre}»? Los presupuestos que ya la incluyen se conservan.`)) return;
    setOcupado(true);
    try {
      await almacen.borrarProducto(producto.id);
      setProductos(actual => actual.filter(p => p.id !== producto.id)); setProducto(null); setError('');
    } catch (e) { setError(e.message || 'No se ha podido borrar la tarjeta.'); }
    finally { setOcupado(false); }
  }

  function añadir(p) {
    const existente = draft.lineas.find(l => l.productoId === p.id);
    if (existente && (!Number.isFinite(decimal(existente.cantidad)) || decimal(existente.cantidad) <= 0)) { setLinea({ ...existente }); return; }
    const next = existente ? draft.lineas.map(l => l.id === existente.id ? { ...l, cantidad: String(Math.round((decimal(l.cantidad) + 1) * 100) / 100) } : l) : [...draft.lineas, { id: crypto.randomUUID(), productoId: p.id, nombre: p.nombre, precio: p.precio, cantidad: '1' }];
    cambiarDraft({ ...draft, lineas: next });
    setAviso(`${p.nombre} añadido al presupuesto.`);
  }

  function guardarLinea(event) {
    event.preventDefault();
    if (!Number.isFinite(decimal(linea.cantidad)) || decimal(linea.cantidad) <= 0 || decimal(linea.cantidad) > 999999) { setError('Introduce una cantidad mayor que cero, con un máximo de dos decimales.'); return; }
    cambiarDraft({ ...draft, lineas: draft.lineas.map(l => l.id === linea.id ? { ...l, cantidad: String(decimal(linea.cantidad)) } : l) });
    setLinea(null);
  }

  async function nuevo() {
    setOcupado(true);
    try {
      if (pendiente || draft.lineas.length || draft.cliente.trim()) await guardarActual();
      const empty = nuevoPresupuesto();
      cambios.current += 1; setPendiente(false); setDraft(empty); guardarCache(empty, false); setDocumentos(null); setError(''); setAviso('Nuevo presupuesto. El anterior está guardado en tu cuenta.');
    } catch (e) { setError(e.message || 'No se ha podido guardar el presupuesto anterior.'); }
    finally { setOcupado(false); }
  }

  async function generar() {
    const fallo = validarPresupuesto(draft);
    if (fallo) { setError(fallo); return; }
    if (generando) return;
    setGenerando(true); setError(''); setAviso('Preparando Excel y PDF con tu plantilla…');
    try {
      const { generarArchivos } = await import('../lib/exportarPresupuesto');
      const result = await generarArchivos(draft);
      let guardado = false;
      try { await guardarActual(); guardado = true; }
      catch (e) { setError(e.message === conflicto ? conflicto : 'Los archivos están listos, pero el presupuesto sigue pendiente de sincronizar.'); }
      urls.current.forEach(url => URL.revokeObjectURL(url));
      const excel = URL.createObjectURL(result.excel), pdf = URL.createObjectURL(result.pdf);
      urls.current = [excel, pdf];
      setDocumentos({ excel, pdf });
      setAviso(guardado ? 'Presupuesto generado y guardado en Supabase.' : 'Archivos generados. Descárgalos; el borrador se conserva localmente hasta sincronizar.');
    } catch (e) { setError(e.message || 'No se ha podido generar el presupuesto. Inténtalo de nuevo.'); setAviso(''); }
    finally { setGenerando(false); }
  }

  const total = calcular(draft.lineas, Number(draft.iva));
  const fileName = `Presupuesto-${draft.numero.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const nuevoProducto = () => { if (subcategoria === null) return; setError(''); setProducto({ nombre: '', importe: '', categoria, subcategoria_id: subcategoria === 'sin-clasificar' ? null : subcategoria }); };
  const nuevaSubcategoria = () => { setError(''); setEditarGrupo({ nombre: '', categoria }); };

  return <div className="min-h-screen bg-slate-50 pb-28 text-slate-900 dark:bg-slate-950 dark:text-white">
    <header className="bg-blue-950 px-5 py-6 text-white"><div className="mx-auto max-w-6xl">
      <Link to="/" className="inline-block py-2 text-sm text-blue-200">← Volver al inicio</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-blue-200">De la tarjeta al presupuesto</p><h1 className="text-3xl font-bold">Presupuestos rápidos</h1></div><div className="flex gap-2"><button disabled={generando || ocupado || !listo} onClick={() => setVerHistorial(true)} className="rounded-xl border border-white/30 px-4 py-2 text-sm">Guardados ({historial.length})</button><button disabled={generando || ocupado || !listo} onClick={nuevo} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-950">+ Nuevo</button></div></div>
    </div></header>
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-5">
      <fieldset disabled={generando || ocupado || !listo} className="min-w-0 space-y-6">
      <p className="text-sm text-slate-600 dark:text-slate-300">Tus tarjetas y presupuestos se guardan en tu cuenta de Supabase. Usa el mismo correo en todos tus dispositivos. Los precios no incluyen IVA.</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {!listo && <p role="status" className="text-sm">Conectando y recuperando los datos guardados…</p>}
      <div className="flex flex-wrap items-center gap-3 text-sm"><span className="break-all">{user.email}</span><button disabled={ocupado || generando || !listo} onClick={actualizar} className="font-semibold text-blue-700 dark:text-blue-200">Actualizar</button><button disabled={ocupado || generando || !listo} onClick={salir} className="text-slate-500 dark:text-slate-300">Cerrar sesión</button>{pendiente && <span className="text-amber-700 dark:text-amber-300">Pendiente de sincronizar</span>}</div>
      {pendiente && error && <div className="flex flex-wrap gap-3"><button onClick={() => guardarActual().catch(e => setError(e.message || 'No se ha podido sincronizar.'))} className={boton}>Reintentar</button><button onClick={() => cambiarDraft({ ...draft, id: crypto.randomUUID(), numero: `${draft.numero.slice(0,22)}-copia` })} className="rounded-xl border px-4 py-3">Guardar como copia</button></div>}

      <p role="status" className="text-sm text-blue-700 dark:text-blue-200">{aviso}</p>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <CatalogoPresupuestos productos={productos} subcategorias={subcategorias} lineas={draft.lineas} categoria={categoria}
          seleccionarCategoria={id => { setCategoria(id); setSubcategoria(null); setBusqueda(''); }}
          subcategoria={subcategoria} seleccionarSubcategoria={setSubcategoria} busqueda={busqueda} buscar={setBusqueda}
          crearSubcategoria={nuevaSubcategoria} editarSubcategoria={grupo => { setError(''); setEditarGrupo({ ...grupo }); }}
          crearProducto={nuevoProducto} editarProducto={p => { setError(''); setProducto({ ...p, importe: String(p.precio / 100) }); }} añadir={añadir} />

        <section aria-label="Presupuesto actual" className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-xl font-bold">Tu presupuesto</h2>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Referencia<input maxLength={28} value={draft.numero} onChange={e => cambiar('numero', e.target.value)} className={campo} /></label><label className="text-sm">Fecha<input type="date" value={draft.fecha} onChange={e => cambiar('fecha', e.target.value)} className={campo} /></label></div>
          <label className="block text-sm">Cliente<input maxLength={80} value={draft.cliente} onChange={e => cambiar('cliente', e.target.value)} placeholder="Nombre del cliente" className={campo} /></label>
          <details><summary className="cursor-pointer text-sm font-medium text-blue-700 dark:text-blue-200">Más datos del cliente (opcional)</summary><div className="mt-3 space-y-3">
            <label className="block text-sm">NIF/CIF<input maxLength={30} value={draft.nif} onChange={e => cambiar('nif', e.target.value)} className={campo} /></label>
            <label className="block text-sm">Dirección<input maxLength={120} value={draft.direccion} onChange={e => cambiar('direccion', e.target.value)} className={campo} /></label>
            <label className="block text-sm">Teléfono o correo<input maxLength={80} value={draft.contacto} onChange={e => cambiar('contacto', e.target.value)} className={campo} /></label>
          </div></details>
          <div className="space-y-3" aria-label="Conceptos del presupuesto">{draft.lineas.map(l => <div key={l.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <div className="flex items-start justify-between gap-3"><p className="min-w-0 break-words font-medium">{l.nombre}</p><strong className="shrink-0">{euros(Math.round(l.precio * decimal(l.cantidad)))}</strong></div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{l.cantidad} × {euros(l.precio)}</p>
            <div className="mt-2 flex gap-4 text-sm"><button aria-label={`Editar cantidad de ${l.nombre}`} onClick={() => { setError(''); setLinea({ ...l }); }} className="font-semibold text-blue-700 dark:text-blue-200">Editar cantidad</button><button aria-label={`Quitar ${l.nombre} del presupuesto`} onClick={() => cambiar('lineas', draft.lineas.filter(x => x.id !== l.id))} className="text-slate-500 dark:text-slate-300">Quitar</button></div>
          </div>)}</div>
          {!draft.lineas.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-300">Pulsa las tarjetas para añadir conceptos aquí.</p>}
          <label className="block text-sm">Observaciones (opcional)<textarea maxLength={500} rows={3} value={draft.observaciones} onChange={e => cambiar('observaciones', e.target.value)} className={campo} placeholder="Condiciones, qué incluye el trabajo…" /></label>
          <details><summary className="cursor-pointer text-sm font-medium text-blue-700 dark:text-blue-200">IVA y datos para el pago</summary><div className="mt-3 space-y-3"><label className="block text-sm">IVA (%)<input type="number" min="0" max="100" step="0.01" value={draft.iva} onChange={e => cambiar('iva', e.target.value)} className={campo} /></label><label className="block text-sm">Datos para el pago (opcional)<input maxLength={120} value={draft.pago} onChange={e => cambiar('pago', e.target.value)} className={campo} /></label></div></details>
          <dl className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700"><div className="flex justify-between"><dt>Base imponible</dt><dd>{euros(total.base)}</dd></div><div className="flex justify-between text-sm text-slate-500 dark:text-slate-300"><dt>IVA ({draft.iva || 0} %)</dt><dd>{euros(total.impuesto)}</dd></div><div className="flex justify-between text-2xl font-bold"><dt>Total</dt><dd>{euros(total.total)}</dd></div></dl>
          <button onClick={generar} disabled={generando || !draft.lineas.length} className={`${boton} w-full`}>{generando ? 'Generando…' : 'Generar presupuesto'}</button>
          {documentos && <div className="space-y-3 rounded-2xl bg-blue-50 p-4 dark:bg-blue-950"><p className="font-semibold">Listo con tu plantilla y tu logo</p><div className="flex flex-wrap gap-3"><a href={documentos.pdf} download={`${fileName}.pdf`} className={boton}>Descargar PDF</a><a href={documentos.excel} download={`${fileName}.xlsx`} className="rounded-xl border border-blue-300 px-4 py-3 font-semibold">Descargar Excel</a><a href={documentos.pdf} target="_blank" rel="noreferrer" className="px-2 py-3 text-sm underline">Ver PDF</a></div></div>}
        </section>
      </div>
      </fieldset>
    </main>

    {editarGrupo && <Modal titulo={editarGrupo.id ? 'Editar subcategoría' : 'Nueva subcategoría'} ocupado={ocupado} cerrar={() => setEditarGrupo(null)}><form onSubmit={guardarSubcategoria} className="space-y-4"><p className="text-sm text-slate-500 dark:text-slate-300">Dentro de {CATEGORIAS.find(c => c.id === editarGrupo.categoria)?.nombre}</p><label className="block text-sm">Nombre de la subcategoría<input autoFocus required maxLength={80} value={editarGrupo.nombre} onChange={e => setEditarGrupo({ ...editarGrupo, nombre: e.target.value })} placeholder="Ej.: instalaciones, reparaciones…" className={campo} /></label>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<button disabled={ocupado} className={`${boton} w-full`}>{ocupado ? 'Guardando…' : 'Guardar subcategoría'}</button>{editarGrupo.id && <><p className="text-xs text-slate-500 dark:text-slate-300">Para borrarla, mueve antes sus productos a otra subcategoría.</p><button type="button" disabled={ocupado || productos.some(p => p.subcategoria_id === editarGrupo.id)} onClick={borrarSubcategoria} className="w-full py-2 text-sm text-red-600 disabled:opacity-40">Borrar subcategoría</button></>}</form></Modal>}
    {producto && <Modal titulo={producto.id ? 'Editar tarjeta' : 'Nueva tarjeta'} ocupado={ocupado} cerrar={() => setProducto(null)}><form onSubmit={guardarProducto} className="space-y-4">
      <label className="block text-sm">Nombre del producto o servicio<input autoFocus required maxLength={160} value={producto.nombre} onChange={e => setProducto({ ...producto, nombre: e.target.value })} className={campo} /></label>
      <label className="block text-sm">Precio por unidad, sin IVA (€)<input required inputMode="decimal" placeholder="0,00" value={producto.importe} onChange={e => setProducto({ ...producto, importe: e.target.value })} className={campo} /></label>
      <label className="block text-sm">Categoría<select value={producto.categoria} onChange={e => setProducto({ ...producto, categoria: e.target.value, subcategoria_id: null })} className={campo}>{CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
      <label className="block text-sm">Subcategoría<select required={!producto.id && subcategoria !== 'sin-clasificar'} value={producto.subcategoria_id || ''} onChange={e => setProducto({ ...producto, subcategoria_id: e.target.value || null })} className={campo}><option value="">{producto.id || subcategoria === 'sin-clasificar' ? 'Sin clasificar' : 'Selecciona una subcategoría'}</option>{subcategorias.filter(c => c.categoria === producto.categoria).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
      <p className="text-xs text-slate-500 dark:text-slate-300">Cambiar el precio de la tarjeta no modifica los conceptos que ya has añadido a un presupuesto.</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button disabled={ocupado} className={`${boton} w-full`}>{ocupado ? 'Guardando…' : 'Guardar tarjeta'}</button>
      {producto.id && <button type="button" disabled={ocupado} onClick={borrarProducto} className="w-full py-2 text-sm text-red-600">Borrar tarjeta</button>}
    </form></Modal>}
    {linea && <Modal titulo="Editar cantidad" cerrar={() => setLinea(null)}><form onSubmit={guardarLinea} className="space-y-4"><p className="font-medium">{linea.nombre}</p><p>{euros(linea.precio)} por unidad, sin IVA</p><label className="block text-sm">Cantidad<input autoFocus required inputMode="decimal" value={linea.cantidad} onChange={e => setLinea({ ...linea, cantidad: e.target.value })} className={campo} /></label>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<button className={`${boton} w-full`}>Guardar cantidad</button></form></Modal>}
    {verHistorial && <Modal titulo="Presupuestos guardados" ocupado={ocupado} cerrar={() => setVerHistorial(false)}><p className="mb-4 text-sm text-slate-500 dark:text-slate-300">Guardados en tu cuenta. Pulsa Actualizar en la pantalla principal para ver los cambios de otros dispositivos.</p><div className="space-y-3">{historial.map(p => <div key={p.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><p className="font-bold">{p.numero}</p><p className="break-words text-sm">{p.cliente || 'Sin cliente'} · {p.fecha}</p><p className="my-2">{euros(calcular(p.lineas, Number(p.iva)).total)}</p><div className="flex gap-5"><button className="font-semibold text-blue-700 dark:text-blue-200" disabled={ocupado} onClick={() => abrir(p)}>Abrir</button><button className="text-sm text-red-600" disabled={ocupado} onClick={() => borrarPresupuesto(p)}>Borrar</button></div></div>)}{!historial.length && <p className="text-sm">Los presupuestos aparecerán aquí al guardarse en tu cuenta.</p>}</div></Modal>}
  </div>;
}
