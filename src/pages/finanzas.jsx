import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { trimestreActual } from '../lib/trimestre';
import { balanceAnual } from '../lib/balanceAnual';
import { agruparMovimientos, claveCategoria, dinero, fechaHoy, fechaRegistro, importeValido, mostrarFecha, nombreCategoria, repositorioFinanzas } from '../lib/finanzas';

const input = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
const primario = 'rounded-xl bg-blue-800 px-4 py-3 font-semibold text-white hover:bg-blue-900 disabled:opacity-50';
const listas = { mensual: 'Gastos mensuales', anual: 'Gastos anuales', puntual: 'Gastos puntuales', ingreso: 'Ingresos' };
const tipos = { mensual: 'Gasto mensual', anual: 'Gasto anual', puntual: 'Gasto puntual', ingreso: 'Ingreso' };

function Ventana({ titulo, cerrar, ocupado, children }) {
  const ref = useRef(null), id = useId();
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} aria-labelledby={id} onCancel={e => { e.preventDefault(); if (!ocupado) cerrar(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-950/60 dark:bg-slate-900 dark:text-white sm:p-6">
    <div className="mb-5 flex items-start justify-between gap-4"><h2 id={id} className="min-w-0 break-words text-xl font-bold">{titulo}</h2><button type="button" disabled={ocupado} onClick={cerrar} aria-label="Cerrar ventana" className="rounded-xl px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button></div>
    <fieldset disabled={ocupado} className="min-w-0">{children}</fieldset>
  </dialog>;
}

export default function Finanzas({ repositorio = repositorioFinanzas }) {
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargaConfirmada, setCargaConfirmada] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [formulario, setFormulario] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [desglose, setDesglose] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const bloqueo = useRef(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try { setMovimientos(await repositorio.listar()); setCargaConfirmada(true); setError(''); }
    catch { setError('No se han podido cargar los movimientos. Comprueba la conexión y pulsa Actualizar.'); }
    finally { setCargando(false); }
  }, [repositorio]);
  useEffect(() => {
    let activo = true;
    repositorio.listar().then(data => { if (activo) { setMovimientos(data); setCargaConfirmada(true); setCargando(false); } }).catch(() => { if (activo) { setError('No se han podido cargar los movimientos. Comprueba la conexión y pulsa Actualizar.'); setCargando(false); } });
    return () => { activo = false; };
  }, [repositorio]);
  useEffect(() => {
    if (formulario || detalle || desglose || ocupado) return;
    const refrescar = () => { if (document.visibilityState === 'visible') cargar(); };
    window.addEventListener('focus', refrescar); document.addEventListener('visibilitychange', refrescar);
    return () => { window.removeEventListener('focus', refrescar); document.removeEventListener('visibilitychange', refrescar); };
  }, [cargar, formulario, detalle, desglose, ocupado]);

  const grupos = agruparMovimientos(movimientos);
  const gastos = grupos.filter(g => !g.ingreso).reduce((total, g) => total + g.total, 0);
  const ingresos = grupos.filter(g => g.ingreso).reduce((total, g) => total + g.total, 0);
  const trimestre = trimestreActual(fechaHoy());
  const gruposTrimestre = agruparMovimientos(movimientos.filter(m => {
    const fecha = fechaRegistro(m);
    return fecha >= trimestre.desde && fecha < trimestre.hasta;
  }));
  const gastosTrimestre = gruposTrimestre.filter(g => !g.ingreso).reduce((total, g) => total + g.total, 0);
  const ingresosTrimestre = gruposTrimestre.filter(g => g.ingreso).reduce((total, g) => total + g.total, 0);
  const anual = balanceAnual(movimientos, fechaHoy(), fechaRegistro);
  const registrosResumen = movimientos.filter(m => {
    const fecha = fechaRegistro(m);
    if (desglose?.id === 'trimestre') return fecha >= trimestre.desde && fecha < trimestre.hasta;
    if (desglose?.id === 'anual') return fecha >= `${anual.year}-01-01` && fecha < `${anual.year + 1}-01-01`;
    return true;
  }).filter(m => !desglose || desglose.titulo === 'Balance' || (desglose.titulo === 'Ingresos' ? m.tipo === 'ingreso' : m.tipo !== 'ingreso'));
  const gruposResumen = agruparMovimientos(registrosResumen);
  const grupoActual = detalle ? grupos.find(g => g.key === detalle.key) : null;
  const repeticionActiva = grupoActual?.registros.find(m => m.repetir_mensual);
  const sugerencias = grupos.filter(g => g.tipo === formulario?.tipo).map(g => g.nombre);
  const listaId = useId();

  function nuevo(tipo = 'puntual', categoria = '') {
    setError(''); setFormulario({ id: null, categoria, tipo, cantidad: '', fecha: fechaHoy(), concepto: '', repetir_mensual: false, repeticion_origen: null, origen: detalle }); setDetalle(null);
  }
  function editar(m) {
    setError(''); setFormulario({ id: m.id, categoria: nombreCategoria(m.categoria) || nombreCategoria(m.concepto) || 'Sin categoría', tipo: m.tipo, cantidad: String(m.cantidad), fecha: fechaRegistro(m), concepto: m.concepto || '', repetir_mensual: !!m.repetir_mensual, repeticion_origen: m.repeticion_origen, origen: detalle }); setDetalle(null);
  }
  function cerrarFormulario() { const origen = formulario?.origen; setFormulario(null); setError(''); if (origen) setDetalle(origen); }

  async function guardar(event) {
    event.preventDefault(); if (bloqueo.current) return;
    const categoria = nombreCategoria(formulario.categoria), cantidad = importeValido(formulario.cantidad);
    if (!categoria || categoria.length > 100) { setError('Escribe una categoría de hasta 100 caracteres.'); return; }
    if (cantidad === null) { setError('Introduce un importe mayor que cero, con un máximo de dos decimales.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formulario.fecha)) { setError('Selecciona la fecha del movimiento.'); return; }
    const ingreso = formulario.tipo === 'ingreso';
    const existente = grupos.find(g => g.key === claveCategoria(categoria, formulario.tipo));
    const nombre = existente?.nombre || categoria;
    if (formulario.tipo === 'mensual' && formulario.repetir_mensual && movimientos.some(m => m.id !== formulario.id && m.repetir_mensual && claveCategoria(m.categoria || m.concepto, 'mensual') === claveCategoria(nombre, 'mensual'))) {
      setError('Esta categoría ya se repite cada mes. Edita el movimiento con la repetición activa.'); return;
    }
    const datos = { repetir_mensual: formulario.tipo === 'mensual' && !formulario.repeticion_origen && !!formulario.repetir_mensual, categoria: nombre, tipo: formulario.tipo, cantidad, fecha: formulario.fecha, concepto: formulario.concepto.trim() || nombre };
    bloqueo.current = true; setOcupado(true); setError('');
    try {
      const saved = await repositorio.escribir(datos, formulario.id);
      setMovimientos(actual => formulario.id == null ? [saved, ...actual] : actual.map(m => m.id === formulario.id ? saved : m));
      setFormulario(null);
      if (formulario.origen) setDetalle({ key: claveCategoria(nombre, formulario.tipo), nombre, ingreso, tipo: formulario.tipo });
      setAviso(`${formulario.id == null ? 'Movimiento añadido' : 'Movimiento actualizado'} en ${nombre}.`);
    } catch { setError('No se ha podido guardar el movimiento. Los datos siguen en el formulario; vuelve a intentarlo.'); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  async function borrar(m) {
    if (bloqueo.current || !window.confirm(`¿Borrar este movimiento de ${dinero(Math.round(Number(m.cantidad) * 100))}? ${m.repetir_mensual ? 'También se detendrá su repetición mensual. ' : ''}El resto de registros se conservará.`)) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try { await repositorio.borrar(m.id); setMovimientos(actual => actual.filter(x => x.id !== m.id)); setAviso('Movimiento eliminado. El total de la categoría se ha actualizado.'); }
    catch { setError('No se ha podido borrar el movimiento. Vuelve a intentarlo.'); }
    finally { bloqueo.current = false; setOcupado(false); }
  }

  return <div className="min-h-screen bg-slate-50 pb-24 text-slate-900 dark:bg-slate-950 dark:text-white">
    <header className="bg-slate-800 px-5 pb-7 pt-5 text-white"><div className="mx-auto max-w-4xl"><Link to="/" className="inline-block py-2 text-sm text-slate-200">← Volver al inicio</Link><div className="mt-3 flex flex-wrap items-center justify-between gap-4"><div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-blue-200">Tus cuentas, por categorías</p><h1 className="text-3xl font-bold">Finanzas</h1></div><button disabled={ocupado || cargando} onClick={cargar} className="rounded-xl border border-white/30 px-4 py-2 text-sm disabled:opacity-50">Actualizar</button></div></div></header>
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-5">
      {error && !formulario && !detalle && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{cargando ? 'Cargando movimientos…' : aviso}</p>
      {[
        { id: 'trimestre', titulo: 'Totales del trimestre actual', detalle: trimestre.etiqueta, gastos: gastosTrimestre, ingresos: ingresosTrimestre },
        { id: 'anual', titulo: 'Balance anual', detalle: `Año ${anual.year} · Cada gasto e ingreso registrado se cuenta una sola vez.`, gastos: anual.gastos, ingresos: anual.ingresos },
        { id: 'historial', titulo: 'Totales acumulados de todo el historial', detalle: '', gastos, ingresos },
      ].map(resumen => <section key={resumen.id} aria-label={resumen.titulo}><h2 className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-300">{resumen.titulo}{resumen.detalle && <span className="mt-1 block text-xs font-normal">{resumen.detalle}</span>}</h2><div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-3">{[['Gastos', resumen.gastos, 'text-rose-700 dark:text-rose-300'], ['Ingresos', resumen.ingresos, 'text-teal-700 dark:text-teal-300'], ['Balance', resumen.ingresos - resumen.gastos, 'text-blue-800 dark:text-blue-200']].map(([titulo, total, color]) => <button type="button" key={titulo} disabled={cargando || !cargaConfirmada} onClick={() => setDesglose({ id: resumen.id, periodo: resumen.titulo, titulo, total })} aria-label={`Ver desglose de ${titulo.toLocaleLowerCase('es')}: ${resumen.titulo}`} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:shadow-md focus-visible:outline-blue-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"><p className="text-sm text-slate-500 dark:text-slate-300">{titulo}</p><p className={`mt-1 break-words text-lg font-bold sm:text-2xl ${color}`}>{cargando ? '…' : cargaConfirmada ? dinero(total) : '—'}</p><p className="mt-2 text-xs text-slate-500 dark:text-slate-300">Ver desglose →</p></button>)}</div></section>)}
      <div className="grid grid-cols-2 gap-3"><button disabled={cargando || ocupado || !cargaConfirmada} onClick={() => nuevo('puntual')} className="rounded-xl bg-rose-600 px-3 py-4 font-semibold text-white hover:bg-rose-700 disabled:opacity-50">+ Registrar gasto</button><button disabled={cargando || ocupado || !cargaConfirmada} onClick={() => nuevo('ingreso')} className="rounded-xl bg-teal-700 px-3 py-4 font-semibold text-white hover:bg-teal-800 disabled:opacity-50">+ Registrar ingreso</button></div>
      <input type="search" aria-label="Buscar categoría" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar categoría…" className={input} />
      <p className="text-sm text-slate-500 dark:text-slate-300">Cada tarjeta suma todos los movimientos de su categoría. Púlsala para ver las fechas y los importes.</p>
      {['puntual', 'ingreso', 'mensual', 'anual'].map(tipo => {
        const ingreso = tipo === 'ingreso';
        const categorias = grupos.filter(g => g.tipo === tipo && g.nombre.toLocaleLowerCase('es').includes(busqueda.trim().toLocaleLowerCase('es')));
        return <section key={tipo} aria-label={listas[tipo]}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{listas[tipo]}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{categorias.length} {categorias.length === 1 ? 'categoría' : 'categorías'} · {dinero(categorias.reduce((total, g) => total + g.total, 0))}</p></div><button disabled={cargando || ocupado || !cargaConfirmada} onClick={() => nuevo(tipo)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-600">+ Registrar</button></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{categorias.map(g => <button key={g.key} onClick={() => { setDetalle({ key: g.key, nombre: g.nombre, ingreso, tipo }); setError(''); }} aria-label={`Ver registro de ${g.nombre}, ${listas[tipo].toLocaleLowerCase('es')}`} className={`flex min-h-36 min-w-0 flex-col items-start justify-between gap-3 rounded-2xl border p-4 text-left transition hover:shadow-md ${ingreso ? 'border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950' : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950'}`}><span className="w-full break-words font-semibold">{g.nombre}</span><span className={`w-full break-words text-xl font-bold ${ingreso ? 'text-teal-800 dark:text-teal-200' : 'text-rose-800 dark:text-rose-200'}`}>{dinero(g.total)}</span><span className="text-xs text-slate-500 dark:text-slate-300">{g.registros.some(m => m.repetir_mensual) && <span className="mb-1 block font-semibold text-blue-700 dark:text-blue-200">↻ Repetición activa</span>}{g.registros.length} {g.registros.length === 1 ? 'movimiento' : 'movimientos'} · Ver registro →</span></button>)}</div>{!cargando && cargaConfirmada && !categorias.length && <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">{busqueda ? 'No hay categorías con ese nombre.' : `Todavía no hay movimientos en ${listas[tipo].toLocaleLowerCase('es')}.`}</p>}</section>;
      })}
    </main>
    {desglose && <Ventana titulo={`${desglose.titulo} · ${desglose.periodo}`} cerrar={() => setDesglose(null)} ocupado={false}>
      <p className="mb-4 text-3xl font-bold">{dinero(desglose.total)}</p>
      {desglose.titulo === 'Balance' && <p className="mb-4 text-sm text-slate-500 dark:text-slate-300">Ingresos menos gastos. Los gastos aparecen con signo negativo.</p>}
      {desglose.id === 'anual' && <p className="mb-4 text-sm text-slate-500 dark:text-slate-300">Año {anual.year}: suma de los movimientos registrados, sin multiplicar por 12.</p>}
      <div className="space-y-3">{gruposResumen.map(g => {
        const signo = desglose.titulo === 'Balance' && !g.ingreso ? -1 : 1;
        return <details key={g.key} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <summary className="cursor-pointer"><span className="font-semibold">{g.nombre}</span><span className="ml-2 text-xs text-slate-500 dark:text-slate-300">{tipos[g.tipo]}</span><strong className="mt-1 block">{dinero(g.total * signo)}</strong><span className="text-xs text-slate-500 dark:text-slate-300">{g.registros.length} {g.registros.length === 1 ? 'movimiento' : 'movimientos'} · Ver fechas y conceptos</span></summary>
          <ul className="mt-3 space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">{g.registros.map(m => <li key={m.id} className="text-sm"><div className="flex flex-wrap justify-between gap-2"><time dateTime={m.fecha || undefined}>{mostrarFecha(m.fecha)}</time><strong>{dinero(Math.round(Number(m.cantidad) * 100) * signo)}</strong></div><p className="mt-1 break-words text-slate-500 dark:text-slate-300">{m.concepto || g.nombre}</p></li>)}</ul>
        </details>;
      })}</div>
      {!gruposResumen.length && <p className="text-sm text-slate-500 dark:text-slate-300">No hay movimientos para este resumen.</p>}
    </Ventana>}
    {detalle && <Ventana titulo={`${detalle.nombre} · ${tipos[detalle.tipo]}`} cerrar={() => { setDetalle(null); setError(''); }} ocupado={ocupado}><div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-slate-500 dark:text-slate-300">Total acumulado · {listas[detalle.tipo]}</p><p className="mt-1 text-3xl font-bold">{dinero(grupoActual?.total || 0)}</p></div><button onClick={() => nuevo(detalle.tipo, detalle.nombre)} className={primario}>+ Añadir movimiento</button></div>{repeticionActiva && <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950"><p className="text-sm font-semibold">↻ Repetición mensual activa · {dinero(Math.round(Number(repeticionActiva.cantidad) * 100))}</p><button onClick={() => editar(repeticionActiva)} className="mt-2 text-sm font-semibold text-blue-700 dark:text-blue-200">Cambiar importe o detener repetición</button></div>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="space-y-3">{grupoActual?.registros.map(m => <article key={m.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex items-start justify-between gap-4"><time dateTime={m.fecha || undefined} className="text-sm font-semibold">{mostrarFecha(m.fecha)}</time><strong className={detalle.ingreso ? 'text-teal-700 dark:text-teal-300' : 'text-rose-700 dark:text-rose-300'}>{dinero(Math.round(Number(m.cantidad) * 100))}</strong></div>{m.repetir_mensual && <p className="mt-2 text-xs font-semibold text-blue-700 dark:text-blue-200">↻ Repetición mensual activa · Edita este movimiento para cambiar los próximos cargos o detenerlos.</p>}{m.repeticion_mes && <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">Añadido automáticamente · Editar este cargo solo cambia este mes.</p>}{m.concepto && <p className="mt-2 break-words text-sm text-slate-600 dark:text-slate-300">{m.concepto}</p>}<div className="mt-3 flex flex-wrap items-center gap-4 text-sm"><span className="mr-auto text-xs text-slate-500 dark:text-slate-300">{tipos[m.tipo] || 'Gasto'}</span><button aria-label={`Editar movimiento del ${m.fecha || 'sin fecha'} de ${m.cantidad} euros`} onClick={() => editar(m)} className="font-semibold text-blue-700 dark:text-blue-200">Editar</button><button aria-label={`Borrar movimiento del ${m.fecha || 'sin fecha'} de ${m.cantidad} euros`} onClick={() => borrar(m)} className="text-rose-700 dark:text-rose-300">Borrar</button></div></article>)}</div>{!grupoActual?.registros.length && <p className="text-sm text-slate-500 dark:text-slate-300">Esta categoría ya no tiene movimientos.</p>}</div></Ventana>}
    {formulario && <Ventana titulo={formulario.id == null ? 'Nuevo movimiento' : 'Editar movimiento'} cerrar={cerrarFormulario} ocupado={ocupado}><form onSubmit={guardar} className="space-y-4"><div className="grid grid-cols-2 gap-2" role="group" aria-label="Gasto o ingreso"><button type="button" aria-pressed={formulario.tipo !== 'ingreso'} onClick={() => setFormulario({ ...formulario, tipo: formulario.tipo === 'ingreso' ? 'puntual' : formulario.tipo })} className={`rounded-xl border p-3 font-semibold ${formulario.tipo !== 'ingreso' ? 'border-rose-600 bg-rose-50 text-rose-800' : 'border-slate-300'}`}>Gasto</button><button type="button" aria-pressed={formulario.tipo === 'ingreso'} onClick={() => setFormulario({ ...formulario, tipo: 'ingreso' })} className={`rounded-xl border p-3 font-semibold ${formulario.tipo === 'ingreso' ? 'border-teal-700 bg-teal-50 text-teal-800' : 'border-slate-300'}`}>Ingreso</button></div>
      <label className="block text-sm">Categoría<input autoFocus required maxLength={100} list={listaId} value={formulario.categoria} onChange={e => setFormulario({ ...formulario, categoria: e.target.value })} placeholder="Ej.: Gasolina, Herramientas, Instalaciones…" className={input} /><datalist id={listaId}>{sugerencias.map(nombre => <option key={nombre} value={nombre} />)}</datalist></label><p className="text-xs text-slate-500 dark:text-slate-300">Elige una categoría existente o escribe una nueva. Los movimientos con la misma categoría se sumarán en una sola tarjeta.</p>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm">Importe (€)<input required inputMode="decimal" value={formulario.cantidad} onChange={e => setFormulario({ ...formulario, cantidad: e.target.value })} placeholder="0,00" className={input} /></label><label className="block text-sm">Fecha<input required type="date" value={formulario.fecha} onChange={e => setFormulario({ ...formulario, fecha: e.target.value })} className={input} /></label></div>
      <label className="block text-sm">Concepto o nota (opcional)<input maxLength={300} value={formulario.concepto} onChange={e => setFormulario({ ...formulario, concepto: e.target.value })} placeholder="Ej.: Repostaje de la furgoneta" className={input} /></label>
      {formulario.tipo !== 'ingreso' && <div><label className="block text-sm">Tipo de gasto<select value={formulario.tipo} onChange={e => setFormulario({ ...formulario, tipo: e.target.value })} className={input}><option value="puntual">Gasto puntual</option><option value="mensual">Gasto mensual</option><option value="anual">Gasto anual</option></select></label><p className="mt-2 text-xs text-slate-500 dark:text-slate-300">Cada registro cuenta una sola vez por su importe.</p></div>}
      {formulario.tipo === 'mensual' && !formulario.repeticion_origen && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950"><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={formulario.repetir_mensual} onChange={e => setFormulario({ ...formulario, repetir_mensual: e.target.checked })} className="h-5 w-5" />Repetir cada mes</label><p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Desde el próximo mes se añadirá el mismo importe, el mismo día, aunque no abras la aplicación. Si ese día no existe, se usará el último del mes. Edita este movimiento para cambiar futuros importes o desmarcar la repetición. Los cargos ya registrados se conservan.</p></div>}
      {formulario.repeticion_origen && <p className="text-xs text-slate-500 dark:text-slate-300">Este cargo se añadió automáticamente. Para cambiar o detener los próximos cargos, edita el movimiento con «Repetición mensual activa».</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}<button disabled={ocupado} className={`${primario} w-full`}>{ocupado ? 'Guardando…' : formulario.id == null ? 'Guardar movimiento' : 'Guardar cambios'}</button><button type="button" onClick={cerrarFormulario} className="w-full rounded-xl bg-slate-100 p-3 text-slate-800">Cancelar</button>
    </form></Ventana>}
  </div>;
}
