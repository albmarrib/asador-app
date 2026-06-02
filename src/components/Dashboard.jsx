import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';

const LOCAL_ID = 'asador-dc';

export default function Dashboard() {
  const [vista, setVista] = useState('mostrador'); 
  const [franjas, setFranjas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]); 
  const [filtroHora, setFiltroHora] = useState('Todos');
  const [busqueda, setBusqueda] = useState(''); 
  
  // ESTADOS MODALES PANTALLA COMPLETA
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tecladoPantallaCompleta, setTecladoPantallaCompleta] = useState(false);
  const [modalCargaAbierto, setModalCargaAbierto] = useState(false);
  const [modalProduccionAbierto, setModalProduccionAbierto] = useState(false); 
  const [modalVentaDirectaAbierto, setModalVentaDirectaAbierto] = useState(false); 
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null); // Para el nuevo modal de gestión


  // ESTADOS FORMULARIO RESERVA MANUAL
  const [nombreCliente, setNombreCliente] = useState('');
  const [carritoExtras, setCarritoExtras] = useState({}); 
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  const [errorValidacion, setErrorValidacion] = useState('');

  // ESTADOS CARRITO VENTA DIRECTA (TPV)
  const [vdCarritoExtras, setVdCarritoExtras] = useState({});

  // ESTADOS PANEL INTERNO CARGA DE HORNOS
  const [franjaEditandoId, setFranjaEditandoId] = useState(null);
  const [valoresCarga, setValoresCarga] = useState({ pollos: 0, patatas: 0, butifarras: 0 });

  const filasTeclado = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ' ', '←']
  ];

  useEffect(() => {
    const qPedidos = query(collection(db, 'pedidos'), where('local', '==', LOCAL_ID));
    const unsubscribePedidos = onSnapshot(qPedidos, (snapshot) => {
      setPedidos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(p => !p.archivado));
    });

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

    return () => {
      unsubscribePedidos();
      unsubscribeFranjas();
      unsubscribeProductos();
    };
  }, []);

  // --- MOTORES MATEMÁTICOS DE PROCESAMIENTO ---
  const extraerUnidades = (detalleTexto) => {
    if (!detalleTexto) return 0;
    const detalleStr = String(detalleTexto);
    if (detalleStr.includes('|')) return parseFloat(detalleStr.split('|')[0]) || 0;
    return parseFloat(detalleStr) || 1;
  };

  const obtenerReservadosPorFranja = (horaFranja) => {
    const horaInicio = horaFranja.split(' ')[0];
    // Sumamos TODO lo que se ha vendido o reservado para esa hora (tanto pendiente como ya entregado)
    return pedidos
      .filter(p => p.hora === horaInicio)
      .reduce((sum, p) => sum + extraerUnidades(p.detalle), 0); 
  };

  const calcularAlertaFranja = (f) => {
    const reales = obtenerReservadosPorFranja(f.hora);
    return reales > f.max ? reales - f.max : 0;
  };

  const obtenerComandaGlobal = () => {
    const totales = {};
    pedidos.forEach(p => {
      const texto = p.detalle.includes('|') ? p.detalle.split('|')[1] : p.detalle;
      const partes = String(texto).split('+');
      
      partes.forEach(parte => {
        const match = parte.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(.*)/i);
        if (match) {
          const cant = parseFloat(match[1]);
          const nombre = match[2].trim().toUpperCase();
          if (cant > 0 && nombre) {
            if (!totales[nombre]) totales[nombre] = { pendiente: 0, entregado: 0, total: 0 };
            totales[nombre].total += cant;
            if (p.entregado) totales[nombre].entregado += cant;
            else totales[nombre].pendiente += cant;
          }
        }
      });
    });
    return totales;
  };

  const capacidadTotal = franjas.reduce((acc, f) => acc + f.max, 0);
  const totalReservados = pedidos.filter(p => !p.entregado).reduce((sum, p) => sum + extraerUnidades(p.detalle), 0);
  const totalDisponibles = Math.max(capacidadTotal - totalReservados, 0);

  const obtenerFranjaActualEnCurso = () => {
    const ahora = new Date();
    const horaTexto = `${ahora.getHours().toString().padStart(2, '0')}:${ahora.getMinutes().toString().padStart(2, '0')}`;
    return franjas.find(f => {
      const [inicio, fin] = f.hora.split(' - ');
      return horaTexto >= inicio && horaTexto <= fin;
    }) || franjas[0];
  };

  // --- CONTROLES OPERATIVOS ---
  const handleEntregar = async (id) => await updateDoc(doc(db, 'pedidos', id), { entregado: true });
   const handleCobrarPedido = async (id) => {
    await updateDoc(doc(db, 'pedidos', id), { 
      entregado: true,
      cobrado: true // Añadimos marca de cobrado por si en el futuro quieres hacer caja
    });
    setPedidoSeleccionado(null); // Cierra el modal
  };
  const handleAnularPedido = async (id) => await deleteDoc(doc(db, 'pedidos', id));
  const handleReubicarPedido = async (id, nuevaHora) => await updateDoc(doc(db, 'pedidos', id), { hora: nuevaHora });

  // --- NUEVA OPERATIVA DE CARGA INTELIGENTE ---
  const handleCargarEstandarHornos = async () => {
    for (const f of franjas) {
      const plantilla = f.estandar || { pollos: 0, patatas: 0, butifarras: 0 };
      await updateDoc(doc(db, 'franjas', f.id), {
        capacidad: plantilla,
        max: plantilla.pollos || 0
      });
    }
    alert("⚡ Hornos cargados con la plantilla de producción estándar.");
  };

  const handlePresionarBotonHornosVivos = () => {
    if (franjas.length === 0) return;
    if (window.confirm("🤔 ¿Quieres cargar la producción ESTÁNDAR de hoy en los hornos?\n\n[Aceptar] = Cargar molde estándar automáticamente\n[Cancelar] = Ajustar cantidades a mano en el panel")) {
      handleCargarEstandarHornos();
    } else {
      abrirModalCarga(franjas[0].id);
    }
  };

  const abrirModalCarga = (franjaId) => {
    const f = franjas.find(x => x.id === franjaId);
    setFranjaEditandoId(franjaId);
    setValoresCarga({
      pollos: f?.capacidad?.pollos || 0,
      patatas: f?.capacidad?.patatas || 0,
      butifarras: f?.capacidad?.butifarras || 0
    });
    setModalCargaAbierto(true);
  };

  const cambiarFranjaCarga = (f) => {
    setFranjaEditandoId(f.id);
    setValoresCarga({
      pollos: f.capacidad?.pollos || 0,
      patatas: f.capacidad?.patatas || 0,
      butifarras: f.capacidad?.butifarras || 0
    });
  };

  const handleAjustarValorCarga = (campo, incremento) => {
    setValoresCarga(prev => ({ ...prev, [campo]: Math.max(0, prev[campo] + incremento) }));
  };

  const guardarCargaFranja = async () => {
    if (!franjaEditandoId) return;
    await updateDoc(doc(db, 'franjas', franjaEditandoId), { max: valoresCarga.pollos, capacidad: valoresCarga });
    setModalCargaAbierto(false);
  };

  const handleGuardarTemplateEstandar = async (franjaId, campo, valor) => {
    const f = franjas.find(x => x.id === franjaId);
    const estandarActual = f.estandar || { pollos: 0, patatas: 0, butifarras: 0 };
    const nuevoEstandar = { ...estandarActual, [campo]: Math.max(0, parseInt(valor) || 0) };
    await updateDoc(doc(db, 'franjas', franjaId), { estandar: nuevoEstandar });
  };

  // --- CIERRE DE CAJA (CERO OPERATIVO REAL) ---
  const handleLimpiarDia = async () => {
    if (window.confirm("🚨 ¿Seguro que quieres CERRAR EL DÍA? \n\nEsto ocultará los pedidos y vaciará todos los hornos vivos a 0 real para mañana.")) {
      for (const p of pedidos) await updateDoc(doc(db, 'pedidos', p.id), { archivado: true });
      for (const f of franjas) {
        await updateDoc(doc(db, 'franjas', f.id), {
          max: 0,
          capacidad: { pollos: 0, patatas: 0, butifarras: 0 }
        });
      }
      alert("🧹 Caja cerrada de forma limpia. Todo el stock vivo se ha reseteado.");
    }
  };

  // --- FORMULARIOS DE CARRITO ---
  const handleAbrirNuevaReserva = () => {
    setNombreCliente(''); setCarritoExtras({}); 
    setHoraSeleccionada(franjas.length > 0 ? franjas[0].hora.split(' ')[0] : '');
    setErrorValidacion(''); setModalAbierto(true); setTecladoPantallaCompleta(false);
  };

  const handleTecladoPresionado = (letra) => {
    if (letra === '←') setNombreCliente(prev => prev.slice(0, -1));
    else if (nombreCliente.length < 18) setNombreCliente(prev => prev + letra);
  };

  const handleModificarExtra = (productoId, incremento) => {
    setCarritoExtras(prev => {
      const actual = prev[productoId] || 0;
      const nuevaCantidad = Math.max(actual + incremento, 0);
      if (nuevaCantidad === 0) { const { [productoId]: _, ...resto } = prev; return resto; }
      return { ...prev, [productoId]: nuevaCantidad };
    });
  };

  const handleGuardarPedido = async () => {
    if (!nombreCliente.trim()) { setErrorValidacion('⚠️ El nombre del cliente es obligatorio.'); return; }
    if (!horaSeleccionada) { setErrorValidacion('⚠️ Necesitas configurar al menos una franja horaria.'); return; }

    const lineasTicket = [];
    let stockConsumido = 0;

    Object.entries(carritoExtras).forEach(([prodId, cant]) => {
      const prodInfo = productos.find(p => p.id === prodId);
      if (prodInfo) {
        lineasTicket.push(`${cant}x ${prodInfo.nombre}`);
        if (prodInfo.controlaStock) stockConsumido += (parseFloat(prodInfo.consumeUnidades) * cant);
      }
    });

    if (lineasTicket.length === 0) { setErrorValidacion('⚠️ El pedido no puede estar vacío. Añade algún producto.'); return; }
    const detalleTexto = `${stockConsumido} | ` + lineasTicket.join(' + ');

    await addDoc(collection(db, 'pedidos'), {
      local: LOCAL_ID, cliente: nombreCliente.trim().toUpperCase(), hora: horaSeleccionada,
      detalle: detalleTexto, entregado: false, origen: 'Mostrador/Teléfono', creadoEn: new Date()
    });
    setModalAbierto(false);
  };

  // --- TPV VENTA DIRECTA ---
  const handleModificarVDExtra = (productoId, incremento) => {
    setVdCarritoExtras(prev => {
      const actual = prev[productoId] || 0;
      const nuevaCantidad = Math.max(actual + incremento, 0);
      if (nuevaCantidad === 0) { const { [productoId]: _, ...resto } = prev; return resto; }
      return { ...prev, [productoId]: nuevaCantidad };
    });
  };

  const handleEjecutarVentaDirecta = async () => {
    // Intentamos pillar la franja por hora actual, si no, por defecto la primera de la lista
    let franjaDestino = obtenerFranjaActualEnCurso();
    if (!franjaDestino && franjas.length > 0) {
      franjaDestino = franjas[0];
    }
    
    if (!franjaDestino) {
      alert("⚠️ Configura horarios primero en la pantalla de configuración.");
      return;
    }

    const lineasTicket = [];
    let stockConsumido = 0;

    Object.entries(vdCarritoExtras).forEach(([prodId, cant]) => {
      const prodInfo = productos.find(p => p.id === prodId);
      if (prodInfo) {
        lineasTicket.push(`${cant}x ${prodInfo.nombre}`);
        if (prodInfo.controlaStock) {
          stockConsumido += (parseFloat(prodInfo.consumeUnidades) * cant);
        }
      }
    });

    if (lineasTicket.length === 0) {
      alert("⚠️ El carrito del TPV está vacío. Añade algún producto.");
      return;
    }
    
    const detalleTexto = `${stockConsumido} | ` + lineasTicket.join(' + ');

    try {
      await addDoc(collection(db, 'pedidos'), {
        local: LOCAL_ID,
        cliente: "VENTA DIRECTA",
        hora: franjaDestino.hora.split(' ')[0], // Guarda p.ej. "13:00"
        detalle: detalleTexto,
        entregado: true, // Se marca como entregado al momento
        origen: 'Mostrador Directo',
        creadoEn: new Date()
      });
      
      // Limpiamos carrito y cerramos el modal de golpe
      setVdCarritoExtras({});
      setModalVentaDirectaAbierto(false);
    } catch (error) {
      console.error("Error al ejecutar venta:", error);
      alert("❌ Error de Firebase al guardar la venta.");
    }
  };


  // --- CONFIG GESTIÓN ---
  const handleAjustarCapacidadConfig = async (franja, incremento) => {
    const nuevaCapacidad = Math.max(franja.max + incremento, 0);
    await updateDoc(doc(db, 'franjas', franja.id), { max: nuevaCapacidad });
  };

  const handleCrearFranjaNueva = async () => {
    const horaInicio = prompt("Introduce la hora de inicio (Ej: 13:00):");
    const horaFin = prompt("Introduce la hora de fin (Ej: 14:00):");
    if (horaInicio && horaFin) {
      await addDoc(collection(db, 'franjas'), { 
        local: LOCAL_ID, hora: `${horaInicio} - ${horaFin}`, max: 0,
        capacidad: { pollos: 0, patatas: 0, butifarras: 0 },
        estandar: { pollos: 0, patatas: 0, butifarras: 0 }
      });
    }
  };

  const handleBorrarFranjaConfig = async (id) => {
    if(window.confirm("¿Seguro que quieres borrar este tramo horario?")) await deleteDoc(doc(db, 'franjas', id));
  };

  const handleCrearProductoNuevo = async () => {
    const nombre = prompt("Nombre del producto (Ej: Pollo, Medio Pollo, Canelones):");
    if (!nombre) return;
    const precio = prompt("Precio en euros (Ej: 12.50):");
    if (!precio) return;
    const controlaStock = window.confirm("¿Este producto necesita CONTROL DE STOCK diario en los hornos?\n\n(Aceptar = SÍ / Cancelar = NO)");
    let stock = 0, consumeUnidades = 0;
    if (controlaStock) {
      stock = prompt(`Stock inicial de la carta para ${nombre}:`) || 0;
      consumeUnidades = prompt(`¿Cuánto stock descuenta de los hornos al pedirlo?\n(Ej: 1 para Pollo, 0.5 para Medio Pollo):`) || 1;
    }
    await addDoc(collection(db, 'productos'), {
      local: LOCAL_ID, nombre: nombre.toUpperCase(), precio: parseFloat(precio) || 0,
      controlaStock: controlaStock, stockMaximo: parseInt(stock) || 0, consumeUnidades: parseFloat(consumeUnidades) || 0, activo: true
    });
  };

  const handleBorrarProductoConfig = async (id) => {
    if(window.confirm("¿Seguro que quieres borrar este producto de la carta?")) await deleteDoc(doc(db, 'productos', id));
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

  // --- ORDENACIÓN DE LA CARTA CON PRIORIDAD ABSOLUTA AL POLLO ENTERO ---
  const productosOrdenados = [...productos].sort((a, b) => {
    const nomA = a.nombre.toUpperCase();
    const nomB = b.nombre.toUpperCase();

    // 1. Si uno es "POLLO" a secas, va el primero de todos
    if (nomA === 'POLLO' && nomB !== 'POLLO') return -1;
    if (nomB === 'POLLO' && nomA !== 'POLLO') return 1;

    // 2. Si uno contiene "POLLO" (como Medio Pollo) pero el otro no, va antes
    const tienePolloA = nomA.includes('POLLO');
    const tienePolloB = nomB.includes('POLLO');
    if (tienePolloA && !tienePolloB) return -1;
    if (!tienePolloA && tienePolloB) return 1;

    // 3. Para el resto de productos (patatas, canelones...), orden alfabético normal
    return nomA.localeCompare(nomB);
  });


  return (
    <div className="min-h-screen bg-orange-50/40 text-slate-800 p-4 md:p-6 font-sans antialiased">
      <header className="sticky top-2 z-40 bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-md border border-orange-100 mb-6 relative overflow-hidden">
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

          <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-center">
            <button onClick={() => setModalProduccionAbierto(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-4 rounded-xl shadow-md transition-all active:scale-95 text-xs uppercase tracking-wider cursor-pointer border-b-4 border-indigo-800">
              📋 PRODUCCIÓN
            </button>
            <button onClick={handlePresionarBotonHornosVivos} className="bg-orange-500 hover:bg-orange-600 text-white font-black px-5 py-4 rounded-xl shadow-md transition-all active:scale-95 text-xs uppercase tracking-wider cursor-pointer border-b-4 border-orange-700">
              🔥 HORNOS
            </button>
            <button onClick={() => { setVdCarritoExtras({}); setModalVentaDirectaAbierto(true); }} disabled={franjas.length === 0} className="bg-slate-800 hover:bg-slate-900 text-white font-black px-5 py-4 rounded-xl shadow-md transition-all active:scale-95 text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50 border-b-4 border-slate-950">
              🪙 VENTA DIRECTA
            </button>
            <button onClick={handleAbrirNuevaReserva} disabled={franjas.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-4 rounded-xl shadow-md transition-all active:scale-95 text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50 border-b-4 border-emerald-800">
              ➕ RESERVA
            </button>
            <button onClick={() => setVista(vista === 'mostrador' ? 'configuracion' : 'mostrador')} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-black px-4 py-4 rounded-xl text-sm transition-all cursor-pointer border-b-4 border-slate-300">
              ⚙️
            </button>
          </div>
        </div>
      </header>

      {vista === 'mostrador' && franjas.length > 0 && (   
     <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
     <section className="bg-white rounded-2xl p-5 shadow-sm border border-orange-100">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4">📊 Estado de Carga</h2>
            <div className="space-y-4">
              {franjas.map((f) => {
                const reservados = obtenerReservadosPorFranja(f.hora);
                const faltaPollo = calcularAlertaFranja(f);
                const porcentaje = f.max > 0 ? (reservados / f.max) * 100 : 0;
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
                      <button onClick={() => abrirModalCarga(f.id)} className="bg-white hover:bg-orange-50 text-orange-600 border border-orange-200 font-bold px-4 py-2 rounded-xl shadow-sm text-sm uppercase cursor-pointer">
                        ⚙️ Cargar
                      </button>
                    </div>
                    {faltaPollo > 0 && <div className="bg-rose-600 text-white font-black text-xs px-3 py-1.5 rounded-lg">🚨 FALTAN {faltaPollo} POLLOS</div>}
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner mt-2">
                      <div className={`h-3 rounded-full transition-all duration-300 ${colorBarra}`} style={{ width: `${Math.min(porcentaje, 100)}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

<section className="bg-white rounded-2xl p-5 shadow-sm border border-orange-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b-2 border-slate-100 pb-4">
        <div className="flex flex-wrap gap-2 w-full">
          <button onClick={() => setFiltroHora('Todos')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase border-2 transition-all cursor-pointer ${filtroHora === 'Todos' ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>Todos</button>
          {franjas.map(f => {
            const h = f.hora.split(' ')[0];
            return (
              <button key={f.id} onClick={() => setFiltroHora(h)} className={`flex-1 py-3 rounded-xl text-xs font-black border-2 transition-all cursor-pointer ${filtroHora === h ? 'bg-orange-600 text-white border-orange-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>{h}</button>
            );
          })}
        </div>

              <div className="w-full md:w-64 shrink-0">
                <input type="text" placeholder="🔍 Buscar nombre..." value={busqueda} onChange={(e) => setBusqueda(e.target.value.toUpperCase())} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-700 uppercase focus:outline-none focus:border-orange-500 placeholder:text-slate-400" />
              </div>
            </div>

            <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
              {pedidosProcesados.length === 0 ? (
                <div className="text-center text-slate-400 font-bold py-10 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-sm">No hay pedidos registrados.</div>
              ) : (
                pedidosProcesados
                .filter(p => filtroHora === 'Todos' ? true : p.hora === filtroHora)
                .filter(p => busqueda === '' ? true : p.cliente.includes(busqueda))
                .map((p) => (
<div key={p.id} onClick={() => { if(p.cliente !== 'VENTA DIRECTA') setPedidoSeleccionado(p) }} className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${p.cliente === 'VENTA DIRECTA' ? 'cursor-default' : 'cursor-pointer hover:scale-[1.01]'} ${p.entregado ? 'bg-slate-50 border-slate-200 opacity-55' : 'bg-amber-50/40 border-amber-200 shadow-sm'}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-black bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{p.origen === 'QR' ? '📲 WEB' : '📞 TIENDA'}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded font-black tracking-wider ${p.entregado ? 'bg-slate-400 text-white' : 'bg-amber-500 text-white'}`}>{p.entregado ? '✓ ENTREGADO' : '⏳ PENDIENTE'}</span>
                      </div>
                      <h3 className="text-xl font-black text-slate-800 mt-1.5 uppercase tracking-tight">{p.cliente}</h3>
                      <p className="text-sm font-extrabold text-slate-600 mt-0.5">{p.detalle}</p>
                    </div>

                    <div className="flex sm:flex-col items-end sm:items-center justify-between gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-200/60">
                      <span className="text-lg font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-xl border border-orange-200 font-mono">⏰ {p.hora}</span>
                      <div className="flex gap-1.5">
                        {!p.entregado && (
                          <select onChange={(e) => handleReubicarPedido(p.id, e.target.value)} className="bg-white border border-slate-300 text-xs font-bold rounded-xl px-2 py-1 focus:outline-none cursor-pointer" defaultValue="">
                            <option value="" disabled>↪️ Mover hora</option>
                            {franjas.map(fr => <option key={fr.id} value={fr.hora.split(' ')[0]}>{fr.hora.split(' ')[0]}</option>)}
                          </select>
                        )}
                        <button onClick={() => handleAnularPedido(p.id)} className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer">❌ Anular</button>
                        {!p.entregado && <button onClick={() => handleEntregar(p.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl shadow cursor-pointer">✓ Entregar</button>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* SECCIÓN CONFIGURACIÓN COMPLETA REESTABLECIDA Y BLINDADA */}
      {vista === 'configuracion' && (
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100 max-w-5xl mx-auto space-y-8">
          <div className="border-b pb-4 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase">⏱️ 1. Estructura de Horarios</h2>
              <p className="text-slate-500 text-xs mt-0.5">Define los tramos de horas de reparto del negocio.</p>
            </div>
            <button onClick={handleCrearFranjaNueva} className="bg-slate-800 hover:bg-slate-700 text-white font-black px-4 py-2.5 rounded-xl text-xs cursor-pointer shadow-sm">➕ Crear Tramo</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {franjas.map(f => (
              <div key={f.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-lg font-mono font-black text-slate-700">⏰ {f.hora}</span>
                <button onClick={() => handleBorrarFranjaConfig(f.id)} className="text-rose-500 font-black text-xs uppercase px-3 py-2 bg-rose-50 rounded-lg border border-rose-200 cursor-pointer">🗑 Borrar</button>
              </div>
            ))}
          </div>

          <div className="border-b pt-4 pb-4">
            <h2 className="text-2xl font-black text-slate-800 uppercase">📐 2. Plantilla de Carga Estándar (Template Diario)</h2>
            <p className="text-slate-500 text-xs mt-0.5">Configura las cantidades estándar que cocinas por defecto a cada hora.</p>
          </div>
          <div className="space-y-3">
            {franjas.map(f => (
              <div key={f.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <span className="text-xl font-mono font-black text-slate-800">⏰ {f.hora}</span>
                <div className="flex flex-wrap gap-4 font-mono font-black">
                  <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border">
                    <span className="text-xs text-slate-400">🍗 POLLOS:</span>
                    <input type="number" defaultValue={f.estandar?.pollos || 0} onChange={(e) => handleGuardarTemplateEstandar(f.id, 'pollos', e.target.value)} className="w-16 text-center text-lg font-black focus:outline-none" />
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border">
                    <span className="text-xs text-slate-400">🍟 PATATAS:</span>
                    <input type="number" defaultValue={f.estandar?.patatas || 0} onChange={(e) => handleGuardarTemplateEstandar(f.id, 'patatas', e.target.value)} className="w-16 text-center text-lg font-black focus:outline-none" />
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border">
                    <span className="text-xs text-slate-400">🌭 BUTIFARRAS:</span>
                    <input type="number" defaultValue={f.estandar?.butifarras || 0} onChange={(e) => handleGuardarTemplateEstandar(f.id, 'butifarras', e.target.value)} className="w-16 text-center text-lg font-black focus:outline-none" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase">🍟 3. Carta y Complementos</h2>
              <p className="text-slate-500 text-xs mt-0.5">Precios y control de stock mermable.</p>
            </div>
            <button onClick={handleCrearProductoNuevo} className="bg-orange-100 text-orange-700 hover:bg-orange-200 font-black px-4 py-2.5 rounded-xl text-xs border border-orange-300 cursor-pointer shadow-sm">➕ Añadir Producto</button>
          </div>
          <div className="space-y-3">
            {productosOrdenados.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                <div className="flex-1">
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">{p.nombre}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-orange-600 font-black text-sm">{parseFloat(p.precio).toFixed(2)}€</span>
                    {p.controlaStock && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">Resta: {p.consumeUnidades} al stock</span>}
                  </div>
                </div>
                {p.controlaStock ? (
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <button onClick={() => handleAjustarStockProducto(p, -5)} className="font-black w-8 h-8 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-100">-5</button>
                    <button onClick={() => handleAjustarStockProducto(p, -1)} className="font-black w-6 h-6 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-100">-</button>
                    <span className="text-lg font-mono font-black text-slate-800 w-10 text-center">{p.stockMaximo}</span>
                    <button onClick={() => handleAjustarStockProducto(p, 1)} className="font-black w-6 h-6 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-100">+</button>
                    <button onClick={() => handleAjustarStockProducto(p, 5)} className="font-black w-8 h-8 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer hover:bg-slate-100">+5</button>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-center"><span className="text-emerald-600 font-black text-xs uppercase tracking-wider">Stock Ilimitado</span></div>
                )}
                {/* FUNCIÓN CORREGIDA AQUÍ: handleBorrarProductoConfig */}
                <button onClick={() => handleBorrarProductoConfig(p.id)} className="text-rose-500 bg-rose-50 px-3 py-2 rounded-lg font-bold text-xs uppercase border border-rose-100 cursor-pointer hover:bg-rose-100">Borrar</button>
              </div>
            ))}
          </div>

          <div className="mt-8 p-6 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-inner">
            <div>
              <h3 className="text-lg font-black text-rose-700 uppercase">🧹 4. Cierre del Día</h3>
              <p className="text-rose-600 text-xs mt-1 font-bold">Oculta todos los pedidos actuales y reinicia la disponibilidad de pollos para el día siguiente.</p>
            </div>
            <button onClick={handleLimpiarDia} className="bg-rose-600 hover:bg-rose-700 text-white font-black px-6 py-3 rounded-xl shadow-md uppercase text-sm cursor-pointer whitespace-nowrap active:scale-95">Cerrar Día</button>
          </div>

          <div className="text-right border-t border-slate-100 pt-6">
            <button onClick={() => setVista('mostrador')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-4 rounded-xl uppercase text-sm shadow cursor-pointer">💾 Volver al Mostrador</button>
          </div>
        </section>
      )}

      {/* MODAL GIGANTE 1: INVENTARIO DE HORNOS VIVOS (MASTER-DETAIL) */}
      {modalCargaAbierto && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4 lg:p-10 z-50 overflow-hidden">
          <div className="bg-white rounded-[2rem] w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="bg-slate-800 p-6 flex justify-between items-center text-white shrink-0">
              <h3 className="text-3xl font-black uppercase tracking-tight">🔥 GESTIÓN DE HORNOS EN VIVO</h3>
              <button onClick={() => setModalCargaAbierto(false)} className="bg-slate-700 hover:bg-rose-600 font-black text-2xl px-6 py-2 rounded-xl cursor-pointer transition-colors border-b-4 border-slate-900">✕ Cerrar</button>
            </div>
            <div className="flex-1 flex flex-row overflow-hidden">
              <div className="w-1/3 bg-slate-50 border-r-4 border-slate-200 p-6 overflow-y-auto space-y-4">
                <h4 className="text-lg font-black text-slate-500 uppercase tracking-widest mb-4">Selecciona Tramo:</h4>
                {franjas.map(f => {
                  const activo = franjaEditandoId === f.id;
                  return (
                    <button key={f.id} onClick={() => cambiarFranjaCarga(f)} className={`w-full text-left p-6 rounded-2xl border-4 font-black text-3xl font-mono transition-all cursor-pointer ${activo ? 'bg-indigo-600 text-white border-indigo-700 shadow-md scale-105' : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50'}`}>⏰ {f.hora.split(' ')[0]}</button>
                  );
                })}
              </div>
              <div className="w-2/3 p-8 bg-white flex flex-col justify-between overflow-y-auto">
                <div>
                  <h4 className="text-2xl font-black text-slate-800 uppercase mb-8 pb-4 border-b-4 border-slate-100">Hornos Ajustados para las: <span className="text-indigo-600 font-mono">{franjas.find(f => f.id === franjaEditandoId)?.hora}</span></h4>
                  <div className="space-y-6">
                    {['pollos', 'patatas', 'butifarras'].map(campo => (
                      <div key={campo} className="bg-slate-50 p-6 rounded-3xl border-4 border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
                        <span className="text-3xl font-black text-slate-700 uppercase">{campo === 'pollos' ? '🍗 Pollos' : campo === 'patatas' ? '🍟 Patatas' : '🌭 Butifarras'}:</span>
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleAjustarValorCarga(campo, -5)} className="bg-white border-4 border-slate-200 text-slate-600 font-black text-2xl w-16 h-16 rounded-2xl active:scale-95 cursor-pointer">-5</button>
                          <button onClick={() => handleAjustarValorCarga(campo, -1)} className="bg-white border-4 border-slate-200 text-slate-600 font-black text-4xl w-20 h-20 rounded-2xl active:scale-95 cursor-pointer">-</button>
                          <span className="text-6xl font-black font-mono text-slate-800 w-32 text-center">{valoresCarga[campo]}</span>
                          <button onClick={() => handleAjustarValorCarga(campo, 1)} className="bg-white border-4 border-slate-200 text-slate-600 font-black text-4xl w-20 h-20 rounded-2xl active:scale-95 cursor-pointer">+</button>
                          <button onClick={() => handleAjustarValorCarga(campo, 5)} className="bg-white border-4 border-slate-200 text-slate-600 font-black text-2xl w-16 h-16 rounded-2xl active:scale-95 cursor-pointer">+5</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-8 pt-8 border-t-4 border-slate-100">
                  <button onClick={guardarCargaFranja} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-6 rounded-2xl uppercase text-3xl shadow-xl border-b-8 border-emerald-800 cursor-pointer">💾 Guardar Cambios</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GIGANTE 2: BALANCE PRODUCCIÓN GLOBAL */}
      {modalProduccionAbierto && (() => {
        const totalesCocina = obtenerComandaGlobal();
        return (
          <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4 lg:p-10 z-50 overflow-hidden">
            <div className="bg-white rounded-[2rem] w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl overflow-hidden border-4 border-indigo-500">
              <div className="bg-indigo-600 p-6 flex justify-between items-center text-white shrink-0">
                <h3 className="text-3xl font-black uppercase tracking-tight">📋 BALANCE DE PRODUCCIÓN HOY</h3>
                <button onClick={() => setModalProduccionAbierto(false)} className="bg-indigo-700 hover:bg-rose-600 font-black text-xl px-6 py-2 rounded-xl cursor-pointer transition-colors border-b-4 border-indigo-900">✕ Cerrar</button>
              </div>
              <div className="p-8 flex-1 overflow-y-auto bg-slate-50">
                {Object.keys(totalesCocina).length === 0 ? (
                  <div className="text-center py-20"><span className="text-4xl text-slate-300 font-black">No hay reservas pendientes de entrega.</span></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Object.entries(totalesCocina).sort((a,b)=>b[1].total - a[1].total).map(([nombre, counts]) => (
                      <div key={nombre} className="bg-white p-5 rounded-3xl border-4 border-indigo-100 flex flex-col items-center justify-center gap-2 shadow-md hover:border-indigo-300 transition-colors">
                        <span className="text-base font-black text-slate-700 uppercase text-center leading-tight h-12 flex items-center">{nombre}</span>
                        <div className="w-full bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 flex flex-col items-center mb-2">
                          <span className="text-xs font-black text-indigo-800 uppercase tracking-widest">Total Pedido</span>
                          <span className="text-5xl font-black font-mono text-indigo-600">{counts.total}</span>
                        </div>
                        <div className="flex w-full gap-2">
                          <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl p-2 flex flex-col items-center">
                            <span className="text-[10px] font-black text-amber-800 uppercase">Falta Hacer</span>
                            <span className="text-2xl font-black font-mono text-amber-600">{counts.pendiente}</span>
                          </div>
                          <div className="flex-1 bg-slate-100 border border-slate-200 rounded-xl p-2 flex flex-col items-center">
                            <span className="text-[10px] font-black text-slate-500 uppercase">Entregado</span>
                            <span className="text-2xl font-black font-mono text-slate-600">{counts.entregado}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL GIGANTE 3: TPV VENTA DIRECTA COMPLETA */}
      {modalVentaDirectaAbierto && (() => {
        const franjaActual = obtenerFranjaActualEnCurso();
        return (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 lg:p-6 z-50 overflow-hidden">
            <div className="bg-white rounded-[2rem] w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="bg-slate-800 p-4 flex justify-between items-center text-white shrink-0">
                <h3 className="text-2xl font-black uppercase tracking-tight">🪙 REGISTRAR VENTA DIRECTA EN MOSTRADOR</h3>
                <button onClick={() => setModalVentaDirectaAbierto(false)} className="bg-slate-700 hover:bg-rose-600 font-black text-xl px-4 py-2 rounded-xl">✕ Cancelar</button>
              </div>
              <div className="p-6 flex flex-col flex-1 overflow-hidden">
                <div className="bg-indigo-50 border-4 border-indigo-100 p-4 rounded-2xl mb-6 shrink-0 flex justify-between items-center">
                  <span className="text-xl font-black text-indigo-900 uppercase">📌 Tramo de stock asignado automáticamente por hora:</span>
                  <span className="text-3xl font-black font-mono text-indigo-600 bg-white px-6 py-2 rounded-xl border-2 border-indigo-200">⏰ {franjaActual ? franjaActual.hora.split(' ')[0] : '13:00'}</span>
                </div>
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {/* Catálogo dinámico de productos generados en configuración */}
                    {productosOrdenados.map(prod => (
                      <div key={prod.id} className="flex flex-col items-center justify-between bg-white p-3 rounded-2xl border-4 border-slate-200 shadow-sm">
                        <span className="text-lg font-black text-slate-700 uppercase text-center h-10 flex items-center leading-tight">{prod.nombre}</span>
                        <div className="flex items-center gap-2 mt-2 bg-slate-50 p-1 rounded-xl border border-slate-100 w-full justify-between">
                          <button type="button" onClick={() => handleModificarVDExtra(prod.id, -1)} className="bg-white border border-slate-200 font-black w-10 h-10 rounded-lg text-2xl cursor-pointer flex items-center justify-center pb-1 text-slate-500">-</button>
                          <span className="text-2xl font-mono font-black text-slate-800">{vdCarritoExtras[prod.id] || 0}</span>
                          <button type="button" onClick={() => handleModificarVDExtra(prod.id, 1)} className="bg-white border border-slate-200 font-black w-10 h-10 rounded-lg text-2xl cursor-pointer flex items-center justify-center pb-1 text-slate-500">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 mt-6 pt-4 border-t-4 border-slate-100">
{(() => {
  const totalTPV = Object.entries(vdCarritoExtras).reduce((sum, [prodId, cant]) => {
    const prod = productos.find(p => p.id === prodId);
    return sum + (prod ? prod.precio * cant : 0);
  }, 0);
  return (
    <button type="button" onClick={handleEjecutarVentaDirecta} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-2xl uppercase text-3xl shadow-xl border-b-8 border-emerald-800 cursor-pointer flex justify-center items-center gap-4">
      <span>🪙 Confirmar Venta</span>
      {totalTPV > 0 && <span className="bg-white text-emerald-700 px-4 py-1 rounded-xl">{totalTPV.toFixed(2)}€</span>}
    </button>
  );
})()}

                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL GIGANTE 4: FORMULARIO NUEVA RESERVA MANUAL */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 lg:p-6 z-50 overflow-hidden">
          {tecladoPantallaCompleta ? (
            <div className="w-full h-full flex flex-col justify-between p-6 max-w-5xl mx-auto bg-white rounded-3xl shadow-2xl border border-slate-300">
              <div className="bg-orange-50 p-5 rounded-2xl border-2 border-orange-400 text-center shadow-inner">
                <span className="text-xs font-black text-orange-700 uppercase block mb-1">Nombre del Cliente</span>
                <div className="text-6xl font-black text-slate-800 uppercase font-mono min-h-[80px] flex items-center justify-center">{nombreCliente || <span className="text-slate-300">PULSA LAS TECLAS...</span>}</div>
              </div>
              <div className="flex-1 flex flex-col justify-center gap-4 my-6">
                {filasTeclado.map((fila, fIdx) => (
                  <div key={fIdx} className="flex justify-center gap-3 h-16 sm:h-20 lg:h-24 w-full">
                    {fila.map((letra, lIdx) => {
                      let estiloLetra = "bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-3xl lg:text-4xl rounded-2xl flex-1 border-b-4 border-slate-300 active:scale-95 cursor-pointer flex items-center justify-center shadow font-mono";
                      if (letra === '←') estiloLetra = "bg-rose-500 hover:bg-rose-600 text-white text-3xl lg:text-4xl font-black flex-[1.5] rounded-2xl border-b-4 border-rose-700 cursor-pointer flex items-center justify-center";
                      if (letra === ' ') estiloLetra = "bg-slate-400 hover:bg-slate-500 text-white font-black text-3xl flex-[3] rounded-2xl border-b-4 border-slate-600 cursor-pointer uppercase flex items-center justify-center";
                      return ( <button key={lIdx} type="button" onClick={() => handleTecladoPresionado(letra)} className={estiloLetra}>{letra}</button> );
                    })}
                  </div>
                ))}
              </div>
              {/* VARIABLE CORREGIDA AQUÍ: setTecladoPantallaCompleta */}
              <button type="button" onClick={() => setTecladoPantallaCompleta(false)} className="w-full bg-emerald-600 text-white font-black text-3xl py-6 rounded-2xl uppercase shadow-md">✓ Fijar Nombre</button>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="bg-orange-600 p-4 flex justify-between items-center text-white shrink-0">
                <h3 className="text-2xl font-black uppercase tracking-tight">📝 Nueva Reserva</h3>
                <button onClick={() => setModalAbierto(false)} className="bg-orange-700 hover:bg-rose-600 font-black text-xl px-4 py-2 rounded-xl">✕ Cancelar</button>
              </div>
              <div className="p-6 flex flex-col flex-1 overflow-hidden">
                <div className="flex flex-row items-stretch gap-4 border-b-4 border-slate-100 pb-4 mb-4 shrink-0 h-20">
                  <div className="w-1/4 min-w-[200px]">
                    {/* VARIABLE CORREGIDA AQUÍ: setTecladoPantallaCompleta */}
                    <div onClick={() => setTecladoPantallaCompleta(true)} className="w-full h-full bg-slate-50 border-4 border-slate-200 hover:border-orange-400 rounded-xl flex items-center justify-center text-2xl font-black text-slate-800 cursor-pointer shadow-inner px-2"><span className="truncate">{nombreCliente || "👉 NOMBRE"}</span></div>
                  </div>
                  <div className="flex-1 flex flex-row flex-nowrap gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {franjas.map(f => {
                      const h = f.hora.split(' ')[0];
                      return ( <button key={f.id} type="button" onClick={() => setHoraSeleccionada(h)} className={`flex-1 h-full min-w-[80px] rounded-xl font-black font-mono text-xl xl:text-3xl border-4 cursor-pointer flex items-center justify-center ${horaSeleccionada === h ? 'bg-orange-600 text-white border-orange-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{h}</button> );
                    })}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {/* Todos los productos dinámicos ordenados que tú crees */}
                    {productosOrdenados.map(prod => (
                      <div key={prod.id} className="flex flex-col items-center justify-between bg-white p-3 rounded-2xl border-4 border-slate-200 shadow-sm">
                        <span className="text-lg font-black text-slate-700 uppercase text-center h-10 flex items-center leading-tight">{prod.nombre}</span>
                        <div className="flex items-center gap-2 mt-2 bg-slate-50 p-1 rounded-xl border border-slate-100 w-full justify-between">
                          <button type="button" onClick={() => handleModificarExtra(prod.id, -1)} className="bg-white border border-slate-200 font-black w-10 h-10 rounded-lg text-2xl cursor-pointer active:scale-95 flex items-center justify-center pb-1 text-slate-500 hover:text-slate-800">-</button>
                          <span className="text-2xl font-mono font-black text-slate-800">{carritoExtras[prod.id] || 0}</span>
                          <button type="button" onClick={() => handleModificarExtra(prod.id, 1)} className="bg-white border border-slate-200 font-black w-10 h-10 rounded-lg text-2xl cursor-pointer active:scale-95 flex items-center justify-center pb-1 text-slate-500 hover:text-slate-800">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 mt-4 pt-4 border-t-4 border-slate-100">
                  {errorValidacion && <p className="text-rose-600 font-black text-center text-lg bg-rose-50 p-3 rounded-xl border-4 border-rose-200 mb-3">{errorValidacion}</p>}
<button type="button" onClick={handleGuardarPedido} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-2xl uppercase text-3xl shadow-xl transition-colors border-b-8 border-emerald-800 cursor-pointer">💾 Confirmar Reserva</button>
</div>
</div>
</div>
)}
</div>
)}

{/* MODAL GIGANTE 5: GESTIÓN DE PEDIDO INDIVIDUAL */}
{pedidoSeleccionado && (
  <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 lg:p-6 z-50 overflow-hidden">
    <div className="bg-white rounded-[2rem] w-full max-w-3xl p-8 shadow-2xl border-4 border-orange-500 flex flex-col gap-6">
      
      <div className="flex justify-between items-start border-b-4 border-slate-100 pb-6">
        <div>
          <h3 className="text-4xl lg:text-5xl font-black text-slate-800 uppercase tracking-tight">{pedidoSeleccionado.cliente}</h3>
          <span className="text-lg font-black text-orange-600 bg-orange-50 px-4 py-2 rounded-xl border-2 border-orange-200 font-mono mt-3 inline-block">
            ⏰ HORA ACTUAL: {pedidoSeleccionado.hora}
          </span>
        </div>
        <button onClick={() => setPedidoSeleccionado(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-black text-xl px-6 py-4 rounded-2xl cursor-pointer transition-all">✕ CERRAR</button>
      </div>
      
      <div className="bg-slate-50 p-6 rounded-2xl border-4 border-slate-100">
        <span className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Detalle de la comanda:</span>
        <div className="flex justify-between items-center mt-2">
          <p className="text-2xl font-black text-slate-700 font-mono leading-relaxed">
            {pedidoSeleccionado.detalle.includes('|') ? pedidoSeleccionado.detalle.split('|')[1].trim() : pedidoSeleccionado.detalle}
          </p>
          <div className="bg-emerald-100 border-4 border-emerald-500 text-emerald-800 text-4xl font-black px-6 py-4 rounded-2xl ml-4 whitespace-nowrap shadow-inner">
            {(() => {
              let total = 0;
              const texto = pedidoSeleccionado.detalle.includes('|') ? pedidoSeleccionado.detalle.split('|')[1] : pedidoSeleccionado.detalle;
              texto.split('+').forEach(parte => {
                const match = parte.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(.*)/i);
                if (match) {
                  const prod = productos.find(p => p.nombre.toUpperCase() === match[2].trim().toUpperCase());
                  if (prod) total += (parseFloat(match[1]) * prod.precio);
                }
              });
              return total.toFixed(2) + ' €';
            })()}
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 gap-4 mt-2">
        {!pedidoSeleccionado.entregado && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button onClick={() => { handleEntregar(pedidoSeleccionado.id); setPedidoSeleccionado(null); }} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-6 rounded-2xl uppercase text-2xl shadow-xl border-b-8 border-emerald-800 cursor-pointer active:scale-95 transition-all">✓ ENTREGAR</button>
            <button onClick={() => { handleCobrarPedido(pedidoSeleccionado.id); setPedidoSeleccionado(null); }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-6 rounded-2xl uppercase text-2xl shadow-xl border-b-8 border-indigo-800 cursor-pointer active:scale-95 transition-all">🪙 COBRAR Y DAR</button>
          </div>
        )}
        
        <div className="bg-slate-100 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border-2 border-slate-200">
          <span className="font-black text-slate-600 uppercase text-lg">↪️ Mover a otra hora:</span>
          <select onChange={(e) => { handleReubicarPedido(pedidoSeleccionado.id, e.target.value); setPedidoSeleccionado(null); }} className="bg-white border-4 border-slate-300 text-slate-800 font-black rounded-xl px-6 py-4 text-xl focus:outline-none cursor-pointer w-full sm:w-auto" defaultValue="">
            <option value="" disabled>Seleccionar tramo...</option>
            {franjas.map(fr => <option key={fr.id} value={fr.hora.split(' ')[0]}>{fr.hora.split(' ')[0]}</option>)}
          </select>
        </div>

        <button onClick={() => { if(window.confirm("¿Estás seguro de anular y borrar este pedido para siempre?")) { handleAnularPedido(pedidoSeleccionado.id); setPedidoSeleccionado(null); } }} className="bg-rose-100 hover:bg-rose-200 text-rose-700 border-4 border-rose-200 font-black py-5 rounded-2xl uppercase text-xl cursor-pointer mt-2 transition-all">❌ ANULAR Y BORRAR PEDIDO</button>
      </div>
    </div>
  </div>
)}

</div>
);
}
