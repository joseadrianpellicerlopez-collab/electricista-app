import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AccesoPresupuestos({ children }) {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [crear, setCrear] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  useEffect(() => {
    let activo = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!activo) return;
      setSesion(data.session); setCargando(false);
      if (error) setMensaje('No se ha podido comprobar la sesión. Recarga la página.');
    }).catch(() => { if (activo) { setCargando(false); setMensaje('No se ha podido conectar. Revisa tu conexión.'); } });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (activo) { setSesion(session); setCargando(false); setPassword(''); }
    });
    return () => { activo = false; data.subscription.unsubscribe(); };
  }, []);
  async function entrar(event) {
    event.preventDefault(); if (ocupado) return;
    setOcupado(true); setMensaje('');
    try {
      const result = crear ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/presupuestos` } }) : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) {
        const code = result.error.code;
        if (code === 'email_not_confirmed') throw new Error('Confirma primero tu correo electrónico y vuelve a iniciar sesión.');
        if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') throw new Error('Espera unos minutos antes de volver a intentarlo.');
        throw new Error(crear ? 'No se ha podido crear la cuenta. Revisa el correo y utiliza una contraseña de al menos 8 caracteres. Si ya tienes cuenta, inicia sesión.' : 'No se ha podido entrar. Revisa el correo y la contraseña, y comprueba que has confirmado tu correo.');
      }
      setPassword('');
      if (crear && !result.data.session) { setMensaje('Revisa tu correo y confirma la cuenta. Después vuelve a esta página e inicia sesión con tu correo y contraseña.'); setCrear(false); }
    } catch (error) { setMensaje(error.message || 'No se ha podido conectar. Inténtalo de nuevo.'); }
    finally { setOcupado(false); }
  }
  if (sesion) return children(sesion.user);
  return <div className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900 dark:bg-slate-950 dark:text-white"><div className="mx-auto max-w-md">
    <Link to="/" className="inline-block py-3 text-sm">← Volver al inicio</Link>
    <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-900"><h1 className="text-2xl font-bold">Tus presupuestos, en todos tus dispositivos</h1><p className="my-4 text-sm text-slate-600 dark:text-slate-300">Entra con la misma cuenta en el móvil y el ordenador. Solo tú podrás acceder a tus tarjetas y presupuestos.</p>
      {cargando ? <p role="status">Comprobando acceso…</p> : <form onSubmit={entrar} className="space-y-4">
        <h2 className="font-semibold">{crear ? 'Crear mi cuenta' : 'Iniciar sesión'}</h2>
        <label className="block text-sm">Correo electrónico<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent p-3" /></label>
        <label className="block text-sm">Contraseña<input type="password" required minLength={crear ? 8 : 1} autoComplete={crear ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent p-3" /></label>
        <button disabled={ocupado} className="w-full rounded-xl bg-blue-800 p-3 font-semibold text-white disabled:opacity-50">{ocupado ? 'Conectando…' : crear ? 'Crear cuenta' : 'Entrar'}</button>
        <button type="button" disabled={ocupado} onClick={() => { setCrear(!crear); setMensaje(''); }} className="w-full p-2 text-sm font-medium text-blue-700 dark:text-blue-200">{crear ? 'Ya tengo cuenta: iniciar sesión' : 'Primera vez: crear mi cuenta'}</button>
      </form>}
      {mensaje && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-950">{mensaje}</p>}
      <p className="mt-5 text-xs text-slate-500 dark:text-slate-300">Al entrar recuperaremos las tarjetas y presupuestos que tengas guardados en este navegador. No se borrará la copia local.</p>
    </section>
  </div></div>;
}
