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

// UPDATED: Now saves dimensions along with canvas/boards/images
export async function saveBoard(roomId: string, data: any) {
  const ref = doc(db, "rooms", roomId);

  try {
    // Ensure dimensions are included
    const dataToSave = {
      boardData: {
        canvas: data.canvas || [],
        dimensions: data.dimensions || {
          width: 1920,
          height: 1080,
          version: 0,
          lastModifiedBy: "system",
          lastModifiedAt: Date.now(),
          vectorClock: {},
        },
        boards: data.boards || [],
        images: data.images || [],
      },
    };

    await setDoc(ref, dataToSave, { merge: true });
    console.log("✅ Saved to Firestore (including dimensions)");
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
    boardData: {
      canvas: [],
      dimensions: {
        width: 1920,
        height: 1080,
        version: 0,
        lastModifiedBy: user?.uid ?? "guest",
        lastModifiedAt: Date.now(),
        vectorClock: {},
      },
      boards: [],
      images: [],
    },
  });
}

export async function getRoom(roomId: string) {
  const ref = doc(db, "rooms", roomId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
