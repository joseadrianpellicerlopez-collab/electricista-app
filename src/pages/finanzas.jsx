import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Finanzas() {

  const [tipo, setTipo] = useState("mensual");
  const [concepto, setConcepto] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [movimientos, setMovimientos] = useState([]);
  const [editandoId, setEditandoId] = useState(null);

  useEffect(() => {
    cargarMovimientos();
  }, []);

  async function cargarMovimientos() {

    const { data, error } = await supabase
      .from("finanzas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      return;
    }

    setMovimientos(data || []);
  }

  function limpiarFormulario() {

    setTipo("mensual");
    setConcepto("");
    setCantidad("");
    setEditandoId(null);
  }

  async function guardarMovimiento() {

    if (!concepto || !cantidad) {
      alert("Completa concepto y cantidad");
      return;
    }

    const datos = {
      tipo,
      concepto,
      cantidad: Number(cantidad),
    };

    let error;

    if (editandoId) {

      ({ error } = await supabase
        .from("finanzas")
        .update(datos)
        .eq("id", editandoId));

    } else {

      ({ error } = await supabase
        .from("finanzas")
        .insert([datos]));
    }

    if (error) {
      console.log(error);
      alert("Error guardando movimiento");
      return;
    }

    limpiarFormulario();
    cargarMovimientos();
  }

  function editarMovimiento(movimiento) {

    setTipo(movimiento.tipo || "mensual");
    setConcepto(movimiento.concepto || "");
    setCantidad(movimiento.cantidad || "");
    setEditandoId(movimiento.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function borrarMovimiento(id) {

    const confirmar = window.confirm(
      "¿Seguro que quieres borrar este movimiento?"
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("finanzas")
      .delete()
      .eq("id", id);

    if (error) {
      console.log(error);
      alert("Error borrando movimiento");
      return;
    }

    cargarMovimientos();
  }

  const gastosMensuales = movimientos.filter(
    (m) => m.tipo === "mensual"
  );

  const gastosAnuales = movimientos.filter(
    (m) => m.tipo === "anual"
  );

  const gastosPuntuales = movimientos.filter(
    (m) => m.tipo === "puntual"
  );

  const ingresos = movimientos.filter(
    (m) => m.tipo === "ingreso"
  );

  function sumar(lista) {

    return lista.reduce(
      (total, item) => total + Number(item.cantidad || 0),
      0
    );
  }

  const totalMensual = sumar(gastosMensuales);
  const totalAnual = sumar(gastosAnuales);
  const totalPuntual = sumar(gastosPuntuales);
  const totalIngresos = sumar(ingresos);

  const balanceMensual =
    totalIngresos -
    totalMensual -
    totalPuntual;

  const balanceAnual =
    (totalIngresos * 12) -
    (totalMensual * 12) -
    totalAnual -
    totalPuntual;

  function colorTipo(tipo) {

    if (tipo === "ingreso") {
      return "bg-green-100 text-green-700";
    }

    if (tipo === "puntual") {
      return "bg-red-100 text-red-700";
    }

    if (tipo === "anual") {
      return "bg-orange-100 text-orange-700";
    }

    return "bg-yellow-100 text-yellow-700";
  }

  function textoTipo(tipo) {

    if (tipo === "mensual") {
      return "Gasto mensual";
    }

    if (tipo === "anual") {
      return "Gasto anual";
    }

    if (tipo === "puntual") {
      return "Gasto puntual";
    }

    return "Ingreso";
  }

  return (

    <div className="min-h-screen bg-gray-100 dark:bg-black p-5 pb-28">

      <div className="flex items-center gap-4 mb-6">

        <Link
          to="/"
          className="bg-white dark:bg-gray-900 dark:text-white px-4 py-2 rounded-2xl shadow"
        >

          ← Volver

        </Link>

        <h1 className="text-4xl font-bold dark:text-white">
          💰 Finanzas
        </h1>

      </div>

      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow space-y-4 mb-6">

        <input
          type="text"
          placeholder="Concepto"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          className="w-full p-4 rounded-2xl border dark:bg-gray-800 dark:text-white"
        />

        <input
          type="number"
          placeholder="Cantidad €"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="w-full p-4 rounded-2xl border dark:bg-gray-800 dark:text-white"
        />

        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="w-full p-4 rounded-2xl border dark:bg-gray-800 dark:text-white"
        >

          <option value="mensual">
            Gasto fijo mensual
          </option>

          <option value="anual">
            Gasto fijo anual
          </option>

          <option value="puntual">
            Gasto puntual
          </option>

          <option value="ingreso">
            Ingreso
          </option>

        </select>

        <button
          onClick={guardarMovimiento}
          className="w-full bg-black text-white p-4 rounded-2xl"
        >

          {editandoId
            ? "Guardar cambios"
            : "Añadir movimiento"}

        </button>

      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">

        <div className="bg-white dark:bg-gray-900 dark:text-white p-4 rounded-3xl shadow">
          <p className="text-sm text-gray-500">
            Gastos mensuales
          </p>

          <h2 className="text-2xl font-bold">
            {totalMensual.toFixed(2)} €
          </h2>
        </div>

        <div className="bg-white dark:bg-gray-900 dark:text-white p-4 rounded-3xl shadow">
          <p className="text-sm text-gray-500">
            Gastos anuales
          </p>

          <h2 className="text-2xl font-bold">
            {totalAnual.toFixed(2)} €
          </h2>
        </div>

        <div className="bg-white dark:bg-gray-900 dark:text-white p-4 rounded-3xl shadow">
          <p className="text-sm text-gray-500">
            Gastos puntuales
          </p>

          <h2 className="text-2xl font-bold">
            {totalPuntual.toFixed(2)} €
          </h2>
        </div>

        <div className="bg-white dark:bg-gray-900 dark:text-white p-4 rounded-3xl shadow">
          <p className="text-sm text-gray-500">
            Ingresos
          </p>

          <h2 className="text-2xl font-bold">
            {totalIngresos.toFixed(2)} €
          </h2>
        </div>

      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">

        <div className="bg-green-100 p-4 rounded-3xl shadow">
          <p className="text-sm text-green-700">
            Balance mensual
          </p>

          <h2 className="text-2xl font-bold text-green-700">
            {balanceMensual.toFixed(2)} €
          </h2>
        </div>

        <div className="bg-blue-100 p-4 rounded-3xl shadow">
          <p className="text-sm text-blue-700">
            Balance anual
          </p>

          <h2 className="text-2xl font-bold text-blue-700">
            {balanceAnual.toFixed(2)} €
          </h2>
        </div>

      </div>

      <div className="space-y-4">

        {movimientos.map((movimiento) => (

          <div
            key={movimiento.id}
            className="bg-white dark:bg-gray-900 dark:text-white p-5 rounded-3xl shadow space-y-3"
          >

            <div className="flex justify-between items-start gap-3">

              <div>

                <h2 className="text-2xl font-semibold">
                  {movimiento.concepto}
                </h2>

                <p className="text-gray-500 mt-1">
                  💶 {Number(
                    movimiento.cantidad
                  ).toFixed(2)} €
                </p>

              </div>

              <span
                className={`${colorTipo(
                  movimiento.tipo
                )} px-3 py-1 rounded-full text-sm`}
              >

                {textoTipo(movimiento.tipo)}

              </span>

            </div>

            <div className="grid grid-cols-2 gap-3">

              <button
                onClick={() =>
                  editarMovimiento(movimiento)
                }
                className="bg-blue-100 text-blue-700 p-3 rounded-2xl"
              >

                ✏️ Editar

              </button>

              <button
                onClick={() =>
                  borrarMovimiento(movimiento.id)
                }
                className="bg-red-100 text-red-700 p-3 rounded-2xl"
              >

                🗑️ Borrar

              </button>

            </div>

          </div>

        ))}

      </div>

    </div>
  );
}