// src/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 🔥 UPDATED CONFIGURATION (From your screenshot)
const firebaseConfig = {
  apiKey: "AIzaSyDeGFEIGzfrw4mPvuN1Qe7lLRKRmo82DPo",
  authDomain: "whiteboard-b0629-d3a24.firebaseapp.com",
  projectId: "whiteboard-b0629-d3a24",
  storageBucket: "whiteboard-b0629-d3a24.firebasestorage.app",
  messagingSenderId: "621071052468",
  appId: "1:621071052468:web:a2e5fb2b740395dcb7b1e1",
  measurementId: "G-V2WQJCB2JH",
};

// Initialize Firebase (prevent duplicate initialization)
const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// Add required scopes for Drive access
provider.addScope("https://www.googleapis.com/auth/drive.file");

export const db = getFirestore(app);

console.log(
  "✅ Firebase initialized with CORRECT project:",
  firebaseConfig.projectId
);
