// src/lib/validation/socketSchemas.ts
import { z } from "zod";
// ==========================================
// BASE SCHEMAS
// ==========================================
// Room ID: exactly 20 alphanumeric characters
const roomIdSchema = z
    .string()
    .length(20)
    .regex(/^[a-zA-Z0-9]{20}$/, "Room ID must be 20 alphanumeric characters");
// User ID: valid email format
const userIdSchema = z.string().email("Invalid user ID format");
// Admin key: 16-32 characters
const adminKeySchema = z
    .string()
    .min(16, "Admin key must be at least 16 characters")
    .max(32, "Admin key must not exceed 32 characters");
// User role enum
const userRoleSchema = z.enum(["admin", "viewer"]);
// ==========================================
// CANVAS SCHEMAS
// ==========================================
// Stroke point
const pointSchema = z.object({
    x: z.number().finite(),
    y: z.number().finite(),
});
// Stroke data
// Stroke data - UPDATE THIS
const strokeSchema = z.object({
    id: z.string().min(1),
    points: z.array(pointSchema).min(1),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
    width: z.number().positive().max(200),
    timestamp: z.number().positive(),
    userId: z.string().optional(),
    tool: z.string().optional(), // 🔥 ADD THIS
    vectorClock: z.record(z.string(), z.number()), // 🔥 ADD THIS (required by CRDT)
    version: z.number().int().nonnegative(), // 🔥 ADD THIS (required by CRDT)
});
// Canvas dimensions
const dimensionsSchema = z.object({
    width: z.number().int().positive().max(10000),
    height: z.number().int().positive().max(10000),
    version: z.number().int().nonnegative(),
    lastModifiedBy: z.string(),
    lastModifiedAt: z.number().positive(),
    vectorClock: z.record(z.string(), z.number()),
});
// ==========================================
// BOARD SCHEMAS
// ==========================================
const boardDataSchema = z.object({
    id: z.union([z.string(), z.number()]), // 🔥 CHANGE: Can be string or number
    x: z.number().finite().optional(), // 🔥 CHANGE: Make optional
    y: z.number().finite().optional(), // 🔥 CHANGE: Make optional
    width: z.number().positive().max(5000).optional(), // 🔥 CHANGE: Make optional
    height: z.number().positive().max(5000).optional(), // 🔥 CHANGE: Make optional
    content: z.string().max(100000).optional(), // 🔥 CHANGE: Make optional
    name: z.string().optional(), // 🔥 ADD THIS
    type: z.string().optional(), // 🔥 ADD THIS
    position: z
        .object({
        // 🔥 ADD THIS
        x: z.number(),
        y: z.number(),
    })
        .optional(),
    sequence: z.number().int().nonnegative().optional(),
    timestamp: z.number().positive().optional(),
    userId: z.string().optional(),
    version: z.number().int().nonnegative(), // 🔥 REQUIRED by CRDT
    lastModifiedBy: z.string(), // 🔥 REQUIRED by CRDT
    lastModifiedAt: z.number().positive(), // 🔥 REQUIRED by CRDT
    vectorClock: z.record(z.string(), z.number()), // 🔥 REQUIRED by CRDT
});
// ==========================================
// IMAGE SCHEMAS
// ==========================================
const imageDataSchema = z.object({
    id: z.union([z.string(), z.number()]),
    name: z.string().optional(),
    type: z.string().optional(),
    position: z.object({
        x: z.number().finite(),
        y: z.number().finite(),
    }),
    content: z.string(), // The base64 image data
    // CRDT fields
    version: z.number().int().nonnegative(),
    lastModifiedBy: z.string(),
    lastModifiedAt: z.number().positive(),
    vectorClock: z.record(z.string(), z.number()), // 🔥 REQUIRED by CRDT
    // Optional fields from board schema
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    src: z.string().optional(),
    rotation: z.number().finite().optional(),
    timestamp: z.number().positive().optional(),
    userId: z.string().optional(),
});
// ==========================================
// SOCKET EVENT SCHEMAS
// ==========================================
export const socketEventSchemas = {
    // Admin verification
    "room:verify-admin": z.object({
        roomId: roomIdSchema,
        inputKey: adminKeySchema,
    }),
    // User joined
    userJoined: z.object({
        userId: userIdSchema,
        roomId: roomIdSchema,
        role: userRoleSchema,
    }),
    // Canvas operations
    "canvas:stroke": z.object({
        roomId: roomIdSchema,
        stroke: strokeSchema,
    }),
    "canvas:clear": z.object({
        roomId: roomIdSchema,
    }),
    "canvas:undo": z.object({
        roomId: roomIdSchema,
        strokeId: z.string().min(1),
    }),
    "canvas:resize": z.object({
        roomId: roomIdSchema,
        dimensions: dimensionsSchema,
    }),
    // Board operations
    "board:add": z.object({
        roomId: roomIdSchema,
        boardData: boardDataSchema,
    }),
    "board:update": z.object({
        roomId: roomIdSchema,
        boardData: boardDataSchema,
    }),
    "board:delete": z.object({
        roomId: roomIdSchema,
        boardId: z.union([z.string(), z.number()]),
    }),
    // Image operations
    "image:add": z.object({
        roomId: roomIdSchema,
        imageData: imageDataSchema,
    }),
    "image:update": z.object({
        roomId: roomIdSchema,
        imageData: imageDataSchema,
    }),
    "image:delete": z.object({
        roomId: roomIdSchema,
        imageId: z.union([z.string(), z.number()]),
    }),
};
// ==========================================
// VALIDATION FUNCTION
// ==========================================
export function validateSocketEvent(eventName, data) {
    try {
        const schema = socketEventSchemas[eventName];
        const result = schema.safeParse(data);
        if (result.success) {
            return {
                success: true,
                data: result.data,
            };
        }
        else {
            // Format Zod errors into user-friendly message
            const errorMessage = result.error.issues
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("; ");
            return {
                success: false,
                error: `Validation failed: ${errorMessage}`,
            };
        }
    }
    catch (error) {
        return {
            success: false,
            error: "Invalid event data structure",
        };
    }
}
