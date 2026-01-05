// src/lib/validation/socketMiddleware.ts
import { Socket } from "socket.io";
import {
  validateSocketEvent,
  SocketEventName,
  ValidationResult,
} from "./socketSchemas.js";

// ==========================================
// VALIDATION MIDDLEWARE
// ==========================================

/**
 * Creates a validated socket event handler
 * @param eventName - The socket event name
 * @param handler - The handler function to execute after validation
 * @returns Wrapped handler with validation
 */
export function createValidatedHandler<T extends SocketEventName>(
  eventName: T,
  handler: (
    socket: Socket,
    data: any,
    callback?: Function
  ) => void | Promise<void>
) {
  return async (socket: Socket, data: unknown, callback?: Function) => {
    // Validate the incoming data
    const validation = validateSocketEvent(eventName, data);
    const errorMsg =
      "error" in validation ? validation.error : "Unknown validation error";
    if (!validation.success) {
      // Log validation failure (don't expose internal details to client)
      console.error(`❌ Validation failed for ${eventName}:`, {
        socketId: socket.id,
        error: errorMsg,
        receivedData: JSON.stringify(data).substring(0, 200), // Truncate for logging
      });

      // Send safe error response to client
      if (callback && typeof callback === "function") {
        callback({
          success: false,
          error: "Invalid request data. Please check your input.",
        });
      } else {
        socket.emit("error", {
          event: eventName,
          message: "Invalid request data",
        });
      }

      return;
    }

    // Data is valid, proceed with handler
    try {
      await handler(socket, validation.data, callback);
    } catch (error) {
      console.error(`❌ Handler error for ${eventName}:`, {
        socketId: socket.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      if (callback && typeof callback === "function") {
        callback({
          success: false,
          error: "An error occurred processing your request",
        });
      }
    }
  };
}

// ==========================================
// HELPER: Register validated handler
// ==========================================

/**
 * Helper to register a validated socket handler
 * @param socket - The Socket.IO socket instance
 * @param eventName - The event name to listen for
 * @param handler - The handler function
 */
export function onValidated<T extends SocketEventName>(
  socket: Socket,
  eventName: T,
  handler: (
    socket: Socket,
    data: any,
    callback?: Function
  ) => void | Promise<void>
) {
  const validatedHandler = createValidatedHandler(eventName, handler);
  socket.on(eventName as string, (...args: any[]) => {
    const data = args[0];
    const callback = typeof args[1] === "function" ? args[1] : undefined;
    validatedHandler(socket, data, callback);
  });
}

// ==========================================
// RATE LIMITING (Optional Enhancement)
// ==========================================

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const rateLimitStore = new Map<string, number[]>();

/**
 * Simple rate limiting for socket events
 * @param socketId - The socket ID
 * @param eventName - The event name
 * @param config - Rate limit configuration
 * @returns true if rate limit exceeded, false otherwise
 */
export function isRateLimited(
  socketId: string,
  eventName: string,
  config: RateLimitConfig = { maxRequests: 100, windowMs: 60000 }
): boolean {
  const key = `${socketId}:${eventName}`;
  const now = Date.now();

  // Get or create timestamp array for this key
  let timestamps = rateLimitStore.get(key) || [];

  // Remove timestamps outside the window
  timestamps = timestamps.filter((ts) => now - ts < config.windowMs);

  // Check if limit exceeded
  if (timestamps.length >= config.maxRequests) {
    return true;
  }

  // Add current timestamp
  timestamps.push(now);
  rateLimitStore.set(key, timestamps);

  return false;
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 300000; // 5 minutes

  for (const [key, timestamps] of rateLimitStore.entries()) {
    const filtered = timestamps.filter((ts) => now - ts < maxAge);
    if (filtered.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, filtered);
    }
  }
}, 300000);
