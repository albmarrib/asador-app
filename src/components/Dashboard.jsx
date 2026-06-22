import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';

const LOCAL_ID = 'asador-dc';

// NUEVO: CEREBRO DE MARCA BLANCA PARA EL PANEL
const APP_CONFIG = {
  nombre: 'ROSTISSERIA LA FOSCA',
 logoUrl: '/logo-fosca.png', // <-- FÍJATE EN LA BARRA INCLINADA AL PRINCIPIO
  tema: {
    fondoBase: 'bg-teal-50/40',
    headerBg: 'bg-white/95',
    textoPrincipal: 'text-teal-600',
    bordeClaro: 'border-teal-100',
  }
};

export default function Dashboard() {

  const [vista, setVista] = useState('mostrador'); 
  const [modoLayout, setModoLayout] = useState('SPLIT'); // 'SPLIT' (50/50) o 'FULL' (Pantalla completa)
  const [pantallaActiva, setPantallaActiva] = useState('PEDIDOS'); // 'PEDIDOS' o 'HORNOS'
  const [franjas, setFranjas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]); 
  const [categorias, setCategorias] = useState([]); // <-- NUEVO: ESTADO PARA CATEGORÍAS
  const [filtroHora, setFiltroHora] = useState('Todos');
  const [busqueda, setBusqueda] = useState(''); 
  const [mostrarSoloPendientes, setMostrarSoloPendientes] = useState(true);
  const [tecladoBuscarAbierto, setTecladoBuscarAbierto] = useState(false);
  
  // ESTADOS MODALES PANTALLA COMPLETA
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tecladoPantallaCompleta, setTecladoPantallaCompleta] = useState(false);
  const [modalCargaAbierto, setModalCargaAbierto] = useState(false);
  const [modalProduccionAbierto, setModalProduccionAbierto] = useState(false); 
  const [modalVentaDirectaAbierto, setModalVentaDirectaAbierto] = useState(false); 
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null); // Para el nuevo modal de gestión
// ESTADOS NUEVO MODAL DETALLE DE FRANJA
const [modalDetalleFranjaAbierto, setModalDetalleFranjaAbierto] = useState(false);
const [franjaDetalleSeleccionada, setFranjaDetalleSeleccionada] = useState(null);

// ESTADO MODAL CIERRE DE CAJA
const [modalCierreCajaAbierto, setModalCierreCajaAbierto] = useState(false);
const [modalEstadisticasAbierto, setModalEstadisticasAbierto] = useState(false);
// CONTROLES DEL MEGA-PANEL DE ESTADÍSTICAS
const [filtroFechaInicio, setFiltroFechaInicio] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]); // Día 1 de este mes por defecto
const [filtroFechaFin, setFiltroFechaFin] = useState(new Date().toISOString().split('T')[0]); // Hoy por defecto
const [filtroProductoEstat, setFiltroProductoEstat] = useState('TODOS');

  // ESTADOS FORMULARIO RESERVA MANUAL
  const [nombreCliente, setNombreCliente] = useState('');
  const [carritoExtras, setCarritoExtras] = useState({}); 
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  const [errorValidacion, setErrorValidacion] = useState('');
  const [origenReservaManual, setOrigenReservaManual] = useState('TIENDA'); // <-- NUEVO ESTADO
  const [reservaPrePagada, setReservaPrePagada] = useState(false);

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

    // NUEVO: ESCUCHAR LAS CATEGORÍAS EN TIEMPO REAL
    const qCategorias = query(collection(db, 'categorias'), where('local', '==', LOCAL_ID));
    const unsubscribeCategorias = onSnapshot(qCategorias, (snapshot) => {
      // Ordenamos las categorías alfabéticamente por defecto
      setCategorias(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.nombre.localeCompare(b.nombre)));
    });

    return () => {
      unsubscribePedidos();
      unsubscribeFranjas();
      unsubscribeProductos();
      unsubscribeCategorias(); // <-- NUEVO: DESCONECTAR CATEGORÍAS AL CERRAR
    };
  }, []);

    // --- MOTORES MATEMÁTICOS DE PROCESAMIENTO ---
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

  const chequearSobrecargaOtros = (franja, pedidosFranja) => {
    const limitePatatas = Number(franja.patatas || franja.maxPatatas || (franja.capacidad && franja.capacidad.patatas) || 0);
    const limiteButifarras = Number(franja.butifarras || franja.maxButifarras || (franja.capacidad && franja.capacidad.butifarras) || 0);
    let consumos = { patatas: 0, butifarras: 0 };
    
    pedidosFranja.forEach(p => {
      if (p.historico) return; // IGNORAMOS LA COMIDA DE DEUDAS VIEJAS
      const texto = String(p.detalle).includes('|') ? String(p.detalle).split('|')[1] : String(p.detalle);
      texto.split('+').forEach(parte => {
        const match = parte.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(.*)/i);
        if (match) {
          const cant = parseFloat(match[1]);
          const nombre = match[2].trim().toUpperCase();
          if (nombre.includes('PATATA')) consumos.patatas += cant;
          if (nombre.includes('BUTI')) consumos.butifarras += cant; 
        }
      });
    });
    
    if ((limitePatatas > 0 && consumos.patatas > limitePatatas) || (limiteButifarras > 0 && consumos.butifarras > limiteButifarras)) return true;
    return false;
  };

  const obtenerReservadosPorFranja = (horaFranja) => {
    const horaInicio = horaFranja.split(' ')[0];
    return pedidos
      .filter(p => p.hora === horaInicio && !p.historico) // IGNORAMOS COMIDA VIEJA
      .reduce((sum, p) => sum + extraerUnidades(p.detalle), 0); 
  };

  const calcularAlertaFranja = (f) => {
    const reales = obtenerReservadosPorFranja(f.hora);
    return reales > f.max ? reales - f.max : 0;
  };

  const obtenerComandaGlobal = () => {
    const totales = {};
    pedidos.forEach(p => {
      if (p.historico) return; // NO CUENTA EN LA PRODUCCIÓN DE HOY
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
  // Cuentan TODOS los pedidos de hoy (los pendientes, los ya entregados y la venta directa)
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
    // Solo marca la fianza como devuelta y cierra la pantalla
    await updateDoc(doc(db, 'pedidos', id), { fianza: 'devuelta' });
    setPedidoSeleccionado(null);
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
    if (window.confirm("🚨 ¿Seguro que quieres CERRAR EL DÍA? \n\n• Los pedidos NO RECOGIDOS se registrarán como PÉRDIDA y desaparecerán.\n• Las deudas y sartenes se mantendrán, pero su comida no contará para mañana.\n• Los hornos se vaciarán a 0.")) {
      for (const p of pedidos) {
        const esVentaDirecta = p.cliente === 'VENTA DIRECTA';
        const estaCobrado = p.cobrado || esVentaDirecta;
        const tieneFianzaRetenida = p.fianza === 'retenida';
        
        // CASO 1: Pérdida (No recogido) -> Se archiva y desaparece del todo
        if (!p.entregado) {
          await updateDoc(doc(db, 'pedidos', p.id), { archivado: true, estadoCierre: 'perdida_no_recogido' });
        } 
        // CASO 2: Completado limpio -> Se archiva y desaparece del todo
        else if (p.entregado && estaCobrado && !tieneFianzaRetenida) {
          await updateDoc(doc(db, 'pedidos', p.id), { archivado: true, estadoCierre: 'completado' });
        } 
        // CASO 3: Deudas y Sartenes -> Sobreviven, pero las marcamos como de días pasados
        else {
          await updateDoc(doc(db, 'pedidos', p.id), { historico: true });
        }
      }
      for (const f of franjas) {
        await updateDoc(doc(db, 'franjas', f.id), {
          max: 0,
          capacidad: { pollos: 0, patatas: 0, butifarras: 0 }
        });
      }
      alert("🧹 Caja cerrada. Las pérdidas se han registrado y el mostrador está listo para mañana.");
    }
  };


  // --- FORMULARIOS DE CARRITO ---
const handleAbrirNuevaReserva = () => {
    setNombreCliente(''); setCarritoExtras({}); 
    setHoraSeleccionada(franjas.length > 0 ? franjas[0].hora.split(' ')[0] : '');
    setOrigenReservaManual('TIENDA'); 
    setReservaPrePagada(false); // <-- RESETEA EL ESTADO DE PAGO
    setErrorValidacion(''); setModalAbierto(true); setTecladoPantallaCompleta(false);
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

let racionesPaella = 0; // <-- Guardamos cuántas raciones piden

  Object.entries(carritoExtras).forEach(([prodId, cant]) => {
    const prodInfo = productos.find(p => p.id === prodId);
    if (prodInfo) {
      lineasTicket.push(`${cant}x ${prodInfo.nombre}`);
      if (prodInfo.controlaStock) stockConsumido += (parseFloat(prodInfo.consumeUnidades) * cant);
      if (prodInfo.nombre.toUpperCase() === 'PAELLA' && cant > 0) {
        llevaPaella = true;
        racionesPaella = cant; // <-- Almacenamos el número de personas
      }
    }
  });

  if (lineasTicket.length === 0) { setErrorValidacion('⚠️ El pedido no puede estar vacío. Añade algún producto.'); return; }

  // NUEVA LIMITACIÓN: MÍNIMO 2 PERSONAS PARA LA PAELLA
  if (llevaPaella && racionesPaella < 2) {
    setErrorValidacion('⚠️ LA PAELLA DEBE SER COMO MÍNIMO PARA 2 PERSONAS.');
    return;
  }

  // REGLA DE LAS 2 HORAS PARA LA PAELLA

  if (llevaPaella) {
    const ahora = new Date();
    const [horaSel, minSel] = horaSeleccionada.split(':').map(Number);
    const fechaReserva = new Date();
    fechaReserva.setHours(horaSel, minSel, 0, 0);

    // Diferencia en milisegundos (2 horas)
    if (fechaReserva.getTime() - ahora.getTime() < 2 * 60 * 60 * 1000) {
      setErrorValidacion('⚠️ LA PAELLA REQUIERE MÍNIMO 2 HORAS DE ANTELACIÓN PARA PODER COCINARLA.');
      return;
    }
  }
  
  const detalleTexto = `${stockConsumido} | ` + lineasTicket.join(' + ');

await addDoc(collection(db, 'pedidos'), {
    local: LOCAL_ID, 
    cliente: nombreCliente.trim().toUpperCase(), 
    hora: horaSeleccionada,
    detalle: detalleTexto, 
    entregado: false, 
    cobrado: reservaPrePagada, // <-- AHORA DEPENDE DEL BOTÓN DE PRE-PAGO
    fianza: llevaPaella ? 'pendiente' : null,
    origen: origenReservaManual, // <-- AQUÍ USAMOS EL ESTADO SELECCIONADO
    creadoEn: new Date()
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

  // --- NUEVAS FUNCIONES DE CATEGORÍAS ---
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
    // Validación previa: Si no hay categorías, no dejamos crear productos
    if (!categorias || categorias.length === 0) {
      alert("⚠️ Primero debes crear al menos una categoría en el paso 3.");
      return;
    }

    // 1. Pedimos los nombres en todos los idiomas
    const nombre = prompt("Nombre en CASTELLANO (Ej: POLLO ENTERO):");
    if (!nombre) return;
    
    const nombreCa = prompt("Nombre en CATALÁN (Ej: POLLASTRE SENCER):") || nombre;
    const nombreEn = prompt("Nombre en INGLÉS (Ej: WHOLE CHICKEN):") || nombre;
    const nombreFr = prompt("Nombre en FRANCÉS (Ej: POULET ENTIER):") || nombre;

    const precio = prompt("Precio en euros (Ej: 12.50):");
    if (!precio) return;

    // --- NUEVO: SELECCIÓN TÁCTIL DE CATEGORÍA POR NÚMERO ---
    const menuCategorias = categorias.map((cat, index) => `${index + 1}. ${cat.nombre}`).join("\n");
    const seleccion = prompt(`Selecciona el número de la categoría para este producto:\n\n${menuCategorias}`);
    
    const numSeleccionado = parseInt(seleccion) - 1;
    if (isNaN(numSeleccionado) || numSeleccionado < 0 || numSeleccionado >= categorias.length) {
      alert("⚠️ Selección de categoría no válida. Proceso cancelado.");
      return;
    }
    const categoriaAsignadaId = categorias[numSeleccionado].id;
    
    const controlaStock = window.confirm("¿Este producto necesita CONTROL DE STOCK diario en los hornos?\n\n(Aceptar = SÍ / Cancelar = NO)");
    let stock = 0, consumeUnidades = 0;
    if (controlaStock) {
      stock = prompt(`Stock inicial de la carta para ${nombre}:`) || 0;
      consumeUnidades = prompt(`¿Cuánto stock descuenta de los hornos al pedirlo?\n(Ej: 1 para Pollo, 0.5 para Medio Pollo):`) || 1;
    }

    // 2. Guardamos el producto con su correspondiente categoriaId en Firebase
    await addDoc(collection(db, 'productos'), {
      local: LOCAL_ID, 
      nombre: nombre.toUpperCase(),
      nombre_ca: nombreCa.toUpperCase(),
      nombre_en: nombreEn.toUpperCase(),
      nombre_fr: nombreFr.toUpperCase(),
      precio: parseFloat(precio) || 0,
      categoriaId: categoriaAsignadaId, // <-- NUEVO: VÍNCULO RELACIONAL
      controlaStock: controlaStock, 
      stockMaximo: parseInt(stock) || 0, 
      consumeUnidades: parseFloat(consumeUnidades) || 0, 
      activo: true
    });
  };

  // NUEVO: FUNCIÓN PARA EDITAR LOS PRODUCTOS EXISTENTES
  const handleEditarProducto = async (producto) => {
    const nombre = prompt("Editar nombre en CASTELLANO:", producto.nombre) || producto.nombre;
    const nombreCa = prompt("Editar nombre en CATALÁN:", producto.nombre_ca || nombre) || producto.nombre_ca;
    const nombreEn = prompt("Editar nombre en INGLÉS:", producto.nombre_en || nombre) || producto.nombre_en;
    const nombreFr = prompt("Editar nombre en FRANCÉS:", producto.nombre_fr || nombre) || producto.nombre_fr;
    const precio = prompt("Editar precio en euros:", producto.precio) || producto.precio;

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
      categoriaId: categoriaAsignadaId
    });
    alert("⚡ Producto actualizado correctamente.");
  };

  const handleBorrarProductoConfig = async (id) => {
    if(window.confirm("¿Seguro que quieres borrar este producto de la carta?")) await deleteDoc(doc(db, 'productos', id));
  };

  const handleAjustarStockProducto = async (producto, incremento) => {
    const nuevoStock = Math.max(producto.stockMaximo + incremento, 0);
    await updateDoc(doc(db, 'productos', producto.id), { stockMaximo: nuevoStock });
  };

const handleMoverProducto = async (producto, direccion) => {
    // 1. Buscamos los índices actuales en la lista YA ORDENADA
    const indexActual = productosOrdenados.findIndex(p => p.id === producto.id);
    const indexDestino = direccion === 'SUBIR' ? indexActual - 1 : indexActual + 1;

    // 2. Validación: si intenta subir el primero o bajar el último, no hacemos nada
    if (indexDestino < 0 || indexDestino >= productosOrdenados.length) return;

    const producto1 = productosOrdenados[indexActual];
    const producto2 = productosOrdenados[indexDestino];

    // 3. NORMALIZACIÓN: Nos aseguramos de tener números de orden reales
    // Si no tenían orden, usamos su índice actual como base para que el intercambio sea limpio
    const orden1 = producto1.orden !== undefined ? producto1.orden : indexActual;
    const orden2 = producto2.orden !== undefined ? producto2.orden : indexDestino;

    // 4. Intercambiamos los valores de orden en Firebase
    await updateDoc(doc(db, 'productos', producto1.id), { orden: orden2 });
    await updateDoc(doc(db, 'productos', producto2.id), { orden: orden1 });
  };

  const pedidosProcesados = [...pedidos].sort((a, b) => {
    if (a.entregado && !b.entregado) return 1;
    if (!a.entregado && b.entregado) return -1;
    return a.hora.localeCompare(b.hora);
  });

// --- ORDENACIÓN DE LA CARTA PERSONALIZABLE ---
  const productosOrdenados = [...productos].sort((a, b) => {
    // Si no tienen número de orden (productos antiguos), les damos un 999 para que vayan al final
    const ordenA = a.orden !== undefined ? a.orden : 999;
    const ordenB = b.orden !== undefined ? b.orden : 999;
    
    // Primero ordenamos por su número
    if (ordenA !== ordenB) return ordenA - ordenB;
    
    // Si tienen el mismo número (o no tienen), desempata por orden alfabético
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
        <div className="flex-1 flex flex-col min-h-0">
          
          {/* BOTONES DE ALTERNAR (Solo visibles en modo FULL) */}
          {modoLayout === 'FULL' && (
            <div className="flex gap-2 mb-4 shrink-0">
              <button onClick={() => setPantallaActiva('HORNOS')} className={`flex-1 py-4 font-black rounded-xl border-4 transition-all ${pantallaActiva === 'HORNOS' ? 'bg-orange-500 text-white border-orange-700 shadow-md' : 'bg-white border-slate-200 text-slate-500'}`}>🔥 ESTADO HORNOS</button>
              <button onClick={() => setPantallaActiva('PEDIDOS')} className={`flex-1 py-4 font-black rounded-xl border-4 transition-all ${pantallaActiva === 'PEDIDOS' ? 'bg-indigo-600 text-white border-indigo-800 shadow-md' : 'bg-white border-slate-200 text-slate-500'}`}>📋 PEDIDOS</button>
            </div>
          )}

          {/* CONTENEDOR DE SECCIONES */}
          <div className={`${modoLayout === 'SPLIT' ? 'grid grid-cols-1 xl:grid-cols-2 gap-6' : 'flex-1'} flex-1 min-h-0`}>
            
{/* SECCIÓN HORNOS */}
            <section className={`bg-white rounded-2xl p-5 shadow-sm border border-orange-100 flex flex-col overflow-hidden relative ${(modoLayout === 'FULL' && pantallaActiva !== 'HORNOS') ? 'hidden' : ''}`}>
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 shrink-0">📊 Estado de Carga</h2>
              
              <div className="space-y-4 overflow-y-auto pr-2 flex-1 scrollbar-hide">
                {franjas.map((f) => {
                  const reservados = obtenerReservadosPorFranja(f.hora);
                  const faltaPollo = calcularAlertaFranja(f);
                  const porcentaje = f.max > 0 ? (reservados / f.max) * 100 : 0;
                  const horaInicio = f.hora.split(' ')[0];
                  const pedidosFranja = pedidosProcesados.filter(p => p.hora === horaInicio && p.cliente !== 'VENTA DIRECTA');
                  const alertaSecundaria = chequearSobrecargaOtros(f, pedidosFranja);
                  const tieneExtrasPendientes = pedidosFranja.some(p => !p.entregado && (p.detalle.toUpperCase().includes('PATATA') || p.detalle.toUpperCase().includes('BUTIFARRA') || p.detalle.toUpperCase().includes('CANELON')));
                  let colorBarra = "bg-emerald-500";
                  let estiloFila = "bg-slate-50/60 border-slate-100";
                  if (faltaPollo > 0) { colorBarra = "bg-rose-500 animate-pulse"; estiloFila = "bg-rose-50 border-rose-200 ring-2 ring-rose-500/10"; } 
                  else if (porcentaje >= 85) { colorBarra = "bg-amber-500"; estiloFila = "bg-amber-50/50 border-amber-200"; }
                  return (
                    <div key={f.id} onClick={() => { setFranjaDetalleSeleccionada(f); setModalDetalleFranjaAbierto(true); }} className={`p-4 rounded-xl border flex flex-col gap-2 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all ${estiloFila}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-xl text-slate-800">{f.hora}</span>
                              {alertaSecundaria && <span className="animate-pulse bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded-md font-black shadow-sm tracking-wider">⚠️ LÍMITE EXTRAS SUPERADO</span>}
                            </div>
                            <div className="flex flex-col gap-1">
                              {tieneExtrasPendientes && !alertaSecundaria && <div className="flex items-center gap-1 bg-indigo-500 text-white px-2 py-0.5 rounded-md text-[10px] font-black animate-pulse shadow-sm w-fit tracking-wider">🍟 REVISAR EXTRAS</div>}
                            </div>
                          </div>
                          <span className="block text-xs font-bold text-slate-500 mt-1">{reservados} / {f.max} pollos comprometidos</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); abrirModalCarga(f.id); }} className="bg-white hover:bg-orange-50 text-orange-600 border border-orange-200 font-bold px-4 py-2 rounded-xl shadow-sm text-sm uppercase cursor-pointer z-10">⚙️ Cargar</button>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner mt-2">
                        <div className={`h-3 rounded-full transition-all duration-300 ${colorBarra}`} style={{ width: `${Math.min(porcentaje, 100)}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* TECLADO EN HORNOS (Solo SPLIT + BUSCANDO) */}
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

{/* SECCIÓN PEDIDOS */}
            <section className={`bg-white rounded-2xl p-5 shadow-sm border border-orange-100 flex flex-col overflow-hidden ${(modoLayout === 'FULL' && pantallaActiva !== 'PEDIDOS') ? 'hidden' : ''}`}>
              
              {/* FILTROS Y BUSCADOR */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b-2 border-slate-100 pb-4 shrink-0">
                <div className="flex flex-wrap gap-2 w-full">
                  <button onClick={() => setFiltroHora('Todos')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase border-2 transition-all cursor-pointer ${filtroHora === 'Todos' ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>Todos</button>
                  {franjas.map(f => { const h = f.hora.split(' ')[0]; return <button key={f.id} onClick={() => setFiltroHora(h)} className={`flex-1 py-3 rounded-xl text-xs font-black border-2 transition-all cursor-pointer ${filtroHora === h ? 'bg-orange-600 text-white border-orange-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>{h}</button> })}
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

              {/* LISTA DE PEDIDOS Y TECLADO (Flexbox dinámico) */}
              <div className="flex-1 flex overflow-hidden gap-4">
                
                {/* LISTA DE PEDIDOS - Siempre presente, se ajusta automáticamente */}
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

{/* TECLADO DERECHO (Solo en FULL) */}
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
      {/* SECCIÓN CONFIGURACIÓN COMPLETA REESTABLECIDA Y BLINDADA */}
      {vista === 'configuracion' && (
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100 max-w-5xl mx-auto space-y-8 flex-1 overflow-y-auto w-full mb-4">

{/* --- NUEVO: PREFERENCIAS DE VISUALIZACIÓN --- */}
          <div className="bg-slate-50 p-6 rounded-2xl border-2 border-indigo-100 shadow-sm">
            <h2 className="text-xl font-black text-slate-800 uppercase mb-4">🖥️ 0. Preferencias de Pantalla</h2>
            <div className="flex gap-4">
              <button onClick={() => setModoLayout('SPLIT')} className={`flex-1 py-4 rounded-xl font-black border-4 cursor-pointer transition-all ${modoLayout === 'SPLIT' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>MODO CLÁSICO (Dividido)</button>
              <button onClick={() => setModoLayout('FULL')} className={`flex-1 py-4 rounded-xl font-black border-4 cursor-pointer transition-all ${modoLayout === 'FULL' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>MODO FULL (Pantalla Completa)</button>
            </div>
            <p className="text-slate-500 text-xs mt-3 text-center">En modo FULL, podrás alternar entre Pedidos y Hornos con botones rápidos.</p>
          </div>

          {/* --- ACCIONES DIARIAS (ARRIBA SIN SCROLL) --- */}
          <div className="bg-slate-50 border-4 border-slate-200 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
            <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4">

            <button onClick={() => setVista('mostrador')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-4 rounded-xl uppercase text-sm shadow cursor-pointer border-b-4 border-emerald-800 active:scale-95 transition-all">
            💾 Volver al Mostrador
            </button>

            <button onClick={() => setModalCierreCajaAbierto(true)} className="bg-rose-600 hover:bg-rose-700 text-white font-black px-4 py-4 rounded-xl shadow-md uppercase text-sm cursor-pointer active:scale-95 transition-all border-b-4 border-rose-800">
            🧹 Cerrar Caja
            </button>

            {/* NUEVO BOTÓN DE ESTADÍSTICAS */}
            <button onClick={() => setModalEstadisticasAbierto(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-4 rounded-xl shadow-md uppercase text-sm cursor-pointer active:scale-95 transition-all border-b-4 border-indigo-800">
            📊 Estadísticas
            </button>

            </div>

            <div className="hidden md:block text-right">
              <h3 className="text-lg font-black text-slate-700 uppercase">Panel Operativo</h3>
              <p className="text-slate-500 text-xs font-bold mt-1">Acciones de uso diario</p>
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

{/* NUEVA SECCIÓN DE CATEGORÍAS */}
          <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase">🗂️ 3. Categorías de la Carta</h2>
              <p className="text-slate-500 text-xs mt-0.5">Crea los bloques para agrupar los productos (Ej: Pizzas, Bebidas).</p>
            </div>
            <button onClick={handleCrearCategoria} className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-black px-4 py-2.5 rounded-xl text-xs border border-indigo-300 cursor-pointer shadow-sm">➕ Crear Categoría</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">

            {categorias.length === 0 && (
              <div className="col-span-full p-4 text-center text-slate-400 font-bold text-xs uppercase bg-white border border-dashed border-slate-300 rounded-xl">
                Aún no has creado ninguna categoría.
              </div>
            )}
          </div>

          <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase">🍟 4. Carta y Complementos</h2>
              <p className="text-slate-500 text-xs mt-0.5">Precios y control de stock mermable.</p>
            </div>
            <button onClick={handleCrearProductoNuevo} className="bg-orange-100 text-orange-700 hover:bg-orange-200 font-black px-4 py-2.5 rounded-xl text-xs border border-orange-300 cursor-pointer shadow-sm">➕ Añadir Producto</button>
          </div>
          <div className="space-y-3">
            {productosOrdenados.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
<div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">{p.nombre}</h3>
                    {/* NUEVO: CHIVATO DE CATEGORÍA ASIGNADA */}
                    {(() => {
                      const miCat = categorias.find(c => c.id === p.categoriaId);
                      return miCat ? (
                        <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-100 uppercase tracking-wider">
                          📁 {miCat.nombre}
                        </span>
                      ) : (
                        <span className="text-[9px] font-black bg-rose-50 text-rose-500 px-2 py-0.5 rounded-md border border-rose-100 uppercase tracking-wider">
                          ⚠️ SIN CATEGORÍA
                        </span>
                      );
                    })()}
                  </div>
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

  // Función para saber cuánto hemos cargado en los hornos en total para el día
  const getCargadoTotal = (nombre) => {
    const n = nombre.toUpperCase();
    if (n.includes('POLLO')) return franjas.reduce((sum, f) => sum + (f.capacidad?.pollos || f.max || 0), 0);
    if (n.includes('PATATA')) return franjas.reduce((sum, f) => sum + (f.capacidad?.patatas || 0), 0);
    if (n.includes('BUTIFARRA')) return franjas.reduce((sum, f) => sum + (f.capacidad?.butifarras || 0), 0);
    return null; // Si no es de horno (bebidas, salsas), devuelve null
  };

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
              {Object.entries(totalesCocina).sort((a,b)=>b[1].total - a[1].total).map(([nombre, counts]) => {
                const cargadoHorno = getCargadoTotal(nombre);
                
                return (
                  <div key={nombre} className="bg-white p-5 rounded-3xl border-4 border-indigo-100 flex flex-col items-center justify-center gap-2 shadow-md hover:border-indigo-300 transition-colors relative pt-10">
                    
                    {/* NUEVO: CHIVATO DE HORNO Y SOBRANTE EN LA PARTE SUPERIOR */}
                    {cargadoHorno !== null && (
                      <div className={`absolute top-0 left-0 right-0 py-1.5 flex justify-center items-center gap-2 border-b-2 rounded-t-2xl ${cargadoHorno >= counts.total ? 'bg-emerald-100 border-emerald-200 text-emerald-800' : 'bg-rose-100 border-rose-200 text-rose-800'}`}>
                         <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                           🔥 TOTAL HORNO: <span className="text-sm">{cargadoHorno}</span> 
                           <span className="ml-1 bg-white/60 px-2 py-0.5 rounded shadow-sm border border-black/5 text-black">
                             SOBRAN: {cargadoHorno - counts.total}
                           </span>
                         </span>
                      </div>
                    )}

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
                <div className="shrink-0 mt-4 pt-4 border-t-4 border-slate-100 space-y-4">
                  {errorValidacion && <p className="text-rose-600 font-black text-center text-lg bg-rose-50 p-3 rounded-xl border-4 border-rose-200 mb-3">{errorValidacion}</p>}
                  
                  {/* NUEVO: SELECTOR DE ORIGEN GIGANTE */}
                  <div className="flex gap-4">
                    <button 
                      type="button" 
                      onClick={() => setOrigenReservaManual('TIENDA')}
                      className={`flex-1 font-black py-4 rounded-2xl uppercase text-2xl border-4 transition-all cursor-pointer shadow-sm ${origenReservaManual === 'TIENDA' ? 'bg-indigo-600 text-white border-indigo-800 scale-105' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                    >
                      🏪 EN TIENDA
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setOrigenReservaManual('TELÉFONO')}
                      className={`flex-1 font-black py-4 rounded-2xl uppercase text-2xl border-4 transition-all cursor-pointer shadow-sm ${origenReservaManual === 'TELÉFONO' ? 'bg-indigo-600 text-white border-indigo-800 scale-105' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                    >
                      📞 POR TELÉFONO
                    </button>
                  </div>
{(() => {
                    // Calculamos los euros del carrito en tiempo real
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
                          <button 
                            type="button" 
                            onClick={() => setReservaPrePagada(!reservaPrePagada)}
                            className={`flex-1 font-black py-4 rounded-2xl uppercase text-2xl border-4 transition-all cursor-pointer shadow-sm flex flex-col items-center justify-center gap-1 ${reservaPrePagada ? 'bg-emerald-100 text-emerald-800 border-emerald-400 scale-[1.02]' : 'bg-white text-slate-400 border-slate-300 hover:bg-slate-50'}`}
                          >
                            <span>{reservaPrePagada ? '✅ PAGADO EN MOSTRADOR' : '⏳ PAGO EN RECOGIDA'}</span>
                            <span className="text-[10px] font-bold tracking-widest opacity-80">{reservaPrePagada ? '(Se marcará como cobrado directo)' : '(Se cobrará al entregar)'}</span>
                          </button>
                        </div>

                        <button type="button" onClick={handleGuardarPedido} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-2xl uppercase text-3xl shadow-xl transition-colors border-b-8 border-emerald-800 cursor-pointer">💾 Confirmar Reserva</button>
                      </>
                    );
                  })()}

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
        
        {/* CASO 1: FALTA COBRAR (Tenga o no paella) */}
        {!pedidoSeleccionado.cobrado && (
          <div className="bg-indigo-50 border-4 border-indigo-100 p-5 rounded-2xl flex flex-col gap-4 shadow-inner">
            
            {pedidoSeleccionado.fianza === 'pendiente' ? (
              <>
                <div className="bg-amber-100 border-2 border-amber-300 text-amber-800 p-3 rounded-xl font-black text-center text-sm uppercase">
                  🥘 ESTE PEDIDO TIENE PAELLA
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <button onClick={() => handleCobrarPedido(pedidoSeleccionado.id, 'retenida')} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black py-4 rounded-2xl uppercase text-lg shadow-xl border-b-8 border-amber-700 cursor-pointer active:scale-95 transition-all">
                    🪙 COBRAR + 20€ FIANZA
                  </button>
                  <button onClick={() => handleCobrarPedido(pedidoSeleccionado.id, 'descartada')} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl uppercase text-lg shadow-xl border-b-8 border-indigo-800 cursor-pointer active:scale-95 transition-all">
                    🪙 COBRAR NORMAL (Sin Fianza)
                  </button>
                </div>
              </>
            ) : (
              <button onClick={() => handleCobrarPedido(pedidoSeleccionado.id)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-6 rounded-2xl uppercase text-3xl shadow-xl border-b-8 border-indigo-800 cursor-pointer active:scale-95 transition-all">
                🪙 {pedidoSeleccionado.entregado ? 'COBRAR LO PENDIENTE' : 'COBRAR Y ENTREGAR'}
              </button>
            )}
            
            {!pedidoSeleccionado.entregado && (
              <button onClick={() => { handleEntregar(pedidoSeleccionado.id); setPedidoSeleccionado(null); }} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-black py-4 rounded-xl uppercase text-sm border-2 border-slate-400 cursor-pointer active:scale-95 transition-all">
                ⚠️ Entregar en mano ahora, pero dejar PENDIENTE DE PAGO
              </button>
            )}
          </div>
        )}
{/* NUEVO CASO: PRE-PAGO (ESTÁ PAGADO PERO NO ENTREGADO) */}
        {pedidoSeleccionado.cobrado && !pedidoSeleccionado.entregado && (
          <div className="bg-emerald-50 border-4 border-emerald-200 p-5 rounded-2xl flex flex-col gap-4 shadow-inner">
            <span className="text-emerald-700 font-black uppercase text-center text-lg">✅ PEDIDO ABONADO POR ADELANTADO</span>
            <button onClick={() => { handleEntregar(pedidoSeleccionado.id); setPedidoSeleccionado(null); }} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 rounded-2xl uppercase text-2xl shadow-xl border-b-8 border-emerald-700 cursor-pointer active:scale-95 transition-all">
              📦 ENTREGAR PEDIDO
            </button>
          </div>
        )}

        {/* CASO 2: ESTÁ COBRADO, PERO TIENEN LA SARTÉN (FIANZA RETENIDA) */}
        {pedidoSeleccionado.cobrado && pedidoSeleccionado.fianza === 'retenida' && (
          <div className="bg-amber-50 border-4 border-amber-200 p-5 rounded-2xl flex flex-col gap-4 shadow-inner">
            <span className="text-amber-700 font-black uppercase text-center text-lg">🥘 SARTÉN PENDIENTE DE DEVOLVER</span>
            <button onClick={() => handleDevolverFianza(pedidoSeleccionado.id)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 rounded-2xl uppercase text-2xl shadow-xl border-b-8 border-emerald-700 cursor-pointer active:scale-95 transition-all">
              🤝 SARTÉN DEVUELTA (Abonar 20€)
            </button>
          </div>
        )}
        
        <div className="bg-slate-100 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border-2 border-slate-200">
          <span className="font-black text-slate-600 uppercase text-lg">↪️ Mover a otra hora:</span>
          <select onChange={(e) => { handleReubicarPedido(pedidoSeleccionado.id, e.target.value); setPedidoSeleccionado(null); }} className="bg-white border-4 border-slate-300 text-slate-800 font-black rounded-xl px-6 py-4 text-xl focus:outline-none cursor-pointer w-full sm:w-auto" defaultValue="">
            <option value="" disabled>Seleccionar tramo...</option>
            {franjas.map(fr => <option key={fr.id} value={fr.hora.split(' ')[0]}>{fr.hora.split(' ')[0]}</option>)}
          </select>
        </div>

        {/* Solo permitimos borrar si NO tiene fianza retenida Y NO es una deuda (entregado pero no cobrado) */}
        {!(pedidoSeleccionado.fianza === 'retenida' || (pedidoSeleccionado.entregado && !pedidoSeleccionado.cobrado)) && (
          <button onClick={() => { if(window.confirm("¿Estás seguro de anular y borrar este pedido para siempre?")) { handleAnularPedido(pedidoSeleccionado.id); setPedidoSeleccionado(null); } }} className="bg-rose-100 hover:bg-rose-200 text-rose-700 border-4 border-rose-200 font-black py-5 rounded-2xl uppercase text-xl cursor-pointer mt-2 transition-all">❌ ANULAR Y BORRAR PEDIDO</button>
        )}
      </div>

    </div>
  </div>
)}
      {/* MODAL GIGANTE 6: DETALLE DE FRANJA (INFORME) */}
      {modalDetalleFranjaAbierto && franjaDetalleSeleccionada && (() => {
        const horaInicio = franjaDetalleSeleccionada.hora.split(' ')[0];
        
        // 1. Filtramos pedidos solo de esta hora
        const pedidosFranja = pedidos.filter(p => p.hora === horaInicio);
        // 2. Filtramos pedidos desde el principio del día hasta esta hora (para el acumulado)
        const pedidosAcumulados = pedidos.filter(p => p.hora <= horaInicio);

// Motor de conteo de productos buscando dentro del texto del ticket
      const contarProd = (lista, nombre) => {
        let c = 0;
        lista.forEach(p => {
          if (p.historico) return; // IGNORAMOS TICKETS VIEJOS
          const texto = p.detalle.includes('|') ? p.detalle.split('|')[1] : p.detalle;
          texto.split('+').forEach(parte => {
            const match = parte.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(.*)/i);
            if (match && match[2].trim().toUpperCase() === nombre.toUpperCase()) {
              c += parseFloat(match[1]);
            }
          });
        });
        return c;
      };

      // NUEVO: Agrupador inteligente de paellas por raciones
      const obtenerDesglosePaellas = (lista) => {
        const moldes = {};
        lista.forEach(p => {
          if (p.historico || p.entregado) return; // Solo contamos las que quedan por hacer
          const texto = p.detalle.includes('|') ? p.detalle.split('|')[1] : p.detalle;
          texto.split('+').forEach(parte => {
            const match = parte.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(.*)/i);
            if (match && match[2].trim().toUpperCase() === 'PAELLA') {
              const raciones = parseInt(match[1]);
              if (raciones > 0) {
                moldes[raciones] = (moldes[raciones] || 0) + 1;
              }
            }
          });
        });

        // Construye el texto visual: "2 de 2 pers, 1 de 4 pers"
        const resultado = Object.entries(moldes)
          .map(([raciones, cantidad]) => `${cantidad} de ${raciones}p`)
          .join(', ');
        
        return resultado ? `(🍳 ${resultado})` : '';
      };


      const prodsConStock = productosOrdenados.filter(p => p.controlaStock);
        const prodsSinStock = productosOrdenados.filter(p => !p.controlaStock);

        // Emparejar nombre del producto con la capacidad configurada en la franja
        const getCapacidad = (nombre) => {
          const n = nombre.toUpperCase();
          if (n.includes('POLLO')) return franjaDetalleSeleccionada.capacidad?.pollos || franjaDetalleSeleccionada.max || 0;
          if (n.includes('PATATA')) return franjaDetalleSeleccionada.capacidad?.patatas || 0;
          if (n.includes('BUTIFARRA')) return franjaDetalleSeleccionada.capacidad?.butifarras || 0;
          return '—';
        };

        return (
          <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4 lg:p-10 z-50 overflow-hidden">
            <div className="bg-white rounded-[2rem] w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl overflow-hidden border-4 border-emerald-500">
              
              {/* CABECERA */}
              <div className="bg-emerald-600 p-6 flex justify-between items-center text-white shrink-0">
                <h3 className="text-3xl font-black uppercase tracking-tight">
                  📊 INFORME FRANJA: <span className="font-mono bg-white text-emerald-700 px-4 py-1 rounded-xl ml-2 tracking-wider">{franjaDetalleSeleccionada.hora}</span>
                </h3>
                <button onClick={() => { setModalDetalleFranjaAbierto(false); setFranjaDetalleSeleccionada(null); }} className="bg-emerald-700 hover:bg-rose-600 font-black text-2xl px-6 py-2 rounded-xl cursor-pointer transition-colors border-b-4 border-emerald-900">✕ CERRAR</button>
              </div>

              <div className="p-8 flex-1 overflow-y-auto bg-slate-50 space-y-10">
                
                {/* TABLA 1: PRODUCTOS CON STOCK (HORNOS) */}
                <div>
                  <h4 className="text-2xl font-black text-slate-800 uppercase mb-4 border-b-4 border-slate-200 pb-2 flex items-center gap-3">
                    🔥 PRODUCTOS EN HORNO (CON CAPACIDAD)
                  </h4>
                  <div className="bg-white rounded-3xl shadow-sm border-2 border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-6 bg-slate-100 p-4 border-b-2 border-slate-200 text-xs md:text-sm font-black text-slate-500 uppercase tracking-wider text-center">
                      <div className="text-left">Producto</div>
                      <div>Capacidad</div>
                      <div>Reservados</div>
                      <div>Entregados</div>
                      <div>Pendientes</div>
                      <div className="text-emerald-700">Libres</div>
                    </div>
                    <div className="divide-y-2 divide-slate-100">
                      {prodsConStock.map(p => {
                        const cap = getCapacidad(p.nombre);
                        const res = contarProd(pedidosFranja, p.nombre);
                        const ent = contarProd(pedidosFranja.filter(ped => ped.entregado), p.nombre);
                        const pend = res - ent;
                        const libres = cap === '—' ? '—' : Math.max(0, cap - res);
                        
                        return (
                          <div key={p.id} className="grid grid-cols-6 p-4 items-center text-center font-mono font-bold text-lg hover:bg-slate-50 transition-colors">
                            <div className="text-left font-black font-sans text-slate-800 uppercase">{p.nombre}</div>
                            <div className="text-slate-600 bg-slate-100 mx-auto px-4 py-1 rounded-lg">{cap}</div>
                            <div className="text-amber-600">{res}</div>
                            <div className="text-indigo-600">{ent}</div>
                            <div className="text-rose-600">{pend}</div>
                            <div className="text-emerald-700 font-black bg-emerald-50 mx-auto px-4 py-1 rounded-lg border border-emerald-200">{libres}</div>
                          </div>
                        );
                      })}
                      {prodsConStock.length === 0 && <div className="p-8 text-center text-slate-400 font-bold uppercase">No hay productos con control de stock</div>}
                    </div>
                  </div>
                </div>

                {/* TABLA 2: RESTO DE PRODUCTOS (SIN STOCK) */}
                <div>
                  <h4 className="text-2xl font-black text-slate-800 uppercase mb-4 border-b-4 border-slate-200 pb-2 flex items-center gap-3">
                    🛒 RESTO DE PRODUCTOS (SIN LÍMITE DE HORNO)
                  </h4>
                  <div className="bg-white rounded-3xl shadow-sm border-2 border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-4 bg-slate-100 p-4 border-b-2 border-slate-200 text-xs md:text-sm font-black text-slate-500 uppercase tracking-wider text-center">
                      <div className="text-left">Producto</div>
                      <div>Reservados (Franja)</div>
                      <div>Entregados (Franja)</div>
                      <div className="text-indigo-700">Total Acumulado Hoy</div>
                    </div>
                    <div className="divide-y-2 divide-slate-100">
                      {prodsSinStock.map(p => {
                        const res = contarProd(pedidosFranja, p.nombre);
                        const ent = contarProd(pedidosFranja.filter(ped => ped.entregado), p.nombre);
                        const acum = contarProd(pedidosAcumulados, p.nombre);
                        
                        // Ocultamos los productos que están a 0 en todo para que la lista no sea gigante e inútil
                        if(res === 0 && acum === 0) return null; 

return (
                          <div key={p.id} className="grid grid-cols-4 p-4 items-center text-center font-mono font-bold text-lg hover:bg-slate-50 transition-colors">
                            <div className="text-left font-black font-sans text-slate-800 uppercase flex flex-col gap-0.5">
                              <span>{p.nombre}</span>
                              {p.nombre.toUpperCase() === 'PAELLA' && (
                                <span className="text-xs text-orange-600 font-black tracking-wide normal-case block bg-orange-50 px-2 py-0.5 rounded border border-orange-100 w-fit mt-0.5">
                                  {obtenerDesglosePaellas(pedidosFranja)}
                                </span>
                              )}
                            </div>
                            <div className="text-amber-600">{res}</div>
                            <div className="text-emerald-600">{ent}</div>
                            <div className="text-indigo-700 font-black bg-indigo-50 mx-auto px-6 py-1 rounded-lg border border-indigo-200">{acum}</div>
                          </div>
                        );
                      })}
                      {prodsSinStock.every(p => contarProd(pedidosFranja, p.nombre) === 0 && contarProd(pedidosAcumulados, p.nombre) === 0) && (
                        <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-wider">No hay ventas registradas de extras hasta esta hora.</div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        );
      })()}
      {/* MODAL GIGANTE 7: CIERRE DE CAJA */}
      {modalCierreCajaAbierto && (() => {
        let ventas = 0;
        let fianzasRetenidas = 0;
        let pendienteCobro = 0;
        let perdidas = 0;

        pedidos.forEach(p => {
          if (p.historico) return; // Solo calculamos el dinero movido HOY

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

          // Si hoy se quedaron con la sartén, tenemos 20€ físicos en caja
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
                <div className="text-center bg-rose-100 text-rose-800 p-4 rounded-2xl font-bold text-sm border-2 border-rose-200">
                  Al confirmar, todos los pedidos se archivarán. Las pérdidas se registrarán en el histórico y los hornos se vaciarán a cero para el próximo día.
                </div>

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

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-orange-50 p-5 rounded-3xl border-2 border-orange-200 text-center shadow-inner">
                    <span className="block text-xs font-black text-orange-800 uppercase tracking-widest mb-1">En la calle (Falta Cobrar)</span>
                    <span className="text-3xl font-mono font-black text-orange-600">{pendienteCobro.toFixed(2)}€</span>
                  </div>
                  <div className="bg-slate-100 p-5 rounded-3xl border-2 border-slate-200 text-center shadow-inner">
                    <span className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Pérdidas (No recogido)</span>
                    <span className="text-3xl font-mono font-black text-slate-400">{perdidas.toFixed(2)}€</span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white border-t-4 border-slate-100">
                <button onClick={() => { setModalCierreCajaAbierto(false); handleLimpiarDia(); }} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-6 rounded-2xl uppercase text-3xl shadow-xl border-b-8 border-rose-800 cursor-pointer active:scale-95 transition-all">
                  🚨 CONFIRMAR Y CERRAR EL DÍA
                </button>
              </div>
            </div>
          </div>
        );
      })()}
{/* MODAL GIGANTE 8: MÓDULO ESTADÍSTICO PROFESIONAL */}
      {modalEstadisticasAbierto && (() => {
        // 1. OBTENER Y FILTRAR PEDIDOS EN EL RANGO DE FECHAS
        const pedidosArchivados = pedidos.filter(p => p.historico);
        const pedidosEnFecha = pedidosArchivados.filter(p => {
          const fechaPedido = p.fecha || new Date(parseInt(p.id) || Date.now()).toISOString().split('T')[0];
          return fechaPedido >= filtroFechaInicio && fechaPedido <= filtroFechaFin;
        });

        // 2. VARIABLES DE TOTALES DEL PERIODO
        let ventasGlobales = 0; let perdidasGlobales = 0; let volumenGlobal = 0;
        let ventasFiltradas = 0; let perdidasFiltradas = 0; let volumenFiltrado = 0;

        // 3. AGRUPACIÓN POR DÍAS
        const datosDiarios = {};

        // 4. NUEVO: DESGLOSE POR CANALES DE ORIGEN
        const desgloseCanales = {
          'WEB': { reservas: 0, dinero: 0 },
          'TELÉFONO': { reservas: 0, dinero: 0 },
          'TIENDA': { reservas: 0, dinero: 0 },
          'DIRECTA': { reservas: 0, dinero: 0 }
        };

        pedidosEnFecha.forEach(p => {
          const fechaPedido = p.fecha || new Date(parseInt(p.id) || Date.now()).toISOString().split('T')[0];
          if (!datosDiarios[fechaPedido]) {
            datosDiarios[fechaPedido] = { ventas: 0, perdidas: 0, volumen: 0, ventasFiltro: 0, volumenFiltro: 0 };
          }

          const esVentaDirecta = p.cliente === 'VENTA DIRECTA';
          const estaCobrado = p.cobrado || esVentaDirecta;
          const esExito = p.entregado && estaCobrado;
          const esPerdida = !p.entregado;

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
                const esProductoBuscado = filtroProductoEstat === 'TODOS' || nombreProd === filtroProductoEstat;

                if (esExito) {
                  ventasGlobales += valorLinea; volumenGlobal += cantidad;
                  datosDiarios[fechaPedido].ventas += valorLinea; datosDiarios[fechaPedido].volumen += cantidad;
                  if (esProductoBuscado) {
                    ventasFiltradas += valorLinea; volumenFiltrado += cantidad;
                    datosDiarios[fechaPedido].ventasFiltro += valorLinea; datosDiarios[fechaPedido].volumenFiltro += cantidad;
                  }
                } else if (esPerdida) {
                  perdidasGlobales += valorLinea; datosDiarios[fechaPedido].perdidas += valorLinea;
                  if (esProductoBuscado) perdidasFiltradas += valorLinea;
                }
              }
            }
          });

          // Contabilizar canales solo si es éxito
          if (esExito) {
            if (p.origen === 'QR') { desgloseCanales['WEB'].reservas++; desgloseCanales['WEB'].dinero += totalTicket; }
            else if (p.origen === 'TELÉFONO') { desgloseCanales['TELÉFONO'].reservas++; desgloseCanales['TELÉFONO'].dinero += totalTicket; }
            else if (p.origen === 'TIENDA') { desgloseCanales['TIENDA'].reservas++; desgloseCanales['TIENDA'].dinero += totalTicket; }
            else if (p.origen === 'Mostrador Directo' || esVentaDirecta) { desgloseCanales['DIRECTA'].reservas++; desgloseCanales['DIRECTA'].dinero += totalTicket; }
            else { desgloseCanales['TIENDA'].reservas++; desgloseCanales['TIENDA'].dinero += totalTicket; }
          }
        });

        const evolucionDiaria = Object.entries(datosDiarios).sort((a, b) => a[0].localeCompare(b[0]));
        const proporcionIngresos = ventasGlobales > 0 ? ((ventasFiltradas / ventasGlobales) * 100).toFixed(1) : 0;
        const proporcionVolumen = volumenGlobal > 0 ? ((volumenFiltrado / volumenGlobal) * 100).toFixed(1) : 0;

        const exportarAExcel = () => {
          if (!pedidosEnFecha || pedidosEnFecha.length === 0) {
            alert("⚠️ No hay pedidos en las fechas seleccionadas.");
            return;
          }
          const cabeceras = ["Fecha", "Hora", "Cliente", "Detalle Pedido", "Total (€)", "Estado", "Canal Origen"];
          const filas = pedidosEnFecha.map(p => {
            const detalleLimpio = String(p.detalle || '').replace(/;/g, ',').replace(/\n/g, ' ').trim();
            let totalExcel = 0;
            detalleLimpio.split('+').forEach(parte => {
              const match = parte.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(.*)/i);
              if (match) {
                const prod = productos.find(x => x.nombre.toUpperCase() === match[2].trim().toUpperCase());
                if (prod) totalExcel += (parseFloat(match[1]) * prod.precio);
              }
            });
            const esVentaDirecta = p.cliente === 'VENTA DIRECTA';
            const estado = (p.entregado && (p.cobrado || esVentaDirecta)) ? 'COBRADO' : (!p.entregado ? 'PÉRDIDA' : 'PENDIENTE');
            const fechaFormat = p.fecha ? p.fecha.split('-').reverse().join('/') : new Date(parseInt(p.id) || Date.now()).toLocaleDateString('es-ES');
            
            // Incluimos también el canal en el Excel para auditorías
            let canalTxt = p.origen === 'QR' ? 'WEB' : (p.origen || 'TIENDA');
            if (esVentaDirecta) canalTxt = 'VENTA DIRECTA';

            return [ fechaFormat, p.hora || '', p.cliente, detalleLimpio, totalExcel.toFixed(2), estado, canalTxt ];
          });
          const contenidoCsv = [cabeceras.join(";"), ...filas.map(f => f.join(";"))].join("\n");
          const blob = new Blob(["\uFEFF" + contenidoCsv], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `Auditoria_LaFosca_${filtroFechaInicio}_al_${filtroFechaFin}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        return (
          <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-4 lg:p-8 z-50 overflow-hidden">
            <div className="bg-white rounded-[2rem] w-full max-w-7xl h-[95vh] flex flex-col shadow-2xl overflow-hidden border-4 border-slate-800">
              
              <div className="bg-slate-800 p-6 shrink-0 border-b-4 border-slate-900">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tight">📊 INTELIGENCIA DE NEGOCIO</h3>
                  <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={exportarAExcel} className="flex-1 md:flex-none bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-xl px-6 py-2 rounded-xl cursor-pointer transition-all shadow-md flex items-center justify-center gap-2">
                      ⬇️ DESCARGAR EXCEL
                    </button>
                    <button onClick={() => setModalEstadisticasAbierto(false)} className="flex-1 md:flex-none bg-slate-700 hover:bg-rose-600 text-white font-black text-xl px-6 py-2 rounded-xl cursor-pointer transition-colors">✕ CERRAR</button>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-4 bg-slate-700 p-4 rounded-2xl border-2 border-slate-600">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Desde Fecha</label>
                    <input type="date" value={filtroFechaInicio} onChange={(e) => setFiltroFechaInicio(e.target.value)} className="w-full bg-slate-800 text-white font-mono font-black text-lg rounded-xl border border-slate-500 px-4 py-2 focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hasta Fecha</label>
                    <input type="date" value={filtroFechaFin} onChange={(e) => setFiltroFechaFin(e.target.value)} className="w-full bg-slate-800 text-white font-mono font-black text-lg rounded-xl border border-slate-500 px-4 py-2 focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-[250px]">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Acotar por Producto</label>
                    <select value={filtroProductoEstat} onChange={(e) => setFiltroProductoEstat(e.target.value)} className="w-full bg-slate-800 text-white font-black text-lg rounded-xl border border-slate-500 px-4 py-2 focus:outline-none focus:border-indigo-500 uppercase cursor-pointer">
                      <option value="TODOS">🌐 TODOS LOS PRODUCTOS</option>
                      {productosOrdenados.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-6 flex-1 overflow-y-auto bg-slate-100 flex flex-col gap-6">
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
                  <div className="bg-white p-5 rounded-3xl border-2 border-emerald-200 shadow-sm flex flex-col justify-center items-center relative overflow-hidden">
                    <span className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-1 z-10">Ingresos Totales</span>
                    <span className="text-4xl font-mono font-black text-emerald-600 z-10">{ventasFiltradas.toFixed(2)}€</span>
                    {filtroProductoEstat !== 'TODOS' && <span className="text-[10px] font-bold text-emerald-600 mt-1 z-10 bg-emerald-50 px-2 py-0.5 rounded">De {ventasGlobales.toFixed(2)}€ global</span>}
                  </div>
                  
                  <div className="bg-white p-5 rounded-3xl border-2 border-rose-200 shadow-sm flex flex-col justify-center items-center">
                    <span className="text-xs font-black text-rose-800 uppercase tracking-widest mb-1">Pérdidas Totales</span>
                    <span className="text-4xl font-mono font-black text-rose-600">{perdidasFiltradas.toFixed(2)}€</span>
                    <span className="text-[10px] font-bold text-rose-400 mt-1 uppercase">Material no recogido</span>
                  </div>

                  <div className="bg-white p-5 rounded-3xl border-2 border-indigo-200 shadow-sm flex flex-col justify-center items-center">
                    <span className="text-xs font-black text-indigo-800 uppercase tracking-widest mb-1">Volumen Despachado</span>
                    <span className="text-4xl font-mono font-black text-indigo-600">{volumenFiltrado} <span className="text-xl">ud.</span></span>
                    <span className="text-[10px] font-bold text-indigo-400 mt-1 uppercase">Unidades entregadas</span>
                  </div>

                  <div className={`p-5 rounded-3xl border-2 shadow-sm flex flex-col justify-center items-center transition-all ${filtroProductoEstat === 'TODOS' ? 'bg-slate-50 border-slate-200 opacity-50' : 'bg-amber-50 border-amber-300'}`}>
                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest mb-1">Peso en el Negocio</span>
                    {filtroProductoEstat === 'TODOS' ? (
                      <span className="text-lg font-black text-slate-400 mt-2">Selecciona un producto</span>
                    ) : (
                      <>
                        <div className="flex gap-4 w-full justify-center mt-1">
                          <div className="text-center">
                            <span className="block text-2xl font-mono font-black text-amber-600">{proporcionIngresos}%</span>
                            <span className="text-[9px] uppercase font-bold text-amber-800">Del Dinero</span>
                          </div>
                          <div className="text-center border-l-2 border-amber-200 pl-4">
                            <span className="block text-2xl font-mono font-black text-amber-600">{proporcionVolumen}%</span>
                            <span className="text-[9px] uppercase font-bold text-amber-800">Del Volumen</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* NUEVO: BLOQUE VISUAL DE ORÍGENES */}
                <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm p-5 shrink-0">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 border-b-2 border-slate-100 pb-2">📡 Origen de los Ingresos (Éxitos)</h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center shadow-inner">
                      <span className="block text-[10px] font-black text-emerald-800 uppercase mb-1">📲 APP / WEB</span>
                      <span className="text-3xl font-mono font-black text-emerald-600">{desgloseCanales['WEB'].dinero.toFixed(2)}€</span>
                      <span className="block text-[10px] font-bold text-emerald-600 mt-1">{desgloseCanales['WEB'].reservas} pedidos</span>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl text-center shadow-inner">
                      <span className="block text-[10px] font-black text-indigo-800 uppercase mb-1">📞 TELÉFONO</span>
                      <span className="text-3xl font-mono font-black text-indigo-600">{desgloseCanales['TELÉFONO'].dinero.toFixed(2)}€</span>
                      <span className="block text-[10px] font-bold text-indigo-600 mt-1">{desgloseCanales['TELÉFONO'].reservas} pedidos</span>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-center shadow-inner">
                      <span className="block text-[10px] font-black text-amber-800 uppercase mb-1">🏪 RESERVA EN LOCAL</span>
                      <span className="text-3xl font-mono font-black text-amber-600">{desgloseCanales['TIENDA'].dinero.toFixed(2)}€</span>
                      <span className="block text-[10px] font-bold text-amber-600 mt-1">{desgloseCanales['TIENDA'].reservas} pedidos</span>
                    </div>
                    <div className="bg-slate-100 border border-slate-300 p-4 rounded-2xl text-center shadow-inner">
                      <span className="block text-[10px] font-black text-slate-800 uppercase mb-1">🪙 VENTA DIRECTA</span>
                      <span className="text-3xl font-mono font-black text-slate-700">{desgloseCanales['DIRECTA'].dinero.toFixed(2)}€</span>
                      <span className="block text-[10px] font-bold text-slate-500 mt-1">{desgloseCanales['DIRECTA'].reservas} tickets</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden min-h-[300px]">
                  <div className="bg-slate-50 p-4 border-b-2 border-slate-200">
                    <h4 className="text-lg font-black text-slate-800 uppercase flex items-center gap-2">
                      📅 Desglose Diario <span className="text-xs text-slate-500 font-bold bg-white px-2 py-1 rounded-md border border-slate-200">{evolucionDiaria.length} días con actividad</span>
                    </h4>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-4 lg:grid-cols-5 bg-slate-800 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider p-3 sticky top-0 z-10">
                      <div className="pl-2">Fecha</div>
                      <div className="text-right">Volumen (Ud)</div>
                      <div className="text-right text-emerald-400">Ingresos</div>
                      <div className="text-right text-rose-400">Pérdidas</div>
                      <div className="hidden lg:block text-right text-indigo-300">Rendimiento</div>
                    </div>
                    
                    <div className="divide-y divide-slate-100">
                      {evolucionDiaria.length === 0 ? (
                        <div className="p-10 text-center text-slate-400 font-black uppercase text-lg">No hay datos en estas fechas</div>
                      ) : (
                        evolucionDiaria.map(([fecha, datos]) => {
                          const ingresosDia = filtroProductoEstat === 'TODOS' ? datos.ventas : datos.ventasFiltro;
                          const volumenDia = filtroProductoEstat === 'TODOS' ? datos.volumen : datos.volumenFiltro;
                          const perdidasDia = filtroProductoEstat === 'TODOS' ? datos.perdidas : (datos.perdidas > 0 ? '---' : 0);

                          const maxVentasDias = Math.max(...evolucionDiaria.map(d => filtroProductoEstat === 'TODOS' ? d[1].ventas : d[1].ventasFiltro));
                          const porcentajeBarra = maxVentasDias > 0 ? (ingresosDia / maxVentasDias) * 100 : 0;

                          return (
                            <div key={fecha} className="grid grid-cols-4 lg:grid-cols-5 p-3 sm:p-4 items-center hover:bg-slate-50 transition-colors font-mono text-sm sm:text-base">
                              <div className="font-black text-slate-700">{fecha.split('-').reverse().join('/')}</div>
                              <div className="text-right font-bold text-slate-600">{volumenDia}</div>
                              <div className="text-right font-black text-emerald-600">{ingresosDia.toFixed(2)}€</div>
                              <div className="text-right font-bold text-rose-500">{perdidasDia === '---' ? perdidasDia : perdidasDia.toFixed(2) + '€'}</div>
                              <div className="hidden lg:flex justify-end items-center px-4">
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${porcentajeBarra}%` }}></div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-slate-100 p-4 border-t-2 border-slate-200 grid grid-cols-4 lg:grid-cols-5 font-mono text-base sm:text-lg">
                    <div className="font-black text-slate-800 uppercase font-sans">TOTAL</div>
                    <div className="text-right font-black text-slate-800">{volumenFiltrado}</div>
                    <div className="text-right font-black text-emerald-600">{ventasFiltradas.toFixed(2)}€</div>
                    <div className="text-right font-black text-rose-600">{perdidasFiltradas.toFixed(2)}€</div>
                    <div className="hidden lg:block"></div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        );
      })()}
</div>
);
}
