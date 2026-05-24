import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function TareasPendientes() {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [tareas, setTareas] = useState([]);
  const [editandoId, setEditandoId] = useState(null);

  const [pasarId, setPasarId] = useState(null);
  const [cliente, setCliente] = useState("");
  const [direccion, setDireccion] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");

  useEffect(() => {
    cargarTareas();
  }, []);

  async function cargarTareas() {
    const { data, error } = await supabase
      .from("tareas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      return;
    }

    setTareas(data || []);
  }

  function limpiarFormulario() {
    setTitulo("");
    setDescripcion("");
    setTelefono("");
    setEstado("pendiente");
    setEditandoId(null);
  }

  async function guardarTarea() {
    if (!titulo) {
      alert("Escribe un título");
      return;
    }

    const datos = {
      texto: titulo,
      descripcion,
      telefono,
      estado,
    };

    const consulta = editandoId
      ? supabase.from("tareas").update(datos).eq("id", editandoId)
      : supabase.from("tareas").insert([datos]);

    const { error } = await consulta;

    if (error) {
      console.log(error);
      alert("Error guardando tarea");
      return;
    }

    limpiarFormulario();
    cargarTareas();
  }

  function editarTarea(tarea) {
    setTitulo(tarea.texto || "");
    setDescripcion(tarea.descripcion || "");
    setTelefono(tarea.telefono || "");
    setEstado(tarea.estado || "pendiente");
    setEditandoId(tarea.id);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function borrarTarea(id) {
    if (!confirm("¿Seguro que quieres borrar esta tarea?")) return;

    const { error } = await supabase
      .from("tareas")
      .delete()
      .eq("id", id);

    if (error) {
      console.log(error);
      alert("Error borrando tarea");
      return;
    }

    cargarTareas();
  }

  async function cambiarEstado(id, nuevoEstado) {
    const { error } = await supabase
      .from("tareas")
      .update({ estado: nuevoEstado })
      .eq("id", id);

    if (error) {
      console.log(error);
      alert("Error cambiando estado");
      return;
    }

    cargarTareas();
  }

  function prepararPasarAHorarios(tarea) {
    setPasarId(tarea.id);
    setTitulo(tarea.texto || "");
    setDescripcion(tarea.descripcion || "");
    setTelefono(tarea.telefono || "");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function pasarAHorarios() {
    if (!cliente || !fecha || !hora) {
      alert("Rellena cliente, fecha y hora");
      return;
    }

    const descripcionCompleta = `${titulo}\n${descripcion}\nTel: ${telefono}`;

    const { error } = await supabase
      .from("horarios")
      .insert([
        {
          cliente,
          direccion,
          fecha,
          hora,
          descripcion: descripcionCompleta,
          estado: "pendiente",
        },
      ]);

    if (error) {
      console.log(error);
      alert("Error creando visita");
      return;
    }

    await supabase.from("tareas").delete().eq("id", pasarId);

    setPasarId(null);
    setCliente("");
    setDireccion("");
    setFecha("");
    setHora("");
    limpiarFormulario();
    cargarTareas();

    alert("Tarea pasada a Horarios");
  }

  const pendientes = tareas.filter((t) => t.estado === "pendiente");
  const realizadas = tareas.filter((t) => t.estado === "realizado");

  function Lista({ items }) {
    return (
      <div className="space-y-3">
        {items.map((tarea) => (
          <div key={tarea.id} className="bg-white p-5 rounded-3xl shadow space-y-3">
            <div className="flex justify-between items-start gap-3">
              <div>
                <p className="text-lg font-semibold">{tarea.texto}</p>
                {tarea.descripcion && (
                  <p className="text-gray-600 mt-1">{tarea.descripcion}</p>
                )}
                {tarea.telefono && (
                  <p className="text-gray-500 mt-1">📞 {tarea.telefono}</p>
                )}
              </div>

              <span
                className={
                  tarea.estado === "realizado"
                    ? "bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm"
                    : "bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm"
                }
              >
                {tarea.estado === "realizado" ? "Realizado" : "Pendiente"}
              </span>
            </div>

            <select
              value={tarea.estado}
              onChange={(e) => cambiarEstado(tarea.id, e.target.value)}
              className="w-full p-3 rounded-2xl border"
            >
              <option value="pendiente">Pendiente</option>
              <option value="realizado">Realizado</option>
            </select>

            <button
              onClick={() => prepararPasarAHorarios(tarea)}
              className="w-full bg-black text-white p-3 rounded-2xl"
            >
              Pasar a Horarios
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => editarTarea(tarea)}
                className="bg-blue-100 text-blue-700 p-3 rounded-2xl"
              >
                ✏️ Editar
              </button>

              <button
                onClick={() => borrarTarea(tarea.id)}
                className="bg-red-100 text-red-700 p-3 rounded-2xl"
              >
                🗑️ Borrar
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

        <h1 className="text-4xl font-bold">📝 Tareas Pendientes</h1>
      </div>

      {pasarId && (
        <div className="bg-white p-6 rounded-3xl shadow space-y-4 mb-8">
          <h2 className="text-2xl font-semibold">Pasar a Horarios</h2>

          <input
            type="text"
            placeholder="Cliente"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
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

          <button
            onClick={pasarAHorarios}
            className="w-full bg-black text-white p-4 rounded-2xl"
          >
            Crear visita
          </button>

          <button
            onClick={() => setPasarId(null)}
            className="w-full bg-gray-200 text-black p-4 rounded-2xl"
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl shadow space-y-4">
        <input
          type="text"
          placeholder="Título"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="w-full p-4 rounded-2xl border"
        />

        <textarea
          placeholder="Descripción"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="w-full p-4 rounded-2xl border"
        />

        <input
          type="tel"
          placeholder="Número de teléfono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
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
          onClick={guardarTarea}
          className="w-full bg-black text-white p-4 rounded-2xl"
        >
          {editandoId ? "Guardar cambios" : "Añadir tarea"}
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

      <div className="mt-8 space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-4">🟡 Pendientes</h2>
          <Lista items={pendientes} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">🟢 Realizadas</h2>
          <Lista items={realizadas} />
        </section>
      </div>
    </div>
  );
}