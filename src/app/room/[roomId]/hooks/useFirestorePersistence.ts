// src/app/room/[roomId]/hooks/useFirestorePersistence.ts

import { useEffect, useRef } from "react";
import { saveBoard, subscribeToBoard, getRoom } from "@/lib/roomService";
import type { CanvasStroke } from "../types/canvas";
import type { BoardData } from "../types";

interface UseFirestorePersistenceProps {
  roomId: string;
  canvasStrokes: CanvasStroke[];
  boards: BoardData[];
  images: BoardData[];
  canvasSize: { width: number; height: number };
  onLoadData: (data: any) => void;
}

export function useFirestorePersistence({
  roomId,
  canvasStrokes,
  boards,
  images,
  canvasSize,
  onLoadData,
}: UseFirestorePersistenceProps) {
  const isLoadingRef = useRef(false);
  const lastSaveRef = useRef(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial data and subscribe to changes
  useEffect(() => {
    if (!roomId) return;

    const loadInitialData = async () => {
      try {
        const roomData = await getRoom(roomId);
        if (roomData?.boardData) {
          console.log("📥 Loading initial data from Firestore");
          onLoadData(roomData.boardData);
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    };

    loadInitialData();

    const unsubscribe = subscribeToBoard(roomId, (data) => {
      if (!data) return;
      console.log("📥 Firestore update received");
      if (!isLoadingRef.current) {
        onLoadData(data);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [roomId, onLoadData]);

  // Save function
  const saveThrottled = (
    currentCanvasStrokes?: CanvasStroke[],
    currentBoards?: BoardData[],
    currentImages?: BoardData[]
  ) => {
    if (isLoadingRef.current) {
      console.log("🚫 Skipping save (loading from Firestore)");
      return;
    }

    const dataToSave = {
      canvas: currentCanvasStrokes || canvasStrokes,
      boards: currentBoards || boards,
      images: currentImages || images,
      canvasSize,
    };

    console.log("💾 About to save:", {
      canvasStrokes: dataToSave.canvas.length,
      boards: dataToSave.boards.length,
      images: dataToSave.images.length,
    });

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const now = Date.now();
      if (now - lastSaveRef.current > 500) {
        lastSaveRef.current = now;
        console.log("💾 Saving board to Firestore...");
        saveBoard(roomId, dataToSave).catch((err) => {
          console.error("❌ Firestore save failed:", err);
        });
      }
    }, 2000);
  };

  // Auto-save when data changes
  useEffect(() => {
    if (isLoadingRef.current) return;
    if (boards.length === 0 && images.length === 0) return;

    const timer = setTimeout(() => {
      console.log("💾 Auto-saving boards/images after remote update");
      const dataToSave = {
        canvas: canvasStrokes,
        boards: boards,
        images: images,
        canvasSize,
      };
      saveBoard(roomId, dataToSave).catch((err) => {
        console.error("❌ Auto-save failed:", err);
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [boards, images, canvasStrokes, canvasSize, roomId]);

  // Emergency save before page closes
  useEffect(() => {
    const handleBeforeUnload = () => {
      const dataToSave = {
        canvas: canvasStrokes,
        boards,
        images,
        canvasSize,
      };
      console.log("💾 Emergency save on page unload");
      saveBoard(roomId, dataToSave);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [roomId, canvasStrokes, boards, images, canvasSize]);

  return {
    saveThrottled,
    isLoadingRef,
  };
}
