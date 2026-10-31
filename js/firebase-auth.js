/**
 * Firebase Auth Module - Dedicated for Admin Panel & Login
 * Separated to ensure public pages (index.html, detalle.html) never load firebase-auth
 * or spawn the /__/auth/iframe cross-domain iframe for Googlebot.
 */
import { app, ADMIN_EMAIL } from './firebase-config.js';
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { 
    auth, 
    googleProvider, 
    ADMIN_EMAIL, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
};
