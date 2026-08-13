// js/firebase-config.js

const firebaseConfig = {
    apiKey: "AIzaSyAnVVKO8HdwFnytvz4BwxYQ6xiClZyIW3g",
    authDomain: "rdmfcpro.firebaseapp.com",
    databaseURL: "https://rdmfcpro-default-rtdb.firebaseio.com",
    projectId: "rdmfcpro",
    storageBucket: "rdmfcpro.firebasestorage.app",
    messagingSenderId: "626480220792",
    appId: "1:626480220792:web:82f199d14b802f0ba13b8d",
    measurementId: "G-97EWWJEHHV"
};

// Inicializa o Firebase (formato compatível)
firebase.initializeApp(firebaseConfig);
const db = firebase.database(); // Conecta ao Realtime Database
const auth = firebase.auth();   // Conecta ao Sistema de Autenticação