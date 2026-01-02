//src/app/room/[roomId]/utils/crdt.ts

import { BoardData, VectorClock } from "../types";
import { CanvasStroke } from "../types/canvas";

export class CRDTManager {
  private vectorClock: VectorClock = {};
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.vectorClock[userId] = 0;
  }

  // Increment local user's logical clock
  increment(): number {
    this.vectorClock[this.userId]++;
    return this.vectorClock[this.userId];
  }

  // Get current clock state
  getClock(): VectorClock {
    return { ...this.vectorClock };
  }

  // Update clock from remote operation
  updateClock(remoteClock: VectorClock) {
    for (const userId in remoteClock) {
      this.vectorClock[userId] = Math.max(
        this.vectorClock[userId] || 0,
        remoteClock[userId]
      );
    }
  }

  // Compare two vector clocks: did A happen before B?
  happensBefore(clockA: VectorClock, clockB: VectorClock): boolean {
    let allLessEqual = true;
    let someLess = false;

    // Check all dimensions in clockB
    for (const userId in clockB) {
      const a = clockA[userId] || 0;
      const b = clockB[userId] || 0;

      if (a > b) return false; // A is ahead in this dimension
      if (a < b) someLess = true;
    }

    // Also check dimensions only in clockA
    for (const userId in clockA) {
      if (!(userId in clockB)) {
        const a = clockA[userId] || 0;
        if (a > 0) return false; // A has updates B doesn't know about
      }
    }

    return someLess && allLessEqual;
  }

  // Are two clocks concurrent (neither happened before the other)?
  areConcurrent(clockA: VectorClock, clockB: VectorClock): boolean {
    return (
      !this.happensBefore(clockA, clockB) && !this.happensBefore(clockB, clockA)
    );
  }

  private mergeTextContent(localHtml: string, remoteHtml: string): string {
    // Strip HTML tags for comparison
    const stripTags = (html: string) => html.replace(/<[^>]*>/g, "");
    const localText = stripTags(localHtml);
    const remoteText = stripTags(remoteHtml);

    // If remote is a superset of local, use remote
    if (remoteText.includes(localText)) {
      return remoteHtml;
    }

    // If local is a superset of remote, use local
    if (localText.includes(remoteText)) {
      return localHtml;
    }

    // If they diverged, use the longer one (simple heuristic)
    // In production, use proper diff algorithm (e.g., Myers' diff)
    return localText.length >= remoteText.length ? localHtml : remoteHtml;
  }

  // Resolve conflict between two concurrent writes using Last-Write-Wins
  resolveConflict(local: BoardData, remote: BoardData): BoardData {
    // If one happened before the other, choose the later one
    if (this.happensBefore(local.vectorClock, remote.vectorClock)) {
      console.log(`🔄 Remote operation is newer (causal order)`);
      return remote;
    }
    if (this.happensBefore(remote.vectorClock, local.vectorClock)) {
      console.log(`🔄 Local operation is newer (causal order)`);
      return local;
    }

    // ✅ NEW: Special handling for text boards
    if (local.type === "text" && remote.type === "text") {
      const mergedContent = this.mergeTextContent(
        local.content,
        remote.content
      );

      // Use the one with higher version, but with merged content
      if (remote.version > local.version) {
        return { ...remote, content: mergedContent };
      } else {
        return { ...local, content: mergedContent };
      }
    }

    // Concurrent writes: use Last-Write-Wins based on timestamp
    console.log(`⚠️ Concurrent write detected, resolving with LWW`);

    if (remote.lastModifiedAt > local.lastModifiedAt) {
      return remote;
    }
    if (local.lastModifiedAt > remote.lastModifiedAt) {
      return local;
    }

    // Same timestamp (extremely rare): tiebreak by userId lexicographically
    return local.lastModifiedBy > remote.lastModifiedBy ? local : remote;
  }

  // Merge local and remote board arrays
  mergeBoards(
    localBoards: BoardData[],
    remoteBoards: BoardData[]
  ): BoardData[] {
    const merged = new Map<string | number, BoardData>();

    // Add all local boards first
    localBoards.forEach((board) => {
      merged.set(board.id, board);
    });

    // Merge remote boards
    remoteBoards.forEach((remoteBoard) => {
      const localBoard = merged.get(remoteBoard.id);

      if (!localBoard) {
        // New board from remote, add it
        console.log(`➕ Adding remote board: ${remoteBoard.id}`);
        merged.set(remoteBoard.id, remoteBoard);
      } else {
        // Both have this board: resolve conflict
        const resolved = this.resolveConflict(localBoard, remoteBoard);
        merged.set(remoteBoard.id, resolved);
      }
    });

    return Array.from(merged.values());
  }

  // Create operation metadata for a new/updated board
  // crdt.ts - MODIFY createOperation

  createOperation(board: Partial<BoardData>): BoardData {
    const version = this.increment();

    return {
      ...board,
      version,
      sequence: Date.now(), // ✅ Add monotonic sequence number
      lastModifiedBy: this.userId,
      lastModifiedAt: Date.now(),
      vectorClock: this.getClock(),
    } as BoardData;
  }

  // Reset clock (use when switching rooms)
  reset() {
    this.vectorClock = {};
    this.vectorClock[this.userId] = 0;
  }

  // Add to existing CRDTManager class

  createStroke(strokeData: Partial<CanvasStroke>): CanvasStroke {
    const version = this.increment();

    return {
      ...strokeData,
      id: `${this.userId}-${Date.now()}-${Math.random()}`, // Unique ID
      userId: this.userId,
      timestamp: Date.now(),
      vectorClock: this.getClock(),
      version,
    } as CanvasStroke;
  }

  // Merge strokes from multiple users
  mergeStrokes(
    localStrokes: CanvasStroke[],
    remoteStrokes: CanvasStroke[]
  ): CanvasStroke[] {
    const merged = new Map<string, CanvasStroke>();

    // Add all local strokes
    localStrokes.forEach((stroke) => {
      merged.set(stroke.id, stroke);
    });

    // Merge remote strokes
    remoteStrokes.forEach((remoteStroke) => {
      const localStroke = merged.get(remoteStroke.id);

      if (!localStroke) {
        // New stroke from remote user
        merged.set(remoteStroke.id, remoteStroke);
      } else {
        // Conflict: same stroke ID exists locally
        // This shouldn't happen with proper IDs, but just in case...
        if (remoteStroke.timestamp > localStroke.timestamp) {
          merged.set(remoteStroke.id, remoteStroke);
        }
      }
    });

    // Sort by timestamp for consistent rendering order
    return Array.from(merged.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );
  }
}
