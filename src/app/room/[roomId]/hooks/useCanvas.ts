// src/app/room/[roomId]/hooks/useCanvas.ts

import { useEffect, useRef } from "react";
import type { Point } from "../types/canvas";

interface UseCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isDrawing: boolean;
  selectedTool: string;
  selectedColor: string;
  brushSize: number;
  onDrawStart: (x: number, y: number) => void;
  onDrawMove: (x: number, y: number) => void;
  onDrawEnd: (points: Point[]) => void;
}

export function useCanvas({
  canvasRef,
  isDrawing,
  selectedTool,
  selectedColor,
  brushSize,
  onDrawStart,
  onDrawMove,
  onDrawEnd,
}: UseCanvasProps) {
  const tempStrokePointsRef = useRef<Point[]>([]);
  const startPosRef = useRef({ x: 0, y: 0 });
  const imageDataRef = useRef<ImageData | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleMouseDown = (e: MouseEvent) => {
      isDrawingRef.current = true;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      tempStrokePointsRef.current = [{ x, y }];
      startPosRef.current = { x, y };
      imageDataRef.current = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

      onDrawStart(x, y);

      if (selectedTool === "pencil") {
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      tempStrokePointsRef.current.push({ x, y });
      onDrawMove(x, y);

      if (
        ["line", "rect", "circle"].includes(selectedTool) &&
        imageDataRef.current
      ) {
        ctx.putImageData(imageDataRef.current, 0, 0);
      }

      ctx.strokeStyle = selectedColor;
      ctx.fillStyle = selectedColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (selectedTool) {
        case "pencil":
          ctx.lineTo(x, y);
          ctx.stroke();
          break;
        case "line":
          ctx.beginPath();
          ctx.moveTo(startPosRef.current.x, startPosRef.current.y);
          ctx.lineTo(x, y);
          ctx.stroke();
          break;
        case "rect": {
          const width = x - startPosRef.current.x;
          const height = y - startPosRef.current.y;
          ctx.strokeRect(
            startPosRef.current.x,
            startPosRef.current.y,
            width,
            height
          );
          break;
        }
        case "circle": {
          const radius = Math.sqrt(
            Math.pow(x - startPosRef.current.x, 2) +
              Math.pow(y - startPosRef.current.y, 2)
          );
          ctx.beginPath();
          ctx.arc(
            startPosRef.current.x,
            startPosRef.current.y,
            radius,
            0,
            2 * Math.PI
          );
          ctx.stroke();
          break;
        }
        case "eraser":
          ctx.clearRect(
            x - brushSize / 2,
            y - brushSize / 2,
            brushSize,
            brushSize
          );
          break;
      }
    };

    const handleMouseUp = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      let strokePoints = tempStrokePointsRef.current;

      if (["line", "rect", "circle"].includes(selectedTool)) {
        strokePoints = [
          startPosRef.current,
          strokePoints[strokePoints.length - 1],
        ];
      }

      onDrawEnd(strokePoints);

      tempStrokePointsRef.current = [];
      ctx.beginPath();
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseUp);
    };
  }, [
    selectedTool,
    selectedColor,
    brushSize,
    canvasRef,
    onDrawStart,
    onDrawMove,
    onDrawEnd,
  ]);
}
