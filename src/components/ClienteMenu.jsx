import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, where } from 'firebase/firestore';

const LOCAL_ID = 'asador-dc'; 

export default function ClienteMenu() {
  const [franjas, setFranjas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  
  // NUEVO: Un único carrito universal para todo
  const [carrito, setCarrito] = useState({});
  const [horaRecogida, setHoraRecogida] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [pedidoConfirmado, setPedidoConfirmado] = useState(false);
  const [ticketId, setTicketId] = useState('');
  const [errorFormulario, setErrorFormulario] = useState('');

  useEffect(() => {
    const qFranjas = query(collection(db, 'franjas'), where('local', '==', LOCAL_ID));
    const unsubscribeFranjas = onSnapshot(qFranjas, (snapshot) => {
      const franjasFb = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      franjasFb.sort((a, b) => a.hora.localeCompare(b.hora));
      setFranjas(franjasFb);
    });

    const qProductos = query(collection(db, 'productos'), where('local', '==', LOCAL_ID));
    const unsubscribeProductos = onSnapshot(qProductos, (snapshot) => {
      setProductos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qPedidos = query(collection(db, 'pedidos'), where('local', '==', LOCAL_ID));
    const unsubscribePedidos = onSnapshot(qPedidos, (snapshot) => {
      setPedidos(
        snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(p => !p.archivado)
      );
    });

    return () => {
      unsubscribeFranjas();
      unsubscribeProductos();
      unsubscribePedidos();
    };
  }, []);

  // --- LÓGICA DE STOCK Y CARRITO ---
  
  // Extrae el consumo usando parseFloat para que entienda los decimales (0.5)
  const obtenerReservadosPorFranja = (horaFranjaInicio) => {
    return pedidos
      .filter(p => p.hora === horaFranjaInicio && !p.entregado)
      .reduce((sum, p) => sum + (parseFloat(p.detalle) || 0), 0);
  };

  // Suma cuánto espacio de horno requiere nuestro carrito actual
  const calcularUnidadesConsumidas = () => {
    let unidades = 0;
    Object.entries(carrito).forEach(([id, cant]) => {
      const p = productos.find(x => x.id === id);
      if (p && p.controlaStock) {
        unidades += (parseFloat(p.consumeUnidades) * cant);
      }
    });
    return unidades;
  };

  // Verifica si el carrito supera el stock o hay que deseleccionar la hora
  useEffect(() => {
    if (horaRecogida) {
      const franjaActual = franjas.find(f => f.hora.split(' ')[0] === horaRecogida);
      if (franjaActual) {
        const reservados = obtenerReservadosPorFranja(horaRecogida);
        const disponibles = Math.max(franjaActual.max - reservados, 0);
        if (calcularUnidadesConsumidas() > disponibles) {
          setHoraRecogida(''); 
        }
      }
    }
  }, [carrito, franjas, pedidos, horaRecogida]);

  const handleModificarCarrito = (id, incremento) => {
    setCarrito(prev => {
      const actual = prev[id] || 0;
      const nueva = Math.max(actual + incremento, 0);
      if (nueva === 0) {
        const { [id]: _, ...resto } = prev;
        return resto;
      }
      return { ...prev, [id]: nueva };
    });
  };

  const calcularTotal = () => {
    let total = 0;
    Object.entries(carrito).forEach(([id, cant]) => {
      const p = productos.find(x => x.id === id);
      if (p) total += (p.precio * cant);
    });
    return total;
  };

  const totalArticulos = Object.values(carrito).reduce((sum, q) => sum + q, 0);

  // NUEVO: Vigilante de la Paella
  const tienePaella = Object.entries(carrito).some(([id, cant]) => {
    const p = productos.find(x => x.id === id);
    return p && p.nombre.includes('PAELLA') && cant > 0;
  });

  // --- ENVIAR A FIREBASE ---
  const handleEnviarReserva = async (e) => {
    e.preventDefault();
    setErrorFormulario('');

    if (totalArticulos === 0) {
      setErrorFormulario('⚠️ Tu pedido está vacío.');
      return;
    }
    if (!horaRecogida) {
      setErrorFormulario('⚠️ Selecciona a qué hora pasarás a recoger la comida.');
      return;
    }
    if (!nombreCliente.trim()) {
      setErrorFormulario('⚠️ Dinos tu nombre para rotular tu pedido.');
      return;
    }

    const unidadesConsumidas = calcularUnidadesConsumidas();
    const lineasTicket = [];
    Object.entries(carrito).forEach(([id, cant]) => {
      const p = productos.find(x => x.id === id);
      if (p) lineasTicket.push(`${cant}x ${p.nombre}`);
    });
    
    // TRUCO: Empezamos el texto con el número de unidades consumidas (ej: "1.5 | ...")
    // Así la tablet del asador podrá leer este número al instante y descontarlo del stock.
    const detalleTexto = `${unidadesConsumidas} | ` + lineasTicket.join(' + ');

    try {
      const docRef = await addDoc(collection(db, 'pedidos'), {
        local: LOCAL_ID,
        cliente: nombreCliente.trim().toUpperCase(),
        hora: horaRecogida,
        detalle: detalleTexto,
        entregado: false,
        origen: 'QR', 
        creadoEn: new Date()
      });

      setTicketId(docRef.id.slice(-4).toUpperCase()); 
      setPedidoConfirmado(true);
    } catch (error) {
      setErrorFormulario('❌ Hubo un error de conexión. Inténtalo de nuevo.');
    }
  };

  if (pedidoConfirmado) {
    return (
      <div className="min-h-screen bg-orange-50/40 p-4 flex items-center justify-center font-sans antialiased">
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-emerald-100 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto animate-bounce">✓</div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">¡Reserva Confirmada!</h2>
            <p className="text-slate-500 text-sm mt-1">Ya lo tenemos apuntado en las espadas del asador.</p>
          </div>

          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-5 text-left space-y-3 font-mono">
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-400 text-xs">Nº DE PEDIDO:</span>
              <span className="font-black text-orange-600 text-sm">#{ticketId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">CLIENTE:</span>
              <span className="font-bold text-slate-800 text-xs">{nombreCliente.toUpperCase()}</span>
            </div>
            <div className="flex justify-between bg-orange-50 p-2 rounded-lg border border-orange-100">
              <span className="text-xs text-orange-800 font-bold">HORA RECOGIDA:</span>
              <span className="font-black text-orange-600 text-sm">⏰ {horaRecogida}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 text-xs text-slate-600 space-y-1">
              <span className="block font-bold text-[10px] text-slate-400 uppercase mb-1">Detalle:</span>
              {Object.entries(carrito).map(([id, cant]) => {
                const p = productos.find(x => x.id === id);
                if (!p) return null;
                return (
                  <div key={id} className="flex justify-between">
                    <span>{cant}x {p.nombre}</span>
                    <span>{(cant * p.precio).toFixed(2)}€</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-black text-slate-800 text-base">
              <span>TOTAL A PAGAR:</span>
              <span>{calcularTotal().toFixed(2)}€</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 font-bold bg-slate-100 p-3 rounded-xl">Paga cómodamente con tarjeta o efectivo al recogerlo en el mostrador. ¡Gracias!</p>
          <button onClick={() => window.location.reload()} className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl text-xs uppercase cursor-pointer">Hacer otro pedido</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50/30 text-slate-800 pb-32 font-sans antialiased">
      <header className="bg-white border-b border-orange-100 sticky top-0 z-40 shadow-sm px-4 py-4 text-center">
        <h1 className="text-2xl font-black text-orange-600 tracking-tight flex items-center justify-center gap-1.5">🔥 Asador D&C</h1>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">Haz tu pedido sin colas</p>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        <section className="space-y-3">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">🍗 Nuestra Carta</h2>
          
          {productos.length === 0 && (
             <p className="text-slate-400 text-sm text-center bg-white p-4 rounded-xl border border-slate-200">
               El menú de hoy se está cargando o no hay productos configurados...
             </p>
          )}

          {productos.map((plato) => {
            const cantidad = carrito[plato.id] || 0;
            return (
              <div key={plato.id} className={`bg-white rounded-2xl p-4 border shadow-sm flex items-center justify-between gap-4 transition-all ${cantidad > 0 ? 'border-orange-400' : 'border-orange-100/60'}`}>
                <div className="flex-1">
                  <h3 className="text-base font-black text-slate-800 leading-tight uppercase">{plato.nombre}</h3>
                  <span className="text-sm font-black text-orange-600 block mt-1">{parseFloat(plato.precio).toFixed(2)}€</span>
                </div>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-inner">
                  {cantidad > 0 ? (
                    <>
                      <button onClick={() => handleModificarCarrito(plato.id, -1)} className="w-8 h-8 font-black text-slate-600 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center active:scale-90 cursor-pointer">-</button>
                      <span className="w-8 text-center font-bold font-mono text-slate-800 text-sm">{cantidad}</span>
                      <button onClick={() => handleModificarCarrito(plato.id, 1)} className="w-8 h-8 font-black text-slate-600 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center active:scale-90 cursor-pointer">+</button>
                    </>
                  ) : (
                    <button onClick={() => handleModificarCarrito(plato.id, 1)} className="bg-slate-800 text-white font-black text-xs px-4 py-2.5 rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer">AÑADIR</button>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        <section className="bg-white rounded-2xl p-5 border border-orange-100/60 shadow-sm space-y-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">📋 Confirmar recogida</h2>
          {franjas.length === 0 ? (
            <p className="text-rose-500 font-bold text-sm bg-rose-50 p-3 rounded-lg text-center">
              Aún no hay horas disponibles para hoy.
            </p>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">¿A qué hora pasas a por ello?</label>
              <div className="grid grid-cols-3 gap-2">
                {franjas.map(f => {
                  const h = f.hora.split(' ')[0];
                  
                  // LÓGICA DE PAELLAS (Bloquear menos de 2 horas)
                  let bloqueadoPorPaella = false;
                  if (tienePaella) {
                    const ahora = new Date();
                    const [horas, minutos] = h.split(':');
                    const horaFranja = new Date();
                    horaFranja.setHours(parseInt(horas), parseInt(minutos), 0, 0);
                    if ((horaFranja - ahora) < 120 * 60 * 1000) {
                      bloqueadoPorPaella = true;
                    }
                  }

                  const reservados = obtenerReservadosPorFranja(h);
                  const disponibles = Math.max(f.max - reservados, 0);
                  const unidadesPedidas = calcularUnidadesConsumidas();
                  const cabenEnElHorno = disponibles >= unidadesPedidas; 

                  const botonDeshabilitado = !cabenEnElHorno || bloqueadoPorPaella;

                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={botonDeshabilitado} 
                      onClick={() => setHoraRecogida(h)}
                      className={`py-2 rounded-xl flex flex-col items-center justify-center transition-all border-2 
                        ${botonDeshabilitado 
                          ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed grayscale' 
                          : horaRecogida === h 
                            ? 'bg-orange-600 border-orange-600 text-white shadow-md' 
                            : 'bg-white border-slate-200 text-slate-700 hover:border-orange-300'}`}
                    >
                      <span className="text-sm font-black font-mono">{h}</span>
                      
                      {bloqueadoPorPaella ? (
                        <span className="text-[8px] font-black text-rose-500 tracking-wider">MÍN 2H (PAELLA)</span>
                      ) : !cabenEnElHorno ? (
                        <span className="text-[9px] font-black text-rose-500 tracking-wider">COMPLETO</span>
                      ) : disponibles <= 5 ? (
                        <span className={`text-[9px] font-black tracking-wider ${horaRecogida === h ? 'text-orange-200' : 'text-orange-500'}`}>Quedan {disponibles}</span>
                      ) : (
                        <span className={`text-[9px] font-bold tracking-wider ${horaRecogida === h ? 'text-orange-200' : 'text-slate-400'}`}>Libre</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">¿A qué nombre dejamos la reserva?</label>
            <input 
              type="text" 
              placeholder="Escribe tu nombre..."
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500 font-bold uppercase tracking-wide"
            />
          </div>

          {errorFormulario && (
            <p className="text-rose-600 font-bold text-xs text-center bg-rose-50 p-2 rounded-xl border border-rose-100">
              {errorFormulario}
            </p>
          )}
        </section>
      </main>

      {totalArticulos > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-orange-100 shadow-xl flex justify-center z-40">
          <button
            onClick={handleEnviarReserva}
            disabled={franjas.length === 0}
            className="w-full max-w-md bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black py-4 px-5 rounded-2xl shadow-lg flex justify-between items-center text-sm uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
          >
            <span>🛒 Confirmar ({totalArticulos})</span>
            <span className="bg-emerald-800/40 px-3 py-1 rounded-lg font-mono font-black">{calcularTotal().toFixed(2)}€</span>
          </button>
        </div>
      )}
    </div>
  );
}
