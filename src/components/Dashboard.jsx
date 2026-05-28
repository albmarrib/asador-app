import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';

const LOCAL_ID = 'asador-dc'; // Identificador único para este cliente (SaaS)

export default function Dashboard() {
  const [vista, setVista] = useState('mostrador'); 
  const [franjas, setFranjas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  
  // NUEVO ESTADO: Guardará los productos/complementos de Firebase
  const [productos, setProductos] = useState([]); 
  
  const [filtroHora, setFiltroHora] = useState('Todos');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tecladoPantallaCompleta, setTecladoPantallaCompleta] = useState(false);
  const [nombreCliente, setNombreCliente] = useState('');
  const [cantidadPollos, setCantidadPollos] = useState(1);
  
  // NUEVO ESTADO: Carrito temporal para el modal de reservas
  const [carritoExtras, setCarritoExtras] = useState({}); 
  
  const [patatas, setPatatas] = useState(false); // Lo mantenemos por compatibilidad con tu código base
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  const [errorValidacion, setErrorValidacion] = useState('');

  const filasTeclado = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ' ', '←']
  ];

  // --- CONEXIÓN EN TIEMPO REAL CON FIREBASE ---
  useEffect(() => {
    // NUEVO: Escuchar todos los pedidos activos para restar el stock
    const qPedidos = query(collection(db, 'pedidos'), where('local', '==', LOCAL_ID));
    const unsubscribePedidos = onSnapshot(qPedidos, (snapshot) => {
      setPedidos(
        snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(p => !p.archivado) // <--- ESTO ES LO ÚNICO NUEVO
      );
    });

    // 2. Escuchar las franjas horarias
    const qFranjas = query(collection(db, 'franjas'), where('local', '==', LOCAL_ID));
    const unsubscribeFranjas = onSnapshot(qFranjas, (snapshot) => {
      const franjasFirebase = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      franjasFirebase.sort((a, b) => a.hora.localeCompare(b.hora));
      setFranjas(franjasFirebase);
    });

    // 3. NUEVO: Escuchar los productos/complementos
    const qProductos = query(collection(db, 'productos'), where('local', '==', LOCAL_ID));
    const unsubscribeProductos = onSnapshot(qProductos, (snapshot) => {
      const productosFirebase = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProductos(productosFirebase);
    });

    return () => {
      unsubscribePedidos();
      unsubscribeFranjas();
      unsubscribeProductos();
    };
  }, []);

  // --- LÓGICA DE TRÁFICO Y STOCK ---
  const obtenerReservadosPorFranja = (horaFranja) => {
    const horaInicio = horaFranja.split(' ')[0];
    return pedidos
      .filter(p => p.hora === horaInicio && !p.entregado)
      .reduce((sum, p) => sum + (parseInt(p.detalle) || 1), 0); // Asumimos 1 pollo base por detalle para la barra
  };

  const calcularAlertaFranja = (f) => {
    const reales = obtenerReservadosPorFranja(f.hora);
    return reales > f.max ? reales - f.max : 0;
  };

  const capacidadTotal = franjas.reduce((acc, f) => acc + f.max, 0);
  const totalReservados = pedidos.filter(p => !p.entregado).reduce((sum, p) => sum + (parseInt(p.detalle) || 1), 0);
  const totalDisponibles = Math.max(capacidadTotal - totalReservados, 0);

  const obtenerFranjaActualEnCurso = () => {
    const ahora = new Date();
    const horaTexto = `${ahora.getHours().toString().padStart(2, '0')}:${ahora.getMinutes().toString().padStart(2, '0')}`;
    return franjas.find(f => {
      const [inicio, fin] = f.hora.split(' - ');
      return horaTexto >= inicio && horaTexto <= fin;
    }) || franjas[0];
  };

  // --- ACCIONES DE FIREBASE (ESCRITURA) ---
  const handleEntregar = async (id) => {
    await updateDoc(doc(db, 'pedidos', id), { entregado: true });
  };

  const handleAnularPedido = async (id) => {
    await deleteDoc(doc(db, 'pedidos', id));
  };

  const handleReubicarPedido = async (id, nuevaHora) => {
    await updateDoc(doc(db, 'pedidos', id), { hora: nuevaHora });
  };

  const handleRestarCapacidadMerma = async (franja) => {
    const nuevaCapacidad = Math.max(franja.max - 1, 0);
    await updateDoc(doc(db, 'franjas', franja.id), { max: nuevaCapacidad });
  };

  const handleAbrirNuevaReserva = () => {
    setNombreCliente('');
    setCantidadPollos(1);
    setPatatas(false);
    setCarritoExtras({}); // NUEVO: Reseteamos los extras
    setHoraSeleccionada(franjas.length > 0 ? franjas[0].hora.split(' ')[0] : '');
    setErrorValidacion('');
    setModalAbierto(true);
    setTecladoPantallaCompleta(false);
  };

  const handleTecladoPresionado = (letra) => {
    if (letra === '←') {
      setNombreCliente(prev => prev.slice(0, -1));
    } else {
      if (nombreCliente.length < 18) setNombreCliente(prev => prev + letra);
    }
  };

  // NUEVO: Función para sumar/restar cantidades de extras en el modal
  const handleModificarExtra = (productoId, incremento) => {
    setCarritoExtras(prev => {
      const actual = prev[productoId] || 0;
      const nuevaCantidad = Math.max(actual + incremento, 0);
      
      if (nuevaCantidad === 0) {
        const { [productoId]: _, ...resto } = prev;
        return resto;
      }
      return { ...prev, [productoId]: nuevaCantidad };
    });
  };

  const handleGuardarPedido = async () => {
    if (!nombreCliente.trim()) {
      setErrorValidacion('⚠️ El nombre del cliente es obligatorio.');
      return;
    }
    if (!horaSeleccionada) {
      setErrorValidacion('⚠️ Necesitas configurar al menos una franja horaria.');
      return;
    }

    let detalleTexto = `${cantidadPollos} ${cantidadPollos > 1 ? 'Pollos' : 'Pollo'}`;
    if (patatas) detalleTexto += ' + Patatas Fijas';

    // NUEVO: Añadimos los complementos dinámicos al texto del ticket
    Object.entries(carritoExtras).forEach(([prodId, cant]) => {
      const prodInfo = productos.find(p => p.id === prodId);
      if (prodInfo) {
        detalleTexto += ` + ${cant}x ${prodInfo.nombre}`;
      }
    });

    await addDoc(collection(db, 'pedidos'), {
      local: LOCAL_ID,
      cliente: nombreCliente.trim().toUpperCase(),
      hora: horaSeleccionada,
      detalle: detalleTexto,
      entregado: false,
      origen: 'Mostrador/Teléfono',
      creadoEn: new Date()
    });
    
    setModalAbierto(false);
  };

  const handleVentaDirectaMostrador = async () => {
    const franjaDestino = obtenerFranjaActualEnCurso();
    if (!franjaDestino) return; 

    await addDoc(collection(db, 'pedidos'), {
      local: LOCAL_ID,
      cliente: "VENTA DIRECTA MOSTRADOR",
      hora: franjaDestino.hora.split(' ')[0],
      detalle: "1 Pollo al Ast",
      entregado: true,
      origen: 'Mostrador Directo',
      creadoEn: new Date()
    });
  };

  // --- ACCIONES DE CONFIGURACIÓN FIREBASE ---
  const handleAjustarCapacidadConfig = async (franja, incremento) => {
    const nuevaCapacidad = Math.max(franja.max + incremento, 0);
    await updateDoc(doc(db, 'franjas', franja.id), { max: nuevaCapacidad });
  };

  const handleCrearFranjaNueva = async () => {
    const horaInicio = prompt("Introduce la hora de inicio (Ej: 13:00):");
    const horaFin = prompt("Introduce la hora de fin (Ej: 14:00):");
    const maxPollos = prompt("Límite máximo de pollos para este tramo:");
    if (horaInicio && horaFin && maxPollos) {
      await addDoc(collection(db, 'franjas'), {
        local: LOCAL_ID,
        hora: `${horaInicio} - ${horaFin}`,
        max: parseInt(maxPollos) || 0
      });
    }
  };

  const handleBorrarFranjaConfig = async (id) => {
    if(window.confirm("¿Seguro que quieres borrar este tramo horario?")) {
      await deleteDoc(doc(db, 'franjas', id));
    }
  };

  // NUEVA FUNCIÓN: Archiva todos los pedidos del día en Firebase
  const handleLimpiarDia = async () => {
    if (window.confirm("🚨 ¿Seguro que quieres CERRAR EL DÍA? \n\nEsto ocultará los pedidos actuales de la pantalla y liberará el stock para mañana. Los datos quedarán guardados de forma segura en la nube para tus estadísticas.")) {
      for (const p of pedidos) {
        await updateDoc(doc(db, 'pedidos', p.id), { archivado: true });
      }
    }
  };

  // NUEVO: Funciones para gestionar Productos en Configuración
  const handleCrearProductoNuevo = async () => {
    const nombre = prompt("Nombre del complemento (Ej: Patatas Caliu, Canelones):");
    const precio = prompt("Precio de venta en euros (Ej: 4.50):");
    const stock = prompt("Stock máximo disponible para vender hoy:");
    
    if (nombre && precio && stock) {
      await addDoc(collection(db, 'productos'), {
        local: LOCAL_ID,
        nombre: nombre.toUpperCase(),
        precio: parseFloat(precio) || 0,
        stockMaximo: parseInt(stock) || 0,
        activo: true
      });
    }
  };

  const handleBorrarProductoConfig = async (id) => {
    if(window.confirm("¿Seguro que quieres borrar este producto de la carta?")) {
      await deleteDoc(doc(db, 'productos', id));
    }
  };

  const handleAjustarStockProducto = async (producto, incremento) => {
    const nuevoStock = Math.max(producto.stockMaximo + incremento, 0);
    await updateDoc(doc(db, 'productos', producto.id), { stockMaximo: nuevoStock });
  };


  const pedidosProcesados = [...pedidos].sort((a, b) => {
    if (a.entregado && !b.entregado) return 1;
    if (!a.entregado && b.entregado) return -1;
    return a.hora.localeCompare(b.hora);
  });

  return (
    <div className="min-h-screen bg-orange-50/40 text-slate-800 p-4 md:p-6 font-sans antialiased">

<header className="sticky top-2 z-40 bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-md border border-orange-100 mb-6 relative overflow-hidden">
        {/* Indicador de conexión en tiempo real */}
        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> Nube Conectada
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 mt-2">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-black text-orange-600 tracking-tight">🔥 Asador D&C</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Panel de Control de Reservas</p>
          </div>
          
          <div className="grid grid-cols-3 gap-4 w-full lg:w-auto text-center font-mono">
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="block text-[10px] font-bold text-slate-500 uppercase">Total Asador</span>
              <span className="text-xl md:text-2xl font-black text-slate-700">{capacidadTotal}</span>
            </div>
            <div className="bg-orange-50 p-3 rounded-xl border border-orange-200">
              <span className="block text-[10px] font-bold text-orange-700 uppercase">Reservados</span>
              <span className="text-xl md:text-2xl font-black text-orange-600">{totalReservados}</span>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <span className="block text-[10px] font-bold text-emerald-700 uppercase">Libres Venta</span>
              <span className="text-xl md:text-2xl font-black text-emerald-600">{totalDisponibles}</span>
            </div>
          </div>

          <div className="flex gap-3 w-full lg:w-auto">
            <button 
              onClick={handleAbrirNuevaReserva}
              className="flex-1 lg:flex-none bg-orange-600 hover:bg-orange-700 text-white font-black px-6 py-4 rounded-xl shadow-md transition-all active:scale-95 text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50"
              disabled={franjas.length === 0}
            >
              ➕ NUEVA RESERVA
            </button>
            <button 
              onClick={handleVentaDirectaMostrador}
              className="flex-1 lg:flex-none bg-slate-800 hover:bg-slate-900 text-white font-black px-5 py-4 rounded-xl shadow-md transition-all active:scale-95 text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50"
              disabled={franjas.length === 0}
            >
              🪙 VENTA DIRECTA
            </button>
            <button 
              onClick={() => setVista(vista === 'mostrador' ? 'configuracion' : 'mostrador')}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-black px-4 py-4 rounded-xl text-sm transition-all cursor-pointer"
              title="Configuración de franjas"
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      {/* AVISO SI LA BASE DE DATOS ESTÁ VACÍA */}
      {franjas.length === 0 && vista === 'mostrador' && (
        <div className="bg-white border-2 border-dashed border-orange-300 rounded-2xl p-12 text-center shadow-sm">
          <h2 className="text-2xl font-black text-slate-800 uppercase mb-2">Asador Vacío</h2>
          <p className="text-slate-500 mb-6">Aún no has configurado tus horas de reparto en la base de datos.</p>
          <button 
            onClick={() => setVista('configuracion')}
            className="bg-slate-800 text-white font-black px-8 py-4 rounded-xl shadow-lg cursor-pointer hover:bg-slate-700"
          >
            ⚙️ Ir a Configuración para empezar
          </button>
        </div>
      )}

      {vista === 'mostrador' && franjas.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          <section className="xl:col-span-5 bg-white rounded-2xl p-5 shadow-sm border border-orange-100">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4">📊 Estado de Carga del Asador</h2>
            
            <div className="space-y-4">
              {franjas.map((f) => {
                const reservados = obtenerReservadosPorFranja(f.hora);
                const faltaPollo = calcularAlertaFranja(f);
                const porcentaje = (reservados / f.max) * 100;
                let colorBarra = "bg-emerald-500";
                let estiloFila = "bg-slate-50/60 border-slate-100";

                if (faltaPollo > 0) {
                  colorBarra = "bg-rose-500 animate-pulse";
                  estiloFila = "bg-rose-50 border-rose-200 ring-2 ring-rose-500/10";
                } else if (porcentaje >= 85) {
                  colorBarra = "bg-amber-500";
                  estiloFila = "bg-amber-50/50 border-amber-200";
                }

                return (
                  <div key={f.id} className={`p-4 rounded-xl border flex flex-col gap-2 ${estiloFila}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-black text-xl text-slate-800">{f.hora}</span>
                        <span className="block text-xs font-bold text-slate-500 mt-0.5">
                          {reservados} / {f.max} pollos comprometidos
                        </span>
                      </div>
                      <button
                        onClick={() => handleRestarCapacidadMerma(f)}
                        className="bg-white hover:bg-rose-50 text-rose-500 border border-slate-200 font-bold px-3 py-2 rounded-xl shadow-sm active:scale-90 text-xs cursor-pointer"
                      >
                        ⚠️ Mermar -1
                      </button>
                    </div>

                    {faltaPollo > 0 && (
                      <div className="bg-rose-600 text-white font-black text-xs px-3 py-1.5 rounded-lg">
                        🚨 ¡ALERTA! FALTAN {faltaPollo} POLLOS PARA ESTA HORA
                      </div>
                    )}
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
                      <div className={`h-3 rounded-full transition-all duration-300 ${colorBarra}`} style={{ width: `${Math.min(porcentaje, 100)}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="xl:col-span-7 bg-white rounded-2xl p-5 shadow-sm border border-orange-100">
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-black text-slate-400 uppercase mr-1">Filtrar:</span>
              <button 
                onClick={() => setFiltroHora('Todos')} 
                className={`px-3 py-2 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${filtroHora === 'Todos' ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
              >
                Todos
              </button>
              {franjas.map(f => {
                const h = f.hora.split(' ')[0];
                return (
                  <button 
                    key={f.id} 
                    onClick={() => setFiltroHora(h)} 
                    className={`px-3 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${filtroHora === h ? 'bg-orange-600 text-white border-orange-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
              {pedidosProcesados.length === 0 ? (
                <div className="text-center text-slate-400 font-bold py-10 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-sm">
                  No hay pedidos registrados.
                </div>
              ) : (
                pedidosProcesados
                  .filter(p => filtroHora === 'Todos' ? true : p.hora === filtroHora)
                  .map((p) => (
                    <div key={p.id} className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${p.entregado ? 'bg-slate-50 border-slate-200 opacity-55' : 'bg-amber-50/40 border-amber-200 shadow-sm'}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-black bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                            {p.origen === 'QR' ? '📲 WEB' : '📞 TIENDA'}
                          </span>
                          <span className={`text-[9px] px-2 py-0.5 rounded font-black tracking-wider ${p.entregado ? 'bg-slate-400 text-white' : 'bg-amber-500 text-white'}`}>
                            {p.entregado ? '✓ ENTREGADO' : '⏳ PENDIENTE'}
                          </span>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mt-1.5 uppercase tracking-tight">{p.cliente}</h3>
                        <p className="text-sm font-extrabold text-slate-600 mt-0.5">{p.detalle}</p>
                      </div>

                      <div className="flex sm:flex-col items-end sm:items-center justify-between gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-200/60">
                        <span className="text-lg font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-xl border border-orange-200 font-mono">⏰ {p.hora}</span>
                        
                        <div className="flex gap-1.5">
                          {!p.entregado && (
                            <select 
                              onChange={(e) => handleReubicarPedido(p.id, e.target.value)}
                              className="bg-white border border-slate-300 text-xs font-bold rounded-xl px-2 py-1 focus:outline-none cursor-pointer"
                              defaultValue=""
                            >
                              <option value="" disabled>↪️ Mover hora</option>
                              {franjas.map(fr => (
                                <option key={fr.id} value={fr.hora.split(' ')[0]}>{fr.hora.split(' ')[0]}</option>
                              ))}
                            </select>
                          )}
                          <button 
                            onClick={() => handleAnularPedido(p.id)} 
                            className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer"
                          >
                            ❌ Anular
                          </button>
                          {!p.entregado && (
                            <button 
                              onClick={() => handleEntregar(p.id)} 
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl shadow cursor-pointer"
                            >
                              ✓ Entregar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {vista === 'configuracion' && (
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100 max-w-4xl mx-auto space-y-8">
          
          {/* SECCIÓN 1: HORARIOS */}
          <div>
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase">⏱️ 1. Horarios y Capacidad</h2>
                <p className="text-slate-500 text-xs mt-0.5">Controla los límites de espadas por cada tramo de tiempo.</p>
              </div>
              <button 
                onClick={handleCrearFranjaNueva}
                className="bg-slate-800 hover:bg-slate-700 text-white font-black px-4 py-2.5 rounded-xl text-xs cursor-pointer shadow-sm"
              >
                ➕ Crear Tramo
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {franjas.length === 0 && (
                <p className="text-slate-400 font-bold py-2 col-span-2 text-sm">No hay tramos configurados. Crea uno para empezar.</p>
              )}
              {franjas.map(f => (
                <div key={f.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                  <span className="text-lg font-mono font-black text-slate-700">{f.hora}</span>
                  
                  <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-sm">
                    <button onClick={() => handleAjustarCapacidadConfig(f, -5)} className="bg-slate-100 font-black w-7 h-7 rounded-lg border border-slate-300 text-xs cursor-pointer hover:bg-slate-200">-5</button>
                    <button onClick={() => handleAjustarCapacidadConfig(f, -1)} className="bg-slate-100 font-black w-6 h-6 rounded-lg border border-slate-300 text-[10px] cursor-pointer hover:bg-slate-200">-1</button>
                    <span className="text-base font-mono font-black text-slate-800 w-8 text-center">{f.max}</span>
                    <button onClick={() => handleAjustarCapacidadConfig(f, 1)} className="bg-slate-100 font-black w-6 h-6 rounded-lg border border-slate-300 text-[10px] cursor-pointer hover:bg-slate-200">+1</button>
                    <button onClick={() => handleAjustarCapacidadConfig(f, 5)} className="bg-slate-100 font-black w-7 h-7 rounded-lg border border-slate-300 text-xs cursor-pointer hover:bg-slate-200">+5</button>
                  </div>

                  <button 
                    onClick={() => handleBorrarFranjaConfig(f.id)}
                    className="text-rose-500 font-black text-xs uppercase px-2 py-2 bg-rose-50 rounded-lg hover:bg-rose-100 cursor-pointer border border-rose-200"
                    title="Borrar Franja"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* NUEVA SECCIÓN 2: COMPLEMENTOS DE LA CARTA */}
          <div>
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase">🍟 2. Carta y Complementos</h2>
                <p className="text-slate-500 text-xs mt-0.5">Añade canelones, patatas, bebidas y controla su stock diario.</p>
              </div>
              <button 
                onClick={handleCrearProductoNuevo}
                className="bg-orange-100 text-orange-700 hover:bg-orange-200 font-black px-4 py-2.5 rounded-xl text-xs border border-orange-300 cursor-pointer shadow-sm"
              >
                ➕ Añadir Producto
              </button>
            </div>

            <div className="space-y-3">
              {productos.length === 0 ? (
                <p className="text-center text-slate-400 font-bold py-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-sm">Aún no has añadido productos complementarios a la carta.</p>
              ) : (
                productos.map(p => (
                  <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                    <div className="flex-1">
                      <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">{p.nombre}</h3>
                      <span className="text-orange-600 font-black text-sm">{parseFloat(p.precio).toFixed(2)}€ / ud</span>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1">Stock Diario:</span>
                      <button onClick={() => handleAjustarStockProducto(p, -5)} className="font-black w-8 h-8 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-100">-5</button>
                      <button onClick={() => handleAjustarStockProducto(p, -1)} className="font-black w-6 h-6 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-100">-</button>
                      <span className="text-lg font-mono font-black text-slate-800 w-10 text-center">{p.stockMaximo}</span>
                      <button onClick={() => handleAjustarStockProducto(p, 1)} className="font-black w-6 h-6 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-100">+</button>
                      <button onClick={() => handleAjustarStockProducto(p, 5)} className="font-black w-8 h-8 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-100">+5</button>
                    </div>

                    <button 
                      onClick={() => handleBorrarProductoConfig(p.id)}
                      className="text-rose-500 bg-rose-50 px-3 py-2 rounded-lg font-bold text-xs uppercase border border-rose-100 cursor-pointer hover:bg-rose-100"
                    >
                      Borrar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* NUEVA SECCIÓN 3: CIERRE DE CAJA */}
          <div>
            <div className="mt-8 p-6 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-inner">
              <div>
                <h3 className="text-lg font-black text-rose-700 uppercase">🧹 Cierre de Caja Diario</h3>
                <p className="text-rose-600 text-xs mt-1 font-bold">Oculta todos los pedidos actuales y reinicia la disponibilidad de pollos para el día siguiente.</p>
              </div>
              <button 
                onClick={handleLimpiarDia} 
                className="bg-rose-600 hover:bg-rose-700 text-white font-black px-6 py-3 rounded-xl shadow-md uppercase text-sm cursor-pointer whitespace-nowrap active:scale-95"
              >
                Cerrar Día
              </button>
            </div>
          </div>

          <div className="text-right border-t border-slate-100 pt-6">
            <button 
              onClick={() => setVista('mostrador')} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-4 rounded-xl uppercase text-sm shadow cursor-pointer"
            >
              💾 Volver al Mostrador
            </button>
          </div>
        </section>
      )}

      {/* MODAL TPV GIGANTE */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 z-50">
          
          {tecladoPantallaCompleta ? (
            <div className="w-full h-full flex flex-col justify-between p-4 max-w-5xl mx-auto bg-white rounded-3xl shadow-2xl border border-slate-300 my-2">
              <div className="bg-orange-50 p-5 rounded-2xl border-2 border-orange-400 text-center shadow-inner">
                <span className="text-xs font-black text-orange-700 uppercase tracking-widest block mb-1">Nombre del Cliente</span>
                <div className="text-5xl font-black text-slate-800 uppercase font-mono tracking-wide min-h-[60px] flex items-center justify-center">
                  {nombreCliente || <span className="text-slate-300">PULSA LAS TECLAS INFERIORES...</span>}
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center gap-3 my-6">
                {filasTeclado.map((fila, fIdx) => (
                  <div key={fIdx} className="flex justify-center gap-2 h-16 sm:h-22 w-full">
                    {fila.map((letra, lIdx) => {
                      let estiloLetra = "bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-3xl rounded-2xl flex-1 border-b-4 border-slate-300 active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow select-none font-mono";
                      if (letra === '←') estiloLetra = "bg-rose-500 hover:bg-rose-600 text-white text-3xl font-black flex-[1.5] rounded-2xl border-b-4 border-rose-700 cursor-pointer";
                      if (letra === ' ') estiloLetra = "bg-slate-400 hover:bg-slate-500 text-white font-black text-xl flex-[3] rounded-2xl border-b-4 border-slate-600 cursor-pointer uppercase";
                      
                      return (
                        <button key={lIdx} type="button" onClick={() => handleTecladoPresionado(letra)} className={estiloLetra}>
                          {letra}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <button 
                type="button" 
                onClick={() => setTecladoPantallaCompleta(false)} 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xl py-5 rounded-2xl uppercase tracking-wider cursor-pointer shadow-md transition-colors"
              >
                ✓ Fijar Nombre y Regresar al Formulario
              </button>
            </div>
          ) : (
            
            <div className="bg-white rounded-3xl w-full max-w-xl p-6 border border-orange-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-100">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <h3 className="text-xl font-black text-orange-600 uppercase">📝 Añadir Nueva Reserva Manual</h3>
                <button onClick={() => setModalAbierto(false)} className="text-slate-400 font-black text-xl cursor-pointer p-1">✕</button>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">PULSA PARA INTRODUCIR NOMBRE:</label>
                <div 
                  onClick={() => setTecladoPantallaCompleta(true)}
                  className="w-full bg-slate-50 border-2 border-slate-200 hover:border-orange-400 p-4 rounded-xl text-center text-2xl font-black text-slate-800 uppercase tracking-wide cursor-pointer transition-all shadow-inner"
                >
                  {nombreCliente || <span className="text-slate-400 font-medium text-lg">👉 HACER CLIC AQUÍ PARA ESCRIBIR 👈</span>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5">Hora de Recogida:</label>
                <div className="grid grid-cols-4 gap-2">
                  {franjas.map(f => {
                    const h = f.hora.split(' ')[0];
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setHoraSeleccionada(h)}
                        className={`py-3 rounded-xl font-black font-mono text-base border-2 transition-all cursor-pointer ${horaSeleccionada === h ? 'bg-orange-600 text-white border-orange-600 scale-105 shadow-md' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-sm font-black text-slate-800 uppercase">🍗 Pollos Enteros:</span>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setCantidadPollos(prev => Math.max(prev - 1, 1))} className="bg-white font-black w-10 h-10 rounded-lg border border-slate-300 shadow-sm text-lg cursor-pointer">-</button>
                  <span className="text-xl font-mono font-black text-slate-800 w-6 text-center">{cantidadPollos}</span>
                  <button type="button" onClick={() => setCantidadPollos(prev => prev + 1)} className="bg-white font-black w-10 h-10 rounded-lg border border-slate-300 shadow-sm text-lg cursor-pointer">+</button>
                </div>
              </div>

              {/* LISTA DINÁMICA DE EXTRAS EN EL MODAL */}
              {productos.length > 0 ? (
                <div className="bg-orange-50/60 p-3 rounded-xl border border-orange-200 max-h-48 overflow-y-auto space-y-2 shadow-inner">
                  <span className="text-[10px] font-black text-orange-700 uppercase tracking-wider block mb-1">Añadir Complementos a la orden:</span>
                  {productos.map(prod => (
                    <div key={prod.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                      <span className="text-xs font-black text-slate-700 uppercase">{prod.nombre}</span>
                      <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-2 py-1 border border-slate-200">
                        <button type="button" onClick={() => handleModificarExtra(prod.id, -1)} className="font-black text-slate-500 px-2 py-1 active:scale-90 text-sm cursor-pointer">-</button>
                        <span className="font-mono font-black text-base w-4 text-center text-slate-800">{carritoExtras[prod.id] || 0}</span>
                        <button type="button" onClick={() => handleModificarExtra(prod.id, 1)} className="font-black text-slate-500 px-2 py-1 active:scale-90 text-sm cursor-pointer">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                 <div onClick={() => setPatatas(!patatas)} className={`p-3.5 rounded-xl border-2 flex items-center gap-3 cursor-pointer select-none ${patatas ? 'bg-orange-50 border-orange-400 text-orange-700 font-black' : 'bg-slate-50 border-slate-200 text-slate-500 font-bold'}`}>
                  <input type="checkbox" checked={patatas} readOnly className="w-4 h-4 accent-orange-500 pointer-events-none" />
                  <span className="text-xs uppercase tracking-wide">🍟 ¿AÑADIR PATATAS DE LA CASA?</span>
                </div>
              )}

              {errorValidacion && <p className="text-rose-600 font-black text-center text-xs bg-rose-50 p-2 rounded-lg border border-rose-200">{errorValidacion}</p>}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalAbierto(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3.5 rounded-xl uppercase text-xs cursor-pointer">Atrás</button>
                <button type="button" onClick={handleGuardarPedido} className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-xl uppercase text-xs shadow-md cursor-pointer">💾 Confirmar Reserva</button>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
