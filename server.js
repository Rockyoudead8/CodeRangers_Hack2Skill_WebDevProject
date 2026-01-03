//server.js

import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { userJoin, userLeave, getUsers } from "./src/utils/user.js";

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

  io.on("connection", (socket) => {
    console.log("socket connected", socket.id);

    socket.on("userJoined", ({ userId, roomId }) => {
      const userData = { id: userId, roomId, socketId: socket.id };
      userJoin(userData);
      socket.join(roomId);

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
        "userJoined",
        userId,
        roomId,
        "Strokes:",
        roomHistory[roomId].strokes.length,
        "Canvas:",
        `${roomHistory[roomId].dimensions.width}x${roomHistory[roomId].dimensions.height}`
      );
    });

    // CANVAS STROKE
    socket.on("canvas:stroke", ({ roomId, stroke }) => {
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

    // CANVAS CLEAR
    socket.on("canvas:clear", ({ roomId }) => {
      if (!roomHistory[roomId])
        roomHistory[roomId] = { strokes: [], dimensions: {} };

      roomHistory[roomId].strokes = [];
      console.log("🗑️ Canvas cleared for room", roomId);

      io.to(roomId).emit("canvas:clear");
    });

    // CANVAS UNDO
    socket.on("canvas:undo", ({ roomId, strokeId }) => {
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

    // NEW: CANVAS RESIZE
    socket.on("canvas:resize", ({ roomId, dimensions }) => {
      if (!roomHistory[roomId]) return;

      const currentDimensions = roomHistory[roomId].dimensions;

      // Apply Max-Merge strategy on server side
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

      // Broadcast to all users including sender (to handle concurrent conflicts)
      io.to(roomId).emit("canvas:resize", mergedDimensions);
    });

    // BOARD EVENTS
    socket.on("board:add", ({ roomId, boardData }) => {
      if (!boardHistory[roomId]) boardHistory[roomId] = [];
      boardHistory[roomId].push(boardData);
      io.to(roomId).emit("board:add", boardData);
    });

    const boardUpdateBuffers = {};

    socket.on("board:update", ({ roomId, boardData }) => {
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
      if (!boardHistory[roomId]) return;
      boardHistory[roomId] = boardHistory[roomId].filter(
        (b) => b.id !== boardId
      );
      io.to(roomId).emit("board:delete", boardId);
    });

    // IMAGE EVENTS
    socket.on("image:add", ({ roomId, imageData }) => {
      if (!imageHistory[roomId]) imageHistory[roomId] = [];
      imageHistory[roomId].push(imageData);
      io.to(roomId).emit("image:add", imageData);
    });

    socket.on("image:update", ({ roomId, imageData }) => {
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
      if (!imageHistory[roomId]) return;
      imageHistory[roomId] = imageHistory[roomId].filter(
        (img) => img.id !== imageId
      );
      io.to(roomId).emit("image:delete", imageId);
    });

    socket.on("disconnect", () => {
      const user = userLeave(socket.id);
      if (user) {
        const roomUsers = getUsers(user.roomId);
        io.to(user.roomId).emit("allUsers", roomUsers);
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
