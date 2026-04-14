// Firebase configuration — compat SDK (loaded via CDN in HTML)
// Requires: firebase-app-compat.js + firebase-database-compat.js + firebase-auth-compat.js

const firebaseConfig = {
  apiKey: "AIzaSyAId6LtakeEnKLxRKM5dEScNZUV9kvpHY4",
  authDomain: "manajemenlab.firebaseapp.com",
  databaseURL: "https://manajemenlab-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "manajemenlab",
  storageBucket: "manajemenlab.firebasestorage.app",
  messagingSenderId: "978127796163",
  appId: "1:978127796163:web:1199a5e4dd6b4b5301ef76",
  measurementId: "G-PMCJNNJ6Y0"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// db is the global Realtime Database reference used by app.js
const db = firebase.database();
const auth = firebase.auth();
