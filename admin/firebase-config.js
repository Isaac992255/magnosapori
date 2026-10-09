// ==================== CONFIGURACIÓN FIREBASE FILLIPO ====================
// Configuración del proyecto Firebase de Fillipo

const firebaseConfig = {
  apiKey: "AIzaSyCV2Hy1zHQTMf0Z7fl5DaSARjrHlkrFIOk",
  authDomain: "ludlow-cc1df.firebaseapp.com",
  projectId: "ludlow-cc1df",
  storageBucket: "ludlow-cc1df.firebasestorage.app",
  messagingSenderId: "606767458308",
  appId: "1:606767458308:web:0787971a4bd1bb86f7ad51",
  measurementId: "G-H59H9PBK4Y"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referencias
const auth = firebase.auth();
const db = firebase.firestore();
