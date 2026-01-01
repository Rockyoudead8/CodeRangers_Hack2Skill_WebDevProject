//src/lib/roomService.ts

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { onSnapshot } from "firebase/firestore";

export function subscribeToBoard(
  roomId: string,
  callback: (data: any) => void
) {
  const ref = doc(db, "rooms", roomId);
  return onSnapshot(ref, (snap) => {
    const d = snap.data();
    if (d?.boardData) callback(d.boardData);
  });
}

// 🔥 FIXED: Use setDoc with merge instead of updateDoc
export async function saveBoard(roomId: string, data: any) {
  const ref = doc(db, "rooms", roomId);

  try {
    // Use setDoc with merge: true to create if doesn't exist
    await setDoc(ref, { boardData: data }, { merge: true });
    console.log("✅ Saved to Firestore");
  } catch (err) {
    console.error("❌ Firestore save failed:", err);
    throw err;
  }
}

export async function createRoom(roomId: string, user: any) {
  console.log("🔥 Creating room in Firestore:", roomId);
  const ref = doc(db, "rooms", roomId);

  const snap = await getDoc(ref);
  if (snap.exists()) {
    console.log("Room already exists");
    return;
  }

  await setDoc(ref, {
    createdBy: user?.uid ?? "guest",
    createdAt: serverTimestamp(),
    participants: [],
    boardData: null,
  });
}

export async function getRoom(roomId: string) {
  const ref = doc(db, "rooms", roomId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
