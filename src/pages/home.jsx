import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Home() {

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  function cambiarModo() {

    const nuevoModo = !darkMode;

    setDarkMode(nuevoModo);

  }

  return (

    <div className="min-h-screen bg-gray-100 dark:bg-black transition-colors duration-300 p-5 flex flex-col items-center justify-center">

      <div className="absolute top-5 right-5">

        <button
          onClick={cambiarModo}
          className="bg-white dark:bg-gray-800 dark:text-white px-4 py-2 rounded-2xl shadow"
        >

          {darkMode ? "☀️" : "🌙"}

        </button>

      </div>

      <img
        src="/logo.png"
        alt="Logo"
        className="w-40 h-40 object-contain mb-10"
      />

      <div className="w-full max-w-md space-y-5">

        <Link
          to="/horarios"
          className="block bg-white dark:bg-gray-900 dark:text-white text-center text-2xl font-semibold p-6 rounded-3xl shadow"
        >

          📅 Horarios

        </Link>

        <Link
          to="/finanzas"
          className="block bg-white dark:bg-gray-900 dark:text-white text-center text-2xl font-semibold p-6 rounded-3xl shadow"
        >

          💰 Finanzas

        </Link>

        <Link
          to="/tareas"
          className="block bg-white dark:bg-gray-900 dark:text-white text-center text-2xl font-semibold p-6 rounded-3xl shadow"
        >

          📝 Tareas pendientes

        </Link>

        <Link
          to="/materiales"
          className="block bg-white dark:bg-gray-900 dark:text-white text-center text-2xl font-semibold p-6 rounded-3xl shadow"
        >

          📦 Lista de material

        </Link>

      </div>

    </div>

  );
}