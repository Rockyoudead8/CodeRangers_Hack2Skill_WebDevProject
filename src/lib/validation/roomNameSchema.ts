// src/lib/validation/roomNameSchema.ts

import { z } from "zod";

/**
 * Validation schema for room names
 *
 * Rules:
 * - Length: 1-50 characters
 * - Allowed: Letters (a-z, A-Z), numbers (0-9), spaces, hyphens (-), apostrophes (')
 * - NOT allowed: Special characters like !, @, #, $, %, ^, &, *, etc.
 */
export const roomNameSchema = z
  .string()
  .min(1, "Room name cannot be empty")
  .max(50, "Room name too long (max 50 characters)")
  .regex(
    /^[a-zA-Z0-9\s\-']+$/,
    "Only letters, numbers, spaces, hyphens, and apostrophes allowed"
  )
  .transform((val) => val.trim()); // Remove leading/trailing whitespace

/**
 * Validate room name and return result
 */
export function validateRoomName(name: string): {
  success: boolean;
  error?: string;
  data?: string;
} {
  const result = roomNameSchema.safeParse(name);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  } else {
    return {
      success: false,
      error: result.error.issues[0].message,
    };
  }
}

/**
 * Quick validation check (returns boolean only)
 */
export function isValidRoomName(name: string): boolean {
  return roomNameSchema.safeParse(name).success;
}
