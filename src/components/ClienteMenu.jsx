import React, { useState, useEffect } from 'react';
import { db, functions } from '../firebase';
import { collection, onSnapshot, addDoc, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const LOCAL_ID = 'asador-dc'; 

// NUEVO: CEREBRO DE MARCA BLANCA (SaaS)
const APP_CONFIG = {
  nombre: 'ROSTISSERIA LA FOSCA',
  subtitulo: 'Fes la teva comanda sense cues',
  telefono: '690 176 030',
  direccion: 'Carrer Garbí, 2 (Edifici La Proa)',
  logoUrl: '/logo-fosca.png', // <-- ¡ESTA ES LA LÍNEA QUE FALTABA!
  // Diccionario de colores (Usamos 'teal' que encaja con el turquesa de tu logo)
tema: {
      fondoBase: 'bg-teal-50/30',
      headerBg: 'bg-white',
      textoPrincipal: 'text-teal-600',
      textoSecundario: 'text-teal-800',
      bordeClaro: 'border-teal-100',
      bordeOscuro: 'border-teal-600',
      botonPrimario: 'bg-teal-600 hover:bg-teal-700',
      botonActivo: 'bg-teal-600 border-teal-600 text-white',
      textoAcento: 'text-teal-200'
    }
  };

  // NUEVO: TRADUCCIONES DE LAS PARTES FIJAS DE LA WEB
  const TEXTOS = {
    es: {
      subtitulo: "HAZ TU PEDIDO SIN COLAS",
      carta: "🍗 Nuestra Carta",
      noProductos: "El menú de hoy se está cargando o no hay productos configurados...",
      fianzaTitulo: "🥘 FIANZA DE PAELLERA",
      fianzaTexto: "Al recoger tu pedido, se cobrarán 20€ extra en concepto de fianza por la sartén. Te los devolveremos íntegros al retornarla.",
      confirmarRecogida: "📋 Confirmar recogida",
      AQueHora: "¿A qué hora pasas a por ello?",
      disponible: "Disponible",
      completo: "Completo",
      paellaEspera: "Paella: +2h",
      AQueNombre: "¿A qué nombre dejamos la reserva?",
      placeholderNombre: "Escribe tu nombre...",
      botonConfirmar: "🛒 Confirmar",
      fianzaBoton: "+ 20€ Fianza",
      errorVacio: "⚠️ Tu pedido está vacío.",
      errorHora: "⚠️ Selecciona a qué hora pasarás a recoger la comida.",
      errorNombre: "⚠️ Dinos tu nombre para rotular tu pedido.",
      errorPaellaMina: "⚠️ LA PAELLA DEBE SER COMO MÍNIMO PARA 2 PERSONAS.",
      errorPaellaHora: "⚠️ LA PAELLA REQUIERE MÍNIMO 2 HORAS DE ANTELACIÓN.",
      errorConexion: "❌ Hubo un error de conexión. Inténtalo de nuevo."
    },
    ca: {
      subtitulo: "FES LA TEVA COMANDA SENSE CUES",
      carta: "🍗 La Nostra Carta",
      noProductos: "El menú d'avui s'està carregant o no hi ha productes configurats...",
      fianzaTitulo: "🥘 FIANÇA DE PAELLERA",
      fianzaTexto: "Al recollir la teva comanda, es cobraran 20€ extra en concepte de fiança per la paella. Te'ls tornarem íntegres al retornar-la.",
      confirmarRecogida: "📋 Confirmar recollida",
      AQueHora: "A quina hora passes a per ella?",
      disponible: "Disponible",
      completo: "Complet",
      paellaEspera: "Paella: +2h",
      AQueNombre: "A quin nom deixem la reserva?",
      placeholderNombre: "Escriu el teu nom...",
      botonConfirmar: "🛒 Confirmar",
      fianzaBoton: "+ 20€ Fiança",
      errorVacio: "⚠️ La teva comanda està buida.",
      errorHora: "⚠️ Selecciona a quina hora passaràs a recollir el menjar.",
      errorNombre: "⚠️ Digues el teu nom para rètolar la teva comanda.",
      errorPaellaMina: "⚠️ LA PAELLA HA DE SER COM A MÍNIM PER A 2 PERSONES.",
      errorPaellaHora: "⚠️ LA PAELLA REQUEREIX MÍNIM 2 HORES D'ANTELACIÓ.",
      errorConexion: "❌ Hi va haver un error de connexió. Torna-ho a intentar."
    },
    en: {
      subtitulo: "ORDER WITHOUT QUEUING",
      carta: "🍗 Our Menu",
      noProductos: "Today's menu is loading or there are no items configured...",
      fianzaTitulo: "🥘 PAELLA PAN DEPOSIT",
      fianzaTexto: "When picking up your order, an extra €20 will be charged as a deposit for the pan. It will be fully refunded upon return.",
      confirmarRecogida: "📋 Confirm order details",
      AQueHora: "What time will you pick it up?",
      disponible: "Available",
      completo: "Full",
      paellaEspera: "Paella: +2h",
      AQueNombre: "Under what name should we save the order?",
      placeholderNombre: "Write your name...",
      botonConfirmar: "🛒 Confirm Order",
      fianzaBoton: "+ €20 Deposit",
      errorVacio: "⚠️ Your order is empty.",
      errorHora: "⚠️ Select what time you will pick up the food.",
      errorNombre: "⚠️ Tell us your name to label your order.",
      errorPaellaMina: "⚠️ PAELLA MUST BE FOR A MINIMUM OF 2 PEOPLE.",
      errorPaellaHora: "⚠️ PAELLA REQUIRES A MINIMUM OF 2 HOURS NOTICE.",
      errorConexion: "❌ Connection error. Please try again."
    },
    fr: {
      subtitulo: "COMMANDEZ SANS ATTENTE",
      carta: "🍗 Notre Carte",
      noProductos: "Le menu d'aujourd'hui est en cours de chargement...",
      fianzaTitulo: "🥘 CAUTION CAUTÈRE À PAELLA",
      fianzaTexto: "Lors du retrait de votre commande, un supplément de 20€ sera facturé comme caution pour la poêle. Il vous sera intégralement remboursé au retour.",
      confirmarRecogida: "📋 Confirmer le retrait",
      AQueHora: "À quelle heure passez-vous prendre la commande?",
      disponible: "Disponible",
      completo: "Complet",
      paellaEspera: "Paella: +2h",
      AQueNombre: "À quel nom laissons-nous la réservation?",
      placeholderNombre: "Écrivez votre nom...",
      botonConfirmar: "🛒 Confirmer",
      fianzaBoton: "+ 20€ Caution",
      errorVacio: "⚠️ Votre commande est vide.",
      errorHora: "⚠️ Sélectionnez l'heure à laquelle vous récupérerez la nourriture.",
      errorNombre: "⚠️ Donnez-nous votre nom pour étiqueter votre commande.",
      errorPaellaMina: "⚠️ LA PAELLA DOIT ÊTRE POUR UN MINIMUM DE 2 PERSONNES.",
      errorPaellaHora: "⚠️ LA PAELLA REQUIERT UN MINIMUM DE 2 HEURES DE PRÉAVIS.",
      errorConexion: "❌ Erreur de connexion. Veuillez réessayer."
    }
  };
export default function ClienteMenu() {

    const [idioma, setIdioma] = useState('es'); 
    const [franjas, setFranjas] = useState([]);
    const [hornadas, setHornadas] = useState([]); // <-- NUEVO: EL MÓVIL ESCUCHA EL ASADOR
    const [productos, setProductos] = useState([]);
    const [pedidos, setPedidos] = useState([]);
    const [categorias, setCategorias] = useState([]); // <-- NUEVO: Guarda las categorías
    const [categoriasAbiertas, setCategoriasAbiertas] = useState({}); // <-- NUEVO: Controla qué acordeón está abierto
  
    // NUEVO: Un único carrito universal para todo
    const [carrito, setCarrito] = useState({});
  const [horaRecogida, setHoraRecogida] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [pedidoConfirmado, setPedidoConfirmado] = useState(false);
  const [ticketId, setTicketId] = useState('');

  // Stripe States
  const [opcionesPagoVisible, setOpcionesPagoVisible] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');
  
  const [configuracion, setConfiguracion] = useState(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('success') === 'true') {
      const tid = searchParams.get('ticketId');
      if (tid) {
        import('firebase/firestore').then(({ updateDoc, doc }) => {
          updateDoc(doc(db, 'pedidos', tid), { cobrado: true, metodoPago: 'stripe' }).catch(console.error);
        });
        setTicketId(tid);
        setPedidoConfirmado(true);
        setClientSecret('pagado'); // Esto muestra el check verde
      }
    }
  }, []);

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

    // NUEVO: ESCUCHAR CATEGORÍAS PARA LOS ACORDEONES
    const qCategorias = query(collection(db, 'categorias'), where('local', '==', LOCAL_ID));
    const unsubscribeCategorias = onSnapshot(qCategorias, (snapshot) => {
      const catData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.nombre.localeCompare(b.nombre));
      setCategorias(catData);
      
      // Iniciamos los acordeones abiertos por defecto la primera vez
      const inicialAbiertas = {};
      catData.forEach(c => inicialAbiertas[c.id] = false);
      // Solo las forzamos abiertas si es la carga inicial para no molestar al usuario si ya cerró alguna
      setCategoriasAbiertas(prev => Object.keys(prev).length === 0 ? inicialAbiertas : prev);
    });

const qPedidos = query(collection(db, 'pedidos'), where('local', '==', LOCAL_ID));
    const unsubscribePedidos = onSnapshot(qPedidos, (snapshot) => {
      setPedidos(
        snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(p => !p.archivado)
      );
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

    const qConfig = query(collection(db, 'configuracion'), where('local', '==', LOCAL_ID));
    const unsubscribeConfig = onSnapshot(qConfig, (snapshot) => {
      if (!snapshot.empty) setConfiguracion({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
    });

    return () => {
      unsubscribeFranjas();
      unsubscribeProductos();
      unsubscribeCategorias();
      unsubscribePedidos();
      unsubscribeHornadas();
      unsubscribeConfig();
    };
  }, []);

// --- ORDENACIÓN DE LA CARTA PARA EL CLIENTE ---
  const productosOrdenados = [...productos].sort((a, b) => {
    const ordenA = a.orden !== undefined ? a.orden : 999;
    const ordenB = b.orden !== undefined ? b.orden : 999;
    if (ordenA !== ordenB) return ordenA - ordenB;
    return a.nombre.localeCompare(b.nombre);
  });

  // NUEVO: FUNCIÓN PARA ABRIR/CERRAR ACORDEONES
  const toggleCategoria = (catId) => {
    setCategoriasAbiertas(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

// --- LÓGICA DE STOCK Y CARRITO (CEREBRO ACUMULADO) ---
  
  // Calcula SOLO los pollos que hay en el carrito (los extras van aparte)
  const calcularPollosConsumidos = () => {
    let pollos = 0;
    Object.entries(carrito).forEach(([id, cant]) => {
      const p = productos.find(x => x.id === id);
      if (p && p.controlaStock && p.nombre.toUpperCase().includes('POLLO')) {
        pollos += (parseFloat(p.consumeUnidades) * cant);
      }
    });
    return pollos;
  };

// Motor matemático: Cruza Hornadas vs Pedidos en el tiempo
  const calcularEstadoStockDinámico = (horaFranjaInicio) => {
    const horas = franjas.map(f => f.hora.split(' ')[0]).sort();
    const indexActual = horas.indexOf(horaFranjaInicio);
    
    // Solo los productos que consumen 1 o más tienen su propia alarma y cálculo.
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
          if (esEsteProducto && new Date(horno.horaListo) <= fechaEval && horno.activa) {
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
                        // Si pide medio pollo, detectamos que es una fracción y lo sumamos a este pollo
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
        faltan: minDisponible < 0 ? Math.ceil(Math.abs(minDisponible)) : 0,
        nombre: prod.nombre
      };
    });

    return resultado;
  };

  const tienePaella = Object.entries(carrito).some(([id, cant]) => {
    const p = productos.find(x => x.id === id);
    return p && p.nombre.toUpperCase().includes('PAELLA') && cant > 0;
  });

// Validador en tiempo real: ¿Me acabo de pasar de frenada?
  useEffect(() => {
    if (horaRecogida) {
      const f = franjas.find(x => x.hora.split(' ')[0] === horaRecogida);
      if (!f) return;

      let bloqueado = false;

      // 1. Check Paella
      if (tienePaella) {
        const ahora = new Date();
        const [horas, minutos] = horaRecogida.split(':');
        const horaFranja = new Date();
        horaFranja.setHours(parseInt(horas), parseInt(minutos), 0, 0);
        if ((horaFranja - ahora) < 120 * 60 * 1000) bloqueado = true;
      }

      // 2. Check Stock Dinámico Global (Pollos y Extras)
      const estadoStock = calcularEstadoStockDinámico(horaRecogida);
      
      const libresPollos = Object.values(estadoStock)
          .filter(s => s.nombre.toUpperCase().includes('POLLO'))
          .reduce((sum, s) => sum + s.libres, 0);
          
      if (calcularPollosConsumidos() > libresPollos) {
          bloqueado = true;
      }

      // 3. Check Extras
      Object.entries(carrito).forEach(([id, cant]) => {
        const p = productos.find(x => x.id === id);
        if (p && p.controlaStock && !p.nombre.toUpperCase().includes('POLLO')) {
           const stockItem = estadoStock[id];
           if (stockItem && cant > stockItem.libres) {
               bloqueado = true;
           }
        }
      });

      if (bloqueado) setHoraRecogida('');
    }
  }, [carrito, franjas, pedidos, horaRecogida, tienePaella, hornadas, productos]);

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
 

  const validarPedido = () => {
    setErrorFormulario('');
    if (totalArticulos === 0) {
      setErrorFormulario('⚠️ Tu pedido está vacío.');
      return false;
    }
    if (!horaRecogida) {
      setErrorFormulario('⚠️ Selecciona a qué hora pasarás a recoger la comida.');
      return false;
    }
    if (!nombreCliente.trim()) {
      setErrorFormulario('⚠️ Dinos tu nombre para rotular tu pedido.');
      return false;
    }

    if (tienePaella) {
      let racionesPaella = 0;
      Object.entries(carrito).forEach(([id, cant]) => {
        const p = productos.find(x => x.id === id);
        if (p && p.nombre.toUpperCase().includes('PAELLA')) racionesPaella = cant;
      });

      if (racionesPaella < 2) {
        setErrorFormulario('⚠️ LA PAELLA DEBE SER COMO MÍNIMO PARA 2 PERSONAS.');
        return false;
      }

      const ahora = new Date();
      const [horas, minutos] = horaRecogida.split(':');
      const fechaReserva = new Date();
      fechaReserva.setHours(parseInt(horas), parseInt(minutos), 0, 0);
      if (fechaReserva.getTime() - ahora.getTime() < 120 * 60 * 1000) {
        setErrorFormulario('⚠️ LA PAELLA REQUIERE MÍNIMO 2 HORAS DE ANTELACIÓN.');
        return false;
      }
    }
    return true;
  };

  const handleEnviarReserva = async (e) => {
    e.preventDefault();
    if (!validarPedido()) return;

    const unidadesConsumidas = calcularPollosConsumidos();
    const lineasTicket = [];
    Object.entries(carrito).forEach(([id, cant]) => {
      const p = productos.find(x => x.id === id);
      if (p) lineasTicket.push(`${cant}x ${p.nombre}`);
    });
    
    const detalleTexto = `${unidadesConsumidas} | ` + lineasTicket.join(' + ');

    try {
      const docRef = await addDoc(collection(db, 'pedidos'), {
        local: LOCAL_ID,
        cliente: nombreCliente.trim().toUpperCase(),
        hora: horaRecogida,
        detalle: detalleTexto,
        entregado: false,
        cobrado: false,
        metodoPago: 'mostrador',
        fianza: tienePaella ? 'pendiente' : null,
        origen: 'QR', 
        creadoEn: new Date()
      });

      // Guardamos el ID real de Firestore para poder actualizarlo si pagan después
      setTicketId(docRef.id); 
      setPedidoConfirmado(true);
    } catch (error) {
      setErrorFormulario('❌ Hubo un error de conexión al guardar el pedido. Inténtalo de nuevo.');
    }
  };

  const handlePagarAhora = async () => {
    setProcesandoPago(true);
    try {
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      const baseUrl = import.meta.env.DEV 
        ? `http://${window.location.hostname}:5001/${projectId}/us-central1/createStripePaymentIntent`
        : `https://us-central1-${projectId}.cloudfunctions.net/createStripePaymentIntent`;
        
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: { 
            total: calcularTotal(),
            stripeAccountId: configuracion?.stripeAccountId || null,
            returnUrl: window.location.origin + window.location.pathname,
            ticketId: ticketId
          } 
        })
      });
      const result = await response.json();
      
      if (result.result && result.result.url) {
        window.location.href = result.result.url;
      } else {
        throw new Error("No se pudo obtener la URL de Stripe Checkout");
      }
    } catch (error) {
      console.error(error);
      alert('Error al contactar con el servidor de pagos. Inténtalo de nuevo.');
      setProcesandoPago(false);
    }
  };

  if (pedidoConfirmado) {


    const estaPagadoVisual = clientSecret === 'pagado';

    return (
      <div className="min-h-screen bg-orange-50/40 p-4 flex items-center justify-center font-sans antialiased">
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-emerald-100 max-w-md w-full text-center space-y-6">
          <div className={`w-16 h-16 ${estaPagadoVisual ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-600'} rounded-full flex items-center justify-center text-3xl mx-auto animate-bounce`}>✓</div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">¡Reserva Confirmada!</h2>
            <p className="text-slate-500 text-sm mt-1">Ya lo tenemos apuntado en las espadas del asador.</p>
          </div>

          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-5 text-left space-y-3 font-mono relative overflow-hidden">
            {estaPagadoVisual && <div className="absolute top-0 right-0 bg-emerald-500 text-white font-black px-3 py-1 text-[10px] rounded-bl-lg">PAGADO</div>}
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-400 text-xs">Nº DE PEDIDO:</span>
              <span className="font-black text-orange-600 text-sm">#{ticketId.slice(-4).toUpperCase()}</span>
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
            <div className="flex flex-col border-t border-slate-200 pt-2 font-black text-slate-800 text-base">
              <div className="flex justify-between w-full">
                <span>TOTAL A PAGAR:</span>
                <span>{calcularTotal().toFixed(2)}€</span>
              </div>
              {tienePaella && (
                <span className="text-[10px] text-amber-600 font-bold mt-1 text-right italic">+ 20.00€ FIANZA (A pagar al recoger)</span>
              )}
            </div>
          </div>
          
          {!estaPagadoVisual ? (
            <div className="space-y-3">
              <button
                onClick={handlePagarAhora}
                disabled={procesandoPago}
                className="w-full bg-black text-white py-4 px-5 rounded-2xl shadow-lg flex justify-between items-center text-sm font-black uppercase tracking-wider transition-all hover:bg-gray-800 disabled:opacity-50"
              >
                <span>💳 Pagar Ahora (Tarjeta / Apple Pay)</span>
                <span>{procesandoPago ? '⌛' : '⚡'}</span>
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-orange-100 text-orange-900 py-4 px-5 rounded-2xl shadow-sm flex justify-center items-center text-sm font-black uppercase tracking-wider transition-all hover:bg-orange-200"
              >
                <span>Pagaré al recogerlo</span>
              </button>
            </div>
          ) : (
            <button onClick={() => window.location.reload()} className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl text-xs uppercase cursor-pointer">Hacer otro pedido</button>
          )}
        </div>
      </div>
    );
  }



return (
<div className={`min-h-screen ${APP_CONFIG.tema.fondoBase} text-slate-800 pb-56 font-sans antialiased`}>

{/* CONTENEDOR INVISIBLE PARA CENTRAR LA CABECERA */}
<div className="sticky top-0 z-40 flex justify-center w-full px-2 mt-2">
  {/* LA CABECERA REAL CON TAMAÑO MÁXIMO IDÉNTICO AL BOTÓN */}
  <header className={`${APP_CONFIG.tema.headerBg} border ${APP_CONFIG.tema.bordeClaro} shadow-md px-4 py-3 w-full max-w-md rounded-2xl`}>
    <h1 className={`text-xl font-black ${APP_CONFIG.tema.textoPrincipal} tracking-tight flex items-center justify-center gap-2`}>
      {APP_CONFIG.logoUrl ? (
        <img src={APP_CONFIG.logoUrl} alt="Logo" className="h-9 w-auto object-contain shrink-0" />
      ) : (
        <span className="text-2xl">🍗</span>
      )}
      <span className="truncate leading-none pt-1">{APP_CONFIG.nombre}</span>
    </h1>
<p className="text-slate-400 text-[10px] font-bold uppercase text-center tracking-wider mt-1.5">
      {TEXTOS[idioma].subtitulo}
    </p>

    {/* NUEVO: ROW DE BOTONES DE IDIOMA COMPACTOS */}
    <div className="flex justify-center gap-2 mt-3 pt-2.5 border-t border-slate-100 text-[10px] font-black">
      <button type="button" onClick={() => setIdioma('es')} className={`px-3 py-1.5 rounded-xl border-2 transition-all cursor-pointer ${idioma === 'es' ? 'bg-teal-600 border-teal-600 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>ESP</button>
      <button type="button" onClick={() => setIdioma('ca')} className={`px-3 py-1.5 rounded-xl border-2 transition-all cursor-pointer ${idioma === 'ca' ? 'bg-teal-600 border-teal-600 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>CAT</button>
      <button type="button" onClick={() => setIdioma('en')} className={`px-3 py-1.5 rounded-xl border-2 transition-all cursor-pointer ${idioma === 'en' ? 'bg-teal-600 border-teal-600 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>ENG</button>
      <button type="button" onClick={() => setIdioma('fr')} className={`px-3 py-1.5 rounded-xl border-2 transition-all cursor-pointer ${idioma === 'fr' ? 'bg-teal-600 border-teal-600 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>FRA</button>
    </div>
  </header>
</div>

      <main className="max-w-md mx-auto p-4 space-y-6">
<section className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">
            {TEXTOS[idioma].carta}
          </h2>

          {productos.length === 0 && (
            <p className="text-slate-400 text-sm text-center bg-white p-4 rounded-xl border border-slate-200">
              {TEXTOS[idioma].noProductos}
            </p>
          )}

          {/* ACORDEONES DE CATEGORÍAS */}
          {categorias.map(cat => {
          const productosCategoria = productosOrdenados.filter(p => p.categoriaId === cat.id);
          if (productosCategoria.length === 0) return null; // Ocultamos categorías vacías

            const isOpen = categoriasAbiertas[cat.id];
            const nombreCatTraducido = idioma === 'es' ? cat.nombre : (cat[`nombre_${idioma}`] || cat.nombre);
            const itemsEnCarrito = productosCategoria.reduce((sum, p) => sum + (carrito[p.id] || 0), 0);

            return (
              <div key={cat.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* CABECERA */}
                <button 
                  onClick={() => toggleCategoria(cat.id)}
                  className={`w-full flex items-center justify-between p-4 transition-colors cursor-pointer ${isOpen ? 'bg-slate-50 border-b border-slate-100' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{nombreCatTraducido}</h3>
                    {itemsEnCarrito > 0 && (
                      <span className={`${APP_CONFIG.tema.botonActivo} text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm`}>{itemsEnCarrito}</span>
                    )}
                  </div>
                  <span className={`text-slate-400 font-black transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {/* PRODUCTOS */}
                {isOpen && (
                  <div className="p-3 space-y-2 bg-slate-50/50">
                    {productosCategoria.map(plato => {
                      const cantidad = carrito[plato.id] || 0;
                      const nombreTraducido = idioma === 'es' ? plato.nombre : (plato[`nombre_${idioma}`] || plato.nombre);

                      return (
                        <div key={plato.id} className={`bg-white rounded-xl p-3 border shadow-sm flex items-center justify-between gap-3 transition-all ${cantidad > 0 ? APP_CONFIG.tema.bordeOscuro : APP_CONFIG.tema.bordeClaro}`}>
                          <div className="flex-1">
                            <h4 className="text-sm font-black text-slate-800 leading-tight uppercase">{nombreTraducido}</h4>
                            <span className={`text-sm font-black ${APP_CONFIG.tema.textoPrincipal} block mt-0.5`}>{parseFloat(plato.precio).toFixed(2)}€</span>
                          </div>

                          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 shadow-inner shrink-0">
                            {cantidad > 0 ? (
                              <>
                                <button onClick={() => handleModificarCarrito(plato.id, -1)} className="w-8 h-8 font-black text-slate-600 bg-white rounded-md shadow-sm border border-slate-200 flex items-center justify-center active:scale-90 cursor-pointer">-</button>
                                <span className="w-8 text-center font-bold font-mono text-slate-800 text-sm">{cantidad}</span>
                                <button onClick={() => handleModificarCarrito(plato.id, 1)} className="w-8 h-8 font-black text-slate-600 bg-white rounded-md shadow-sm border border-slate-200 flex items-center justify-center active:scale-90 cursor-pointer">+</button>
                              </>
                            ) : (
                              <button onClick={() => handleModificarCarrito(plato.id, 1)} className="bg-slate-800 text-white font-black text-[10px] px-3 py-2.5 rounded-md shadow-sm active:scale-95 transition-all cursor-pointer">AÑADIR</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* PRODUCTOS SIN CATEGORÍA (Red de seguridad) */}
          {(() => {
            const productosSinCat = productosOrdenados.filter(p => !p.categoriaId || !categorias.some(c => c.id === p.categoriaId));
            if (productosSinCat.length === 0) return null;

            const isOpen = categoriasAbiertas['sin-categoria'];
            const itemsEnCarrito = productosSinCat.reduce((sum, p) => sum + (carrito[p.id] || 0), 0);

            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-4">
                <button 
                  onClick={() => toggleCategoria('sin-categoria')}
                  className={`w-full flex items-center justify-between p-4 transition-colors cursor-pointer ${isOpen ? 'bg-orange-50 border-b border-orange-100' : 'bg-slate-50 hover:bg-slate-100'}`}
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-600 uppercase tracking-tight">Otras Especialidades</h3>
                    {itemsEnCarrito > 0 && (
                      <span className="bg-slate-800 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">{itemsEnCarrito}</span>
                    )}
                  </div>
                  <span className={`text-slate-400 font-black transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {isOpen && (
                  <div className="p-3 space-y-2 bg-slate-50/50">
                    {productosSinCat.map(plato => {
                      const cantidad = carrito[plato.id] || 0;
                      const nombreTraducido = idioma === 'es' ? plato.nombre : (plato[`nombre_${idioma}`] || plato.nombre);

                      return (
                        <div key={plato.id} className={`bg-white rounded-xl p-3 border shadow-sm flex items-center justify-between gap-3 transition-all ${cantidad > 0 ? APP_CONFIG.tema.bordeOscuro : APP_CONFIG.tema.bordeClaro}`}>
                          <div className="flex-1">
                            <h4 className="text-sm font-black text-slate-800 leading-tight uppercase">{nombreTraducido}</h4>
                            <span className={`text-sm font-black ${APP_CONFIG.tema.textoPrincipal} block mt-0.5`}>{parseFloat(plato.precio).toFixed(2)}€</span>
                          </div>

                          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 shadow-inner shrink-0">
                            {cantidad > 0 ? (
                              <>
                                <button onClick={() => handleModificarCarrito(plato.id, -1)} className="w-8 h-8 font-black text-slate-600 bg-white rounded-md shadow-sm border border-slate-200 flex items-center justify-center active:scale-90 cursor-pointer">-</button>
                                <span className="w-8 text-center font-bold font-mono text-slate-800 text-sm">{cantidad}</span>
                                <button onClick={() => handleModificarCarrito(plato.id, 1)} className="w-8 h-8 font-black text-slate-600 bg-white rounded-md shadow-sm border border-slate-200 flex items-center justify-center active:scale-90 cursor-pointer">+</button>
                              </>
                            ) : (
                              <button onClick={() => handleModificarCarrito(plato.id, 1)} className="bg-slate-800 text-white font-black text-[10px] px-3 py-2.5 rounded-md shadow-sm active:scale-95 transition-all cursor-pointer">AÑADIR</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </section>

 {tienePaella && (
                <div className="bg-amber-100 border-2 border-amber-300 rounded-2xl p-4 mb-4 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-bl-lg tracking-widest">INFO</div>
                  <h3 className="text-amber-900 font-black text-sm uppercase flex items-center gap-2 mb-1">
                    {TEXTOS[idioma].fianzaTitulo}
                  </h3>
                  <p className="text-amber-800 text-xs font-bold leading-relaxed">
                    {TEXTOS[idioma].fianzaTexto}
                  </p>
                </div>
              )}

              <section className="bg-white rounded-2xl p-5 border border-orange-100/60 shadow-sm space-y-4">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                  {TEXTOS[idioma].confirmarRecogida}
                </h2>

                {franjas.length === 0 ? (
                  <p className="text-rose-500 font-bold text-sm bg-rose-50 p-3 rounded-lg text-center">
                    Aún no hay horas disponibles para hoy.
                  </p>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                      {TEXTOS[idioma].AQueHora}
                    </label>
<div className="w-full">
                      <select
                        value={horaRecogida || ""}
                        onChange={(e) => setHoraRecogida(e.target.value)}
                        className="w-full bg-white border-2 border-slate-200 text-slate-700 font-black rounded-xl px-5 py-4 text-lg md:text-xl focus:outline-none focus:border-orange-500 shadow-sm cursor-pointer appearance-none"
                      >
                        <option value="" disabled>🕒 Toca aquí para elegir tu hora...</option>
                        {(() => {
                          return franjas.map(f => {
                            const h = f.hora.split(' ')[0];
                            const ahora = new Date();
                            const [horas, minutos] = h.split(':');
                            const horaFranja = new Date();
                            horaFranja.setHours(parseInt(horas), parseInt(minutos), 0, 0);

                            const franjaPasada = horaFranja < ahora;

                            let bloqueadoPorPaella = false;
                            if (tienePaella && (horaFranja - ahora) < 120 * 60 * 1000) {
                              bloqueadoPorPaella = true;
                            }

                            const estadoStock = calcularEstadoStockDinámico(h);

                            // 1. ¿Hay pollos suficientes en esta hora?
                            const libresPollos = Object.values(estadoStock)
                              .filter(s => s.nombre.toUpperCase().includes('POLLO'))
                              .reduce((sum, s) => sum + s.libres, 0);
                            const faltanPollos = calcularPollosConsumidos() > libresPollos;

                            // 2. ¿Hay extras suficientes en esta hora? (Dinámico)
                            let faltaAlgunExtra = false;
                            let nombreExtraFaltante = "";
                            
                            Object.entries(carrito).forEach(([id, cant]) => {
                              const p = productos.find(x => x.id === id);
                              if (p && p.controlaStock && !p.nombre.toUpperCase().includes('POLLO') && !faltaAlgunExtra) {
                                const stockItem = estadoStock[p.id];
                                if (stockItem && cant > stockItem.libres) {
                                  faltaAlgunExtra = true;
                                  nombreExtraFaltante = p.nombre;
                                }
                              }
                            });

                            const botonDeshabilitado = franjaPasada || bloqueadoPorPaella || faltanPollos || faltaAlgunExtra;

                            // Formateamos el texto que saldrá dentro del desplegable
                            let textoEstado = "";
                            if (franjaPasada) textoEstado = "- (Cerrada)";
                            else if (bloqueadoPorPaella) textoEstado = `- (${TEXTOS[idioma].paellaEspera})`;
                            else if (faltaAlgunExtra) textoEstado = `- (Sin ${nombreExtraFaltante})`;
                            else if (faltanPollos) textoEstado = `- (${TEXTOS[idioma].completo})`;
                            else textoEstado = `- ✓ ${TEXTOS[idioma].disponible}`;

                            return (
                              <option 
                                key={f.id} 
                                value={h} 
                                disabled={botonDeshabilitado}
                              >
                                {h} {textoEstado}
                              </option>
                            );
                          });
                        })()}
                      </select>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    {TEXTOS[idioma].AQueNombre}
                  </label>
                  <input 
                    type="text" 
                    placeholder={TEXTOS[idioma].placeholderNombre}
                    value={nombreCliente}
                    onChange={(e) => setNombreCliente(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500 font-bold uppercase tracking-wide"
                  />
                </div>

                {/* Chivato dinámico de errores en el idioma actual */}
                {errorFormulario && (
                  <p className="text-rose-600 font-bold text-xs text-center bg-rose-50 p-2 rounded-xl border border-rose-100">
                    {TEXTOS[idioma][errorFormulario] || errorFormulario}
                  </p>
                )}
              </section>
            </main>

            {totalArticulos > 0 && (
              <div className={`fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t ${APP_CONFIG.tema.bordeClaro} shadow-xl flex justify-center z-40`}>
                <button
                  onClick={handleEnviarReserva}
                  disabled={franjas.length === 0}
                  className={`w-full max-w-md ${APP_CONFIG.tema.botonPrimario} active:scale-95 text-white font-black py-4 px-5 rounded-2xl shadow-lg flex justify-between items-center text-sm uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer`}
                >
                  <span>{TEXTOS[idioma].botonConfirmar} ({totalArticulos})</span>
                  <div className="flex flex-col items-end">
                    <span className="bg-emerald-800/40 px-3 py-1 rounded-lg font-mono font-black">{calcularTotal().toFixed(2)}€</span>
                    {tienePaella && <span className="text-[9px] text-teal-200 mt-0.5 font-bold">{TEXTOS[idioma].fianzaBoton}</span>}
                  </div>
                </button>
              </div>
            )}
          </div>
        );
      }