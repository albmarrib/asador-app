import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ClienteMenu from './components/ClienteMenu';
import Login from './components/Login';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const esCliente = params.get('modo') === 'cliente';

  const [usuario, setUsuario] = useState(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);

  // Escuchamos si hay un usuario logueado en la memoria de la tablet
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setCargandoAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // REGLA 1: Si es el enlace del cliente (QR), pasa siempre sin preguntar
  if (esCliente) {
    return (
      <div className="relative min-h-screen selection:bg-orange-500 selection:text-white">
        <ClienteMenu />
      </div>
    );
  }

  // REGLA 2: Si aún estamos preguntando a Firebase quién es, mostramos "Cargando"
  if (cargandoAuth) {
    return (
      <div className="min-h-screen bg-orange-50/40 flex items-center justify-center font-black text-orange-600 animate-pulse">
        Conectando con el asador...
      </div>
    );
  }

  // REGLA 3: Si NO es cliente y el usuario NO está logueado, a la pantalla de Login
  // REGLA 4: Si NO es cliente y el usuario SÍ está logueado, al Mostrador
  return (
    <div className="relative min-h-screen selection:bg-orange-500 selection:text-white">
      {usuario ? <Dashboard /> : <Login />}
    </div>
  );
}
