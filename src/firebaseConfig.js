import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Suas chaves do projeto Celebre
const firebaseConfig = {
  apiKey: "AIzaSyAPvEB-CkQyRRFvr3O_FZcNXho1XHSslis",
  authDomain: "celebre-9f5c9.firebaseapp.com",
  projectId: "celebre-9f5c9",
  storageBucket: "celebre-9f5c9.firebasestorage.app",
  messagingSenderId: "863903211417",
  appId: "1:863903211417:web:bfbb153d3d4b148f5fbd08"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);