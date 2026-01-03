// src/app/room/[roomId]/hooks/useSync.ts

import { useEffect } from "react";
import type { BoardData } from "../types";
import { CanvasStroke, CanvasDimensions } from "../types/canvas";
import type { CRDTManager } from "../utils/crdt";
import { socket } from "@/app/lib/socket";

interface UseSyncProps {
  roomId: string;
  userEmail: string;
  crdtRef: React.RefObject<CRDTManager | null>;
  setCanvasStrokes: React.Dispatch<React.SetStateAction<CanvasStroke[]>>;
  setCanvasDimensions: React.Dispatch<React.SetStateAction<CanvasDimensions>>; // NEW
  setUsers: React.Dispatch<React.SetStateAction<any[]>>;
  setBoards: React.Dispatch<React.SetStateAction<BoardData[]>>;
  setImages: React.Dispatch<React.SetStateAction<BoardData[]>>;
}

export const useSync = ({
  roomId,
  userEmail,
  crdtRef,
  setCanvasStrokes,
  setCanvasDimensions,
  setUsers,
  setBoards,
  setImages,
}: UseSyncProps) => {
  useEffect(() => {
    if (!roomId || !crdtRef.current) return;

    if (!socket.connected) socket.connect();

    console.log(`Joining room ${roomId} as ${userEmail}`);
    socket.emit("userJoined", { userId: userEmail, roomId });

    // ===== CANVAS HANDLERS =====

    const handleCanvasStroke = (stroke: CanvasStroke) => {
      if (!crdtRef.current) return;

      console.log("📥 Received stroke from another user:", stroke.id);

      crdtRef.current.updateClock(stroke.vectorClock);

      setCanvasStrokes((prev) => {
        if (prev.find((s) => s.id === stroke.id)) {
          return prev;
        }
        return [...prev, stroke].sort((a, b) => a.timestamp - b.timestamp);
      });
    };

    const handleCanvasSync = (strokes: CanvasStroke[]) => {
      console.log("📥 Socket sync received:", strokes.length, "strokes");

      setCanvasStrokes((currentStrokes) => {
        if (strokes.length > currentStrokes.length) {
          console.log(
            `✅ Socket has MORE strokes (${strokes.length} vs ${currentStrokes.length}) - accepting socket data`
          );
          return strokes.sort((a, b) => a.timestamp - b.timestamp);
        }

        if (currentStrokes.length === 0 && strokes.length > 0) {
          console.log("✅ Accepting socket sync (no local strokes)");
          return strokes.sort((a, b) => a.timestamp - b.timestamp);
        }

        console.log(
          `⚠️ Keeping current strokes (${currentStrokes.length}) - socket has ${strokes.length}`
        );
        return currentStrokes;
      });
    };

    const handleCanvasClear = () => {
      console.log("🗑️ Canvas cleared by another user");
      setCanvasStrokes([]);
    };

    // NEW: Handle dimension sync and updates
    const handleDimensionsSync = (dimensions: CanvasDimensions) => {
      console.log("📥 Initial dimensions sync:", dimensions);
      setCanvasDimensions(dimensions);

      if (crdtRef.current) {
        crdtRef.current.updateClock(dimensions.vectorClock);
      }
    };

    const handleCanvasResize = (remoteDimensions: CanvasDimensions) => {
      if (!crdtRef.current) return;

      console.log("📥 Received canvas resize:", remoteDimensions);

      crdtRef.current.updateClock(remoteDimensions.vectorClock);

      setCanvasDimensions((currentDimensions) => {
        // Resolve conflict using CRDT
        const resolved = crdtRef.current!.resolveDimensionConflict(
          currentDimensions,
          remoteDimensions
        );

        console.log("📐 Resolved dimensions:", resolved);
        return resolved;
      });
    };

    // ===== USER LIST HANDLER =====

    const handleUserList = (data: any) => {
      const userList = Array.isArray(data) ? data : data.users;
      if (userList) setUsers(userList);
    };

    // ===== BOARD HANDLERS =====

    const handleBoardAdd = (boardData: BoardData) => {
      if (!crdtRef.current) return;

      console.log("📥 Received board:add:", {
        id: boardData.id,
        version: boardData.version,
        vectorClock: boardData.vectorClock,
      });

      crdtRef.current.updateClock(boardData.vectorClock);

      setBoards((prev) => {
        const exists = prev.find((b) => b.id === boardData.id);

        if (exists) {
          console.log("⚠️ Board already exists locally, resolving conflict");
          const resolved = crdtRef.current!.resolveConflict(exists, boardData);
          return prev.map((b) => (b.id === boardData.id ? resolved : b));
        }

        return [...prev, boardData];
      });
    };

    const handleBoardUpdate = (boardData: BoardData) => {
      if (!crdtRef.current) return;

      console.log("📥 Received board:update:", {
        id: boardData.id,
        version: boardData.version,
        vectorClock: boardData.vectorClock,
      });

      crdtRef.current.updateClock(boardData.vectorClock);

      setBoards((prev) => {
        const local = prev.find((b) => b.id === boardData.id);

        if (!local) {
          console.warn("⚠️ Received update for unknown board, adding it");
          return [...prev, boardData];
        }

        const resolved = crdtRef.current!.resolveConflict(local, boardData);

        if (resolved === local) {
          return prev;
        }

        return prev.map((b) => (b.id === boardData.id ? resolved : b));
      });
    };

    const handleBoardDelete = (boardId: string | number) => {
      console.log("📥 Received board:delete:", boardId);
      setBoards((prev) => prev.filter((b) => b.id !== boardId));
    };

    // ===== IMAGE HANDLERS =====

    const handleImageAdd = (imageData: BoardData) => {
      if (!crdtRef.current) return;

      console.log("📥 Received image:add:", {
        id: imageData.id,
        version: imageData.version,
      });

      crdtRef.current.updateClock(imageData.vectorClock);

      setImages((prev) => {
        const exists = prev.find((i) => i.id === imageData.id);

        if (exists) {
          const resolved = crdtRef.current!.resolveConflict(exists, imageData);
          return prev.map((i) => (i.id === imageData.id ? resolved : i));
        }

        return [...prev, imageData];
      });
    };

    const handleImageUpdate = (imageData: BoardData) => {
      if (!crdtRef.current) return;

      console.log("📥 Received image:update:", {
        id: imageData.id,
        version: imageData.version,
      });

      crdtRef.current.updateClock(imageData.vectorClock);

      setImages((prev) => {
        const local = prev.find((i) => i.id === imageData.id);

        if (!local) {
          return [...prev, imageData];
        }

        const resolved = crdtRef.current!.resolveConflict(local, imageData);
        return prev.map((i) => (i.id === imageData.id ? resolved : i));
      });
    };

    const handleImageDelete = (imageId: string | number) => {
      console.log("📥 Received image:delete:", imageId);
      setImages((prev) => prev.filter((i) => i.id !== imageId));
    };

    const handleBoardFocus = ({ boardId, userId }: any) => {
      if (userId !== userEmail) {
        console.log(`🔒 ${userId} is now editing board ${boardId}`);
      }
    };

    // ===== REGISTER ALL LISTENERS =====
    socket.on("board:focus", handleBoardFocus);
    socket.on("canvas:stroke", handleCanvasStroke);
    socket.on("canvas:sync", handleCanvasSync);
    socket.on("canvas:clear", handleCanvasClear);
    socket.on("canvas:dimensions:sync", handleDimensionsSync); // NEW
    socket.on("canvas:resize", handleCanvasResize); // NEW
    socket.on("userIsJoined", handleUserList);
    socket.on("allUsers", handleUserList);
    socket.on("board:add", handleBoardAdd);
    socket.on("board:update", handleBoardUpdate);
    socket.on("board:delete", handleBoardDelete);
    socket.on("image:add", handleImageAdd);
    socket.on("image:update", handleImageUpdate);
    socket.on("image:delete", handleImageDelete);

    // ===== CLEANUP =====

    return () => {
      socket.off("canvas:stroke", handleCanvasStroke);
      socket.off("canvas:sync", handleCanvasSync);
      socket.off("canvas:clear", handleCanvasClear);
      socket.off("canvas:dimensions:sync", handleDimensionsSync);
      socket.off("canvas:resize", handleCanvasResize);
      socket.off("userIsJoined", handleUserList);
      socket.off("allUsers", handleUserList);
      socket.off("board:add", handleBoardAdd);
      socket.off("board:update", handleBoardUpdate);
      socket.off("board:delete", handleBoardDelete);
      socket.off("image:add", handleImageAdd);
      socket.off("image:update", handleImageUpdate);
      socket.off("image:delete", handleImageDelete);
      socket.off("board:focus", handleBoardFocus);
      socket.disconnect();
    };
  }, [roomId, userEmail]);
};
