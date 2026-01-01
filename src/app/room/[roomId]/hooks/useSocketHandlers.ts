// src/app/room/[roomId]/hooks/useSocketHandlers.ts

import { useEffect } from "react";
import { socket } from "@/app/lib/socket";
import type { CanvasStroke } from "../types/canvas";
import type { BoardData } from "../types";
import type { CRDTManager } from "../utils/crdt";

interface UseSocketHandlersProps {
  roomId: string;
  userEmail: string;
  crdtManager: CRDTManager | null;
  onCanvasStroke: (stroke: CanvasStroke) => void;
  onCanvasSync: (strokes: CanvasStroke[]) => void;
  onCanvasClear: () => void;
  onCanvasExpand: (data: {
    newSize: { width: number; height: number };
    offset: { x: number; y: number };
  }) => void;
  onBoardAdd: (board: BoardData) => void;
  onBoardUpdate: (board: BoardData) => void;
  onBoardDelete: (boardId: string | number) => void;
  onImageAdd: (image: BoardData) => void;
  onImageUpdate: (image: BoardData) => void;
  onImageDelete: (imageId: string | number) => void;
  onUserListUpdate: (users: any[]) => void;
}

export function useSocketHandlers({
  roomId,
  userEmail,
  crdtManager,
  onCanvasStroke,
  onCanvasSync,
  onCanvasClear,
  onCanvasExpand,
  onBoardAdd,
  onBoardUpdate,
  onBoardDelete,
  onImageAdd,
  onImageUpdate,
  onImageDelete,
  onUserListUpdate,
}: UseSocketHandlersProps) {
  useEffect(() => {
    if (!roomId || !crdtManager) return;

    if (!socket.connected) socket.connect();

    console.log(`Joining room ${roomId} as ${userEmail}`);
    socket.emit("userJoined", { userId: userEmail, roomId });

    // Canvas handlers
    const handleCanvasStroke = (stroke: CanvasStroke) => {
      console.log("📥 Received stroke from another user:", stroke.id);
      crdtManager.updateClock(stroke.vectorClock);
      onCanvasStroke(stroke);
    };

    const handleCanvasSync = (strokes: CanvasStroke[]) => {
      console.log("📥 Socket sync received:", strokes.length, "strokes");
      onCanvasSync(strokes);
    };

    const handleCanvasClear = () => {
      console.log("🗑️ Canvas cleared by another user");
      onCanvasClear();
    };

    const handleCanvasExpand = (data: {
      newSize: { width: number; height: number };
      offset: { x: number; y: number };
    }) => {
      console.log("📥 Canvas expansion received from another user");
      onCanvasExpand(data);
    };

    // Board handlers
    const handleBoardAdd = (boardData: BoardData) => {
      console.log("📥 Received board:add:", {
        id: boardData.id,
        version: boardData.version,
      });
      crdtManager.updateClock(boardData.vectorClock);
      onBoardAdd(boardData);
    };

    const handleBoardUpdate = (boardData: BoardData) => {
      console.log("📥 Received board:update:", {
        id: boardData.id,
        version: boardData.version,
      });
      crdtManager.updateClock(boardData.vectorClock);
      onBoardUpdate(boardData);
    };

    const handleBoardDelete = (boardId: string | number) => {
      console.log("📥 Received board:delete:", boardId);
      onBoardDelete(boardId);
    };

    // Image handlers
    const handleImageAdd = (imageData: BoardData) => {
      console.log("📥 Received image:add:", {
        id: imageData.id,
        version: imageData.version,
      });
      crdtManager.updateClock(imageData.vectorClock);
      onImageAdd(imageData);
    };

    const handleImageUpdate = (imageData: BoardData) => {
      console.log("📥 Received image:update:", {
        id: imageData.id,
        version: imageData.version,
      });
      crdtManager.updateClock(imageData.vectorClock);
      onImageUpdate(imageData);
    };

    const handleImageDelete = (imageId: string | number) => {
      console.log("📥 Received image:delete:", imageId);
      onImageDelete(imageId);
    };

    // User list handler
    const handleUserList = (data: any) => {
      const userList = Array.isArray(data) ? data : data.users;
      if (userList) onUserListUpdate(userList);
    };

    // Register all listeners
    socket.on("canvas:stroke", handleCanvasStroke);
    socket.on("canvas:sync", handleCanvasSync);
    socket.on("canvas:clear", handleCanvasClear);
    socket.on("canvas:expand", handleCanvasExpand);
    socket.on("userIsJoined", handleUserList);
    socket.on("allUsers", handleUserList);
    socket.on("board:add", handleBoardAdd);
    socket.on("board:update", handleBoardUpdate);
    socket.on("board:delete", handleBoardDelete);
    socket.on("image:add", handleImageAdd);
    socket.on("image:update", handleImageUpdate);
    socket.on("image:delete", handleImageDelete);

    return () => {
      socket.off("canvas:stroke", handleCanvasStroke);
      socket.off("canvas:sync", handleCanvasSync);
      socket.off("canvas:clear", handleCanvasClear);
      socket.off("canvas:expand", handleCanvasExpand);
      socket.off("userIsJoined", handleUserList);
      socket.off("allUsers", handleUserList);
      socket.off("board:add", handleBoardAdd);
      socket.off("board:update", handleBoardUpdate);
      socket.off("board:delete", handleBoardDelete);
      socket.off("image:add", handleImageAdd);
      socket.off("image:update", handleImageUpdate);
      socket.off("image:delete", handleImageDelete);
      socket.disconnect();
    };
  }, [
    roomId,
    userEmail,
    crdtManager,
    onCanvasStroke,
    onCanvasSync,
    onCanvasClear,
    onCanvasExpand,
    onBoardAdd,
    onBoardUpdate,
    onBoardDelete,
    onImageAdd,
    onImageUpdate,
    onImageDelete,
    onUserListUpdate,
  ]);
}
