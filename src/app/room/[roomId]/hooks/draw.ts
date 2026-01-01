// src/app/room/[roomId]/hooks/draw.ts

import { Point } from "../types/canvas";
import { socket } from "@/app/lib/socket";
import { CRDTManager } from "../utils/crdt";
import { CanvasStroke } from "../types/canvas";
import { useEffect, useRef } from "react";

interface DrawProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  selectedTool: string;
  selectedColor: string;
  brushSize: number;
  crdtRef: React.RefObject<CRDTManager | null>;
  setCanvasStrokes: React.Dispatch<React.SetStateAction<CanvasStroke[]>>;
  roomId: string;
  saveThrottled: () => void;
}

export const useDraw = ({
  canvasRef,
  selectedTool,
  selectedColor,
  brushSize,
  crdtRef,
  setCanvasStrokes,
  roomId,
  saveThrottled,
}: DrawProps) => {
  // Create refs for values that change frequently
  const selectedToolRef = useRef(selectedTool);
  const selectedColorRef = useRef(selectedColor);
  const brushSizeRef = useRef(brushSize);

  // Update refs when values change
  useEffect(() => {
    selectedToolRef.current = selectedTool;
  }, [selectedTool]);

  useEffect(() => {
    selectedColorRef.current = selectedColor;
  }, [selectedColor]);

  useEffect(() => {
    brushSizeRef.current = brushSize;
  }, [brushSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Local drawing state
    let isCurrentlyDrawing = false;
    let tempStrokePoints: Point[] = [];
    let localStartX = 0;
    let localStartY = 0;
    let localImageData: ImageData | null = null;

    const handleMouseDown = (e: MouseEvent) => {
      isCurrentlyDrawing = true;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      localStartX = x;
      localStartY = y;
      tempStrokePoints = [{ x, y }];

      localImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (selectedToolRef.current === "pencil") {
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isCurrentlyDrawing) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      tempStrokePoints.push({ x, y });

      // Get current values from refs
      const tool = selectedToolRef.current;
      const color = selectedColorRef.current;
      const size = brushSizeRef.current;

      // For shapes, restore canvas to show preview
      if (["line", "rect", "circle"].includes(tool) && localImageData) {
        ctx.putImageData(localImageData, 0, 0);
      }

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (tool) {
        case "pencil":
          ctx.lineTo(x, y);
          ctx.stroke();
          break;
        case "line":
          ctx.beginPath();
          ctx.moveTo(localStartX, localStartY);
          ctx.lineTo(x, y);
          ctx.stroke();
          break;
        case "rect": {
          const width = x - localStartX;
          const height = y - localStartY;
          ctx.strokeRect(localStartX, localStartY, width, height);
          break;
        }
        case "circle": {
          const radius = Math.sqrt(
            Math.pow(x - localStartX, 2) + Math.pow(y - localStartY, 2)
          );
          ctx.beginPath();
          ctx.arc(localStartX, localStartY, radius, 0, 2 * Math.PI);
          ctx.stroke();
          break;
        }
        case "eraser":
          ctx.clearRect(x - size / 2, y - size / 2, size, size);
          break;
      }
    };

    const handleMouseUp = () => {
      if (!isCurrentlyDrawing) return;

      isCurrentlyDrawing = false;

      if (!crdtRef.current) return;

      let strokePoints = tempStrokePoints;

      const tool = selectedToolRef.current;

      // For shapes, only need start/end points
      if (["line", "rect", "circle"].includes(tool)) {
        strokePoints = [
          { x: localStartX, y: localStartY },
          strokePoints[strokePoints.length - 1],
        ];
      }

      // Create CRDT stroke
      const newStroke = crdtRef.current.createStroke({
        tool: tool as any,
        points: strokePoints,
        color: selectedColorRef.current,
        lineWidth: brushSizeRef.current,
      });

      // Add to local state
      setCanvasStrokes((prev) => [...prev, newStroke]);

      // Emit to others
      socket.emit("canvas:stroke", { roomId, stroke: newStroke });

      // Save to Firestore (throttled)
      saveThrottled();

      // Reset
      tempStrokePoints = [];
      ctx.beginPath();
    };

    const handleMouseLeave = handleMouseUp;

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [canvasRef, crdtRef, roomId, saveThrottled, setCanvasStrokes]);
};
