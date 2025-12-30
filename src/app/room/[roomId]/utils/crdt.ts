//src/app/room/[roomId]/utils/crdt.ts

import { BoardData, VectorClock } from "../types";

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
  createOperation(board: Partial<BoardData>): BoardData {
    const version = this.increment();

    return {
      ...board,
      version,
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
}
