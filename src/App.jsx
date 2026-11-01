import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/home";
import Horarios from "./pages/horarios";
import Finanzas from "./pages/finanzas";
import TareasPendientes from "./pages/TareasPendientes";
import Materiales from "./pages/materiales";
import Presupuestos from "./pages/presupuestos";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/horarios" element={<Horarios />} />
        <Route path="/finanzas" element={<Finanzas />} />
        <Route path="/tareas" element={<TareasPendientes />} />
        <Route path="/materiales" element={<Materiales />} />
        <Route path="/presupuestos" element={<Presupuestos />} />
      </Routes>
    </BrowserRouter>
  );
}