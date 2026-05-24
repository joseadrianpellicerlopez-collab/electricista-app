import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Horarios() {

  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estado, setEstado] = useState("pendiente");

  const [visitas, setVisitas] = useState([]);
  const [editandoId, setEditandoId] = useState(null);

  useEffect(() => {
    cargarVisitas();
  }, []);

  async function cargarVisitas() {

    const { data, error } = await supabase
      .from("horarios")
      .select("*")
      .order("fecha", { ascending: true });

    if (error) {
      console.log(error);
      return;
    }

    setVisitas(data);
  }

  function limpiarFormulario() {

    setCliente("");
    setTelefono("");
    setDireccion("");
    setFecha("");
    setHora("");
    setDescripcion("");
    setEstado("pendiente");

    setEditandoId(null);
  }

  async function guardarVisita() {

    if (!cliente || !fecha || !hora) {
      alert("Rellena cliente, fecha y hora");
      return;
    }

    const datos = {
      cliente,
      telefono,
      direccion,
      fecha,
      hora,
      descripcion,
      estado,
    };

    if (editandoId) {

      const { error } = await supabase
        .from("horarios")
        .update(datos)
        .eq("id", editandoId);

      if (error) {
        console.log(error);
        alert("Error actualizando visita");
        return;
      }

    } else {

      const { error } = await supabase
        .from("horarios")
        .insert([datos]);

      if (error) {
        console.log(error);
        alert("Error guardando visita");
        return;
      }
    }

    limpiarFormulario();

    cargarVisitas();
  }

  function editarVisita(visita) {

    setCliente(visita.cliente || "");
    setTelefono(visita.telefono || "");
    setDireccion(visita.direccion || "");
    setFecha(visita.fecha || "");
    setHora(visita.hora || "");
    setDescripcion(visita.descripcion || "");
    setEstado(visita.estado || "pendiente");

    setEditandoId(visita.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function borrarVisita(id) {

    const confirmar = window.confirm(
      "¿Seguro que quieres borrar esta visita?"
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("horarios")
      .delete()
      .eq("id", id);

    if (error) {
      console.log(error);
      alert("Error borrando visita");
      return;
    }

    cargarVisitas();
  }

  async function cambiarEstado(id, nuevoEstado) {

    const { error } = await supabase
      .from("horarios")
      .update({
        estado: nuevoEstado,
      })
      .eq("id", id);

    if (error) {
      console.log(error);
      alert("Error cambiando estado");
      return;
    }

    cargarVisitas();
  }

  return (

    <div className="min-h-screen bg-gray-100 p-5">

      <div className="flex items-center gap-4 mb-6">

        <Link
          to="/"
          className="bg-white px-4 py-2 rounded-2xl shadow"
        >
          ← Volver
        </Link>

        <h1 className="text-4xl font-bold">
          📅 Horarios
        </h1>

      </div>

      <div className="bg-white p-6 rounded-3xl shadow space-y-4">

        <input
          type="text"
          placeholder="Cliente"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          className="w-full p-4 rounded-2xl border"
        />

        <input
          type="tel"
          placeholder="Número de teléfono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className="w-full p-4 rounded-2xl border"
        />

        <input
          type="text"
          placeholder="Dirección"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          className="w-full p-4 rounded-2xl border"
        />

        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="w-full p-4 rounded-2xl border"
        />

        <input
          type="time"
          value={hora}
          onChange={(e) => setHora(e.target.value)}
          className="w-full p-4 rounded-2xl border"
        />

        <textarea
          placeholder="Descripción"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="w-full p-4 rounded-2xl border"
        />

        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="w-full p-4 rounded-2xl border"
        >

          <option value="pendiente">
            Pendiente
          </option>

          <option value="realizado">
            Realizado
          </option>

        </select>

        <button
          onClick={guardarVisita}
          className="w-full bg-black text-white p-4 rounded-2xl"
        >

          {editandoId
            ? "Guardar cambios"
            : "Guardar visita"}

        </button>

        {editandoId && (

          <button
            onClick={limpiarFormulario}
            className="w-full bg-gray-200 text-black p-4 rounded-2xl"
          >

            Cancelar edición

          </button>

        )}

      </div>

      <div className="mt-8 space-y-4">

        {visitas.map((visita) => (

          <div
            key={visita.id}
            className="bg-white p-5 rounded-3xl shadow space-y-3"
          >

            <div className="flex justify-between items-start gap-3">

              <h2 className="text-2xl font-semibold">
                {visita.cliente}
              </h2>

              <span
                className={
                  visita.estado === "realizado"

                    ? "bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm"

                    : "bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm"
                }
              >

                {visita.estado === "realizado"
                  ? "Realizado"
                  : "Pendiente"}

              </span>

            </div>

            {visita.telefono && (

              <a
                href={`tel:${visita.telefono}`}
                className="text-blue-600 font-semibold block"
              >

                📞 {visita.telefono}

              </a>

            )}

            <p className="text-gray-500">
              📍 {visita.direccion}
            </p>

            <p className="text-gray-500">
  📅 {
    (() => {

      const fecha = new Date(visita.fecha);

      const dias = [
        "Domingo",
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
      ];

      const meses = [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
      ];

      return `${dias[fecha.getDay()]} ${String(
        fecha.getDate()
      ).padStart(2, "0")}-${
        meses[fecha.getMonth()]
      }-${fecha.getFullYear()}`;

    })()
  }
</p>
            

            <p className="text-gray-500">
              ⏰ {visita.hora}
            </p>

            <p>
              {visita.descripcion}
            </p>

            <select
              value={visita.estado || "pendiente"}
              onChange={(e) =>
                cambiarEstado(
                  visita.id,
                  e.target.value
                )
              }
              className="w-full p-3 rounded-2xl border"
            >

              <option value="pendiente">
                Pendiente
              </option>

              <option value="realizado">
                Realizado
              </option>

            </select>

            <div className="grid grid-cols-2 gap-3">

              <button
                onClick={() =>
                  editarVisita(visita)
                }
                className="bg-blue-100 text-blue-700 p-3 rounded-2xl"
              >

                ✏️ Editar

              </button>

              <button
                onClick={() =>
                  borrarVisita(visita.id)
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