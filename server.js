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

  // 1. Canvas History
  const roomHistory = {};

  // 2. Boards History (Text/Sticky Notes)
  const boardHistory = {};

  // 3. NEW: Images History (Separate Storage)
  const imageHistory = {};

  io.on("connection", (socket) => {
    console.log("socket connected", socket.id);

    socket.on("userJoined", ({ userId, roomId }) => {
      const userData = { id: userId, roomId, socketId: socket.id };
      userJoin(userData);
      socket.join(roomId);

      const roomUsers = getUsers(roomId);

      // INITIALIZE STATES
      if (!roomHistory[roomId]) roomHistory[roomId] = { history: [], step: -1 };
      if (!boardHistory[roomId]) boardHistory[roomId] = [];

      // Initialize Image Array
      if (!imageHistory[roomId]) imageHistory[roomId] = [];

      socket.emit("userIsJoined", { success: true, users: roomUsers });
      socket.broadcast.to(roomId).emit("allUsers", roomUsers);

      //  SYNC CANVAS
      const room = roomHistory[roomId];
      let currentImage = null;
      if (room.step >= 0 && room.history[room.step]) {
        currentImage = room.history[room.step];
      }
      socket.emit("draw", { roomId, image: currentImage });

      //SYNC BOARDS
      socket.emit("boards:sync", boardHistory[roomId]);

      //  NEW: SYNC IMAGES
      socket.emit("images:sync", imageHistory[roomId]);

      console.log("userJoined", userId, roomId);
    });

    // CANVAS EVENTS
    socket.on("draw", ({ roomId, image }) => {
      if (!roomHistory[roomId]) return;
      const room = roomHistory[roomId];
      const newStep = room.step + 1;
      room.history = room.history.slice(0, newStep);
      room.history.push(image);
      room.step = newStep;
      io.to(roomId).emit("draw", { roomId, image });
    });

    socket.on("undo", ({ roomId }) => {
      if (!roomHistory[roomId]) return;
      const room = roomHistory[roomId];
      if (room.step > 0) {
        room.step -= 1;
        const prevImage = room.history[room.step];
        io.to(roomId).emit("draw", { roomId, image: prevImage });
      } else if (room.step === 0) {
        room.step = -1;
        io.to(roomId).emit("draw", { roomId, image: null });
      }
    });

    socket.on("redo", ({ roomId }) => {
      if (!roomHistory[roomId]) return;
      const room = roomHistory[roomId];
      if (room.step < room.history.length - 1) {
        room.step += 1;
        const nextImage = room.history[room.step];
        io.to(roomId).emit("draw", { roomId, image: nextImage });
      }
    });

    //BOARD MANAGEMENT EVENTS
    socket.on("board:add", ({ roomId, boardData }) => {
      if (!boardHistory[roomId]) boardHistory[roomId] = [];
      boardHistory[roomId].push(boardData);
      io.to(roomId).emit("board:add", boardData);
    });

    socket.on("board:update", ({ roomId, boardData }) => {
      if (!boardHistory[roomId]) return;
      const index = boardHistory[roomId].findIndex(
        (b) => b.id === boardData.id
      );
      if (index !== -1) {
        boardHistory[roomId][index] = boardData;
        io.to(roomId).emit("board:update", boardData);
      }
    });

    socket.on("board:delete", ({ roomId, boardId }) => {
      if (!boardHistory[roomId]) return;
      boardHistory[roomId] = boardHistory[roomId].filter(
        (b) => b.id !== boardId
      );
      io.to(roomId).emit("board:delete", boardId);
    });

    //  NEW: IMAGE MANAGEMENT EVENTS (Separate)

    // 1. Add Image
    socket.on("image:add", ({ roomId, imageData }) => {
      if (!imageHistory[roomId]) imageHistory[roomId] = [];
      imageHistory[roomId].push(imageData);
      io.to(roomId).emit("image:add", imageData);
    });

    // 2. Update Image
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

    // 3. Delete Image
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
