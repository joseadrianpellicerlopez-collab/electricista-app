import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Horarios from "./pages/Horarios";
import Finanzas from "./pages/finanzas";
import TareasPendientes from "./pages/TareasPendientes";
import Materiales from "./pages/Materiales";

export default function App() {

  return (

    <BrowserRouter>

      <Routes>

        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/horarios"
          element={<Horarios />}
        />

        <Route
          path="/finanzas"
          element={<Finanzas />}
        />

        <Route
          path="/tareas"
          element={<TareasPendientes />}
        />

        <Route
          path="/materiales"
          element={<Materiales />}
        />

      </Routes>

    </BrowserRouter>

  );
}