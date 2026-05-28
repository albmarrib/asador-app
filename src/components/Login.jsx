import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleIngresar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Si va bien, Firebase avisa a la App y entra automáticamente
    } catch (err) {
      setError('⚠️ Credenciales incorrectas o usuario no encontrado.');
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50/40 flex flex-col items-center justify-center p-4 font-sans antialiased">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-orange-100 max-w-sm w-full">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-sm">
            🔒
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Acceso Privado</h1>
          <p className="text-slate-500 text-xs font-bold uppercase mt-1">Asador D&C - Mostrador</p>
        </div>

        <form onSubmit={handleIngresar} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5">Email del Local</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 font-bold text-slate-700"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5">Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 font-bold text-slate-700"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-600 font-bold text-xs p-3 rounded-xl border border-rose-100 text-center">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={cargando}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-xl shadow-md uppercase tracking-wide text-sm mt-4 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            {cargando ? 'Comprobando...' : 'Entrar al Mostrador'}
          </button>
        </form>

      </div>
    </div>
  );
}
