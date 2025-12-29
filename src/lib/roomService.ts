import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { updateDoc } from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";

// it subscribes to the board data changes in the firestore
export function subscribeToBoard(roomId: string, callback: (data:any)=>void) {
  const ref = doc(db, "rooms", roomId);

  return onSnapshot(ref, snap => {
    const d = snap.data();
    if (d?.boardData) callback(d.boardData);
  });
}

// it write the data means it saves the data on the firestore
export async function saveBoard(roomId: string, data: any) {
  const ref = doc(db, "rooms", roomId);
  await updateDoc(ref, {
    boardData: data
  });
}

export async function createRoom(roomId: string, user: any) {
    console.log("🔥 Trying to create room in Firestore:", roomId, user?.email);
    const ref = doc(db, "rooms", roomId);

  const snap = await getDoc(ref);
  if (snap.exists()) return;  // Room already exists, don't overwrite

  await setDoc(ref, {
    createdBy: user?.uid ?? "guest",
    createdAt: serverTimestamp(),
    participants: [],
    boardData: null
  });
}

export async function getRoom(roomId: string) {
  const ref = doc(db, "rooms", roomId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
