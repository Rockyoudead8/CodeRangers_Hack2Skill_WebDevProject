// src/lib/roomService.ts - FINAL FIX with correct UID usage

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { onSnapshot } from "firebase/firestore";

// ==========================================
// RBAC TYPES
// ==========================================

export interface RoomMetadata {
  isRoleBased: boolean;
  adminKeyHash?: string;
  createdBy: string;
  createdAt: any;
}

export interface RoomAccessInfo {
  isRoleBased: boolean;
  requiresKey: boolean;
}

// ==========================================
// KEY GENERATION & HASHING
// ==========================================

export function generateAdminKey(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);

  return Array.from(array)
    .map((byte) => chars[byte % chars.length])
    .join("");
}

export async function hashAdminKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ==========================================
// ROOM CREATION - FIXED WITH CORRECT UID
// ==========================================

export interface CreateRoomOptions {
  roomId: string;
  user: any;
  isRoleBased: boolean;
  adminKey?: string;
}

export async function createRoom({
  roomId,
  user,
  isRoleBased,
  adminKey,
}: CreateRoomOptions) {
  console.log("🔥 Creating room in Firestore:", roomId);

  // 🔥 CRITICAL: Validate user authentication
  if (!user || !user.uid) {
    console.error("❌ User not authenticated!", { user });
    throw new Error("User must be authenticated to create a room");
  }

  console.log("✅ User authenticated:", {
    uid: user.uid,
    email: user.email,
  });

  const ref = doc(db, "rooms", roomId);

  try {
    // Check if room exists
    const snap = await getDoc(ref);
    if (snap.exists()) {
      console.log("⚠️ Room already exists");
      return { exists: true };
    }

    // Hash the admin key if provided
    const adminKeyHash = adminKey ? await hashAdminKey(adminKey) : undefined;

    // 🔥 CRITICAL FIX: Ensure createdBy is the UID (not email or anything else)
    const roomData: any = {
      createdBy: user.uid, // ✅ MUST BE UID
      createdAt: serverTimestamp(),
      participants: [user.uid], // ✅ Store UIDs in participants array
      isRoleBased,
      boardData: {
        canvas: [],
        dimensions: {
          width: 1920,
          height: 1080,
          version: 0,
          lastModifiedBy: user.uid, // ✅ Use UID here too
          lastModifiedAt: Date.now(),
          vectorClock: {},
        },
        boards: [],
        images: [],
      },
    };

    // Only store hash if role-based
    if (isRoleBased && adminKeyHash) {
      roomData.adminKeyHash = adminKeyHash;
    }

    console.log("💾 Room data prepared:", {
      roomId,
      createdBy: roomData.createdBy, // Should show UID
      isRoleBased,
      hasAdminKey: !!adminKeyHash,
    });

    // 🔥 This is where the permission check happens
    console.log("🔐 Writing to Firestore with user:", {
      uid: user.uid,
      email: user.email,
    });

    await setDoc(ref, roomData);

    console.log("✅ Room created successfully!");

    return {
      exists: false,
      plainKey: adminKey,
    };
  } catch (error: any) {
    console.error("❌ Failed to create room:", error);

    // Detailed error logging for permission issues
    if (error.code === "permission-denied") {
      console.error("🚫 PERMISSION DENIED");
      console.error("User UID:", user?.uid);
      console.error("User Email:", user?.email);
      console.error("Room ID:", roomId);
      console.error("Check if your Firestore rules match the user UID");
    }

    throw error;
  }
}

// ==========================================
// ROOM ACCESS CHECK
// ==========================================

export async function getRoomAccessInfo(
  roomId: string
): Promise<RoomAccessInfo | null> {
  try {
    const ref = doc(db, "rooms", roomId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.log("⚠️ Room does not exist:", roomId);
      return null;
    }

    const data = snap.data();

    return {
      isRoleBased: data.isRoleBased ?? false,
      requiresKey: !!(data.isRoleBased && data.adminKeyHash),
    };
  } catch (error: any) {
    console.error("❌ Failed to get room access info:", error);

    if (error.code === "permission-denied") {
      console.error("🚫 Permission Denied when reading room");
    }

    throw error;
  }
}

// ==========================================
// EXISTING FUNCTIONS
// ==========================================

export function subscribeToBoard(
  roomId: string,
  callback: (data: any) => void
) {
  const ref = doc(db, "rooms", roomId);
  return onSnapshot(
    ref,
    (snap) => {
      const d = snap.data();
      if (d?.boardData) callback(d.boardData);
    },
    (error) => {
      console.error("❌ Firestore subscription error:", error);
    }
  );
}

export async function saveBoard(roomId: string, data: any) {
  const ref = doc(db, "rooms", roomId);

  try {
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
    console.log("✅ Saved to Firestore");
  } catch (err: any) {
    console.error("❌ Firestore save failed:", err);

    if (err.code === "permission-denied") {
      console.error("🚫 Permission Denied - Cannot save board");
    }

    throw err;
  }
}

export async function getRoom(roomId: string) {
  try {
    const ref = doc(db, "rooms", roomId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (error: any) {
    console.error("❌ Failed to get room:", error);

    if (error.code === "permission-denied") {
      console.error("🚫 Permission Denied when reading room");
    }

    return null;
  }
}
