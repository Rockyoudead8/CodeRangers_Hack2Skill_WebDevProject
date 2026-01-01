// src/app/room/[roomId]/hooks/useCanvasExpansion.ts

import { useRef } from "react";
import { socket } from "@/app/lib/socket";
import type { BoardData } from "../types";
import type { CanvasStroke } from "../types/canvas";

const EXPANSION_THRESHOLD = 200;
const EXPANSION_AMOUNT = 1000;

interface UseCanvasExpansionProps {
  roomId: string;
  canvasSize: { width: number; height: number };
  setCanvasSize: (size: { width: number; height: number }) => void;
  setCanvasStrokes: React.Dispatch<React.SetStateAction<CanvasStroke[]>>;
  setBoards: React.Dispatch<React.SetStateAction<BoardData[]>>;
  setImages: React.Dispatch<React.SetStateAction<BoardData[]>>;
}

export function useCanvasExpansion({
  roomId,
  canvasSize,
  setCanvasSize,
  setCanvasStrokes,
  setBoards,
  setImages,
}: UseCanvasExpansionProps) {
  const expansionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isExpandingRef = useRef(false);

  const adjustContentPositions = (offsetX: number, offsetY: number) => {
    if (offsetX === 0 && offsetY === 0) return;

    setCanvasStrokes((prev) =>
      prev.map((stroke) => ({
        ...stroke,
        points: stroke.points.map((p) => ({
          x: p.x + offsetX,
          y: p.y + offsetY,
        })),
      }))
    );

    setBoards((prev) =>
      prev.map((board) => ({
        ...board,
        position: {
          x: board.position.x + offsetX,
          y: board.position.y + offsetY,
        },
      }))
    );

    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        position: {
          x: img.position.x + offsetX,
          y: img.position.y + offsetY,
        },
      }))
    );

    console.log(`📐 Adjusted all positions by (${offsetX}, ${offsetY})`);
  };

  const checkAndExpandCanvas = (x: number, y: number) => {
    if (isExpandingRef.current)
      return { expanded: false, offset: { x: 0, y: 0 } };

    const needsExpansion = {
      right: x > canvasSize.width - EXPANSION_THRESHOLD,
      bottom: y > canvasSize.height - EXPANSION_THRESHOLD,
      left: x < EXPANSION_THRESHOLD,
      top: y < EXPANSION_THRESHOLD,
    };

    if (Object.values(needsExpansion).some(Boolean)) {
      if (expansionDebounceRef.current) {
        clearTimeout(expansionDebounceRef.current);
      }

      expansionDebounceRef.current = setTimeout(() => {
        if (isExpandingRef.current) return;

        isExpandingRef.current = true;

        const newSize = { ...canvasSize };
        let offsetX = 0;
        let offsetY = 0;

        if (needsExpansion.right) newSize.width += EXPANSION_AMOUNT;
        if (needsExpansion.bottom) newSize.height += EXPANSION_AMOUNT;
        if (needsExpansion.left) {
          newSize.width += EXPANSION_AMOUNT;
          offsetX = EXPANSION_AMOUNT;
        }
        if (needsExpansion.top) {
          newSize.height += EXPANSION_AMOUNT;
          offsetY = EXPANSION_AMOUNT;
        }

        console.log("📐 Expanding canvas:", {
          newSize,
          offset: { offsetX, offsetY },
        });

        setCanvasSize(newSize);

        if (offsetX !== 0 || offsetY !== 0) {
          adjustContentPositions(offsetX, offsetY);
        }

        socket.emit("canvas:expand", {
          roomId,
          newSize,
          offset: { x: offsetX, y: offsetY },
        });

        setTimeout(() => {
          isExpandingRef.current = false;
        }, 500);
      }, 300);

      return { expanded: true, offset: { x: 0, y: 0 } };
    }

    return { expanded: false, offset: { x: 0, y: 0 } };
  };

  const handleRemoteExpansion = (data: {
    newSize: { width: number; height: number };
    offset: { x: number; y: number };
  }) => {
    if (isExpandingRef.current) {
      console.log("⚠️ Already expanding, skipping");
      return;
    }

    isExpandingRef.current = true;
    setCanvasSize(data.newSize);

    if (data.offset.x !== 0 || data.offset.y !== 0) {
      adjustContentPositions(data.offset.x, data.offset.y);
    }

    setTimeout(() => {
      isExpandingRef.current = false;
    }, 500);
  };

  return {
    checkAndExpandCanvas,
    handleRemoteExpansion,
    isExpandingRef,
  };
}
