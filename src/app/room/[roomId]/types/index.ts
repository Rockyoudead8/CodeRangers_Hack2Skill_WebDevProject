//src/app/room/[roomId]/types/index.ts

export type Position = { x: number; y: number };

export type VectorClock = Record<string, number>;

export interface BoardData {
  id: number | string;
  type: "text" | "image";
  name: string;
  position: Position;
  content: string;

  // CRDT metadata
  version: number;
  lastModifiedBy: string;
  lastModifiedAt: number;
  vectorClock: VectorClock;
}

export interface CRDTOperation {
  userId: string;
  timestamp: number;
  vectorClock: VectorClock;
  data: Partial<BoardData>;
}
