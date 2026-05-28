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
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargarVisitas();
  }, []);

  async function cargarVisitas() {
    const { data, error } = await supabase
      .from("horarios")
      .select("*")
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true });

    if (error) {
      console.log(error);
      return;
    }

    setVisitas(data || []);
  }

  function formatearFecha(fechaTexto) {
    const fechaObj = new Date(`${fechaTexto}T00:00:00`);

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

    return `${dias[fechaObj.getDay()]} ${String(
      fechaObj.getDate()
    ).padStart(2, "0")}-${meses[fechaObj.getMonth()]}-${fechaObj.getFullYear()}`;
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
      const { error } = await supabase.from("horarios").insert([datos]);

      if (error) {
        console.log(error);
        alert("Error guardando visita");
        return;
      }
    }

    limpiarFormulario();
    setMostrarFormulario(false);
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
    setMostrarFormulario(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function borrarVisita(id) {
    const confirmar = window.confirm("¿Seguro que quieres borrar esta visita?");
    if (!confirmar) return;

    const { error } = await supabase.from("horarios").delete().eq("id", id);

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
      .update({ estado: nuevoEstado })
      .eq("id", id);

    if (error) {
      console.log(error);
      alert("Error cambiando estado");
      return;
    }

    cargarVisitas();
  }

  function abrirMaps(direccion) {
    if (!direccion) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      direccion
    )}`;
    window.open(url, "_blank");
  }

  const visitasFiltradas = visitas.filter((visita) => {
    const texto = `
      ${visita.cliente || ""}
      ${visita.telefono || ""}
      ${visita.direccion || ""}
      ${visita.descripcion || ""}
      ${visita.estado || ""}
      ${visita.fecha || ""}
      ${visita.hora || ""}
    `.toLowerCase();

    return texto.includes(busqueda.toLowerCase());
  });

  const visitasAgrupadas = visitasFiltradas.reduce((grupo, visita) => {
    const claveFecha = visita.fecha || "Sin fecha";

    if (!grupo[claveFecha]) {
      grupo[claveFecha] = [];
    }

    grupo[claveFecha].push(visita);
    return grupo;
  }, {});

  return (
    <div className="min-h-screen bg-gray-100 p-5 pb-28">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/" className="bg-white px-4 py-2 rounded-2xl shadow">
          ← Volver
        </Link>

        <h1 className="text-4xl font-bold">📅 Horarios</h1>
      </div>

      <div className="bg-white p-4 rounded-3xl shadow mb-6">
        <input
          type="text"
          placeholder="Buscar cliente, teléfono, dirección, trabajo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full p-4 rounded-2xl border"
        />
      </div>

      {mostrarFormulario && (
        <div className="bg-white p-6 rounded-3xl shadow space-y-4 mb-8">
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
            <option value="pendiente">Pendiente</option>
            <option value="realizado">Realizado</option>
          </select>

          <button
            onClick={guardarVisita}
            className="w-full bg-black text-white p-4 rounded-2xl"
          >
            {editandoId ? "Guardar cambios" : "Guardar visita"}
          </button>

          <button
            onClick={() => {
              limpiarFormulario();
              setMostrarFormulario(false);
            }}
            className="w-full bg-gray-200 text-black p-4 rounded-2xl"
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="space-y-8">
        {Object.keys(visitasAgrupadas).map((fechaGrupo) => (
          <section key={fechaGrupo}>
            <div className="sticky top-0 z-10 bg-gray-100 py-3">
              <h2 className="text-xl font-bold text-gray-800 border-b pb-2">
                {fechaGrupo === "Sin fecha"
                  ? "Sin fecha"
                  : formatearFecha(fechaGrupo)}
              </h2>
            </div>

            <div className="space-y-4">
              {visitasAgrupadas[fechaGrupo].map((visita) => (
                <div
                  key={visita.id}
                  className="bg-white p-5 rounded-3xl shadow space-y-3"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <h3 className="text-2xl font-semibold">
                        {visita.cliente}
                      </h3>

                      <p className="text-gray-500 font-medium">
                        ⏰ {visita.hora}
                      </p>
                    </div>

                    <span
                      className={
                        visita.estado === "realizado"
                          ? "bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm"
                          : "bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm"
                      }
                    >
                      {visita.estado === "realizado" ? "Realizado" : "Pendiente"}
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

                  {visita.direccion && (
                    <button
                      onClick={() => abrirMaps(visita.direccion)}
                      className="text-blue-600 font-semibold text-left"
                    >
                      📍 {visita.direccion}
                    </button>
                  )}

                  {visita.descripcion && <p>{visita.descripcion}</p>}

                  <select
                    value={visita.estado || "pendiente"}
                    onChange={(e) => cambiarEstado(visita.id, e.target.value)}
                    className="w-full p-3 rounded-2xl border"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="realizado">Realizado</option>
                  </select>

                  <div className="grid grid-cols-3 gap-3">
                    <button
                      <button
  onClick={() =>
    cambiarEstado(
      visita.id,
      visita.estado === "pendiente"
        ? "realizado"
        : "pendiente"
    )
  }
  className={
    visita.estado === "pendiente"

      ? "bg-orange-100 text-orange-700 p-3 rounded-2xl"

      : "bg-green-100 text-green-700 p-3 rounded-2xl"
  }
>
  {visita.estado === "pendiente"
    ? "🟠"
    : "🟢"}
</button>

                    <button
                      onClick={() => editarVisita(visita)}
                      className="bg-blue-100 text-blue-700 p-3 rounded-2xl"
                    >
                      ✏️
                    </button>

                    <button
                      onClick={() => borrarVisita(visita.id)}
                      className="bg-red-100 text-red-700 p-3 rounded-2xl"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <button
        onClick={() => {
          limpiarFormulario();
          setMostrarFormulario(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className="fixed bottom-6 right-6 bg-black text-white w-16 h-16 rounded-full shadow-xl text-4xl flex items-center justify-center"
      >
        +
      </button>
    </div>
  );
}