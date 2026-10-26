const functions = require('firebase-functions');
const admin = require('firebase-admin');
const ftp = require('basic-ftp');

exports.enviarPedidoTPV = functions.https.onCall(async (data, context) => {
  const { pedidoId } = data;
  if (!pedidoId) {
    throw new functions.https.HttpsError('invalid-argument', 'Falta el ID del pedido');
  }

  try {
    const pedidoDoc = await admin.firestore().collection('pedidos').doc(pedidoId).get();
    if (!pedidoDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Pedido no encontrado');
    }

    const pedido = pedidoDoc.data();
    
    // VERIFICACIÓN CRÍTICA: Necesitamos un array estructurado, no el texto plano
    if (!pedido.carritoData || !Array.isArray(pedido.carritoData) || pedido.carritoData.length === 0) {
       console.error("El pedido no tiene la estructura carritoData", pedido);
       throw new functions.https.HttpsError('failed-precondition', 'El pedido no tiene datos estructurados de carrito (carritoData) con EANs y precios.');
    }

    // 1. Generar variables de tiempo
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    
    const fileName = `00101${yy}${mm}${dd}${hh}${min}${ss}.POP`;
    const numDoc = pedidoId.substring(0, 10); // Usamos hasta 10 chars del ID

    const fechaFormat = `${dd}/${mm}/20${yy}`;
    const horaFormat = `${hh}:${min}:${ss}`;

    let fileContent = "";
    let totalPedidoConIva = 0;
    let totalPedidoSinIva = 0;

    // 2. Construir líneas 1001 (Artículos)
    pedido.carritoData.forEach((item, index) => {
      const ean = item.codigoTPV || '0000000000'; 
      const cantidad = item.cantidad || 1;
      const pvp = item.precio || 0; // Precio con IVA
      const nombre = (item.nombre || '').substring(0, 60);
      
      const importeSinIvaLinea = (cantidad * pvp) / 1.10; // IVA 10%
      const pvpFormatted = pvp.toFixed(2).replace('.', ',');
      const importeSinIvaFormatted = importeSinIvaLinea.toFixed(6).replace('.', ',');
      
      totalPedidoConIva += (cantidad * pvp);
      totalPedidoSinIva += importeSinIvaLinea;

      // 1001#A#1#1#1#2#[NumDoc]#[SKU]#[Cantidad]#[PVP]#[Nombre]#[ImporteSinIVA]#[ImporteCoste]#[Fecha]#[NumLinea]#[IVA]#[Tipo]#
      fileContent += `1001#A#1#1#1#2#${numDoc}#${ean}#${cantidad}#${pvpFormatted}#${nombre}#${importeSinIvaFormatted}#0#${fechaFormat}#${index}#10#AR#\n`;
    });

    // 3. Construir línea 1000 (Cabecera/Totales)
    const totalConIvaStr = totalPedidoConIva.toFixed(2).replace('.', ',');
    const totalSinIvaStr = totalPedidoSinIva.toFixed(2).replace('.', ',');
    
    // 1000#A#1#1#1#2#[NumDoc]##[Fecha]#[Hora]#[TotalConIVA]#[TotalSinIVA]#[TotalCoste]#1##0#Observaciones#[EstadoPago]#
    fileContent += `1000#A#1#1#1#2#${numDoc}##${fechaFormat}#${horaFormat}#${totalConIvaStr}#${totalSinIvaStr}#0#1##0#ENVIADO DESDE APP#0#\n`;

    // 4. Subir por FTP
    const client = new ftp.Client();
    // client.ftp.verbose = true;
    
    // Aquí idealmente usar process.env.FTP_USER pero lo pongo hardcodeado por ahora para pruebas
    await client.access({
        host: "ftp.gestion-eficaz.com",
        user: "2385- BEACHCLUB",
        password: "7KjMo4#B@7",
        secure: false
    });
    
    // Crear un stream desde el string para subirlo
    const { Readable } = require('stream');
    const source = Readable.from([fileContent]);
    
    await client.uploadFrom(source, fileName);
    client.close();

    console.log(`Archivo ${fileName} subido al FTP correctamente.`);
    return { success: true, fileName };

  } catch (error) {
    console.error('Error enviando al TPV:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Error al enviar al TPV');
  }
});
