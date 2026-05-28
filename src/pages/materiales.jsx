import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Materiales() {
  const [nombre, setNombre] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [almacen, setAlmacen] = useState("");
  const [estado, setEstado] = useState("comprado");

  const [materiales, setMateriales] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargarMateriales();
  }, []);

  async function cargarMateriales() {
    const { data, error } = await supabase
      .from("materiales")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      alert("Error cargando materiales");
      return;
    }

    setMateriales(data || []);
  }

  function limpiarFormulario() {
    setNombre("");
    setCantidad("");
    setPrecio("");
    setAlmacen("");
    setEstado("comprado");
    setEditandoId(null);
  }

  async function guardarMaterial() {
    if (!nombre) {
      alert("Escribe el nombre del material");
      return;
    }

    const datos = {
      nombre,
      cantidad,
      precio: precio ? Number(precio) : null,
      almacen,
      estado,
    };

    const consulta = editandoId
      ? supabase.from("materiales").update(datos).eq("id", editandoId)
      : supabase.from("materiales").insert([datos]);

    const { error } = await consulta;

    if (error) {
      console.log(error);
      alert("Error guardando material");
      return;
    }

    limpiarFormulario();
    cargarMateriales();
  }

  function editarMaterial(material) {
    setNombre(material.nombre || "");
    setCantidad(material.cantidad || "");
    setPrecio(material.precio || "");
    setAlmacen(material.almacen || "");
    setEstado(material.estado || "comprado");
    setEditandoId(material.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function borrarMaterial(id) {
    const confirmar = window.confirm(
      "¿Seguro que quieres borrar este material?"
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("materiales")
      .delete()
      .eq("id", id);

    if (error) {
      console.log(error);
      alert("Error borrando material");
      return;
    }

    cargarMateriales();
  }

  async function cambiarEstado(id, nuevoEstado) {
    const { error } = await supabase
      .from("materiales")
      .update({
        estado: nuevoEstado,
      })
      .eq("id", id);

    if (error) {
      console.log(error);
      alert("Error cambiando estado");
      return;
    }

    cargarMateriales();
  }

  function colorEstado(estado) {
    if (estado === "comprado") {
      return "bg-green-100 text-green-700";
    }

    if (estado === "queda_poco") {
      return "bg-orange-100 text-orange-700";
    }

    return "bg-red-100 text-red-700";
  }

  function textoEstado(estado) {
    if (estado === "comprado") {
      return "Comprado";
    }

    if (estado === "queda_poco") {
      return "Queda poco";
    }

    return "Agotado";
  }

  const materialesFiltrados = materiales.filter((material) => {
    const texto = `
      ${material.nombre || ""}
      ${material.cantidad || ""}
      ${material.precio || ""}
      ${material.almacen || ""}
      ${material.estado || ""}
    `.toLowerCase();

    return texto.includes(busqueda.toLowerCase());
  });

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
          📦 Material
        </h1>
      </div>

      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow space-y-4 mb-6">
        <input
          type="text"
          placeholder="Nombre del material"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full p-4 rounded-2xl border dark:bg-gray-800 dark:text-white"
        />

        <input
          type="text"
          placeholder="Cantidad / nota, ejemplo: 3 rollos, 10 metros..."
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="w-full p-4 rounded-2xl border dark:bg-gray-800 dark:text-white"
        />

        <input
          type="number"
          placeholder="Precio €"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          className="w-full p-4 rounded-2xl border dark:bg-gray-800 dark:text-white"
        />

        <input
          type="text"
          placeholder="Almacén donde lo compraste"
          value={almacen}
          onChange={(e) => setAlmacen(e.target.value)}
          className="w-full p-4 rounded-2xl border dark:bg-gray-800 dark:text-white"
        />

        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="w-full p-4 rounded-2xl border dark:bg-gray-800 dark:text-white"
        >
          <option value="comprado">Comprado</option>
          <option value="queda_poco">Queda poco</option>
          <option value="agotado">Agotado</option>
        </select>

        <button
          onClick={guardarMaterial}
          className="w-full bg-black text-white p-4 rounded-2xl"
        >
          {editandoId ? "Guardar cambios" : "Añadir material"}
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

      <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl shadow mb-6">
        <input
          type="text"
          placeholder="Buscar material..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full p-4 rounded-2xl border dark:bg-gray-800 dark:text-white"
        />
      </div>

      <div className="space-y-4">
        {materialesFiltrados.map((material) => (
          <div
            key={material.id}
            className="bg-white dark:bg-gray-900 dark:text-white p-5 rounded-3xl shadow space-y-3"
          >
            <div className="flex justify-between items-start gap-3">
              <div>
                <h2 className="text-2xl font-semibold">
                  {material.nombre}
                </h2>

                {material.cantidad && (
                  <p className="text-gray-500 dark:text-gray-300 mt-1">
                    📦 {material.cantidad}
                  </p>
                )}

                {material.precio && (
                  <p className="text-gray-500 dark:text-gray-300 mt-1">
                    💶 {material.precio} €
                  </p>
                )}

                {material.almacen && (
                  <p className="text-gray-500 dark:text-gray-300 mt-1">
                    🏬 {material.almacen}
                  </p>
                )}
              </div>

              <span
                className={`${colorEstado(
                  material.estado
                )} px-3 py-1 rounded-full text-sm`}
              >
                {textoEstado(material.estado)}
              </span>
            </div>

            <select
              value={material.estado || "comprado"}
              onChange={(e) =>
                cambiarEstado(material.id, e.target.value)
              }
              className="w-full p-3 rounded-2xl border dark:bg-gray-800 dark:text-white"
            >
              <option value="comprado">Comprado</option>
              <option value="queda_poco">Queda poco</option>
              <option value="agotado">Agotado</option>
            </select>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => editarMaterial(material)}
                className="bg-blue-100 text-blue-700 p-3 rounded-2xl"
              >
                ✏️ Editar
              </button>

              <button
                onClick={() => borrarMaterial(material.id)}
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