import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Finanzas() {
  const [tipo, setTipo] = useState("mensual");
  const [concepto, setConcepto] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState("");
  const [movimientos, setMovimientos] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [balance, setBalance] = useState("mensual");

  useEffect(() => {
    cargarMovimientos();
  }, []);

  async function cargarMovimientos() {
    const { data, error } = await supabase
      .from("finanzas")
      .select("*")
      .order("fecha", { ascending: false });

    if (error) {
      console.log(error);
      return;
    }

    setMovimientos(data);
  }

  function limpiarFormulario() {
    setTipo("mensual");
    setConcepto("");
    setCantidad("");
    setFecha("");
    setEditandoId(null);
  }

  async function guardarMovimiento() {
    if (!concepto || !cantidad || !fecha) {
      alert("Rellena concepto, cantidad y fecha");
      return;
    }

    const datos = {
      tipo,
      concepto,
      cantidad: Number(cantidad),
      fecha,
    };

    const consulta = editandoId
      ? supabase.from("finanzas").update(datos).eq("id", editandoId)
      : supabase.from("finanzas").insert([datos]);

    const { error } = await consulta;

    if (error) {
      console.log(error);
      alert("Error guardando");
      return;
    }

    limpiarFormulario();
    cargarMovimientos();
  }

  function editarMovimiento(item) {
    setTipo(item.tipo || "mensual");
    setConcepto(item.concepto || "");
    setCantidad(item.cantidad || "");
    setFecha(item.fecha || "");
    setEditandoId(item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function borrarMovimiento(id) {
    if (!confirm("¿Seguro que quieres borrar este movimiento?")) return;

    const { error } = await supabase.from("finanzas").delete().eq("id", id);

    if (error) {
      console.log(error);
      alert("Error borrando");
      return;
    }

    cargarMovimientos();
  }

  function filtrarPorBalance(items) {
    const hoy = new Date();

    return items.filter((item) => {
      const fechaItem = new Date(item.fecha);

      if (balance === "mensual") {
        return (
          fechaItem.getMonth() === hoy.getMonth() &&
          fechaItem.getFullYear() === hoy.getFullYear()
        );
      }

      if (balance === "trimestral") {
        const trimestreActual = Math.floor(hoy.getMonth() / 3);
        const trimestreItem = Math.floor(fechaItem.getMonth() / 3);

        return (
          trimestreItem === trimestreActual &&
          fechaItem.getFullYear() === hoy.getFullYear()
        );
      }

      if (balance === "anual") {
        return fechaItem.getFullYear() === hoy.getFullYear();
      }

      return true;
    });
  }

  function sumar(items) {
    return items.reduce((total, item) => total + Number(item.cantidad), 0);
  }

  const movimientosFiltrados = filtrarPorBalance(movimientos);

  const gastosMensuales = movimientosFiltrados.filter((m) => m.tipo === "mensual");
  const gastosAnuales = movimientosFiltrados.filter((m) => m.tipo === "anual");
  const ingresos = movimientosFiltrados.filter((m) => m.tipo === "ingreso");

  const totalGastosMensuales = sumar(gastosMensuales);
  const totalGastosAnuales = sumar(gastosAnuales);
  const totalIngresos = sumar(ingresos);
  const beneficio = totalIngresos - totalGastosMensuales - totalGastosAnuales;

  function ListaMovimientos({ items }) {
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 border-b py-3">
            <div>
              <p className="font-medium">{item.concepto}</p>
              <p className="text-gray-500">
                {item.fecha} · {item.cantidad} €
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => editarMovimiento(item)}
                className="bg-blue-100 text-blue-700 px-3 py-2 rounded-xl"
              >
                ✏️
              </button>

              <button
                onClick={() => borrarMovimiento(item.id)}
                className="bg-red-100 text-red-700 px-3 py-2 rounded-xl"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-5">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/" className="bg-white px-4 py-2 rounded-2xl shadow">
          ← Volver
        </Link>

        <h1 className="text-4xl font-bold">💰 Finanzas</h1>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow space-y-4">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full p-4 rounded-2xl border">
          <option value="mensual">Gasto fijo mensual</option>
          <option value="anual">Gasto fijo anual</option>
          <option value="ingreso">Ingreso</option>
        </select>

        <input type="text" placeholder="Concepto" value={concepto} onChange={(e) => setConcepto(e.target.value)} className="w-full p-4 rounded-2xl border" />

        <input type="number" placeholder="Cantidad €" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-full p-4 rounded-2xl border" />

        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full p-4 rounded-2xl border" />

        <button onClick={guardarMovimiento} className="w-full bg-black text-white p-4 rounded-2xl">
          {editandoId ? "Guardar cambios" : "Añadir"}
        </button>

        {editandoId && (
          <button onClick={limpiarFormulario} className="w-full bg-gray-200 text-black p-4 rounded-2xl">
            Cancelar edición
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl shadow mt-8 space-y-4">
        <h2 className="text-2xl font-semibold">📊 Balance</h2>

        <select value={balance} onChange={(e) => setBalance(e.target.value)} className="w-full p-4 rounded-2xl border">
          <option value="mensual">Mensual</option>
          <option value="trimestral">Trimestral</option>
          <option value="anual">Anual</option>
        </select>

        <p>Ingresos: <strong>{totalIngresos.toFixed(2)} €</strong></p>
        <p>Gastos mensuales: <strong>{totalGastosMensuales.toFixed(2)} €</strong></p>
        <p>Gastos anuales: <strong>{totalGastosAnuales.toFixed(2)} €</strong></p>
        <p className="text-xl">Beneficio: <strong>{beneficio.toFixed(2)} €</strong></p>
      </div>

      <div className="mt-8 space-y-6">
        <section className="bg-white p-5 rounded-3xl shadow">
          <h2 className="text-2xl font-semibold mb-2">🔴 Gastos fijos mensuales</h2>
          <p className="mb-4 text-gray-500">Total: {totalGastosMensuales.toFixed(2)} €</p>
          <ListaMovimientos items={gastosMensuales} />
        </section>

        <section className="bg-white p-5 rounded-3xl shadow">
          <h2 className="text-2xl font-semibold mb-2">🟠 Gastos fijos anuales</h2>
          <p className="mb-4 text-gray-500">Total: {totalGastosAnuales.toFixed(2)} €</p>
          <ListaMovimientos items={gastosAnuales} />
        </section>

        <section className="bg-white p-5 rounded-3xl shadow">
          <h2 className="text-2xl font-semibold mb-2">🟢 Ingresos</h2>
          <p className="mb-4 text-gray-500">Total: {totalIngresos.toFixed(2)} €</p>
          <ListaMovimientos items={ingresos} />
        </section>
      </div>
    </div>
  );
}