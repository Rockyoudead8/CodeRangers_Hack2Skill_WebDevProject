// src/app/room/[roomId]/types/canvas.ts

export interface Point {
  x: number;
  y: number;
}

export interface CanvasStroke {
  id: string;
  userId: string;
  tool: "pencil" | "line" | "rect" | "circle" | "eraser";
  points: Point[];
  color: string;
  lineWidth: number;
  timestamp: number;
  vectorClock: Record<string, number>;
}

// NEW: Canvas dimension tracking
export interface CanvasDimensions {
  width: number;
  height: number;
  version: number;
  lastModifiedBy: string;
  lastModifiedAt: number;
  vectorClock: Record<string, number>;
}

export interface CanvasState {
  strokes: CanvasStroke[];
  dimensions: CanvasDimensions; // NEW
  deletedStrokeIds: Set<string>;
}
