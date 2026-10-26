import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de la base de datos de pruebas (asador-dev)
const firebaseConfig = {
  apiKey: "AIzaSyCl9xEG3fdGupmwi9sgUuCBzdEwaca96ao",
  authDomain: "asador-dev.firebaseapp.com",
  projectId: "asador-dev",
  storageBucket: "asador-dev.firebasestorage.app",
  messagingSenderId: "383723446275",
  appId: "1:383723446275:web:305d7ad6529932e9fdae36"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteCollection(collectionName) {
  console.log(`Borrando colección: ${collectionName}...`);
  const colRef = collection(db, collectionName);
  const snapshot = await getDocs(colRef);
  
  let deletedCount = 0;
  for (const document of snapshot.docs) {
    await deleteDoc(doc(db, collectionName, document.id));
    deletedCount++;
  }
  console.log(`Borrados ${deletedCount} documentos de ${collectionName}.`);
}

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(';').map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';').map(v => v.trim());
    if (values.length !== headers.length) continue;
    
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index];
    });
    data.push(obj);
  }
  return data;
}

async function run() {
  try {
    console.log("Iniciando volcado a Firebase PRUEBAS...");
    
    // 1. Borrar colecciones actuales
    await deleteCollection('categorias');
    await deleteCollection('productos');

    // 2. Leer archivos CSV
    const categoriasCSV = fs.readFileSync(path.join(__dirname, 'categorias_restaugest.csv'), 'utf8');
    const productosCSV = fs.readFileSync(path.join(__dirname, 'productos_restaugest.csv'), 'utf8');
    
    const categorias = parseCSV(categoriasCSV);
    const productos = parseCSV(productosCSV);
    
    // 3. Insertar Categorías
    console.log("Insertando categorías...");
    let catCount = 0;
    for (const cat of categorias) {
      const catData = {
        local: 'asador-dc',
        nombre: cat.Nombre_ES,
        nombre_es: cat.Nombre_ES,
        nombre_ca: cat.Nombre_CA,
        nombre_en: cat.Nombre_EN,
        nombre_fr: cat.Nombre_FR,
        orden: parseInt(cat.Orden, 10)
      };
      // Usamos el ID_Categoria como ID del documento en Firebase para mantener coherencia
      await setDoc(doc(db, 'categorias', cat.ID_Categoria), catData);
      catCount++;
    }
    console.log(`Insertadas ${catCount} categorías.`);
    
    // 4. Insertar Productos
    console.log("Insertando productos...");
    let prodCount = 0;
    for (const prod of productos) {
      const prodData = {
        local: 'asador-dc',
        codigoTPV: prod.Codigo_RestauGest,
        categoriaId: prod.Categoria_App,
        nombre: prod.Nombre_ES,
        nombre_es: prod.Nombre_ES,
        nombre_ca: prod.Nombre_CA,
        nombre_en: prod.Nombre_EN,
        nombre_fr: prod.Nombre_FR,
        precio: parseFloat(prod.Precio),
        controlaStock: prod.Control_Hornadas === 'SI',
        minutosCoccion: parseInt(prod.Minutos_Coccion, 10),
        consumeUnidades: parseFloat(prod.Resta_Hornada),
        orden: parseInt(prod.Orden, 10)
      };
      // Aquí podemos dejar que Firebase genere el ID o usar el Codigo_RestauGest. 
      // Por limpieza, usamos el código como ID si queremos.
      await setDoc(doc(db, 'productos', prod.Codigo_RestauGest), prodData);
      prodCount++;
    }
    console.log(`Insertados ${prodCount} productos.`);
    
    console.log("¡Volcado completado con éxito!");
    process.exit(0);
  } catch (error) {
    console.error("Error durante el volcado:", error);
    process.exit(1);
  }
}

run();
