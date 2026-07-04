// Importamos la función central de Firebase
import { initializeApp } from "firebase/app";
// Importamos la función para acceder a la base de datos en tiempo real
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Las credenciales exactas de tu proyecto 'asador-saas'
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 1. Despertamos a Firebase con tu configuración
const app = initializeApp(firebaseConfig);

// 2. Activamos la base de datos Firestore y la exportamos como "db" 
// para que el Dashboard y el ClienteMenu puedan leer y escribir en ella.
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

// Use local emulator in development mode
if (import.meta.env.DEV) {
  // window.location.hostname permite que funcione tanto en tu PC (localhost) como en el móvil (IP)
  connectFunctionsEmulator(functions, window.location.hostname, 5001);
}
