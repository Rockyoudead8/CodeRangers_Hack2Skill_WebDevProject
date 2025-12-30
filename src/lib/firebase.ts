//src\lib\firebase.ts

import { initializeApp } from "firebase/app";

import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDCRJUdLgzF3ZCozhBagjiC3auS5vtieaw",
  authDomain: "whiteboard-b0629.firebaseapp.com",
  projectId: "whiteboard-b0629",
  storageBucket: "whiteboard-b0629.firebasestorage.app",
  messagingSenderId: "1054139719426",
  appId: "1:1054139719426:web:df63e686c4da88e26b6c1b",
  measurementId: "G-S189DGRCQK",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
