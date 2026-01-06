// src/types/room.ts

import { Timestamp } from "firebase/firestore";

/**
 * Represents a saved room in user's personal collection
 */
export interface SavedRoom {
  roomId: string; // Reference to rooms collection
  customName: string; // User-defined name (default: roomId)
  addedAt: Timestamp; // When user saved this room
  isCreator: boolean; // Did this user create the room?
  lastAccessed: Timestamp; // Track recent activity
  roomType: "public" | "rbac"; // For UI indication
}

/**
 * User's saved rooms document structure
 */
export interface UserRoomsDocument {
  savedRooms: SavedRoom[];
}

/**
 * Room metadata for display purposes
 */
export interface RoomDisplayData extends SavedRoom {
  exists: boolean; // Does the room still exist in Firestore?
  relativeTime: string; // "2 hours ago", "3 days ago", etc.
}

/**
 * Filter options for saved rooms
 */
export type RoomFilterType = "all" | "public" | "rbac" | "created";

/**
 * Sort options for saved rooms
 */
export type RoomSortType = "lastAccessed" | "addedAt" | "name";
