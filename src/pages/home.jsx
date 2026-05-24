import { Link } from "react-router-dom";

export default function Home() {

  return (

    <div className="min-h-screen bg-gray-100 p-5">

      <div className="text-center mt-10">

        <h1 className="text-4xl font-bold">
          Electricista & Aire Acondicionado
        </h1>

        <p className="text-gray-500 mt-2">
          Tu negocio, en orden.
        </p>

      </div>

      <div className="mt-10 space-y-5">

        <Link to="/horarios">

          <div className="bg-white rounded-3xl p-6 shadow">

            <h2 className="text-2xl font-semibold">
              📅 Horarios
            </h2>

            <p className="text-gray-500 mt-2">
              Gestiona tus visitas y trabajos
            </p>

          </div>

        </Link>

        <Link to="/finanzas">

          <div className="bg-white rounded-3xl p-6 shadow">

            <h2 className="text-2xl font-semibold">
              💰 Finanzas
            </h2>

            <p className="text-gray-500 mt-2">
              Controla ingresos y gastos
            </p>

          </div>

        </Link>

        <Link to="/tareas">

          <div className="bg-white rounded-3xl p-6 shadow">

            <h2 className="text-2xl font-semibold">
              📝 Tareas pendientes
            </h2>

            <p className="text-gray-500 mt-2">
              Anota cosas por hacer rápidamente
            </p>

          </div>

        </Link>

      </div>

    </div>
  );
}
