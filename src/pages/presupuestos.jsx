import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIAS, calcular, decimal, euros, nuevoPresupuesto, validarPresupuesto } from '../lib/presupuestos';

const KEY = 'electricista.presupuestos.v1';
const campo = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
const boton = 'rounded-xl bg-blue-800 px-4 py-3 font-semibold text-white hover:bg-blue-900 disabled:opacity-50';

function leer() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { productos: [], historial: [], borrador: nuevoPresupuesto(), error: '' };
    const data = JSON.parse(raw);
    if (!Array.isArray(data.productos) || !Array.isArray(data.historial) || !Array.isArray(data.borrador?.lineas)) throw new Error();
    if (data.productos.some(p => !p.id || typeof p.nombre !== 'string' || !Number.isSafeInteger(p.precio) || !CATEGORIAS.some(c => c.id === p.categoria))) throw new Error();
    return { ...data, error: '' };
  } catch {
    return { productos: [], historial: [], borrador: nuevoPresupuesto(), error: 'No se han podido leer los presupuestos guardados. No se sobrescribirán. Recarga la página o revisa el almacenamiento del navegador.' };
  }
}

function Modal({ titulo, cerrar, ocupado, children }) {
  const ref = useRef(null), id = useId();
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!ocupado) cerrar(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 dark:bg-slate-900 dark:text-white">
    <div className="mb-5 flex items-center justify-between gap-4"><h2 id={id} className="text-xl font-bold">{titulo}</h2><button type="button" onClick={cerrar} disabled={ocupado} aria-label="Cerrar ventana" className="rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button></div>
    {children}
  </dialog>;
}

export default function Presupuestos() {
  const [inicio] = useState(leer);
  const [productos, setProductos] = useState(inicio.productos);
  const [historial, setHistorial] = useState(inicio.historial);
  const [draft, setDraft] = useState(inicio.borrador);
  const [error, setError] = useState(inicio.error);
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

  function guardar(data) {
    if (inicio.error) { setError(inicio.error); return false; }
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch { setError('No se han podido guardar los cambios en este dispositivo. No cierres la página; libera espacio o permite el almacenamiento y vuelve a intentarlo.'); return false; }
  }

  function cambiarDraft(next) {
    setDraft(next); setDocumentos(null); setAviso('');
    if (guardar({ productos, historial, borrador: next })) { setError(''); setAviso('Borrador guardado en este dispositivo.'); }
  }
  const cambiar = (campo, value) => cambiarDraft({ ...draft, [campo]: value });

  function guardarProducto(event) {
    event.preventDefault();
    const precio = decimal(producto.importe);
    if (!producto.nombre.trim() || !Number.isFinite(precio) || precio < 0 || precio > 99999999) { setError('Escribe un nombre y un precio válido, con un máximo de dos decimales.'); return; }
    const mismo = productos.some(p => p.id !== producto.id && p.categoria === producto.categoria && p.nombre.trim().toLocaleLowerCase('es') === producto.nombre.trim().toLocaleLowerCase('es'));
    if (mismo) { setError('Ya existe una tarjeta con ese nombre en esta categoría.'); return; }
    const data = { id: producto.id || crypto.randomUUID(), nombre: producto.nombre.trim(), precio: Math.round(precio * 100), categoria: producto.categoria };
    const next = producto.id ? productos.map(p => p.id === producto.id ? data : p) : [...productos, data];
    if (!guardar({ productos: next, historial, borrador: draft })) return;
    setProductos(next); setProducto(null); setError(''); setAviso('Tarjeta guardada. Su precio se utilizará en los próximos presupuestos.');
  }

  function borrarProducto() {
    if (!window.confirm(`¿Borrar la tarjeta «${producto.nombre}»? Los presupuestos que ya la incluyen se conservan.`)) return;
    const next = productos.filter(p => p.id !== producto.id);
    if (guardar({ productos: next, historial, borrador: draft })) { setProductos(next); setProducto(null); setError(''); }
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

  function nuevo() {
    if (draft.lineas.length && !window.confirm('¿Empezar un presupuesto nuevo? El borrador actual se conservará en Guardados.')) return;
    const next = draft.lineas.length ? [{ ...draft, guardado: new Date().toISOString() }, ...historial.filter(p => p.id !== draft.id)] : historial;
    const empty = nuevoPresupuesto();
    if (guardar({ productos, historial: next, borrador: empty })) { setHistorial(next); setDraft(empty); setDocumentos(null); setError(''); setAviso('Nuevo presupuesto.'); }
  }

  async function generar() {
    const fallo = validarPresupuesto(draft);
    if (fallo) { setError(fallo); return; }
    if (generando) return;
    setGenerando(true); setError(''); setAviso('Preparando Excel y PDF con tu plantilla…');
    try {
      const { generarArchivos } = await import('../lib/exportarPresupuesto');
      const result = await generarArchivos(draft);
      const next = [{ ...draft, guardado: new Date().toISOString() }, ...historial.filter(p => p.id !== draft.id)];
      const guardado = guardar({ productos, historial: next, borrador: draft });
      if (guardado) setHistorial(next);
      urls.current.forEach(url => URL.revokeObjectURL(url));
      const excel = URL.createObjectURL(result.excel), pdf = URL.createObjectURL(result.pdf);
      urls.current = [excel, pdf];
      setDocumentos({ excel, pdf });
      setAviso(guardado ? 'Presupuesto generado y guardado en este dispositivo.' : 'Archivos generados. Descárgalos; el borrador no se ha podido guardar.');
    } catch (e) { setError(e.message || 'No se ha podido generar el presupuesto. Inténtalo de nuevo.'); setAviso(''); }
    finally { setGenerando(false); }
  }

  const visibles = productos.filter(p => p.categoria === categoria && p.nombre.toLocaleLowerCase('es').includes(busqueda.trim().toLocaleLowerCase('es')));
  const total = calcular(draft.lineas, Number(draft.iva));
  const fileName = `Presupuesto-${draft.numero.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const nuevoProducto = () => { setError(''); setProducto({ nombre: '', importe: '', categoria }); };

  return <div className="min-h-screen bg-slate-50 pb-28 text-slate-900 dark:bg-slate-950 dark:text-white">
    <header className="bg-blue-950 px-5 py-6 text-white"><div className="mx-auto max-w-6xl">
      <Link to="/" className="inline-block py-2 text-sm text-blue-200">← Volver al inicio</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-blue-200">De la tarjeta al presupuesto</p><h1 className="text-3xl font-bold">Presupuestos rápidos</h1></div><div className="flex gap-2"><button disabled={generando} onClick={() => setVerHistorial(true)} className="rounded-xl border border-white/30 px-4 py-2 text-sm">Guardados ({historial.length})</button><button disabled={generando} onClick={nuevo} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-950">+ Nuevo</button></div></div>
    </div></header>
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-5">
      <fieldset disabled={generando} className="min-w-0 space-y-6">
      <p className="text-sm text-slate-600 dark:text-slate-300">Tus tarjetas y presupuestos se guardan en este dispositivo. Los precios de las tarjetas no incluyen IVA.</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <p role="status" className="text-sm text-blue-700 dark:text-blue-200">{aviso}</p>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="space-y-5" aria-label="Catálogo de productos">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Mis productos y servicios</h2><button onClick={nuevoProducto} className={boton}>+ Crear tarjeta</button></div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Categorías">{CATEGORIAS.map(c => <button key={c.id} aria-pressed={categoria === c.id} onClick={() => setCategoria(c.id)} className={`rounded-xl px-2 py-3 text-xs font-semibold sm:text-sm ${categoria === c.id ? 'bg-blue-800 text-white' : 'border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}><span aria-hidden="true">{c.icono}</span> {c.nombre}</button>)}</div>
          <input type="search" aria-label="Buscar tarjeta" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar producto o servicio…" className={campo} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">{visibles.map(p => {
            const seleccionada = draft.lineas.find(l => l.productoId === p.id);
            return <article key={p.id} className={`overflow-hidden rounded-2xl border ${seleccionada ? 'border-blue-600 bg-blue-50 dark:bg-blue-950' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
              <button onClick={() => añadir(p)} aria-label={`Añadir ${p.nombre} al presupuesto`} className="flex min-h-36 w-full flex-col items-center justify-center gap-2 p-3 text-center hover:bg-blue-50 dark:hover:bg-blue-950"><span aria-hidden="true" className="text-3xl">{CATEGORIAS.find(c => c.id === p.categoria)?.icono}</span><span className="w-full break-words text-sm font-semibold">{p.nombre}</span><span className="font-bold text-blue-800 dark:text-blue-200">{euros(p.precio)}</span><span className="text-xs text-slate-500 dark:text-slate-300">{seleccionada ? `${seleccionada.cantidad} en presupuesto · +1` : '+ Añadir al presupuesto'}</span></button>
              <button onClick={() => { setError(''); setProducto({ ...p, importe: String(p.precio / 100) }); }} className="w-full border-t border-slate-200 py-2 text-xs dark:border-slate-700" aria-label={`Editar tarjeta ${p.nombre}`}>Editar tarjeta</button>
            </article>;
          })}</div>
          {!visibles.length && <div className="rounded-2xl border border-dashed border-slate-300 p-7 text-center dark:border-slate-700"><p className="font-medium">{busqueda ? 'No hay tarjetas con ese nombre.' : 'Crea tu primera tarjeta en esta categoría.'}</p><p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Guarda el nombre y el precio una vez. Después, añade el producto con un toque.</p><button onClick={nuevoProducto} className="mt-4 font-semibold text-blue-700 dark:text-blue-200">+ Crear tarjeta</button></div>}
        </section>

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

    {producto && <Modal titulo={producto.id ? 'Editar tarjeta' : 'Nueva tarjeta'} cerrar={() => setProducto(null)}><form onSubmit={guardarProducto} className="space-y-4">
      <label className="block text-sm">Nombre del producto o servicio<input autoFocus required maxLength={160} value={producto.nombre} onChange={e => setProducto({ ...producto, nombre: e.target.value })} className={campo} /></label>
      <label className="block text-sm">Precio por unidad, sin IVA (€)<input required inputMode="decimal" placeholder="0,00" value={producto.importe} onChange={e => setProducto({ ...producto, importe: e.target.value })} className={campo} /></label>
      <label className="block text-sm">Categoría<select value={producto.categoria} onChange={e => setProducto({ ...producto, categoria: e.target.value })} className={campo}>{CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
      <p className="text-xs text-slate-500 dark:text-slate-300">Cambiar el precio de la tarjeta no modifica los conceptos que ya has añadido a un presupuesto.</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className={`${boton} w-full`}>Guardar tarjeta</button>
      {producto.id && <button type="button" onClick={borrarProducto} className="w-full py-2 text-sm text-red-600">Borrar tarjeta</button>}
    </form></Modal>}
    {linea && <Modal titulo="Editar cantidad" cerrar={() => setLinea(null)}><form onSubmit={guardarLinea} className="space-y-4"><p className="font-medium">{linea.nombre}</p><p>{euros(linea.precio)} por unidad, sin IVA</p><label className="block text-sm">Cantidad<input autoFocus required inputMode="decimal" value={linea.cantidad} onChange={e => setLinea({ ...linea, cantidad: e.target.value })} className={campo} /></label>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<button className={`${boton} w-full`}>Guardar cantidad</button></form></Modal>}
    {verHistorial && <Modal titulo="Presupuestos guardados" cerrar={() => setVerHistorial(false)}><p className="mb-4 text-sm text-slate-500 dark:text-slate-300">Guardados en este navegador. Descarga el Excel o el PDF para conservar una copia fuera de este dispositivo.</p><div className="space-y-3">{historial.map(p => <div key={p.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><p className="font-bold">{p.numero}</p><p className="break-words text-sm">{p.cliente || 'Sin cliente'} · {p.fecha}</p><p className="my-2">{euros(calcular(p.lineas, Number(p.iva)).total)}</p><div className="flex gap-5"><button className="font-semibold text-blue-700 dark:text-blue-200" onClick={() => { if (draft.id !== p.id && draft.lineas.length && !window.confirm('¿Abrir este presupuesto y sustituir el borrador actual?')) return; cambiarDraft({ ...p, lineas: p.lineas.map(l => ({ ...l })) }); setVerHistorial(false); }}>Abrir</button><button className="text-sm text-red-600" onClick={() => { if (!window.confirm('¿Borrar este presupuesto del historial?')) return; const next = historial.filter(x => x.id !== p.id); if (guardar({ productos, historial: next, borrador: draft })) setHistorial(next); }}>Borrar</button></div></div>)}{!historial.length && <p className="text-sm">Los presupuestos aparecerán aquí al generarlos o empezar uno nuevo.</p>}</div></Modal>}
  </div>;
}
