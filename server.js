// server.js - FIXED VERSION with proper environment variable loading

import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { userJoin, userLeave, getUsers } from "./src/utils/user.js";
import crypto from "crypto";
import admin from "firebase-admin";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// 🔥 FIX 1: Load environment variables manually for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local file
dotenv.config({ path: join(__dirname, ".env.local") });

console.log("🔍 Checking environment variables:");
console.log(
  "FIREBASE_PROJECT_ID:",
  process.env.FIREBASE_PROJECT_ID ? "✅ Loaded" : "❌ Missing"
);
console.log(
  "FIREBASE_CLIENT_EMAIL:",
  process.env.FIREBASE_CLIENT_EMAIL ? "✅ Loaded" : "❌ Missing"
);
console.log(
  "FIREBASE_PRIVATE_KEY:",
  process.env.FIREBASE_PRIVATE_KEY ? "✅ Loaded" : "❌ Missing"
);

// ==========================================
// FIREBASE ADMIN SETUP
// ==========================================

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!privateKey) {
      throw new Error("FIREBASE_PRIVATE_KEY is not set in .env.local");
    }

    // 🔥 FIX 2: Ensure private key has proper newlines
    const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");

    console.log(
      "🔑 Private key loaded, first 50 chars:",
      formattedPrivateKey.substring(0, 50)
    );

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedPrivateKey, // Use formatted key
      }),
    });

    console.log("✅ Firebase Admin initialized successfully");
  } catch (error) {
    console.error("❌ Firebase Admin initialization failed:", error.message);
    console.log("⚠️  Admin key verification will not work!");
    console.log("📝 Please check your .env.local file");
  }
}

// Get Firestore instance
let db;
try {
  db = admin.firestore();
  console.log("✅ Firestore instance created");
} catch (error) {
  console.error("❌ Firestore initialization failed:", error.message);
}

// Helper function to hash admin key (must match client-side hashing)
function hashAdminKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

// ==========================================
// NEXT.JS SERVER SETUP
// ==========================================

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  // Storage
  const roomHistory = {}; // { roomId: { strokes: [], dimensions: {...} } }
  const boardHistory = {};
  const imageHistory = {};

  // 🔥 Track user roles per socket
  const userRoles = {}; // { socketId: { roomId, role, userId } }

  io.on("connection", (socket) => {
    console.log("✅ Socket connected:", socket.id);

    // ==========================================
    // 🔥 ADMIN KEY VERIFICATION HANDLER
    // ==========================================
    socket.on("room:verify-admin", async ({ roomId, inputKey }, callback) => {
      try {
        console.log("🔐 Verifying admin key for room:", roomId);

        // 🔥 FIX 3: Check if db is available
        if (!db) {
          console.error("❌ Firestore not initialized");
          return callback({
            success: false,
            error: "Server configuration error. Please contact administrator.",
          });
        }

        if (!inputKey || typeof inputKey !== "string") {
          console.log("❌ Invalid key format");
          return callback({
            success: false,
            error: "Invalid admin key format",
          });
        }

        // Fetch room from Firestore
        const roomRef = db.collection("rooms").doc(roomId);
        const roomDoc = await roomRef.get();

        if (!roomDoc.exists) {
          console.log("❌ Room not found:", roomId);
          return callback({
            success: false,
            error: "Room not found",
          });
        }

        const roomData = roomDoc.data();

        // Check if room is role-based
        if (!roomData?.isRoleBased) {
          console.log("⚠️  Room is not role-based");
          return callback({
            success: false,
            error: "This room doesn't require admin verification",
          });
        }

        // Hash the input key
        const inputKeyHash = hashAdminKey(inputKey);
        const storedHash = roomData.adminKeyHash;

        console.log("🔍 Comparing hashes:", {
          inputHash: inputKeyHash.substring(0, 10) + "...",
          storedHash: storedHash?.substring(0, 10) + "...",
          match: inputKeyHash === storedHash,
        });

        // Compare with stored hash
        if (inputKeyHash === storedHash) {
          console.log("✅ Admin key verified successfully for room:", roomId);

          // Store verified admin role
          userRoles[socket.id] = {
            ...userRoles[socket.id],
            role: "admin",
            roomId,
          };

          return callback({
            success: true,
          });
        } else {
          console.log("❌ Invalid admin key for room:", roomId);
          return callback({
            success: false,
            error: "Invalid admin key",
          });
        }
      } catch (error) {
        console.error("❌ Admin verification error:", error);
        return callback({
          success: false,
          error: "Verification failed. Please try again.",
        });
      }
    });

    // ==========================================
    // 🔥 USER JOIN (with role tracking)
    // ==========================================
    socket.on("userJoined", ({ userId, roomId, role }) => {
      const userData = {
        id: userId,
        roomId,
        socketId: socket.id,
        role: role || "admin",
      };
      userJoin(userData);
      socket.join(roomId);

      // 🔥 Store user role
      userRoles[socket.id] = { roomId, role: role || "admin", userId };

      const roomUsers = getUsers(roomId);

      // Initialize room data
      if (!roomHistory[roomId]) {
        roomHistory[roomId] = {
          strokes: [],
          dimensions: {
            width: 1920,
            height: 1080,
            version: 0,
            lastModifiedBy: "system",
            lastModifiedAt: Date.now(),
            vectorClock: {},
          },
        };
      }
      if (!boardHistory[roomId]) boardHistory[roomId] = [];
      if (!imageHistory[roomId]) imageHistory[roomId] = [];

      socket.emit("userIsJoined", { success: true, users: roomUsers });
      socket.broadcast.to(roomId).emit("allUsers", roomUsers);

      // Sync everything including dimensions
      socket.emit("boards:sync", boardHistory[roomId]);
      socket.emit("images:sync", imageHistory[roomId]);
      socket.emit("canvas:sync", roomHistory[roomId].strokes);
      socket.emit("canvas:dimensions:sync", roomHistory[roomId].dimensions);

      console.log(
        "👤 userJoined:",
        userId,
        roomId,
        `(${role || "admin"})`,
        "Strokes:",
        roomHistory[roomId].strokes.length,
        "Canvas:",
        `${roomHistory[roomId].dimensions.width}x${roomHistory[roomId].dimensions.height}`
      );
    });

    // ==========================================
    // 🔥 HELPER: Check if user is admin
    // ==========================================
    const isAdmin = (socketId) => {
      const userRole = userRoles[socketId]?.role;
      return userRole === "admin";
    };

    // ==========================================
    // 🔥 PROTECTED: CANVAS OPERATIONS (admin only)
    // ==========================================

    socket.on("canvas:stroke", ({ roomId, stroke }) => {
      if (!isAdmin(socket.id)) {
        console.log("🚫 Blocked canvas:stroke from viewer");
        return;
      }

      if (!roomHistory[roomId])
        roomHistory[roomId] = { strokes: [], dimensions: {} };

      roomHistory[roomId].strokes.push(stroke);
      console.log(
        "🖊 Stroke added. Room now has",
        roomHistory[roomId].strokes.length,
        "strokes"
      );

      socket.broadcast.to(roomId).emit("canvas:stroke", stroke);
    });

    socket.on("canvas:clear", ({ roomId }) => {
      if (!isAdmin(socket.id)) {
        console.log("🚫 Blocked canvas:clear from viewer");
        return;
      }

      if (!roomHistory[roomId])
        roomHistory[roomId] = { strokes: [], dimensions: {} };

      roomHistory[roomId].strokes = [];
      console.log("🗑️ Canvas cleared for room", roomId);

      io.to(roomId).emit("canvas:clear");
    });

    socket.on("canvas:undo", ({ roomId, strokeId }) => {
      if (!isAdmin(socket.id)) {
        console.log("🚫 Blocked canvas:undo from viewer");
        return;
      }

      if (!roomHistory[roomId]) return;

      roomHistory[roomId].strokes = roomHistory[roomId].strokes.filter(
        (s) => s.id !== strokeId
      );

      console.log(
        "↩️ Undo stroke. Room now has",
        roomHistory[roomId].strokes.length,
        "strokes"
      );

      io.to(roomId).emit("canvas:undo", strokeId);
    });

    socket.on("canvas:resize", ({ roomId, dimensions }) => {
      if (!isAdmin(socket.id)) {
        console.log("🚫 Blocked canvas:resize from viewer");
        return;
      }

      if (!roomHistory[roomId]) return;

      const currentDimensions = roomHistory[roomId].dimensions;

      const mergedDimensions = {
        width: Math.max(currentDimensions.width, dimensions.width),
        height: Math.max(currentDimensions.height, dimensions.height),
        version: Math.max(currentDimensions.version || 0, dimensions.version),
        lastModifiedBy: dimensions.lastModifiedBy,
        lastModifiedAt: Math.max(
          currentDimensions.lastModifiedAt || 0,
          dimensions.lastModifiedAt
        ),
        vectorClock: dimensions.vectorClock,
      };

      roomHistory[roomId].dimensions = mergedDimensions;

      console.log(
        "📐 Canvas resized for room",
        roomId,
        `${mergedDimensions.width}x${mergedDimensions.height}`
      );

      io.to(roomId).emit("canvas:resize", mergedDimensions);
    });

    // ==========================================
    // 🔥 PROTECTED: BOARD OPERATIONS (admin only)
    // ==========================================

    socket.on("board:add", ({ roomId, boardData }) => {
      if (!isAdmin(socket.id)) {
        console.log("🚫 Blocked board:add from viewer");
        return;
      }

      if (!boardHistory[roomId]) boardHistory[roomId] = [];
      boardHistory[roomId].push(boardData);
      io.to(roomId).emit("board:add", boardData);
    });

    const boardUpdateBuffers = {};

    socket.on("board:update", ({ roomId, boardData }) => {
      if (!isAdmin(socket.id)) {
        console.log("🚫 Blocked board:update from viewer");
        return;
      }

      if (!boardHistory[roomId]) return;

      if (!boardUpdateBuffers[roomId]) boardUpdateBuffers[roomId] = {};
      if (!boardUpdateBuffers[roomId][boardData.id]) {
        boardUpdateBuffers[roomId][boardData.id] = [];
      }

      const buffer = boardUpdateBuffers[roomId][boardData.id];
      buffer.push(boardData);

      buffer.sort((a, b) => a.sequence - b.sequence);

      const latestUpdate = buffer[buffer.length - 1];

      const index = boardHistory[roomId].findIndex(
        (b) => b.id === boardData.id
      );
      if (index !== -1) {
        if (
          latestUpdate.sequence > (boardHistory[roomId][index].sequence || 0)
        ) {
          boardHistory[roomId][index] = latestUpdate;
          io.to(roomId).emit("board:update", latestUpdate);
        }
      }

      setTimeout(() => {
        boardUpdateBuffers[roomId][boardData.id] = [];
      }, 5000);
    });

    socket.on("board:delete", ({ roomId, boardId }) => {
      if (!isAdmin(socket.id)) {
        console.log("🚫 Blocked board:delete from viewer");
        return;
      }

      if (!boardHistory[roomId]) return;
      boardHistory[roomId] = boardHistory[roomId].filter(
        (b) => b.id !== boardId
      );
      io.to(roomId).emit("board:delete", boardId);
    });

    // ==========================================
    // 🔥 PROTECTED: IMAGE OPERATIONS (admin only)
    // ==========================================

    socket.on("image:add", ({ roomId, imageData }) => {
      if (!isAdmin(socket.id)) {
        console.log("🚫 Blocked image:add from viewer");
        return;
      }

      if (!imageHistory[roomId]) imageHistory[roomId] = [];
      imageHistory[roomId].push(imageData);
      io.to(roomId).emit("image:add", imageData);
    });

    socket.on("image:update", ({ roomId, imageData }) => {
      if (!isAdmin(socket.id)) {
        console.log("🚫 Blocked image:update from viewer");
        return;
      }

      if (!imageHistory[roomId]) return;
      const index = imageHistory[roomId].findIndex(
        (img) => img.id === imageData.id
      );
      if (index !== -1) {
        imageHistory[roomId][index] = imageData;
        io.to(roomId).emit("image:update", imageData);
      }
    });

    socket.on("image:delete", ({ roomId, imageId }) => {
      if (!isAdmin(socket.id)) {
        console.log("🚫 Blocked image:delete from viewer");
        return;
      }

      if (!imageHistory[roomId]) return;
      imageHistory[roomId] = imageHistory[roomId].filter(
        (img) => img.id !== imageId
      );
      io.to(roomId).emit("image:delete", imageId);
    });

    // ==========================================
    // DISCONNECT
    // ==========================================

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);

      delete userRoles[socket.id];

      const user = userLeave(socket.id);
      if (user) {
        const roomUsers = getUsers(user.roomId);
        io.to(user.roomId).emit("allUsers", roomUsers);
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`🚀 Server ready on http://${hostname}:${port}`);
    console.log(`📦 Environment: ${dev ? "development" : "production"}`);
  });
});
