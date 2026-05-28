import React from 'react';
import Dashboard from './components/Dashboard';
import ClienteMenu from './components/ClienteMenu';

export default function App() {
  // Leemos la URL del navegador.
  // Si la dirección termina en "?modo=cliente" (la URL del QR), mostramos la carta móvil.
  // Si no lleva eso, mostramos el panel de control de la tablet.
  const params = new URLSearchParams(window.location.search);
  const esCliente = params.get('modo') === 'cliente';

  return (
    <div className="relative min-h-screen selection:bg-orange-500 selection:text-white">
      {esCliente ? <ClienteMenu /> : <Dashboard />}
    </div>
  );
}
