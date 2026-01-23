import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyAKr2_t_-JjzeiO8G8vQUkitqgDXi49ih0",
    authDomain: "jveloce-cf602.firebaseapp.com",
    projectId: "jveloce-cf602",
    storageBucket: "jveloce-cf602.firebasestorage.app",
    messagingSenderId: "779415799900",
    appId: "1:779415799900:web:759f5e87559312550dfe99",
    measurementId: "G-YSCZ95T9LY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
export { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
