import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

const sugerencias = ["Cable", "Enchufes", "Interruptores", "Tacos", "Tornillos", "Cinta aislante", "Bridas", "Tubo", "Canaleta", "Magnetotérmico", "Silicona", "Gas refrigerante"];

function icono(nombre) {
  const texto = nombre.toLocaleLowerCase("es");
  if (/cable|cinta|brida/.test(texto)) return "🔌";
  if (/tornillo|taco|broca/.test(texto)) return "🔩";
  if (/enchufe|interruptor|magneto|diferencial/.test(texto)) return "⚡";
  if (/aire|gas|refriger|cobre/.test(texto)) return "❄️";
  if (/bombilla|lámpara|led|foco/.test(texto)) return "💡";
  if (/tubo|canaleta/.test(texto)) return "📏";
  if (/silicona|pegamento/.test(texto)) return "🧴";
  return "🧰";
}

function Tarjeta({ material, ocupado, alternar, editar }) {
  const tengo = material.estado === "comprado";
  return (
    <article className={`relative overflow-hidden rounded-2xl border shadow-sm ${tengo ? "border-teal-600 bg-teal-700" : "border-rose-500 bg-rose-500"}`}>
      <button type="button" disabled={ocupado} onClick={() => alternar(material)}
        aria-label={`${material.nombre}: ${tengo ? "tengo, marcar como necesito" : "necesito, marcar como tengo"}`}
        className="flex min-h-40 w-full flex-col items-center justify-center gap-2 px-3 pb-12 pt-5 text-white transition hover:brightness-110 focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-white disabled:opacity-60">
        <span className="text-4xl" aria-hidden="true">{icono(material.nombre)}</span>
        <span className="w-full break-words text-center text-sm font-semibold sm:text-base">{material.nombre}</span>
        {material.cantidad && <span className="w-full break-words text-center text-xs opacity-90">{material.cantidad}</span>}
        <span className="text-xs font-medium">{ocupado ? "Guardando…" : tengo ? "✓ Tengo" : "+ Necesito"}</span>
      </button>
      <button type="button" onClick={() => editar(material)} disabled={ocupado}
        aria-label={`Editar ${material.nombre}`}
        className="absolute inset-x-0 bottom-0 border-t border-white/20 bg-black/10 py-2 text-xs font-medium text-white hover:bg-black/20 disabled:opacity-60">Editar</button>
    </article>
  );
}

export default function Materiales() {
  const [materiales, setMateriales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [nombre, setNombre] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ocupados, setOcupados] = useState(new Set());
  const [edicion, setEdicion] = useState(null);
  const bloqueos = useRef(new Set());
  const bloqueoFormulario = useRef(false);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      try {
        const { data, error } = await supabase.from("materiales").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        if (activo) setMateriales(data || []);
      } catch {
        if (activo) setError("No se han podido cargar los materiales. Comprueba tu conexión y vuelve a intentarlo.");
      } finally {
        if (activo) setCargando(false);
      }
    }
    cargar();
    return () => { activo = false; };
  }, []);

  async function añadir(event, sugerido) {
    event?.preventDefault();
    const texto = (sugerido ?? nombre).trim();
    if (!texto || bloqueoFormulario.current || cargando) return;
    setError("");
    setAviso("");
    const existente = materiales.find(m => m.nombre.trim().toLocaleLowerCase("es") === texto.toLocaleLowerCase("es"));
    if (existente) {
      if (existente.estado === "comprado") {
        const guardado = await actualizar(existente.id, { estado: "agotado" });
        if (!guardado) return;
      }
      setNombre("");
      setAviso(`${existente.nombre} ya está en Necesito.`);
      return;
    }
    bloqueoFormulario.current = true;
    setGuardando(true);
    try {
      const { data, error } = await supabase.from("materiales").insert([{ nombre: texto, cantidad: "", precio: null, almacen: "", estado: "agotado" }]).select("*").single();
      if (error) throw error;
      setMateriales(actuales => [data, ...actuales]);
      setNombre("");
      setAviso(`${texto} añadido a Necesito.`);
    } catch {
      setError("No se ha podido añadir el producto. Inténtalo de nuevo; el nombre sigue en el formulario.");
    } finally {
      bloqueoFormulario.current = false;
      setGuardando(false);
    }
  }

  async function actualizar(id, datos) {
    if (bloqueos.current.has(id)) return false;
    bloqueos.current.add(id);
    setOcupados(new Set(bloqueos.current));
    setError("");
    try {
      const { data, error } = await supabase.from("materiales").update(datos).eq("id", id).select("*").single();
      if (error) throw error;
      setMateriales(actuales => actuales.map(m => m.id === id ? data : m));
      return true;
    } catch {
      setError("No se ha podido guardar el cambio. El producto conserva su estado anterior. Inténtalo de nuevo.");
      return false;
    } finally {
      bloqueos.current.delete(id);
      setOcupados(new Set(bloqueos.current));
    }
  }

  async function alternar(material) {
    setAviso("");
    await actualizar(material.id, { estado: material.estado === "comprado" ? "agotado" : "comprado" });
  }

  async function guardarEdicion(event) {
    event.preventDefault();
    if (!edicion.nombre.trim() || bloqueoFormulario.current) return;
    const duplicado = materiales.some(m => m.id !== edicion.id && m.nombre.trim().toLocaleLowerCase("es") === edicion.nombre.trim().toLocaleLowerCase("es"));
    if (duplicado) { setError("Ya tienes otro producto con ese nombre."); return; }
    bloqueoFormulario.current = true;
    setGuardando(true);
    const guardado = await actualizar(edicion.id, {
      nombre: edicion.nombre.trim(), cantidad: edicion.cantidad,
      precio: edicion.precio === "" ? null : Number(edicion.precio), almacen: edicion.almacen,
    });
    if (guardado) { setEdicion(null); setAviso("Producto actualizado."); }
    bloqueoFormulario.current = false;
    setGuardando(false);
  }

  async function borrar() {
    if (bloqueoFormulario.current || !window.confirm(`¿Borrar ${edicion.nombre} de la lista?`)) return;
    bloqueoFormulario.current = true;
    setGuardando(true);
    setError("");
    try {
      const { error, data } = await supabase.from("materiales").delete().eq("id", edicion.id).select("id").single();
      if (error || !data) throw error || new Error("No eliminado");
      setMateriales(actuales => actuales.filter(m => m.id !== edicion.id));
      setEdicion(null);
      setAviso("Producto eliminado.");
    } catch { setError("No se ha podido borrar el producto. Inténtalo de nuevo."); }
    finally { bloqueoFormulario.current = false; setGuardando(false); }
  }

  const filtrados = materiales.filter(m => `${m.nombre} ${m.cantidad || ""} ${m.almacen || ""}`.toLocaleLowerCase("es").includes(busqueda.trim().toLocaleLowerCase("es")));
  const necesito = filtrados.filter(m => m.estado !== "comprado");
  const tengo = filtrados.filter(m => m.estado === "comprado");
  const sugeridos = sugerencias.filter(s => !materiales.some(m => m.nombre.trim().toLocaleLowerCase("es") === s.toLocaleLowerCase("es")));
  const editar = material => { setEdicion({ ...material, cantidad: material.cantidad ?? "", precio: material.precio ?? "", almacen: material.almacen ?? "" }); setError(""); };
  const inputClass = "w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <header className="bg-slate-800 px-5 pb-8 pt-5 text-white">
        <div className="mx-auto max-w-4xl">
          <Link to="/" className="inline-block rounded-lg py-2 text-sm text-slate-200 hover:text-white">← Volver</Link>
          <div className="mb-5 mt-3 flex items-center justify-between gap-3">
            <div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-teal-300">Todo listo para trabajar</p><h1 className="text-3xl font-bold">Mis materiales</h1></div>
            <span aria-hidden="true" className="text-4xl">🧰</span>
          </div>
          <form onSubmit={añadir} className="flex gap-2">
            <input aria-label="Nuevo producto" placeholder="¿Qué material necesitas?" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={160} className={`${inputClass} min-w-0 flex-1`} />
            <button disabled={guardando || cargando || !nombre.trim()} className="rounded-xl bg-teal-400 px-4 font-bold text-slate-950 transition hover:bg-teal-300 disabled:opacity-40">{guardando ? "…" : "+ Añadir"}</button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-7 px-4 py-6 sm:px-5">
        <p className="text-sm text-slate-600 dark:text-slate-300">Pulsa una tarjeta para pasarla de «Necesito» a «Tengo», o al revés.</p>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        <p role="status" className="text-sm text-teal-700 dark:text-teal-300">{aviso || (cargando ? "Cargando tus materiales…" : "")}</p>
        <input type="search" aria-label="Buscar en mis materiales" placeholder="Buscar en mi lista…" value={busqueda} onChange={e => setBusqueda(e.target.value)} className={inputClass} />

        {[["Necesito", necesito, "bg-rose-500", "Lo que falta para el próximo trabajo."], ["Tengo", tengo, "bg-teal-600", "Disponible. Púlsalo cuando necesites reponerlo."]].map(([titulo, items, color, descripcion]) => (
          <section key={titulo} aria-label={titulo}>
            <div className="mb-1 flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${color}`} /><h2 className="text-xl font-bold">{titulo}</h2><span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{items.length}</span></div>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{descripcion}</p>
            <div className="grid grid-cols-2 gap-3 min-[360px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
              {items.map(material => <Tarjeta key={material.id} material={material} ocupado={ocupados.has(material.id)} alternar={alternar} editar={editar} />)}
            </div>
            {!cargando && items.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{busqueda ? "No hay productos que coincidan." : titulo === "Necesito" ? "No te falta nada. Añade un producto arriba o pulsa uno de los que tienes." : "Los productos que marques como disponibles aparecerán aquí."}</p>}
          </section>
        ))}

        {!cargando && !busqueda && sugeridos.length > 0 && <section aria-label="Añadir habituales">
          <h2 className="mb-1 text-xl font-bold">Añadir habituales</h2><p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Un toque para añadirlos a Necesito.</p>
          <div className="flex flex-wrap gap-2">{sugeridos.map(s => <button type="button" key={s} disabled={guardando} onClick={() => añadir(null, s)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm hover:border-teal-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900">{icono(s)} {s} +</button>)}</div>
        </section>}
      </main>

      {edicion && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onKeyDown={e => { if (e.key === "Escape" && !guardando) setEdicion(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="editar-material" className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-900">
          <h2 id="editar-material" className="mb-5 text-xl font-bold">Editar producto</h2>
          <form onSubmit={guardarEdicion} className="space-y-4">
            <label className="block text-sm">Nombre<input autoFocus required maxLength={160} value={edicion.nombre} onChange={e => setEdicion({ ...edicion, nombre: e.target.value })} className={`${inputClass} mt-1`} /></label>
            <label className="block text-sm">Cantidad o nota (opcional)<input value={edicion.cantidad} onChange={e => setEdicion({ ...edicion, cantidad: e.target.value })} placeholder="Ej.: 2 rollos, 10 metros…" className={`${inputClass} mt-1`} /></label>
            <details><summary className="cursor-pointer text-sm text-teal-700 dark:text-teal-300">Precio y almacén (opcional)</summary><div className="mt-3 space-y-3">
              <label className="block text-sm">Precio (€)<input type="number" min="0" step="0.01" value={edicion.precio} onChange={e => setEdicion({ ...edicion, precio: e.target.value })} className={`${inputClass} mt-1`} /></label>
              <label className="block text-sm">Almacén<input value={edicion.almacen} onChange={e => setEdicion({ ...edicion, almacen: e.target.value })} className={`${inputClass} mt-1`} /></label>
            </div></details>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <button disabled={guardando || ocupados.has(edicion.id)} className="w-full rounded-xl bg-teal-700 p-3 font-semibold text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar cambios"}</button>
            <button type="button" disabled={guardando} onClick={() => setEdicion(null)} className="w-full rounded-xl bg-slate-100 p-3 text-slate-800 disabled:opacity-50">Cancelar</button>
            <button type="button" disabled={guardando} onClick={borrar} className="w-full p-2 text-sm text-red-600 disabled:opacity-50">Borrar producto</button>
          </form>
        </section>
      </div>}
    </div>
  );
}
