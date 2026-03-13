import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  // CHAVE CORRIGIDA: Troquei "30 " por "3O_"
  apiKey: "AIzaSyAPvEB-CkQyRRFvr3O_FZcNXho1XHSslis", 
  authDomain: "celebre-9f5c9.firebaseapp.com",
  projectId: "celebre-9f5c9",
  storageBucket: "celebre-9f5c9.firebasestorage.app",
  messagingSenderId: "863903211417",
  appId: "1:863903211417:web:bfbb153d3d4b148f5fbd08"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); 
export const auth = getAuth(app); 
export const googleProvider = new GoogleAuthProvider();