// Importamos la función central de Firebase
import { initializeApp } from "firebase/app";
// Importamos la función para acceder a la base de datos en tiempo real
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Las credenciales exactas de tu proyecto 'asador-saas'
const firebaseConfig = {
  apiKey: "AIzaSyB0Xf_8lP3xLtovLaglbhEYuzCxC6AwYLA",
  authDomain: "asador-saas.firebaseapp.com",
  projectId: "asador-saas",
  storageBucket: "asador-saas.firebasestorage.app",
  messagingSenderId: "1004904380675",
  appId: "1:1004904380675:web:34ebce379eb2ccd0cf9136"
};

// 1. Despertamos a Firebase con tu configuración
const app = initializeApp(firebaseConfig);

// 2. Activamos la base de datos Firestore y la exportamos como "db" 
// para que el Dashboard y el ClienteMenu puedan leer y escribir en ella.
export const db = getFirestore(app);
export const auth = getAuth(app);

