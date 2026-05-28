import { BrowserRouter, Routes, Route } from "react-router-dom";
import Materiales from "./pages/Materiales";
import Home from "./pages/home";
import Horarios from "./pages/horarios";
import Finanzas from "./pages/finanzas";
import TareasPendientes from "./pages/TareasPendientes";

export default function App() {

  return (

    <BrowserRouter>

      <Routes>

        <Route
          path="/"
          element={<Home />}
        />
        <Route
          path="/materiales"
          element={<Materiales />}
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

      </Routes>

    </BrowserRouter>

  );
}import Materiales from "./pages/Materiales";