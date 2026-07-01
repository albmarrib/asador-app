import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';

const LOCAL_ID = 'asador-dc';

const APP_CONFIG = {
  nombre: 'ROSTISSERIA LA FOSCA',
  logoUrl: '/logo-fosca.png', 
  tema: {
    fondoBase: 'bg-teal-50/40',
    headerBg: 'bg-white/95',
    textoPrincipal: 'text-teal-600',
    bordeClaro: 'border-teal-100',
  }
};

export default function Dashboard() {

  const [vista, setVista] = useState('mostrador'); 
  const [modoLayout, setModoLayout] = useState('SPLIT'); 
  const [pantallaActiva, setPantallaActiva] = useState('PEDIDOS'); 
  const [franjas, setFranjas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [pedidosHistoricos, setPedidosHistoricos] = useState([]);
  const [productos, setProductos] = useState([]); 
  const [categorias, setCategorias] = useState([]); 
  const [hornadas, setHornadas] = useState([]); 
  const [configuracion, setConfiguracion] = useState({ id: null, capacidadMaxima: 48 });

  const [filtroHora, setFiltroHora] = useState('Todos');
  const [busqueda, setBusqueda] = useState(''); 
  const [mostrarSoloPendientes, setMostrarSoloPendientes] = useState(true);
  const [tecladoBuscarAbierto, setTecladoBuscarAbierto] = useState(false);
  
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tecladoPantallaCompleta, setTecladoPantallaCompleta] = useState(false);
  const [modalProduccionAbierto, setModalProduccionAbierto] = useState(false); 
  const [modalVentaDirectaAbierto, setModalVentaDirectaAbierto] = useState(false); 
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null); 
  const [modalDetalleFranjaAbierto, setModalDetalleFranjaAbierto] = useState(false);
  const [franjaDetalleSeleccionada, setFranjaDetalleSeleccionada] = useState(null);
  const [modalCierreCajaAbierto, setModalCierreCajaAbierto] = useState(false);
  const [modalEstadisticasAbierto, setModalEstadisticasAbierto] = useState(false);

  const [filtroFechaInicio, setFiltroFechaInicio] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]); 
  const [filtroFechaFin, setFiltroFechaFin] = useState(new Date().toISOString().split('T')[0]); 
  const [filtroProductoEstat, setFiltroProductoEstat] = useState('TODOS');

  const [nombreCliente, setNombreCliente] = useState('');
  const [carritoExtras, setCarritoExtras] = useState({}); 
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  const [errorValidacion, setErrorValidacion] = useState('');
  const [origenReservaManual, setOrigenReservaManual] = useState('TIENDA'); 
  const [reservaPrePagada, setReservaPrePagada] = useState(false);
  const [vdCarritoExtras, setVdCarritoExtras] = useState({});
  const [editandoPedidoId, setEditandoPedidoId] = useState(null);

  const filasTeclado = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ' ', '←']
  ];

  useEffect(() => {
    if (modalEstadisticasAbierto) {
      const qHistoricos = query(collection(db, 'pedidos'), where('local', '==', LOCAL_ID));
      const unsubscribeHistoricos = onSnapshot(qHistoricos, (snapshot) => {
        setPedidosHistoricos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribeHistoricos();
    }
  }, [modalEstadisticasAbierto]);

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

    const qCategorias = query(collection(db, 'categorias'), where('local', '==', LOCAL_ID));
    const unsubscribeCategorias = onSnapshot(qCategorias, (snapshot) => {
      setCategorias(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.nombre.localeCompare(b.nombre)));
    });

    const qConfig = query(collection(db, 'configuracion'), where('local', '==', LOCAL_ID));
    const unsubscribeConfig = onSnapshot(qConfig, (snapshot) => {
      if (!snapshot.empty) setConfiguracion({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
    });

    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const qHornadas = query(collection(db, 'hornadas'), where('local', '==', LOCAL_ID), where('activa', '==', true));
    const unsubscribeHornadas = onSnapshot(qHornadas, (snapshot) => {
      const hornadasActivas = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(h => new Date(h.horaCarga) > inicioDia) 
        .sort((a, b) => new Date(a.horaListo) - new Date(b.horaListo));
      setHornadas(hornadasActivas);
    });

    return () => {
      unsubscribePedidos();
      unsubscribeFranjas();
      unsubscribeProductos();
      unsubscribeCategorias(); 
      if (typeof unsubscribeConfig === 'function') unsubscribeConfig();
      if (typeof unsubscribeHornadas === 'function') unsubscribeHornadas();
    };
  }, []);

  const calcularEstadoStockDinámico = (horaFranjaInicio) => {
    const horas = franjas.map(f => f.hora.split(' ')[0]).sort();
    const indexActual = horas.indexOf(horaFranjaInicio);
    
    // CAMBIO: Solo los productos que consumen 1 o más tienen su propia alarma y cálculo.
    const stockControlados = productos.filter(p => p.controlaStock && parseFloat(p.consumeUnidades || 1) >= 1);
    const resultado = {};

    stockControlados.forEach(prod => {
      if (indexActual === -1) {
        resultado[prod.id] = { libres: 0, faltan: 0, nombre: prod.nombre };
        return;
      }

      const esPolloPrincipal = prod.nombre.toUpperCase().includes('POLLO');
      let minDisponible = Infinity;

      for (let i = indexActual; i < horas.length; i++) {
        const horaEval = horas[i];
        const fechaEval = new Date();
        const [h, m] = horaEval.split(':').map(Number);
        fechaEval.setHours(h, m, 0, 0);

        const horneadosAcumulados = hornadas.reduce((sum, horno) => {
          const esEsteProducto = horno.productoId === prod.id || (!horno.productoId && esPolloPrincipal);
          if (esEsteProducto && new Date(horno.horaListo) <= fechaEval) {
            return sum + horno.cantidad;
          }
          return sum;
        }, 0);

        let pedidosAcumulados = 0;
        pedidos.filter(p => !p.historico && p.hora <= horaEval).forEach(p => {
           const texto = String(p.detalle).includes('|') ? String(p.detalle).split('|')[1] : String(p.detalle);
           if (texto) {
              texto.split('+').forEach(parte => {
                 const match = parte.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(.*)/i);
                 if (match) {
                    const cant = parseFloat(match[1]);
                    const nombreTicket = match[2].trim().toUpperCase();
                    
                    if (nombreTicket === prod.nombre.toUpperCase()) {
                        // Si el cliente pide el pollo entero
                        pedidosAcumulados += cant * parseFloat(prod.consumeUnidades || 1);
                    } else if (esPolloPrincipal) {
                        // CAMBIO: Si pide medio pollo, detectamos que es una fracción y lo sumamos a este pollo
                        const prodFraccion = productos.find(x => x.nombre.toUpperCase() === nombreTicket);
                        if (prodFraccion && prodFraccion.controlaStock && parseFloat(prodFraccion.consumeUnidades || 1) < 1) {
                            pedidosAcumulados += cant * parseFloat(prodFraccion.consumeUnidades);
                        }
                    }
                 }
              });
           }
        });

        const stockVirtual = horneadosAcumulados - pedidosAcumulados;
        if (stockVirtual < minDisponible) minDisponible = stockVirtual;
      }

      resultado[prod.id] = {
        libres: Math.max(minDisponible, 0),
        // Si nos falta "0.5" pollos para completar el pedido, avisamos de que falta 1 entero
        faltan: minDisponible < 0 ? Math.ceil(Math.abs(minDisponible)) : 0,
        nombre: prod.nombre
      };
    });

    return resultado;
  };

  const extraerUnidades = (detalleTexto) => {
    if (!detalleTexto) return 0;
    const texto = String(detalleTexto).includes('|') ? String(detalleTexto).split('|')[1] : String(detalleTexto);
    let pollos = 0;
    texto.split('+').forEach(parte => {
      const match = parte.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(.*)/i);
      if (match) {
        const cant = parseFloat(match[1]);
        const nombre = match[2].trim().toUpperCase();
        if (nombre.includes('POLLO')) {
          const prodInfo = productos.find(p => p.nombre.toUpperCase() === nombre);
          if (prodInfo && prodInfo.controlaStock) pollos += (cant * parseFloat(prodInfo.consumeUnidades));
          else pollos += nombre.includes('MEDIO') ? (cant * 0.5) : cant;
        }
      }
    });
    return pollos;
  };

  const obtenerReservadosPorFranja = (horaFranja) => {
    const horaInicio = horaFranja.split(' ')[0];
    return pedidos
      .filter(p => p.hora === horaInicio && !p.historico) 
      .reduce((sum, p) => sum + extraerUnidades(p.detalle), 0); 
  };

  const obtenerComandaGlobal = () => {
    const totales = {};
    pedidos.forEach(p => {
      if (p.historico) return; 
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

  const capacidadTotal = hornadas.filter(h => !h.productoId || h.nombreProducto?.toUpperCase().includes('POLLO')).reduce((sum, h) => sum + h.cantidad, 0);
  const totalReservados = pedidos.filter(p => !p.historico).reduce((sum, p) => sum + extraerUnidades(p.detalle), 0);
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
  const handleEntregar = async (id) => {
    await updateDoc(doc(db, 'pedidos', id), { entregado: true });
    setBusqueda('');
  };
  
  const handleCobrarPedido = async (id, tipoFianza = null) => {
    const actualizacion = { entregado: true, cobrado: true };
    if (tipoFianza) actualizacion.fianza = tipoFianza;
    await updateDoc(doc(db, 'pedidos', id), actualizacion);
    setPedidoSeleccionado(null); 
    setBusqueda('');
  };

  const handleDevolverFianza = async (id) => {
    await updateDoc(doc(db, 'pedidos', id), { fianza: 'devuelta' });
    setPedidoSeleccionado(null);
  };

  const handleAnularPedido = async (id) => await deleteDoc(doc(db, 'pedidos', id));
  const handleReubicarPedido = async (id, nuevaHora) => await updateDoc(doc(db, 'pedidos', id), { hora: nuevaHora });
 
const handleRegistrarHornada = async (producto) => {
    const esPollo = producto.nombre.toUpperCase().includes('POLLO');
    const defaultMax = esPollo ? (configuracion.capacidadMaxima || 48) : 20; 
    
    const cantidadStr = window.prompt(`🔥 ¿Qué cantidad de ${producto.nombre} vas a preparar ahora?\n\nEscribe la cantidad numérica:`, defaultMax);
    if (!cantidadStr) return; 
    
    const cantidad = parseInt(cantidadStr);
    if (isNaN(cantidad) || cantidad <= 0) return;

    const ahora = new Date();
    // Leemos los minutos del producto. Si no los tiene (porque se creó antes de esta mejora), usa 90 o 60 por defecto.
    const minutosCoccion = producto.minutosCoccion || (esPollo ? 90 : 60); 
    const horaListos = new Date(ahora.getTime() + minutosCoccion * 60000); 
    
    await addDoc(collection(db, 'hornadas'), {
      local: LOCAL_ID,
      productoId: producto.id,
      nombreProducto: producto.nombre,
      cantidad: cantidad,
      horaCarga: ahora.toISOString(),
      horaListo: horaListos.toISOString(),
      activa: true
    });
  };

  const handleFinalizarHornada = async (id, accion) => {
    if (accion === 'borrar') {
      if (window.confirm("🚨 ¿Seguro que quieres borrar este registro por un error humano?\n\nLas unidades desaparecerán del cálculo matemático de hoy.")) {
        await deleteDoc(doc(db, 'hornadas', id));
      }
    } else {
      await updateDoc(doc(db, 'hornadas', id), { activa: false });
    }
  };


  const handleLimpiarDia = async () => {
    if (window.confirm("🚨 ¿Seguro que quieres CERRAR EL DÍA? \n\n• Los pedidos NO RECOGIDOS se registrarán como PÉRDIDA.\n• Los hornos y la producción se reiniciarán a 0.")) {
      for (const p of pedidos) {
        const esVentaDirecta = p.cliente === 'VENTA DIRECTA';
        const estaCobrado = p.cobrado || esVentaDirecta;
        const tieneFianzaRetenida = p.fianza === 'retenida';
        
        if (!p.entregado) {
          await updateDoc(doc(db, 'pedidos', p.id), { archivado: true, estadoCierre: 'perdida_no_recogido' });
        } 
        else if (p.entregado && estaCobrado && !tieneFianzaRetenida) {
          await updateDoc(doc(db, 'pedidos', p.id), { archivado: true, estadoCierre: 'completado' });
        } 
        else {
          await updateDoc(doc(db, 'pedidos', p.id), { historico: true });
        }
      }

      for (const h of hornadas) {
        await updateDoc(doc(db, 'hornadas', h.id), { activa: false });
      }
      
      alert("🧹 Caja cerrada. Las pérdidas se han registrado y el mostrador está listo para mañana.");
    }
  };

  // --- FORMULARIOS DE CARRITO ---
  const handleAbrirNuevaReserva = () => {
    setNombreCliente(''); setCarritoExtras({}); 
    setHoraSeleccionada(franjas.length > 0 ? franjas[0].hora.split(' ')[0] : '');
    setOrigenReservaManual('TIENDA'); 
    setReservaPrePagada(false); 
    setEditandoPedidoId(null);
    setErrorValidacion(''); setModalAbierto(true); setTecladoPantallaCompleta(false);
  };

// <-- NUEVA FUNCIÓN PARA EDITAR -->
  const handleAbrirEdicionPedido = (pedido) => {
    setNombreCliente(pedido.cliente);
    setHoraSeleccionada(pedido.hora);
    setOrigenReservaManual(pedido.origen || 'TIENDA');
    setReservaPrePagada(pedido.cobrado || false);

    const nuevoCarrito = {};
    const texto = pedido.detalle.includes('|') ? pedido.detalle.split('|')[1] : pedido.detalle;
    texto.split('+').forEach(parte => {
      const match = parte.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(.*)/i);
      if (match) {
        const cant = parseFloat(match[1]);
        const nombreProd = match[2].trim().toUpperCase();
        const prodInfo = productos.find(p => p.nombre.toUpperCase() === nombreProd);
        if (prodInfo) {
          nuevoCarrito[prodInfo.id] = cant;
        }
      }
    });

    setCarritoExtras(nuevoCarrito);
    setEditandoPedidoId(pedido.id);
    setPedidoSeleccionado(null);
    setModalAbierto(true);
    setTecladoPantallaCompleta(false);
  };

  const handleTecladoPresionado = (letra) => {
    if (letra === '←') setNombreCliente(prev => prev.slice(0, -1));
    else if (nombreCliente.length < 18) setNombreCliente(prev => prev + letra);
  };

  const handleTecladoBuscarPresionado = (letra) => {
    if (letra === '←') {
      setBusqueda(prev => prev.slice(0, -1));
    } else if (letra === ' ') {
      setBusqueda(prev => prev + ' ');
    } else {
      if (busqueda.length < 18) setBusqueda(prev => prev + letra.toUpperCase());
    }
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
    let llevaPaella = false;
    let racionesPaella = 0;

    Object.entries(carritoExtras).forEach(([prodId, cant]) => {
      const prodInfo = productos.find(p => p.id === prodId);
      if (prodInfo) {
        lineasTicket.push(`${cant}x ${prodInfo.nombre}`);
        if (prodInfo.controlaStock && prodInfo.nombre.toUpperCase().includes('POLLO')) {
          stockConsumido += (parseFloat(prodInfo.consumeUnidades) * cant);
        }
        if (prodInfo.nombre.toUpperCase().includes('PAELLA') && cant > 0) {
          llevaPaella = true;
          racionesPaella = cant; 
        }
      }
    });

    if (lineasTicket.length === 0) { setErrorValidacion('⚠️ El pedido no puede estar vacío. Añade algún producto.'); return; }

    if (llevaPaella && racionesPaella < 2) {
      setErrorValidacion('⚠️ LA PAELLA DEBE SER COMO MÍNIMO PARA 2 PERSONAS.');
      return;
    }

    if (llevaPaella) {
      const ahora = new Date();
      const [horaSel, minSel] = horaSeleccionada.split(':').map(Number);
      const fechaReserva = new Date();
      fechaReserva.setHours(horaSel, minSel, 0, 0);
      if (fechaReserva.getTime() - ahora.getTime() < 2 * 60 * 60 * 1000) {
        setErrorValidacion('⚠️ LA PAELLA REQUIERE MÍNIMO 2 HORAS DE ANTELACIÓN PARA PODER COCINARLA.');
        return;
      }
    }
    
const detalleTexto = `${stockConsumido} | ` + lineasTicket.join(' + ');

    const dataPedido = {
      local: LOCAL_ID, 
      cliente: nombreCliente.trim().toUpperCase(), 
      hora: horaSeleccionada,
      detalle: detalleTexto, 
      cobrado: reservaPrePagada,
      fianza: llevaPaella ? 'pendiente' : null,
      origen: origenReservaManual
    };

    if (editandoPedidoId) {
      await updateDoc(doc(db, 'pedidos', editandoPedidoId), dataPedido);
    } else {
      dataPedido.entregado = false;
      dataPedido.creadoEn = new Date();
      await addDoc(collection(db, 'pedidos'), dataPedido);
    }

    setModalAbierto(false);
    setEditandoPedidoId(null);
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
        if (prodInfo.controlaStock && prodInfo.nombre.toUpperCase().includes('POLLO')) {
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
        hora: franjaDestino.hora.split(' ')[0],
        detalle: detalleTexto,
        entregado: true,
        origen: 'Mostrador Directo',
        creadoEn: new Date()
      });
      setVdCarritoExtras({});
      setModalVentaDirectaAbierto(false);
    } catch (error) {
      alert("❌ Error de Firebase al guardar la venta.");
    }
  };

  const handleCrearFranjaNueva = async () => {
    const horaInicio = prompt("Introduce la hora de inicio (Ej: 13:00):");
    const horaFin = prompt("Introduce la hora de fin (Ej: 14:00):");
    if (horaInicio && horaFin) {
      await addDoc(collection(db, 'franjas'), { 
        local: LOCAL_ID, hora: `${horaInicio} - ${horaFin}`
      });
    }
  };

  const handleBorrarFranjaConfig = async (id) => {
    if(window.confirm("¿Seguro que quieres borrar este tramo horario?")) await deleteDoc(doc(db, 'franjas', id));
  };

  const handleCrearCategoria = async () => {
    const nombre = prompt("Nombre de la categoría en CASTELLANO (Ej: PLATOS PRINCIPALES):");
    if (!nombre) return;
    
    const nombreCa = prompt("Nombre en CATALÁN (Ej: PLATS PRINCIPALS):") || nombre;
    const nombreEn = prompt("Nombre en INGLÉS (Ej: MAIN DISHES):") || nombre;
    const nombreFr = prompt("Nombre en FRANCÉS (Ej: PLATS PRINCIPAUX):") || nombre;

    await addDoc(collection(db, 'categorias'), {
      local: LOCAL_ID,
      nombre: nombre.toUpperCase(),
      nombre_ca: nombreCa.toUpperCase(),
      nombre_en: nombreEn.toUpperCase(),
      nombre_fr: nombreFr.toUpperCase()
    });
  };

  const handleBorrarCategoria = async (id) => {
    if(window.confirm("⚠️ ¿Seguro que quieres borrar esta categoría?")) {
      await deleteDoc(doc(db, 'categorias', id));
    }
  };

  const handleEditarCategoria = async (categoria) => {
    const nombre = prompt("Editar nombre en CASTELLANO:", categoria.nombre) || categoria.nombre;
    const nombreCa = prompt("Editar nombre en CATALÁN:", categoria.nombre_ca || nombre) || categoria.nombre_ca;
    const nombreEn = prompt("Editar nombre en INGLÉS:", categoria.nombre_en || nombre) || categoria.nombre_en;
    const nombreFr = prompt("Editar nombre en FRANCÉS:", categoria.nombre_fr || nombre) || categoria.nombre_fr;

    await updateDoc(doc(db, 'categorias', categoria.id), {
      nombre: nombre.toUpperCase(),
      nombre_ca: nombreCa.toUpperCase(),
      nombre_en: nombreEn.toUpperCase(),
      nombre_fr: nombreFr.toUpperCase()
    });
  };

  const handleCrearProductoNuevo = async () => {
    if (!categorias || categorias.length === 0) {
      alert("⚠️ Primero debes crear al menos una categoría en el paso 2.");
      return;
    }

    const nombre = prompt("Nombre en CASTELLANO (Ej: POLLO ENTERO):");
    if (!nombre) return;
    
    const nombreCa = prompt("Nombre en CATALÁN (Ej: POLLASTRE SENCER):") || nombre;
    const nombreEn = prompt("Nombre en INGLÉS (Ej: WHOLE CHICKEN):") || nombre;
    const nombreFr = prompt("Nombre en FRANCÉS (Ej: POULET ENTIER):") || nombre;

    const precio = prompt("Precio en euros (Ej: 12.50):");
    if (!precio) return;

    const menuCategorias = categorias.map((cat, index) => `${index + 1}. ${cat.nombre}`).join("\n");
    const seleccion = prompt(`Selecciona el número de la categoría para este producto:\n\n${menuCategorias}`);
    
    const numSeleccionado = parseInt(seleccion) - 1;
    if (isNaN(numSeleccionado) || numSeleccionado < 0 || numSeleccionado >= categorias.length) {
      alert("⚠️ Selección de categoría no válida. Proceso cancelado.");
      return;
    }
    const categoriaAsignadaId = categorias[numSeleccionado].id;
    
const controlaStock = window.confirm("¿Este producto necesita CONTROL DE STOCK diario mediante HORNADAS?\n\n(Aceptar = SÍ / Cancelar = NO)");
    let consumeUnidades = 0;
    let minutosCoccion = 0;
    if (controlaStock) {
      consumeUnidades = prompt(`¿Cuánto descuenta de cada hornada cuando piden 1 unidad de esto?\n(Ej: 1 para Pollo, 0.5 para Medio Pollo):`) || 1;
      minutosCoccion = prompt(`⏱️ ¿Cuántos MINUTOS tarda en asarse/cocinarse una hornada de este producto?\n(Ej: 90 para pollos, 60 para patatas):`, nombre.toUpperCase().includes('POLLO') ? 90 : 60) || 60;
    }

    await addDoc(collection(db, 'productos'), {
      local: LOCAL_ID, 
      nombre: nombre.toUpperCase(),
      nombre_ca: nombreCa.toUpperCase(),
      nombre_en: nombreEn.toUpperCase(),
      nombre_fr: nombreFr.toUpperCase(),
      precio: parseFloat(precio) || 0,
      categoriaId: categoriaAsignadaId,
      controlaStock: controlaStock, 
      consumeUnidades: parseFloat(consumeUnidades) || 0, 
      minutosCoccion: parseInt(minutosCoccion) || (nombre.toUpperCase().includes('POLLO') ? 90 : 60),
      activo: true
    });
  };

const handleEditarProducto = async (producto) => {
    const nombre = prompt("Editar nombre en CASTELLANO:", producto.nombre) || producto.nombre;
    const nombreCa = prompt("Editar nombre en CATALÁN:", producto.nombre_ca || nombre) || producto.nombre_ca;
    const nombreEn = prompt("Editar nombre en INGLÉS:", producto.nombre_en || nombre) || producto.nombre_en;
    const nombreFr = prompt("Editar nombre en FRANCÉS:", producto.nombre_fr || nombre) || producto.nombre_fr;
    const precio = prompt("Editar precio en euros:", producto.precio) || producto.precio;

    let minutosCoccion = producto.minutosCoccion || (producto.nombre.toUpperCase().includes('POLLO') ? 90 : 60);
    if (producto.controlaStock) {
      const editMinutos = prompt(`⏱️ Editar MINUTOS de cocción para hornadas:`, minutosCoccion);
      if (editMinutos) minutosCoccion = parseInt(editMinutos);
    }

    let categoriaAsignadaId = producto.categoriaId || '';
    if (categorias && categorias.length > 0) {
      const miCatActual = categorias.find(c => c.id === producto.categoriaId);
      const menuCategorias = categorias.map((cat, index) => `${index + 1}. ${cat.nombre}`).join("\n");
      const seleccion = prompt(`Selecciona el número de la nueva categoría (Actual: ${miCatActual ? miCatActual.nombre : 'NINGUNA'}):\n\n${menuCategorias}\n\n(Deja en blanco si no quieres cambiarla)`);
      
      if (seleccion && seleccion.trim() !== '') {
        const numSeleccionado = parseInt(seleccion) - 1;
        if (!isNaN(numSeleccionado) && numSeleccionado >= 0 && numSeleccionado < categorias.length) {
          categoriaAsignadaId = categorias[numSeleccionado].id;
        }
      }
    }

    await updateDoc(doc(db, 'productos', producto.id), {
      nombre: nombre.toUpperCase(),
      nombre_ca: nombreCa.toUpperCase(),
      nombre_en: nombreEn.toUpperCase(),
      nombre_fr: nombreFr.toUpperCase(),
      precio: parseFloat(precio) || 0,
      categoriaId: categoriaAsignadaId,
      ...(producto.controlaStock && { minutosCoccion: minutosCoccion })
    });
  };

  const handleBorrarProductoConfig = async (id) => {
    if(window.confirm("¿Seguro que quieres borrar este producto de la carta?")) await deleteDoc(doc(db, 'productos', id));
  };

  const handleMoverProducto = async (producto, direccion) => {
    const indexActual = productosOrdenados.findIndex(p => p.id === producto.id);
    const indexDestino = direccion === 'SUBIR' ? indexActual - 1 : indexActual + 1;
    if (indexDestino < 0 || indexDestino >= productosOrdenados.length) return;

    const producto1 = productosOrdenados[indexActual];
    const producto2 = productosOrdenados[indexDestino];

    const orden1 = producto1.orden !== undefined ? producto1.orden : indexActual;
    const orden2 = producto2.orden !== undefined ? producto2.orden : indexDestino;

    await updateDoc(doc(db, 'productos', producto1.id), { orden: orden2 });
    await updateDoc(doc(db, 'productos', producto2.id), { orden: orden1 });
  };

  const pedidosProcesados = [...pedidos].sort((a, b) => {
    if (a.entregado && !b.entregado) return 1;
    if (!a.entregado && b.entregado) return -1;
    return a.hora.localeCompare(b.hora);
  });

  const productosOrdenados = [...productos].sort((a, b) => {
    const ordenA = a.orden !== undefined ? a.orden : 999;
    const ordenB = b.orden !== undefined ? b.orden : 999;
    if (ordenA !== ordenB) return ordenA - ordenB;
    return a.nombre.localeCompare(b.nombre);
  });

  return (
    <div className={`fixed inset-0 overflow-hidden overscroll-none flex flex-col ${APP_CONFIG.tema.fondoBase} text-slate-800 p-4 md:p-6 font-sans antialiased`}>
      <header className={`shrink-0 z-40 ${APP_CONFIG.tema.headerBg} backdrop-blur-md rounded-2xl p-6 shadow-md border ${APP_CONFIG.tema.bordeClaro} mb-4 relative overflow-hidden`}>
        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> Nube Conectada
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 mt-2">
          <div className="text-center lg:text-left flex items-center justify-center lg:justify-start gap-3">
            {APP_CONFIG.logoUrl ? (
              <img src={APP_CONFIG.logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
            ) : (
              <span className="text-4xl">🍗</span>
            )}
            <div>
              <h1 className={`text-3xl font-black ${APP_CONFIG.tema.textoPrincipal} tracking-tight uppercase`}>{APP_CONFIG.nombre}</h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Panel de Control de Reservas</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 w-full lg:w-auto text-center font-mono">
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="block text-[10px] font-bold text-slate-500 uppercase">Pollos Totales</span>
              <span className="text-xl md:text-2xl font-black text-slate-700">{capacidadTotal}</span>
            </div>
            <div className="bg-orange-50 p-3 rounded-xl border border-orange-200">
              <span className="block text-[10px] font-bold text-orange-700 uppercase">Reservados</span>
              <span className="text-xl md:text-2xl font-black text-orange-600">{totalReservados}</span>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <span className="block text-[10px] font-bold text-emerald-700 uppercase">Libres</span>
              <span className="text-xl md:text-2xl font-black text-emerald-600">{totalDisponibles}</span>
            </div>
          </div>

          {}
<div className="flex flex-wrap gap-1.5 w-full lg:w-auto justify-center">
            <button onClick={() => setModalProduccionAbierto(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-3 py-3 md:px-5 md:py-4 rounded-xl shadow-md transition-all active:scale-95 text-[11px] md:text-xs uppercase tracking-wider cursor-pointer border-b-4 border-indigo-800">
              📋 PRODUCCIÓN
            </button>
            <button onClick={() => { setVdCarritoExtras({}); setModalVentaDirectaAbierto(true); }} disabled={franjas.length === 0} className="bg-slate-800 hover:bg-slate-900 text-white font-black px-3 py-3 md:px-5 md:py-4 rounded-xl shadow-md transition-all active:scale-95 text-[11px] md:text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50 border-b-4 border-slate-950">
              🪙 VENTA DIRECTA
            </button>
            <button onClick={handleAbrirNuevaReserva} disabled={franjas.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-3 py-3 md:px-5 md:py-4 rounded-xl shadow-md transition-all active:scale-95 text-[11px] md:text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50 border-b-4 border-emerald-800">
              ➕ RESERVA
            </button>
            <button onClick={() => setVista(vista === 'mostrador' ? 'configuracion' : 'mostrador')} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-black px-3 py-3 md:px-5 md:py-4 rounded-xl text-sm transition-all cursor-pointer border-b-4 border-slate-300">
              ⚙️
            </button>
          </div>
        </div>
      </header>

      {vista === 'mostrador' && franjas.length > 0 && (
        <div className="flex-1 flex flex-col min-h-0">
          
          {modoLayout === 'FULL' && (
            <div className="flex gap-2 mb-4 shrink-0">
              <button onClick={() => setPantallaActiva('HORNOS')} className={`flex-1 py-4 font-black rounded-xl border-4 transition-all ${pantallaActiva === 'HORNOS' ? 'bg-orange-500 text-white border-orange-700 shadow-md' : 'bg-white border-slate-200 text-slate-500'}`}>🔥 ESTADO ASADORES</button>
              <button onClick={() => setPantallaActiva('PEDIDOS')} className={`flex-1 py-4 font-black rounded-xl border-4 transition-all ${pantallaActiva === 'PEDIDOS' ? 'bg-indigo-600 text-white border-indigo-800 shadow-md' : 'bg-white border-slate-200 text-slate-500'}`}>📋 PEDIDOS</button>
            </div>
          )}

          {/* CONTENEDOR DE SECCIONES CORREGIDO PARA TABLETS */}
          <div className={`${modoLayout === 'SPLIT' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'flex-1'} flex-1 min-h-0`}>
            
            {}
            <section className={`bg-white rounded-2xl p-5 shadow-sm border border-orange-100 flex flex-col overflow-hidden relative ${(modoLayout === 'FULL' && pantallaActiva !== 'HORNOS') ? 'hidden' : ''}`}>
              
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 shrink-0 border-b-2 border-slate-100 pb-3">📊 Estado de Carga por Franja</h2>
              
<div className="space-y-4 overflow-y-auto pr-2 flex-1 scrollbar-hide">
                {franjas.map((f) => {
                  const horaInicio = f.hora.split(' ')[0];
                  const reservados = obtenerReservadosPorFranja(f.hora);
                  
                  // Usamos el motor universal para TODOS los productos con stock
                  const estadoStock = calcularEstadoStockDinámico(horaInicio);
                  const faltantes = Object.values(estadoStock).filter(s => s.faltan > 0);
                  
                  // Para la barra de progreso nos seguimos basando en los pollos
                  const libresPollos = Object.values(estadoStock).filter(s => s.nombre.toUpperCase().includes('POLLO')).reduce((sum, s) => sum + s.libres, 0);
                  const capacidadVirtualFranja = reservados + libresPollos;
                  const porcentaje = capacidadVirtualFranja > 0 ? (reservados / capacidadVirtualFranja) * 100 : (reservados > 0 ? 100 : 0);
                  
                  let colorBarra = "bg-emerald-500";
                  let estiloFila = "bg-slate-50/60 border-slate-100";
                  
                  if (faltantes.length > 0) { 
                    colorBarra = "bg-rose-500 animate-pulse"; 
                    estiloFila = "bg-rose-50 border-rose-200 ring-2 ring-rose-500/10"; 
                  } else if (porcentaje >= 85) { 
                    colorBarra = "bg-amber-500"; 
                    estiloFila = "bg-amber-50/50 border-amber-200"; 
                  }
 return (
                    <div key={f.id} onClick={() => { setFranjaDetalleSeleccionada(f); setModalDetalleFranjaAbierto(true); }} className={`p-4 rounded-xl border flex flex-col gap-2 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all ${estiloFila}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex flex-col gap-1.5">
                            <div className="flex flex-wrap items-center gap-1.5 max-w-[180px] sm:max-w-none">
                              <span className="font-black text-lg md:text-xl text-slate-800 shrink-0">{f.hora}</span>
                              {faltantes.map((falta, idx) => (
                                <span key={idx} className="animate-pulse bg-rose-600 text-white text-[9px] px-2 py-0.5 rounded-md font-black shadow-sm tracking-wider whitespace-nowrap">
                                  🚨 FALTAN {falta.faltan} {falta.nombre}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <span className="block text-xs font-bold mt-1 text-slate-500 mb-1">{reservados} ud. en pedidos </span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {Object.values(estadoStock).map((s, idx) => (
                              <span key={idx} className={`text-[10px] font-bold px-2 py-0.5 rounded-lg whitespace-nowrap ${s.libres > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                                {s.libres} {s.nombre} libres
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner mt-2">
                        <div className={`h-3 rounded-full transition-all duration-300 ${colorBarra}`} style={{ width: `${Math.min(porcentaje, 100)}%` }}></div>
                      </div>
                    </div>
                  );
                  
                 })}
              </div>

              {modoLayout === 'SPLIT' && tecladoBuscarAbierto && (
                <div className="absolute inset-0 bg-white z-50 p-6 flex flex-col gap-2 border-4 border-slate-300">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-black text-slate-800 uppercase text-lg">⌨️ BUSCANDO: {busqueda}</h3>
                    <button onClick={() => { setTecladoBuscarAbierto(false); setBusqueda(''); }} className="bg-rose-500 text-white font-black px-6 py-2 rounded-xl">CERRAR</button>
                  </div>
                  {filasTeclado.map((fila, fIdx) => (
                    <div key={fIdx} className="flex gap-2 h-16 w-full">
                      {fila.map((letra, lIdx) => (
                        <button key={lIdx} type="button" onClick={() => handleTecladoBuscarPresionado(letra)} 
                          className={`flex-1 font-black rounded-xl text-2xl ${letra === '←' ? 'bg-rose-500 text-white' : 'bg-slate-200 hover:bg-slate-300'} active:scale-95 cursor-pointer`}>
                          {letra}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={`bg-white rounded-2xl p-5 shadow-sm border border-orange-100 flex flex-col overflow-hidden ${(modoLayout === 'FULL' && pantallaActiva !== 'PEDIDOS') ? 'hidden' : ''}`}>
              
<div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4 border-b-2 border-slate-100 pb-4 shrink-0">
                <div className="flex flex-nowrap overflow-x-auto gap-2 w-full pb-2 scrollbar-hide">
                  <button onClick={() => setFiltroHora('Todos')} className={`shrink-0 px-6 py-3 rounded-xl text-xs font-black uppercase border-2 transition-all cursor-pointer ${filtroHora === 'Todos' ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>Todos</button>
                  {franjas.map(f => { const h = f.hora.split(' ')[0]; return <button key={f.id} onClick={() => setFiltroHora(h)} className={`shrink-0 px-6 py-3 rounded-xl text-xs font-black border-2 transition-all cursor-pointer ${filtroHora === h ? 'bg-orange-600 text-white border-orange-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>{h}</button> })}
                </div>
                <div className="w-full md:w-auto shrink-0 flex gap-2">
                  <button onClick={() => setMostrarSoloPendientes(!mostrarSoloPendientes)} className={`w-12 h-12 shrink-0 flex items-center justify-center rounded-xl text-2xl border-2 transition-all cursor-pointer ${mostrarSoloPendientes ? 'bg-amber-100 border-amber-300' : 'bg-slate-100 border-slate-200'}`}>
                    {mostrarSoloPendientes ? '👀' : '👁️'}
                  </button>
                  <div className="relative w-full md:w-48">
                    <input type="text" placeholder="🔍 BUSCAR..." value={busqueda} onChange={(e) => setBusqueda(e.target.value.toUpperCase())} onFocus={() => setTecladoBuscarAbierto(true)} inputMode="none" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-700 uppercase focus:outline-none focus:border-orange-500 pr-10" />
                    {busqueda && <button onClick={(e) => { e.stopPropagation(); setBusqueda(''); setTecladoBuscarAbierto(false); }} className="absolute right-3 top-3.5 text-rose-500 font-black cursor-pointer">✕</button>}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex overflow-hidden gap-4">
                <div className={`overflow-y-auto pr-2 scrollbar-hide space-y-3 transition-all duration-300 ${tecladoBuscarAbierto ? (modoLayout === 'FULL' ? 'w-1/2' : 'w-full') : 'w-full'}`}>
                  {pedidosProcesados
                    .filter(p => filtroHora === 'Todos' ? true : p.hora === filtroHora)
                    .filter(p => busqueda === '' ? true : p.cliente.toUpperCase().includes(busqueda))
                    .filter(p => { if (!mostrarSoloPendientes) return true; const esVentaDirecta = p.cliente === 'VENTA DIRECTA'; return !(p.entregado && (p.cobrado || esVentaDirecta) && p.fianza !== 'retenida'); })
                    .map((p) => {
                      const esVentaDirecta = p.cliente === 'VENTA DIRECTA';
                      const estaCobrado = p.cobrado || esVentaDirecta;
                      const fianzaRetenida = p.fianza === 'retenida';
                      const tienePaella = p.detalle.toUpperCase().includes('PAELLA');
                      let estiloTarjeta = 'bg-amber-50/40 border-amber-200';
                      if (tienePaella && !p.entregado) estiloTarjeta = 'bg-yellow-50 border-yellow-400 ring-2 ring-yellow-400/60';
                      else if (p.entregado && !estaCobrado) estiloTarjeta = 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/50';
                      else if (p.entregado && estaCobrado && fianzaRetenida) estiloTarjeta = 'bg-orange-50 border-orange-400 ring-2 ring-orange-500/40';
                      else if (p.entregado && estaCobrado && !fianzaRetenida) estiloTarjeta = 'bg-slate-50 border-slate-200 opacity-55';
                      
                      return (
                        <div key={p.id} onClick={() => { if(!esVentaDirecta) setPedidoSeleccionado(p) }} className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer ${esVentaDirecta ? 'cursor-default' : 'hover:scale-[1.01]'} ${estiloTarjeta}`}>
                          <div className="flex flex-col gap-0.5 w-full">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black font-mono text-orange-600 bg-white px-2 py-0.5 rounded border">{p.hora}</span>
                                <span className="text-sm font-black text-slate-800 uppercase truncate">{p.cliente}</span>
                                {estaCobrado && !p.entregado && <span className="text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded shadow-sm tracking-widest shrink-0">PAGADO</span>}
                              </div>
                              <p className="text-[11px] font-bold text-slate-600 truncate">{p.detalle}</p>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {tecladoBuscarAbierto && modoLayout === 'FULL' && (
                  <div className={`${modoLayout === 'FULL' ? 'w-1/2 border-l-2 border-slate-200 pl-4' : 'w-full'} flex flex-col gap-2 shrink-0`}>
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="font-black text-slate-400 uppercase text-[10px]">⌨️ BUSCANDO: {busqueda}</h3>
                      <button onClick={() => setTecladoBuscarAbierto(false)} className="text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer">CERRAR</button>
                    </div>
                    {filasTeclado.map((fila, fIdx) => (
                      <div key={fIdx} className="flex gap-1.5 h-12 w-full">
                        {fila.map((letra, lIdx) => (
                          <button key={lIdx} type="button" onClick={() => handleTecladoBuscarPresionado(letra)} 
                            className={`flex-1 font-black rounded-lg text-lg ${letra === '←' ? 'bg-rose-500 text-white' : 'bg-slate-200 hover:bg-slate-300'} active:scale-95 cursor-pointer`}>
                            {letra}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {vista === 'configuracion' && (
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100 max-w-5xl mx-auto space-y-8 flex-1 overflow-y-auto w-full mb-4">
          <div className="bg-slate-50 p-6 rounded-2xl border-2 border-indigo-100 shadow-sm">
            <h2 className="text-xl font-black text-slate-800 uppercase mb-4">🖥️ 0. Preferencias de Pantalla</h2>
            <div className="flex gap-4">
              <button onClick={() => setModoLayout('SPLIT')} className={`flex-1 py-4 rounded-xl font-black border-4 cursor-pointer transition-all ${modoLayout === 'SPLIT' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>MODO CLÁSICO (Dividido)</button>
              <button onClick={() => setModoLayout('FULL')} className={`flex-1 py-4 rounded-xl font-black border-4 cursor-pointer transition-all ${modoLayout === 'FULL' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>MODO FULL (Pantalla Completa)</button>
            </div>
          </div>

          <div className="bg-orange-50 p-6 rounded-2xl border-2 border-orange-200 shadow-sm mb-4">
            <h2 className="text-xl font-black text-slate-800 uppercase mb-4">🔥 Capacidad Base de Pollos</h2>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <span className="text-sm font-bold text-slate-600 uppercase">Sugerencia de Carga:</span>
              <input 
                type="number" 
                value={configuracion.capacidadMaxima} 
                onChange={async (e) => {
                  const valor = parseInt(e.target.value) || 0;
                  if (configuracion.id) {
                    await updateDoc(doc(db, 'configuracion', configuracion.id), { capacidadMaxima: valor });
                  } else {
                    await addDoc(collection(db, 'configuracion'), { local: LOCAL_ID, capacidadMaxima: valor });
                  }
                }} 
                className="w-32 text-center text-3xl font-black bg-white border-4 border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500 text-orange-600" 
              />
            </div>
            <p className="text-orange-700/70 text-xs mt-3 font-bold uppercase">Esto pre-rellenará el botón al crear una hornada de pollos nueva.</p>
          </div>

          <div className="bg-slate-50 border-4 border-slate-200 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
            <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4">
              <button onClick={() => setVista('mostrador')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-4 rounded-xl uppercase text-sm shadow cursor-pointer border-b-4 border-emerald-800 active:scale-95 transition-all">💾 Volver al Mostrador</button>
              <button onClick={() => setModalCierreCajaAbierto(true)} className="bg-rose-600 hover:bg-rose-700 text-white font-black px-4 py-4 rounded-xl shadow-md uppercase text-sm cursor-pointer active:scale-95 transition-all border-b-4 border-rose-800">🧹 Cerrar Caja</button>
              <button onClick={() => setModalEstadisticasAbierto(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-4 rounded-xl shadow-md uppercase text-sm cursor-pointer active:scale-95 transition-all border-b-4 border-indigo-800">📊 Estadísticas</button>
            </div>
          </div>

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

          <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase">🗂️ 2. Categorías de la Carta</h2>
            </div>
            <button onClick={handleCrearCategoria} className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-black px-4 py-2.5 rounded-xl text-xs border border-indigo-300 cursor-pointer shadow-sm">➕ Crear Categoría</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            {categorias.length === 0 && (
              <div className="col-span-full p-4 text-center text-slate-400 font-bold text-xs uppercase bg-white border border-dashed border-slate-300 rounded-xl">Aún no has creado ninguna categoría.</div>
            )}
            {categorias.map(cat => (
              <div key={cat.id} className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex justify-between items-center group">
                <span className="font-black text-indigo-800 text-sm truncate uppercase">{cat.nombre}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleEditarCategoria(cat)} className="text-indigo-400 hover:text-indigo-600">✏️</button>
                  <button onClick={() => handleBorrarCategoria(cat.id)} className="text-rose-400 hover:text-rose-600">🗑</button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase">🍟 3. Carta y Control de Stock</h2>
            </div>
            <button onClick={handleCrearProductoNuevo} className="bg-orange-100 text-orange-700 hover:bg-orange-200 font-black px-4 py-2.5 rounded-xl text-xs border border-orange-300 cursor-pointer shadow-sm">➕ Añadir Producto</button>
          </div>
          <div className="space-y-3">
            {productosOrdenados.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">{p.nombre}</h3>
                    {(() => {
                      const miCat = categorias.find(c => c.id === p.categoriaId);
                      return miCat ? (
                        <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-100 uppercase tracking-wider">📁 {miCat.nombre}</span>
                      ) : (
                        <span className="text-[9px] font-black bg-rose-50 text-rose-500 px-2 py-0.5 rounded-md border border-rose-100 uppercase tracking-wider">⚠️ SIN CATEGORÍA</span>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-orange-600 font-black text-sm">{parseFloat(p.precio).toFixed(2)}€</span>
                    {p.controlaStock && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase border border-emerald-200">Restará: {p.consumeUnidades} ud. por hornada</span>}
                  </div>
                </div>
                
                <div className="flex gap-1">
                  <div className="flex flex-col gap-1 mr-2">
                    <button onClick={() => handleMoverProducto(p, 'SUBIR')} className="text-slate-500 bg-slate-100 w-8 h-6 rounded font-black text-xs hover:bg-slate-200 cursor-pointer">▲</button>
                    <button onClick={() => handleMoverProducto(p, 'BAJAR')} className="text-slate-500 bg-slate-100 w-8 h-6 rounded font-black text-xs hover:bg-slate-200 cursor-pointer">▼</button>
                  </div>
                  <button onClick={() => handleEditarProducto(p)} className="text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg font-bold text-xs uppercase border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors">✏️ Editar</button>
                  <button onClick={() => handleBorrarProductoConfig(p.id)} className="text-rose-500 bg-rose-50 px-3 py-2 rounded-lg font-bold text-xs uppercase border border-rose-100 cursor-pointer hover:bg-rose-100 transition-colors">🗑 Borrar</button>
                </div>
              </div>
            ))}
          </div>

        </section>
      )}

      {modalProduccionAbierto && (() => {
        const totalesCocina = obtenerComandaGlobal();
        return (
          <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4 lg:p-10 z-50 overflow-hidden">
            <div className="bg-white rounded-[2rem] w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl overflow-hidden border-4 border-indigo-500">
              <div className="bg-indigo-600 p-6 flex justify-between items-center text-white shrink-0">
                <h3 className="text-3xl font-black uppercase tracking-tight">📋 BALANCE DE PRODUCCIÓN</h3>
                <button onClick={() => setModalProduccionAbierto(false)} className="bg-indigo-700 hover:bg-rose-600 font-black text-xl px-6 py-2 rounded-xl cursor-pointer transition-colors border-b-4 border-indigo-900">✕ Cerrar</button>
              </div>
              <div className="p-8 flex-1 overflow-y-auto bg-slate-50">
                
                {/* NUEVA ZONA SUPERIOR DE PRODUCCIÓN: CONTROL DE HORNOS UNIVERSAL */}
                <div className="mb-10 bg-white p-6 rounded-3xl border-4 border-orange-200 shadow-sm">
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                    <h4 className="text-2xl font-black text-orange-800 uppercase flex items-center gap-3">🔥 Control de Producción y Asadores</h4>
                  </div>
                  
<div className="bg-slate-50 border-2 border-dashed border-slate-300 p-4 rounded-xl mb-6 flex flex-wrap gap-3">
                    <span className="text-sm font-black text-slate-500 uppercase w-full mb-1">Añadir Hornada de:</span>
                    {productos.filter(p => p.controlaStock && parseFloat(p.consumeUnidades || 1) >= 1).map(prod => (
                      <button key={prod.id} onClick={() => handleRegistrarHornada(prod)} className="bg-orange-600 hover:bg-orange-700 text-white font-black px-4 py-3 rounded-xl uppercase shadow-md active:scale-95 transition-all border-b-4 border-orange-800 flex items-center gap-2 text-sm">
                        ➕ {prod.nombre} ({prod.minutosCoccion || (prod.nombre.toUpperCase().includes('POLLO') ? 90 : 60)}min)
                      </button>
                    ))}
                    {productos.filter(p => p.controlaStock && parseFloat(p.consumeUnidades || 1) >= 1).length === 0 && <span className="text-sm text-slate-400">No hay productos con control de stock.</span>}
                  </div>
                  
                  {hornadas.length === 0 ? (
                    <p className="text-slate-400 font-bold uppercase text-center py-4 bg-white rounded-xl border border-slate-100">No hay ninguna hornada registrada en marcha ahora mismo.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {hornadas.map(h => {
                        const horaListos = new Date(h.horaListo);
                        const horaTexto = `${horaListos.getHours().toString().padStart(2, '0')}:${horaListos.getMinutes().toString().padStart(2, '0')}`;
                        const yaEstanListos = horaListos <= new Date();

                        return (
                          <div key={h.id} className={`p-4 rounded-2xl border-4 flex flex-col justify-between shadow-sm transition-all ${yaEstanListos ? 'bg-emerald-50 border-emerald-400' : 'bg-orange-50 border-orange-400'}`}>
                            <div className="flex items-center gap-3 mb-4">
                              <span className={yaEstanListos ? "text-3xl grayscale" : "text-3xl animate-pulse"}>{yaEstanListos ? '✅' : '🔥'}</span>
                              <div className="flex flex-col">
                                <span className={`text-xl font-black ${yaEstanListos ? 'text-emerald-800' : 'text-orange-800'} leading-tight uppercase`}>{h.cantidad} {h.nombreProducto || 'POLLOS'}</span>
                                <span className="text-xs font-bold text-slate-500 mt-1">
                                  A partir de las: <span className="font-mono font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">{horaTexto}</span>
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleFinalizarHornada(h.id, 'borrar')} title="Borrar por error" className="w-10 h-10 flex items-center justify-center bg-white border-2 border-slate-200 text-slate-400 hover:text-rose-500 rounded-xl cursor-pointer transition-colors active:scale-95">🗑️</button>
                              <button onClick={() => handleFinalizarHornada(h.id, 'completar')} className={`flex-1 font-black text-xs uppercase py-2 rounded-xl border-b-4 cursor-pointer transition-colors active:scale-95 ${yaEstanListos ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-700' : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'}`}>
                                {yaEstanListos ? '✔️ SACAR' : '👁️ OCULTAR DEL PANEL'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* FIN NUEVA ZONA HORNOS */}

                {Object.keys(totalesCocina).length === 0 ? (
                  <div className="text-center py-20"><span className="text-4xl text-slate-300 font-black">No hay reservas pendientes de entrega.</span></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Object.entries(totalesCocina).sort((a,b)=>b[1].total - a[1].total).map(([nombre, counts]) => {
                      return (
                        <div key={nombre} className="bg-white p-5 rounded-3xl border-4 border-indigo-100 flex flex-col items-center justify-center gap-2 shadow-md hover:border-indigo-300 transition-colors">
                          <span className="text-base font-black text-slate-700 uppercase text-center leading-tight h-12 flex items-center">{nombre}</span>
                          
                          <div className="w-full bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 flex flex-col items-center mb-2 mt-1">
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
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {}
      {modalVentaDirectaAbierto && (() => {
        const franjaActual = obtenerFranjaActualEnCurso();
        return (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 lg:p-6 z-50 overflow-hidden">
            <div className="bg-white rounded-[2rem] w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="bg-slate-800 p-4 flex justify-between items-center text-white shrink-0">
                <h3 className="text-2xl font-black uppercase tracking-tight">🪙 REGISTRAR VENTA DIRECTA</h3>
                <button onClick={() => setModalVentaDirectaAbierto(false)} className="bg-slate-700 hover:bg-rose-600 font-black text-xl px-4 py-2 rounded-xl">✕ Cancelar</button>
              </div>
              <div className="p-6 flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
              <button type="button" onClick={() => setTecladoPantallaCompleta(false)} className="w-full bg-emerald-600 text-white font-black text-3xl py-6 rounded-2xl uppercase shadow-md">✓ Fijar Nombre</button>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
<div className="bg-orange-600 p-4 flex justify-between items-center text-white shrink-0">
                <h3 className="text-2xl font-black uppercase tracking-tight">{editandoPedidoId ? '📝 EDITAR RESERVA' : '📝 Nueva Reserva'}</h3>
                <button onClick={() => { setModalAbierto(false); setEditandoPedidoId(null); }} className="bg-orange-700 hover:bg-rose-600 font-black text-xl px-4 py-2 rounded-xl">✕ Cancelar</button>
              </div>
              <div className="p-6 flex flex-col flex-1 overflow-hidden">
<div className="flex flex-row items-stretch gap-4 border-b-4 border-slate-100 pb-4 mb-4 shrink-0 h-20">
                  <div className="w-1/4 min-w-[200px]">
                    <div onClick={() => setTecladoPantallaCompleta(true)} className="w-full h-full bg-slate-50 border-4 border-slate-200 hover:border-orange-400 rounded-xl flex items-center justify-center text-2xl font-black text-slate-800 cursor-pointer shadow-inner px-2"><span className="truncate">{nombreCliente || "👉 NOMBRE"}</span></div>
                  </div>
                  <div className="flex-1 flex flex-row flex-nowrap gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {franjas.map(f => {
                      const h = f.hora.split(' ')[0];
                      return ( 
                        <button 
                          key={f.id} 
                          type="button" 
                          onClick={() => setHoraSeleccionada(h)} 
                          className={`shrink-0 px-6 h-full rounded-xl font-black font-mono text-2xl border-4 cursor-pointer flex items-center justify-center transition-all ${horaSeleccionada === h ? 'bg-orange-600 text-white border-orange-600 shadow-md scale-105' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                        >
                          {h}
                        </button> 
                      );
                    })}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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
                <div className="shrink-0 mt-4 pt-4 border-t-4 border-slate-100 space-y-4">
                  {errorValidacion && <p className="text-rose-600 font-black text-center text-lg bg-rose-50 p-3 rounded-xl border-4 border-rose-200 mb-3">{errorValidacion}</p>}
                  
                  <div className="flex gap-4">
                    <button type="button" onClick={() => setOrigenReservaManual('TIENDA')} className={`flex-1 font-black py-4 rounded-2xl uppercase text-2xl border-4 transition-all cursor-pointer shadow-sm ${origenReservaManual === 'TIENDA' ? 'bg-indigo-600 text-white border-indigo-800 scale-105' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}>🏪 EN TIENDA</button>
                    <button type="button" onClick={() => setOrigenReservaManual('TELÉFONO')} className={`flex-1 font-black py-4 rounded-2xl uppercase text-2xl border-4 transition-all cursor-pointer shadow-sm ${origenReservaManual === 'TELÉFONO' ? 'bg-indigo-600 text-white border-indigo-800 scale-105' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}>📞 POR TELÉFONO</button>
                  </div>
                  {(() => {
                    const totalReserva = Object.entries(carritoExtras).reduce((sum, [prodId, cant]) => {
                      const prod = productos.find(p => p.id === prodId);
                      return sum + (prod ? prod.precio * cant : 0);
                    }, 0);

                    return (
                      <>
                        <div className="flex gap-4">
                          <div className="bg-slate-100 border-4 border-slate-200 rounded-2xl px-6 flex flex-col items-center justify-center shrink-0 w-1/3">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total Reserva</span>
                            <span className="text-4xl font-mono font-black text-slate-800">{totalReserva.toFixed(2)}€</span>
                          </div>
                          <button type="button" onClick={() => setReservaPrePagada(!reservaPrePagada)} className={`flex-1 font-black py-4 rounded-2xl uppercase text-2xl border-4 transition-all cursor-pointer shadow-sm flex flex-col items-center justify-center gap-1 ${reservaPrePagada ? 'bg-emerald-100 text-emerald-800 border-emerald-400 scale-[1.02]' : 'bg-white text-slate-400 border-slate-300 hover:bg-slate-50'}`}>
                            <span>{reservaPrePagada ? '✅ PAGADO EN MOSTRADOR' : '⏳ PAGO EN RECOGIDA'}</span>
                            <span className="text-[10px] font-bold tracking-widest opacity-80">{reservaPrePagada ? '(Se marcará como cobrado directo)' : '(Se cobrará al entregar)'}</span>
                          </button>
                        </div>
<button type="button" onClick={handleGuardarPedido} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-2xl uppercase text-3xl shadow-xl transition-colors border-b-8 border-emerald-800 cursor-pointer">💾 {editandoPedidoId ? 'Guardar Cambios' : 'Confirmar Reserva'}</button>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {pedidoSeleccionado && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 lg:p-6 z-50 overflow-hidden">
          <div className="bg-white rounded-[2rem] w-full max-w-3xl p-8 shadow-2xl border-4 border-orange-500 flex flex-col gap-6">
            <div className="flex justify-between items-start border-b-4 border-slate-100 pb-6">
              <div>
                <h3 className="text-4xl lg:text-5xl font-black text-slate-800 uppercase tracking-tight">{pedidoSeleccionado.cliente}</h3>
                <span className="text-lg font-black text-orange-600 bg-orange-50 px-4 py-2 rounded-xl border-2 border-orange-200 font-mono mt-3 inline-block">⏰ HORA ACTUAL: {pedidoSeleccionado.hora}</span>
              </div>
              <button onClick={() => setPedidoSeleccionado(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-black text-xl px-6 py-4 rounded-2xl cursor-pointer transition-all">✕ CERRAR</button>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border-4 border-slate-100">
              <span className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Detalle de la comanda:</span>
              <div className="flex justify-between items-center mt-2">
                <p className="text-2xl font-black text-slate-700 font-mono leading-relaxed">{pedidoSeleccionado.detalle.includes('|') ? pedidoSeleccionado.detalle.split('|')[1].trim() : pedidoSeleccionado.detalle}</p>
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

            <button onClick={() => handleAbrirEdicionPedido(pedidoSeleccionado)} className="w-full bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border-4 border-indigo-300 font-black py-3 rounded-2xl uppercase text-lg cursor-pointer mt-1 transition-all shadow-sm">
              ✏️ EDITAR PRODUCTOS O CANTIDADES
            </button>

            <div className="grid grid-cols-1 gap-4 mt-2">
              {!pedidoSeleccionado.cobrado && (
                <div className="bg-indigo-50 border-4 border-indigo-100 p-5 rounded-2xl flex flex-col gap-4 shadow-inner">
                  {pedidoSeleccionado.fianza === 'pendiente' ? (
                    <>
                      <div className="bg-amber-100 border-2 border-amber-300 text-amber-800 p-3 rounded-xl font-black text-center text-sm uppercase">🥘 ESTE PEDIDO TIENE PAELLA</div>
                      <div className="flex flex-col sm:flex-row gap-3 w-full">
                        <button onClick={() => handleCobrarPedido(pedidoSeleccionado.id, 'retenida')} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black py-4 rounded-2xl uppercase text-lg shadow-xl border-b-8 border-amber-700 cursor-pointer active:scale-95 transition-all">🪙 COBRAR + 20€ FIANZA</button>
                        <button onClick={() => handleCobrarPedido(pedidoSeleccionado.id, 'descartada')} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl uppercase text-lg shadow-xl border-b-8 border-indigo-800 cursor-pointer active:scale-95 transition-all">🪙 COBRAR NORMAL</button>
                      </div>
                    </>
                  ) : (
                    <button onClick={() => handleCobrarPedido(pedidoSeleccionado.id)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-6 rounded-2xl uppercase text-3xl shadow-xl border-b-8 border-indigo-800 cursor-pointer active:scale-95 transition-all">🪙 {pedidoSeleccionado.entregado ? 'COBRAR LO PENDIENTE' : 'COBRAR Y ENTREGAR'}</button>
                  )}
                  {!pedidoSeleccionado.entregado && (
                    <button onClick={() => { handleEntregar(pedidoSeleccionado.id); setPedidoSeleccionado(null); }} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-black py-4 rounded-xl uppercase text-sm border-2 border-slate-400 cursor-pointer active:scale-95 transition-all">⚠️ Entregar ahora, pero dejar PENDIENTE DE PAGO</button>
                  )}
                </div>
              )}

              {pedidoSeleccionado.cobrado && !pedidoSeleccionado.entregado && (
                <div className="bg-emerald-50 border-4 border-emerald-200 p-5 rounded-2xl flex flex-col gap-4 shadow-inner">
                  <span className="text-emerald-700 font-black uppercase text-center text-lg">✅ PEDIDO ABONADO POR ADELANTADO</span>
                  <button onClick={() => { handleEntregar(pedidoSeleccionado.id); setPedidoSeleccionado(null); }} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 rounded-2xl uppercase text-2xl shadow-xl border-b-8 border-emerald-700 cursor-pointer active:scale-95 transition-all">📦 ENTREGAR PEDIDO</button>
                </div>
              )}

              {pedidoSeleccionado.cobrado && pedidoSeleccionado.fianza === 'retenida' && (
                <div className="bg-amber-50 border-4 border-amber-200 p-5 rounded-2xl flex flex-col gap-4 shadow-inner">
                  <span className="text-amber-700 font-black uppercase text-center text-lg">🥘 SARTÉN PENDIENTE DE DEVOLVER</span>
                  <button onClick={() => handleDevolverFianza(pedidoSeleccionado.id)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 rounded-2xl uppercase text-2xl shadow-xl border-b-8 border-emerald-700 cursor-pointer active:scale-95 transition-all">🤝 SARTÉN DEVUELTA (Abonar 20€)</button>
                </div>
              )}
              
              <div className="bg-slate-100 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border-2 border-slate-200">
                <span className="font-black text-slate-600 uppercase text-lg">↪️ Mover a otra hora:</span>
                <select onChange={(e) => { handleReubicarPedido(pedidoSeleccionado.id, e.target.value); setPedidoSeleccionado(null); }} className="bg-white border-4 border-slate-300 text-slate-800 font-black rounded-xl px-6 py-4 text-xl focus:outline-none cursor-pointer w-full sm:w-auto" defaultValue="">
                  <option value="" disabled>Seleccionar tramo...</option>
                  {franjas.map(fr => <option key={fr.id} value={fr.hora.split(' ')[0]}>{fr.hora.split(' ')[0]}</option>)}
                </select>
              </div>

              {!(pedidoSeleccionado.fianza === 'retenida' || (pedidoSeleccionado.entregado && !pedidoSeleccionado.cobrado)) && (
                <button onClick={() => { if(window.confirm("¿Estás seguro de anular y borrar este pedido para siempre?")) { handleAnularPedido(pedidoSeleccionado.id); setPedidoSeleccionado(null); } }} className="bg-rose-100 hover:bg-rose-200 text-rose-700 border-4 border-rose-200 font-black py-5 rounded-2xl uppercase text-xl cursor-pointer mt-2 transition-all">❌ ANULAR Y BORRAR PEDIDO</button>
              )}
            </div>
          </div>
        </div>
      )}

      {modalCierreCajaAbierto && (() => {
        let ventas = 0; let fianzasRetenidas = 0; let pendienteCobro = 0; let perdidas = 0;
        pedidos.forEach(p => {
          if (p.historico) return; 
          let precioPedido = 0;
          const texto = String(p.detalle).includes('|') ? String(p.detalle).split('|')[1] : String(p.detalle);
          texto.split('+').forEach(parte => {
            const match = parte.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(.*)/i);
            if (match) {
              const prod = productos.find(x => x.nombre.toUpperCase() === match[2].trim().toUpperCase());
              if (prod) precioPedido += (parseFloat(match[1]) * prod.precio);
            }
          });
          const esVentaDirecta = p.cliente === 'VENTA DIRECTA';
          const estaCobrado = p.cobrado || esVentaDirecta;
          if (p.entregado && estaCobrado) ventas += precioPedido;
          else if (p.entregado && !estaCobrado) pendienteCobro += precioPedido;
          else if (!p.entregado) perdidas += precioPedido;
          if (p.fianza === 'retenida') fianzasRetenidas += 20; 
        });

        const totalCajaEsperado = ventas + fianzasRetenidas;
        return (
          <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4 lg:p-10 z-50 overflow-hidden">
            <div className="bg-white rounded-[2rem] w-full max-w-4xl flex flex-col shadow-2xl overflow-hidden border-4 border-rose-500">
              <div className="bg-rose-600 p-6 flex justify-between items-center text-white shrink-0">
                <h3 className="text-3xl font-black uppercase tracking-tight">🧹 CUADRE Y CIERRE DE CAJA</h3>
                <button onClick={() => setModalCierreCajaAbierto(false)} className="bg-rose-700 hover:bg-slate-800 font-black text-2xl px-6 py-2 rounded-xl cursor-pointer transition-colors border-b-4 border-rose-900">✕ CANCELAR</button>
              </div>
              <div className="p-8 flex-1 bg-slate-50 space-y-6 overflow-y-auto">
                <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-slate-200">
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 border-b-2 border-slate-100 pb-2">💰 Dinero Físico en Caja</h4>
                  <div className="flex justify-between items-center py-3 border-b border-dashed border-slate-200">
                    <span className="text-xl font-black text-slate-700 uppercase">Ventas Cobradas (Mostrador + Reservas)</span>
                    <span className="text-2xl font-mono font-black text-emerald-600">{ventas.toFixed(2)}€</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-slate-200">
                    <span className="text-xl font-black text-slate-700 uppercase">Fianzas Retenidas (Sartenes)</span>
                    <span className="text-2xl font-mono font-black text-amber-500">+{fianzasRetenidas.toFixed(2)}€</span>
                  </div>
                  <div className="flex justify-between items-center pt-6 mt-2 bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-3xl border-t-2 border-slate-200">
                    <span className="text-3xl font-black text-slate-800 uppercase">TOTAL A CUADRAR:</span>
                    <span className="text-5xl font-mono font-black text-rose-600 bg-white px-6 py-2 rounded-2xl border-4 border-rose-100 shadow-sm">{totalCajaEsperado.toFixed(2)}€</span>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-white border-t-4 border-slate-100">
                <button onClick={() => { setModalCierreCajaAbierto(false); handleLimpiarDia(); }} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-6 rounded-2xl uppercase text-3xl shadow-xl border-b-8 border-rose-800 cursor-pointer active:scale-95 transition-all">🚨 CONFIRMAR Y CERRAR EL DÍA</button>
              </div>
            </div>
          </div>
        );
      })()}

{modalEstadisticasAbierto && (() => {
        // Filtramos usando las fechas seleccionadas
        const pedidosEnFecha = pedidosHistoricos.filter(p => {
          const fechaPedido = p.fecha || (p.creadoEn && p.creadoEn.toDate ? p.creadoEn.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
          return fechaPedido >= filtroFechaInicio && fechaPedido <= filtroFechaFin;
        });

        let ventasGlobales = 0; let perdidasGlobales = 0; let volumenGlobal = 0;
        let ventasFiltradas = 0; let perdidasFiltradas = 0; let volumenFiltrado = 0;
        const desgloseCanales = { 'WEB/QR': { reservas: 0, dinero: 0 }, 'TELÉFONO': { reservas: 0, dinero: 0 }, 'TIENDA': { reservas: 0, dinero: 0 }, 'MOSTRADOR DIRECTO': { reservas: 0, dinero: 0 } };

        pedidosEnFecha.forEach(p => {
          const esVentaDirecta = p.cliente === 'VENTA DIRECTA';
          const estaCobrado = p.cobrado || esVentaDirecta;
          const esExito = p.entregado && estaCobrado && p.estadoCierre !== 'perdida_no_recogido';
          
          let totalTicket = 0;
          const texto = String(p.detalle).includes('|') ? String(p.detalle).split('|')[1] : String(p.detalle);
          
          texto.split('+').forEach(parte => {
            const match = parte.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(.*)/i);
            if (match) {
              const cantidad = parseFloat(match[1]);
              const nombreProd = match[2].trim().toUpperCase();
              const prod = productos.find(x => x.nombre.toUpperCase() === nombreProd);
              
              if (prod) {
                const valorLinea = cantidad * prod.precio;
                totalTicket += valorLinea;
                
                const esBuscado = filtroProductoEstat === 'TODOS' || nombreProd === filtroProductoEstat;
                
                if (esExito) {
                  ventasGlobales += valorLinea; 
                  volumenGlobal += cantidad;
                  if (esBuscado) { ventasFiltradas += valorLinea; volumenFiltrado += cantidad; }
                } else if (!p.entregado || p.estadoCierre === 'perdida_no_recogido') {
                  perdidasGlobales += valorLinea;
                  if (esBuscado) perdidasFiltradas += valorLinea;
                }
              }
            }
          });
          
          if (esExito) {
            const canal = p.origen ? p.origen.toUpperCase() : 'TIENDA';
            if (canal.includes('QR') || canal.includes('WEB')) { desgloseCanales['WEB/QR'].reservas++; desgloseCanales['WEB/QR'].dinero += totalTicket; }
            else if (canal.includes('TELÉFONO')) { desgloseCanales['TELÉFONO'].reservas++; desgloseCanales['TELÉFONO'].dinero += totalTicket; }
            else if (canal.includes('DIRECTA') || canal.includes('MOSTRADOR')) { desgloseCanales['MOSTRADOR DIRECTO'].reservas++; desgloseCanales['MOSTRADOR DIRECTO'].dinero += totalTicket; }
            else { desgloseCanales['TIENDA'].reservas++; desgloseCanales['TIENDA'].dinero += totalTicket; }
          }
        });

        // Función para exportar a CSV (Excel)
        const exportarExcel = () => {
          let csvContent = "data:text/csv;charset=utf-8,";
          csvContent += "Fecha,Cliente,Hora,Detalle,Total (€),Origen,Estado\n";
          
          pedidosEnFecha.forEach(p => {
             const fecha = p.fecha || (p.creadoEn && p.creadoEn.toDate ? p.creadoEn.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
             let total = 0;
             const texto = String(p.detalle).includes('|') ? String(p.detalle).split('|')[1] : String(p.detalle);
             texto.split('+').forEach(parte => {
                const match = parte.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(.*)/i);
                if(match) {
                   const prod = productos.find(x => x.nombre.toUpperCase() === match[2].trim().toUpperCase());
                   if(prod) total += parseFloat(match[1]) * prod.precio;
                }
             });
             const estado = (p.entregado && (p.cobrado || p.cliente === 'VENTA DIRECTA')) ? "Completado" : (!p.entregado ? "Pérdida/No Recogido" : "Pendiente Cobro");
             const fila = `"${fecha}","${p.cliente}","${p.hora}","${texto.trim()}","${total.toFixed(2)}","${p.origen || 'Tienda'}","${estado}"`;
             csvContent += fila + "\n";
          });
          
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement("a");
          link.setAttribute("href", encodedUri);
          link.setAttribute("download", `Estadisticas_LaFosca_${filtroFechaInicio}_a_${filtroFechaFin}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        return (
          <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4 lg:p-8 z-50 overflow-hidden">
            <div className="bg-white rounded-[2rem] w-full max-w-7xl h-[95vh] flex flex-col shadow-2xl overflow-hidden border-4 border-slate-800">
              
              {/* CABECERA */}
              <div className="bg-slate-800 p-6 shrink-0 border-b-4 border-slate-900">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tight">📊 INTELIGENCIA DE NEGOCIO</h3>
                  <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={exportarExcel} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xl px-6 py-2 rounded-xl cursor-pointer transition-colors shadow-md">📥 EXPORTAR EXCEL</button>
                    <button onClick={() => setModalEstadisticasAbierto(false)} className="flex-1 md:flex-none bg-slate-700 hover:bg-rose-600 text-white font-black text-xl px-6 py-2 rounded-xl cursor-pointer transition-colors">✕ CERRAR</button>
                  </div>
                </div>
                
                {/* FILTROS DE BÚSQUEDA */}
                <div className="flex flex-wrap gap-4 bg-slate-700 p-4 rounded-xl">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-300 uppercase mb-1">Fecha Inicio</label>
                    <input type="date" value={filtroFechaInicio} onChange={(e) => setFiltroFechaInicio(e.target.value)} className="bg-slate-800 text-white border-2 border-slate-600 rounded-lg px-3 py-2 font-mono focus:border-indigo-500 focus:outline-none" />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-300 uppercase mb-1">Fecha Fin</label>
                    <input type="date" value={filtroFechaFin} onChange={(e) => setFiltroFechaFin(e.target.value)} className="bg-slate-800 text-white border-2 border-slate-600 rounded-lg px-3 py-2 font-mono focus:border-indigo-500 focus:outline-none" />
                  </div>
                  <div className="flex flex-col flex-1 min-w-[200px]">
                    <label className="text-[10px] font-bold text-slate-300 uppercase mb-1">Filtrar por Producto</label>
                    <select value={filtroProductoEstat} onChange={(e) => setFiltroProductoEstat(e.target.value)} className="bg-slate-800 text-white border-2 border-slate-600 rounded-lg px-3 py-2 font-bold uppercase focus:border-indigo-500 focus:outline-none">
                      <option value="TODOS">🧾 TODOS LOS PRODUCTOS</option>
                      {productos.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* CONTENIDO Y TARJETAS */}
              <div className="p-6 flex-1 overflow-y-auto bg-slate-100 flex flex-col gap-6">
                
                <h4 className="text-xl font-black text-slate-700 uppercase border-b-2 border-slate-200 pb-2">Resumen General ({filtroProductoEstat})</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                  <div className="bg-white p-6 rounded-3xl border-2 border-emerald-200 shadow-sm flex flex-col justify-center items-center">
                    <span className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-1">Ingresos Totales</span>
                    <span className="text-5xl font-mono font-black text-emerald-600">{ventasFiltradas.toFixed(2)}€</span>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border-2 border-rose-200 shadow-sm flex flex-col justify-center items-center">
                    <span className="text-xs font-black text-rose-800 uppercase tracking-widest mb-1">Pérdidas (No recogidos)</span>
                    <span className="text-5xl font-mono font-black text-rose-600">{perdidasFiltradas.toFixed(2)}€</span>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border-2 border-indigo-200 shadow-sm flex flex-col justify-center items-center">
                    <span className="text-xs font-black text-indigo-800 uppercase tracking-widest mb-1">Unidades Vendidas</span>
                    <span className="text-5xl font-mono font-black text-indigo-600">{volumenFiltrado}</span>
                  </div>
                </div>

                <h4 className="text-xl font-black text-slate-700 uppercase border-b-2 border-slate-200 pb-2 mt-4">Ventas por Canal de Origen</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(desgloseCanales).map(([canal, stats]) => (
                    <div key={canal} className="bg-white p-4 rounded-2xl border-2 border-slate-200 flex flex-col">
                      <span className="text-xs font-black text-slate-500 uppercase">{canal}</span>
                      <span className="text-2xl font-black text-slate-800 mt-2">{stats.dinero.toFixed(2)}€</span>
                      <span className="text-sm font-bold text-slate-400">{stats.reservas} tickets</span>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          </div>
        );
      })()}

      {/* --- NUEVO MODAL DE DETALLE DE FRANJA (CORREGIDO Y POTENCIADO) --- */}
      {modalDetalleFranjaAbierto && franjaDetalleSeleccionada && (() => {
        // La clave de todo: Extraemos SOLO la hora "13:30" ignorando el " - 14:00"
        const horaInicio = franjaDetalleSeleccionada.hora.split(' ')[0];
        
        // Ahora sí que encontrará los pedidos
        const pedidosFranja = pedidos.filter(p => p.hora === horaInicio && !p.historico);

        // EXTRA: Calculamos un resumen total de productos para esta hora
        const totalesFranja = {};
        pedidosFranja.forEach(p => {
          const texto = p.detalle.includes('|') ? p.detalle.split('|')[1] : p.detalle;
          if(texto) {
            texto.split('+').forEach(parte => {
              const match = parte.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(.*)/i);
              if (match) {
                const cant = parseFloat(match[1]);
                const nombre = match[2].trim().toUpperCase();
                if (cant > 0) {
                  totalesFranja[nombre] = (totalesFranja[nombre] || 0) + cant;
                }
              }
            });
          }
        });

        return (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 lg:p-6 z-[60] overflow-hidden">
            <div className="bg-white rounded-[2rem] w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden border-4 border-indigo-600">
              <div className="bg-indigo-600 p-6 flex justify-between items-center text-white shrink-0 border-b-4 border-indigo-800">
                <h3 className="text-2xl font-black uppercase tracking-tight">⏱️ PEDIDOS PARA LAS {franjaDetalleSeleccionada.hora}</h3>
                <button onClick={() => setModalDetalleFranjaAbierto(false)} className="bg-indigo-500 hover:bg-rose-600 font-black text-lg px-4 py-2 rounded-xl transition-colors shadow-inner">✕ CERRAR</button>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto bg-slate-50 flex flex-col gap-6">
                
                {/* 1. Resumen Agregado (Súper útil para el asador) */}
                {Object.keys(totalesFranja).length > 0 && (
                  <div className="bg-white p-5 rounded-3xl shadow-sm border-2 border-indigo-100">
                    <h4 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-4 border-b-2 border-slate-100 pb-2">📦 RESUMEN TOTAL A PREPARAR (STOCK Y NO STOCK)</h4>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(totalesFranja).sort((a,b)=>b[1]-a[1]).map(([nombre, cant]) => (
                        <div key={nombre} className="bg-orange-50 border-2 border-orange-200 text-orange-800 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
                          <span className="text-2xl font-black font-mono">{cant}</span>
                          <span className="text-sm font-black uppercase leading-tight">{nombre}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Lista de Pedidos Individuales */}
                <div className="space-y-3">
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2 border-b-2 border-slate-100 pb-2">📝 DETALLE DE TICKETS ({pedidosFranja.length})</h4>
                  {pedidosFranja.length === 0 ? (
                    <p className="text-slate-500 font-bold p-6 text-center bg-white rounded-xl border border-dashed border-slate-300">No hay pedidos registrados para esta hora.</p>
                  ) : (
                    pedidosFranja.map(pedido => {
                      const textoLimpio = pedido.detalle.includes('|') ? pedido.detalle.split('|')[1].trim() : pedido.detalle;
                      return (
                        <div key={pedido.id} className="bg-white p-4 rounded-xl border-l-8 border-l-indigo-500 shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <span className="font-black text-lg text-slate-800 uppercase block">{pedido.cliente}</span>
                            <span className="text-sm font-bold text-slate-600 block mt-1">{textoLimpio}</span>
                          </div>
                          <div className="shrink-0 flex flex-col gap-2">
                             {pedido.cobrado ? <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded uppercase text-center border border-emerald-200">PAGADO</span> : <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-2 py-1 rounded uppercase text-center border border-rose-200">PENDIENTE COBRO</span>}
                             {pedido.entregado ? <span className="bg-slate-200 text-slate-600 text-[10px] font-black px-2 py-1 rounded uppercase text-center border border-slate-300">ENTREGADO</span> : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}