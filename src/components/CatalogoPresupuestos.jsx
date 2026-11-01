import { CATEGORIAS, compararNombre, euros } from '../lib/presupuestos';

export default function CatalogoPresupuestos({ productos, subcategorias, lineas, categoria, seleccionarCategoria, subcategoria, seleccionarSubcategoria, busqueda, buscar, crearSubcategoria, editarSubcategoria, crearProducto, editarProducto, añadir }) {
  const texto = busqueda.trim().toLocaleLowerCase('es');
  const nombreCategoria = CATEGORIAS.find(c => c.id === categoria)?.nombre;
  const grupos = subcategorias.filter(s => s.categoria === categoria);
  const sinClasificar = productos.filter(p => p.categoria === categoria && !p.subcategoria_id);
  const carpetas = [...grupos, ...(sinClasificar.length ? [{ id: 'sin-clasificar', nombre: 'Sin clasificar' }] : [])].sort(compararNombre);
  const pertenece = (p, id) => p.categoria === categoria && (id === 'sin-clasificar' ? !p.subcategoria_id : p.subcategoria_id === id);
  const elegida = carpetas.find(s => s.id === subcategoria);
  const visibles = productos.filter(p => pertenece(p, subcategoria) && p.nombre.toLocaleLowerCase('es').includes(texto)).sort(compararNombre);
  const carpetasVisibles = carpetas.filter(s => !texto || s.nombre.toLocaleLowerCase('es').includes(texto) || productos.some(p => pertenece(p, s.id) && p.nombre.toLocaleLowerCase('es').includes(texto)));
  const boton = 'rounded-xl bg-blue-800 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-900';
  return <section className="space-y-5" aria-label="Catálogo de productos">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Mis productos y servicios</h2><button onClick={crearSubcategoria} className={boton}>+ Nueva subcategoría</button></div>
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Categorías">{CATEGORIAS.map(c => <button key={c.id} aria-pressed={categoria === c.id} onClick={() => seleccionarCategoria(c.id)} className={`rounded-xl px-2 py-3 text-xs font-semibold sm:text-sm ${categoria === c.id ? 'bg-blue-800 text-white' : 'border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}><span aria-hidden="true">{c.icono}</span> {c.nombre}</button>)}</div>
    {subcategoria !== null && <div className="space-y-2"><button onClick={() => seleccionarSubcategoria(null)} className="text-sm font-semibold text-blue-700 dark:text-blue-200">← Subcategorías de {nombreCategoria}</button><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="min-w-0 break-words text-lg font-bold">{elegida?.nombre || 'Subcategoría'}</h3><button onClick={crearProducto} className={boton}>+ Crear tarjeta</button></div></div>}
    <input type="search" aria-label="Buscar en el catálogo" value={busqueda} onChange={e => buscar(e.target.value)} placeholder={subcategoria === null ? 'Buscar subcategoría o producto…' : 'Buscar en esta subcategoría…'} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-600 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
    {subcategoria === null ? <>
      <p className="text-sm text-slate-500 dark:text-slate-300">Elige una subcategoría para ver sus productos.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">{carpetasVisibles.map(s => {
        const cantidad = productos.filter(p => pertenece(p, s.id)).length;
        return <article key={s.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><button onClick={() => { seleccionarSubcategoria(s.id); buscar(''); }} aria-label={`Abrir ${s.nombre}`} className="flex min-h-32 w-full flex-col items-center justify-center gap-2 p-4 hover:bg-blue-50 dark:hover:bg-blue-950"><span aria-hidden="true" className="text-3xl">📁</span><span className="w-full break-words text-sm font-semibold">{s.nombre}</span><span className="text-xs text-slate-500 dark:text-slate-300">{cantidad} {cantidad === 1 ? 'producto' : 'productos'}</span></button>{s.id !== 'sin-clasificar' && <button onClick={() => editarSubcategoria(s)} aria-label={`Editar subcategoría ${s.nombre}`} className="w-full border-t border-slate-200 py-2 text-xs dark:border-slate-700">Editar subcategoría</button>}</article>;
      })}</div>
      {!carpetasVisibles.length && <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700"><p>{texto ? 'No hay coincidencias en esta categoría.' : 'Crea tu primera subcategoría.'}</p><p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Por ejemplo: instalaciones, reparaciones o mantenimiento.</p><button onClick={crearSubcategoria} className="mt-4 font-semibold text-blue-700 dark:text-blue-200">+ Nueva subcategoría</button></div>}
    </> : <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">{visibles.map(p => {
        const seleccionada = lineas.find(l => l.productoId === p.id);
        return <article key={p.id} className={`overflow-hidden rounded-2xl border ${seleccionada ? 'border-blue-600 bg-blue-50 dark:bg-blue-950' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}><button onClick={() => añadir(p)} aria-label={`Añadir ${p.nombre} al presupuesto`} className="flex min-h-36 w-full flex-col items-center justify-center gap-2 p-3 text-center hover:bg-blue-50 dark:hover:bg-blue-950"><span aria-hidden="true" className="text-3xl">{CATEGORIAS.find(c => c.id === p.categoria)?.icono}</span><span className="w-full break-words text-sm font-semibold">{p.nombre}</span><span className="font-bold text-blue-800 dark:text-blue-200">{euros(p.precio)}</span><span className="text-xs text-slate-500 dark:text-slate-300">{seleccionada ? `${seleccionada.cantidad} en presupuesto · +1` : '+ Añadir al presupuesto'}</span></button><button onClick={() => editarProducto(p)} className="w-full border-t border-slate-200 py-2 text-xs dark:border-slate-700" aria-label={`Editar tarjeta ${p.nombre}`}>Editar tarjeta</button></article>;
      })}</div>
      {!visibles.length && <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700"><p>{texto ? 'No hay productos con ese nombre.' : 'Esta subcategoría todavía no tiene productos.'}</p><button onClick={crearProducto} className="mt-4 font-semibold text-blue-700 dark:text-blue-200">+ Crear tarjeta</button></div>}
    </>}
  </section>;
}
