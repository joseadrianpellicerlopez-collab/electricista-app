import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { supabase } from "./lib/supabase";

import Home from "./pages/home";
import Horarios from "./pages/horarios";
import Finanzas from "./pages/finanzas";
import TareasPendientes from "./pages/TareasPendientes";

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function iniciarSesion() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Email o contraseña incorrectos");
      console.log(error);
    }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-100 p-5 flex items-center justify-center">
        <div className="bg-white p-6 rounded-3xl shadow w-full max-w-md space-y-4">
          <h1 className="text-3xl font-bold text-center">
            Acceso privado
          </h1>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 rounded-2xl border"
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-4 rounded-2xl border"
          />

          <button
            onClick={iniciarSesion}
            className="w-full bg-black text-white p-4 rounded-2xl"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={cerrarSesion}
          className="bg-white px-4 py-2 rounded-2xl shadow text-sm"
        >
          Salir
        </button>
      </div>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/horarios" element={<Horarios />} />
        <Route path="/finanzas" element={<Finanzas />} />
        <Route path="/tareas" element={<TareasPendientes />} />
      </Routes>
    </BrowserRouter>
  );
}