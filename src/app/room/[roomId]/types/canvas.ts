// src/app/room/[roomId]/types/canvas.ts

export interface Point {
  x: number;
  y: number;
}

export interface CanvasStroke {
  id: string; // Unique ID like "user123-1234567890"
  userId: string; // Who drew it
  tool: "pencil" | "line" | "rect" | "circle" | "eraser";
  points: Point[]; // Array of coordinates
  color: string; // Like "#FF0000"
  lineWidth: number; // Brush size
  timestamp: number; // When it was created
  vectorClock: Record<string, number>; // CRDT magic for conflict resolution
}

export interface CanvasState {
  strokes: CanvasStroke[]; // All strokes in the canvas
  deletedStrokeIds: Set<string>; // IDs of erased strokes
}
