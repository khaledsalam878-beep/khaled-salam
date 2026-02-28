import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDJiGrK0AnGQvWszbp6o7RFZJQO5Rm0yBQ",
  authDomain: "mohamedrostom-b6027.firebaseapp.com",
  databaseURL: "https://mohamedrostom-b6027-default-rtdb.firebaseio.com",
  projectId: "mohamedrostom-b6027",
  storageBucket: "mohamedrostom-b6027.firebasestorage.app",
  messagingSenderId: "63872187835",
  appId: "1:63872187835:web:21be801c57783c853ed89e",
  measurementId: "G-XK25RDL3Y0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
