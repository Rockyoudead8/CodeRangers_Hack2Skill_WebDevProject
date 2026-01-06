// src/lib/roomService.ts - UPDATED with Saved Rooms functionality

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { onSnapshot } from "firebase/firestore";
import { SavedRoom, UserRoomsDocument } from "@/types/room";

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
// ROOM CREATION - WITH AUTO-SAVE
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
      createdBy: roomData.createdBy,
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

    // 🔥 NEW: Auto-save to user's savedRooms
    try {
      await saveRoomToList(
        user.uid,
        roomId,
        isRoleBased ? "rbac" : "public",
        true
      );
      console.log("✅ Room auto-saved to user's list");
    } catch (saveError) {
      console.error("⚠️ Failed to auto-save room to list:", saveError);
      // Don't throw error - room creation succeeded
    }

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
// SAVED ROOMS MANAGEMENT
// ==========================================

/**
 * Save room to user's personal list
 */
export async function saveRoomToList(
  userId: string,
  roomId: string,
  roomType: "public" | "rbac",
  isCreator: boolean = false
): Promise<void> {
  if (!userId || !roomId) {
    throw new Error("User ID and Room ID are required");
  }

  const userRoomsRef = doc(db, "userRooms", userId);

  try {
    // Check if room already saved
    const userRoomsDoc = await getDoc(userRoomsRef);

    if (userRoomsDoc.exists()) {
      const existingRooms = userRoomsDoc.data().savedRooms || [];
      const alreadySaved = existingRooms.some(
        (room: SavedRoom) => room.roomId === roomId
      );

      if (alreadySaved) {
        console.log("⚠️ Room already in saved list, updating lastAccessed");
        // Update lastAccessed timestamp
        await updateRoomLastAccessed(userId, roomId);
        return;
      }
    }

    const newSavedRoom: SavedRoom = {
      roomId,
      customName: roomId, // Default to roomId
      addedAt: Timestamp.now(),
      isCreator,
      lastAccessed: Timestamp.now(),
      roomType,
    };

    // Add to savedRooms array (create document if doesn't exist)
    await setDoc(
      userRoomsRef,
      {
        savedRooms: arrayUnion(newSavedRoom),
      },
      { merge: true }
    );

    console.log("✅ Room saved to user's list:", roomId);
  } catch (error: any) {
    console.error("❌ Failed to save room to list:", error);
    throw error;
  }
}

/**
 * Remove room from user's saved list
 * NOTE: Does NOT delete the actual room from Firestore
 */
export async function removeRoomFromList(
  userId: string,
  roomId: string
): Promise<void> {
  if (!userId || !roomId) {
    throw new Error("User ID and Room ID are required");
  }

  const userRoomsRef = doc(db, "userRooms", userId);

  try {
    const userRoomsDoc = await getDoc(userRoomsRef);

    if (!userRoomsDoc.exists()) {
      console.log("⚠️ No saved rooms found for user");
      return;
    }

    const savedRooms = userRoomsDoc.data().savedRooms || [];
    const roomToRemove = savedRooms.find(
      (room: SavedRoom) => room.roomId === roomId
    );

    if (!roomToRemove) {
      console.log("⚠️ Room not in saved list");
      return;
    }

    // Remove from array
    await updateDoc(userRoomsRef, {
      savedRooms: arrayRemove(roomToRemove),
    });

    console.log("✅ Room removed from saved list:", roomId);
  } catch (error: any) {
    console.error("❌ Failed to remove room from list:", error);
    throw error;
  }
}

/**
 * Update room's custom name
 */
export async function updateRoomName(
  userId: string,
  roomId: string,
  newName: string
): Promise<void> {
  if (!userId || !roomId || !newName) {
    throw new Error("User ID, Room ID, and new name are required");
  }

  const userRoomsRef = doc(db, "userRooms", userId);

  try {
    const userRoomsDoc = await getDoc(userRoomsRef);

    if (!userRoomsDoc.exists()) {
      throw new Error("No saved rooms found");
    }

    const savedRooms = userRoomsDoc.data().savedRooms || [];
    const updatedRooms = savedRooms.map((room: SavedRoom) =>
      room.roomId === roomId ? { ...room, customName: newName } : room
    );

    await updateDoc(userRoomsRef, {
      savedRooms: updatedRooms,
    });

    console.log("✅ Room name updated:", { roomId, newName });
  } catch (error: any) {
    console.error("❌ Failed to update room name:", error);
    throw error;
  }
}

/**
 * Update lastAccessed timestamp for a room
 */
export async function updateRoomLastAccessed(
  userId: string,
  roomId: string
): Promise<void> {
  if (!userId || !roomId) return;

  const userRoomsRef = doc(db, "userRooms", userId);

  try {
    const userRoomsDoc = await getDoc(userRoomsRef);

    if (!userRoomsDoc.exists()) {
      console.log("⚠️ No saved rooms found for user");
      return;
    }

    const savedRooms = userRoomsDoc.data().savedRooms || [];
    const updatedRooms = savedRooms.map((room: SavedRoom) =>
      room.roomId === roomId ? { ...room, lastAccessed: Timestamp.now() } : room
    );

    await updateDoc(userRoomsRef, {
      savedRooms: updatedRooms,
    });

    console.log("✅ Room lastAccessed updated:", roomId);
  } catch (error: any) {
    console.error("❌ Failed to update lastAccessed:", error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Get all saved rooms for a user
 */
export async function getUserRooms(userId: string): Promise<SavedRoom[]> {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const userRoomsRef = doc(db, "userRooms", userId);

  try {
    const userRoomsDoc = await getDoc(userRoomsRef);

    if (!userRoomsDoc.exists()) {
      console.log("⚠️ No saved rooms found for user");
      return [];
    }

    const savedRooms = userRoomsDoc.data().savedRooms || [];

    // Sort by lastAccessed (most recent first)
    return savedRooms.sort(
      (a: SavedRoom, b: SavedRoom) =>
        b.lastAccessed.toMillis() - a.lastAccessed.toMillis()
    );
  } catch (error: any) {
    console.error("❌ Failed to get user rooms:", error);
    throw error;
  }
}

/**
 * Check if room exists in Firestore
 */
export async function checkRoomExists(roomId: string): Promise<boolean> {
  if (!roomId) return false;

  try {
    const roomRef = doc(db, "rooms", roomId);
    const roomDoc = await getDoc(roomRef);
    return roomDoc.exists();
  } catch (error) {
    console.error("❌ Failed to check room existence:", error);
    return false;
  }
}

/**
 * Subscribe to user's saved rooms (real-time updates)
 */
export function subscribeToUserRooms(
  userId: string,
  callback: (rooms: SavedRoom[]) => void
): () => void {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const userRoomsRef = doc(db, "userRooms", userId);

  return onSnapshot(
    userRoomsRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const savedRooms = snapshot.data().savedRooms || [];

        // Sort by lastAccessed (most recent first)
        const sortedRooms = savedRooms.sort(
          (a: SavedRoom, b: SavedRoom) =>
            b.lastAccessed.toMillis() - a.lastAccessed.toMillis()
        );

        callback(sortedRooms);
      } else {
        callback([]);
      }
    },
    (error) => {
      console.error("❌ Firestore subscription error:", error);
      callback([]);
    }
  );
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
