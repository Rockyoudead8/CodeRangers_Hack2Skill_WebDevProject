///src\app\room\[roomId]\WhiteBoard.tsx

"use client";
import { CRDTManager } from "./utils/crdt";
import { BoardData as CRDTBoardData } from "./types";
import { useEffect, useRef, useState, createRef } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

import axios from "axios";
import toast from "react-hot-toast";
import { socket } from "../../lib/socket";
import Board from "./Board";
import IBoard from "./IBoard";

import { saveBoard, subscribeToBoard, getRoom } from "@/lib/roomService";
import { renderAllStrokes } from "./hooks/renderAllStrokes";
import {
  resizeImage,
  handleImageUpload,
  determineNewPosition,
  checkForOverlap,
  handleDragStart,
} from "./components/image";

type Position = { x: number; y: number };

import { BoardData } from "./types";
import type { CanvasStroke, Point, CanvasDimensions } from "./types/canvas";
import { useDraw } from "./hooks/useDraw";
import { useSync } from "./hooks/useSync";

interface WhiteboardProps {
  roomId: string;
  userEmail: string;
}

export default function Whiteboard({ roomId, userEmail }: WhiteboardProps) {
  const router = useRouter();

  const isLoadingFromFirestore = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userIdRef = useRef(userEmail);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const crdtRef = useRef<CRDTManager | null>(null);
  // Canvas expansion tracking
  const canvasOffsetRef = useRef({ x: 0, y: 0 });

  // Initialize CRDT Manager
  useEffect(() => {
    console.log("🔧 Initializing CRDT Manager for user:", userEmail);
    crdtRef.current = new CRDTManager(userEmail);

    return () => {
      crdtRef.current?.reset();
    };
  }, [userEmail]);

  const [selectedTool, setSelectedTool] = useState("pencil");
  const [selectedColor, setSelectedColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(2);
  // const [isDrawing, setIsDrawing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]); // Points being drawn right now
  const [canvasStrokes, setCanvasStrokes] = useState<CanvasStroke[]>([]); // All finished strokes
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [imageData, setImageData] = useState<ImageData | null>(null);

  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const [boards, setBoards] = useState<BoardData[]>([]);
  const [images, setImages] = useState<BoardData[]>([]);
  const itemRefs = useRef<any>({});
  const [users, setUsers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [focusedBoardId, setFocusedBoardId] = useState<number | string | null>(
    null
  );
  const [canvasDimensions, setCanvasDimensions] = useState<CanvasDimensions>({
    width: 1920,
    height: 1080,
    version: 0,
    lastModifiedBy: userEmail,
    lastModifiedAt: Date.now(),
    vectorClock: {},
  });

  const [expandAmount, setExpandAmount] = useState<number>(0);
  const [expandDirection, setExpandDirection] = useState<
    "horizontal" | "vertical"
  >("horizontal");

  const handleSaveToDrive = async () => {
    try {
      const token = localStorage.getItem("drive_token");
      if (!token)
        return alert("Login again with Google to enable Drive access");

      const canvas = canvasRef.current;
      if (!canvas) return alert("Canvas missing… like hope in my life");

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/png")
      );

      const metadata = {
        name: `whiteboard-${roomId}.png`,
        mimeType: "image/png",
      };

      const form = new FormData();
      form.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      );
      form.append("file", blob);

      const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
        }
      );

      const result = await res.json();
      console.log(result);

      alert("Saved to Google Drive 🎉");
    } catch (e) {
      console.error(e);
      alert("Drive upload failed. Technology hates you today.");
    }
  };

  // ==========================================
  // ⭐ FIRESTORE PERSISTENCE HELPERS
  // ==========================================

  function exportBoardData() {
    return {
      canvas: canvasStrokes,
      dimensions: canvasDimensions, // NEW
      boards,
      images,
    };
  }

  function loadBoardFromData(data: any) {
    if (!data) {
      console.log("⚠️ No Firestore data - keeping current state");
      return;
    }

    isLoadingFromFirestore.current = true;

    console.log("🔥 Restoring board from Firestore", {
      hasCanvas: !!data.canvas,
      canvasLength: Array.isArray(data.canvas) ? data.canvas.length : 0,
      hasDimensions: !!data.dimensions,
      hasBoards: !!data.boards,
      boardsLength: data.boards?.length || 0,
      hasImages: !!data.images,
      imagesLength: data.images?.length || 0,
    });

    // Canvas strokes loading (unchanged)
    if (data.canvas && Array.isArray(data.canvas) && data.canvas.length > 0) {
      console.log("✅ Restoring", data.canvas.length, "strokes from Firestore");

      setCanvasStrokes((currentStrokes) => {
        if (currentStrokes.length === 0) {
          return data.canvas;
        }

        if (data.canvas.length > currentStrokes.length) {
          console.log("✅ Firestore has more data, using it");
          return data.canvas;
        }

        console.log("⚠️ Keeping current strokes");
        return currentStrokes;
      });
    } else {
      console.log("⚠️ Firestore has no canvas data - keeping current strokes");
    }

    // 🔥 FIX: Only load dimensions if they're LARGER than current
    if (data.dimensions) {
      console.log("📐 Firestore dimensions:", data.dimensions);

      setCanvasDimensions((currentDimensions) => {
        const remoteWidth = data.dimensions.width;
        const remoteHeight = data.dimensions.height;
        const currentWidth = currentDimensions.width;
        const currentHeight = currentDimensions.height;

        // Use Max-Merge strategy: take the larger of each dimension
        if (remoteWidth > currentWidth || remoteHeight > currentHeight) {
          console.log(
            `✅ Firestore has larger dimensions (${remoteWidth}x${remoteHeight} vs ${currentWidth}x${currentHeight})`
          );

          return {
            width: Math.max(remoteWidth, currentWidth),
            height: Math.max(remoteHeight, currentHeight),
            version: Math.max(
              data.dimensions.version,
              currentDimensions.version
            ),
            lastModifiedBy: data.dimensions.lastModifiedBy,
            lastModifiedAt: Math.max(
              data.dimensions.lastModifiedAt,
              currentDimensions.lastModifiedAt
            ),
            vectorClock: data.dimensions.vectorClock,
          };
        }

        console.log(
          `⚠️ Keeping current dimensions (${currentWidth}x${currentHeight}) - Firestore has ${remoteWidth}x${remoteHeight}`
        );
        return currentDimensions;
      });
    }

    if (data.boards && data.boards.length > 0) {
      setBoards(data.boards);
    }

    if (data.images && data.images.length > 0) {
      setImages(data.images);
    }

    setTimeout(() => {
      isLoadingFromFirestore.current = false;
    }, 1000);
  }

  let lastSave = 0;
  let saveTimeout: NodeJS.Timeout | null = null;

  // Around line 250 - REPLACE the entire saveThrottled function
  // REPLACE saveThrottled in WhiteBoard.tsx (around line 270)

  function saveThrottled(
    currentCanvasStrokes?: CanvasStroke[],
    currentBoards?: BoardData[],
    currentImages?: BoardData[],
    currentDimensions?: CanvasDimensions // 🔥 NEW PARAMETER
  ) {
    if (isLoadingFromFirestore.current) {
      console.log("🚫 Skipping save (loading from Firestore)");
      return;
    }

    // 🔥 FIX: Include dimensions in save
    const dataToSave = {
      canvas: currentCanvasStrokes || canvasStrokes,
      dimensions: currentDimensions || canvasDimensions, // 🔥 CRITICAL FIX
      boards: currentBoards || boards,
      images: currentImages || images,
    };

    console.log("💾 About to save:", {
      canvasStrokes: dataToSave.canvas.length,
      dimensions: `${dataToSave.dimensions.width}x${dataToSave.dimensions.height}`, // 🔥 LOG THIS
      boards: dataToSave.boards.length,
      images: dataToSave.images.length,
    });

    // Clear any pending save
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(() => {
      const now = Date.now();
      if (now - lastSave > 500) {
        lastSave = now;
        console.log("💾 Saving board to Firestore...");
        saveBoard(roomId, dataToSave).catch((err) => {
          console.error("❌ Firestore save failed:", err);
        });
      }
    }, 2000);
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = async () => {
    try {
      socket.disconnect();
      await signOut(auth);
      localStorage.removeItem("drive_token"); // optional cleanup
      router.push("/login");
    } catch (error) {
      console.error("Logout failed", error);
      alert("Logout failed. Life remains disappointing.");
    }
  };

  // ==========================================
  // SOCKET + FIRESTORE SUBSCRIPTION
  // ==========================================
  useEffect(() => {
    if (!roomId) return;

    // Load initial data
    const loadInitialData = async () => {
      try {
        const roomData = await getRoom(roomId);

        if (roomData?.boardData) {
          console.log("📥 Loading initial data from Firestore");
          loadBoardFromData(roomData.boardData);
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    };

    loadInitialData();

    // Subscribe to Firestore for cross-tab/cross-device sync
    const unsubscribe = subscribeToBoard(roomId, (data) => {
      if (!data) return;

      console.log("📥 Firestore update received");

      // Only load if not currently saving
      if (!isLoadingFromFirestore.current) {
        loadBoardFromData(data);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [roomId]);

  useSync({
    roomId,
    userEmail,
    crdtRef,
    setCanvasStrokes,
    setCanvasDimensions,
    setUsers,
    setBoards,
    setImages,
  });

  // Auto-save boards and images when they change (from remote updates)
  useEffect(() => {
    if (isLoadingFromFirestore.current) return;

    // Skip if no data
    if (boards.length === 0 && images.length === 0) return;

    // Debounce to avoid too many saves
    const timer = setTimeout(() => {
      console.log("💾 Auto-saving boards/images after remote update");
      const dataToSave = {
        canvas: canvasStrokes,
        boards: boards,
        images: images,
      };
      saveBoard(roomId, dataToSave).catch((err) => {
        console.error("❌ Auto-save failed:", err);
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [boards, images, canvasStrokes, roomId]); // Include all dependencies

  // ==========================================
  // CANVAS DRAWING  ⭐ SAVE TO FIRESTORE WHEN DONE
  // ==========================================
  const emitCanvasImage = () => {
    const canvas = canvasRef.current;
    if (!canvas || !roomId) return;
    const image = canvas.toDataURL("image/png");
    socket.emit("draw", { roomId, image });
    saveThrottled(canvasStrokes, boards, images, canvasDimensions); // ⭐ SAVE HERE
  };

  const undo = () => {
    setCanvasStrokes((prev) => {
      if (prev.length === 0) return prev;
      const newStrokes = prev.slice(0, -1); // Remove last stroke
      socket.emit("canvas:undo", {
        roomId,
        strokeId: prev[prev.length - 1].id,
      });
      saveThrottled(newStrokes, boards, images, canvasDimensions);
      return newStrokes;
    });
  };

  const redo = () => {
    // TODO: Implement proper redo with deleted strokes tracking
    console.log("Redo not yet implemented for stroke-based canvas");
  };

  const clearCanvas = () => {
    setCanvasStrokes([]);
    socket.emit("canvas:clear", { roomId });
    saveThrottled([], boards, images, canvasDimensions);
  };
  // Use the useDraw hook
  useDraw({
    canvasRef,
    selectedTool,
    selectedColor,
    brushSize,
    crdtRef,
    setCanvasStrokes,
    roomId,
    saveThrottled,
    canvasDimensions,
  });

  // Add this near your other useEffects

  useEffect(() => {
    renderAllStrokes({
      canvasRef,
      canvasStrokes,
    });
  }, [canvasStrokes]); // Re-render whenever strokes change

  // Around line 800 - REPLACE handleAddBoard
  const handleAddBoard = () => {
    if (!newBoardTitle.trim()) return;
    if (!crdtRef.current) {
      console.error("❌ CRDT Manager not initialized");
      return;
    }

    const baseBoard = {
      id: Date.now(),
      type: "text" as const,
      name: newBoardTitle,
      position: determineNewPosition(),
      content: "<p>Hello World! 🌎</p>",
    };

    const newBoard = crdtRef.current.createOperation(baseBoard);

    console.log("➕ Adding board with CRDT metadata:", {
      id: newBoard.id,
      version: newBoard.version,
      vectorClock: newBoard.vectorClock,
    });

    setBoards((prev) => {
      const updatedBoards = [...prev, newBoard];
      // 🔥 CRITICAL: Save with NEW state inside setState callback
      saveThrottled(canvasStrokes, updatedBoards, images, canvasDimensions);
      return updatedBoards;
    });

    socket.emit("board:add", { roomId, boardData: newBoard });

    setNewBoardTitle("");
    setIsModalOpen(false);
  };
  // Around line 850 - REPLACE updateItemName
  const updateItemName = (
    id: number | string,
    newName: string,
    type: "text" | "image"
  ) => {
    if (!crdtRef.current) return;

    if (type === "text") {
      const board = boards.find((b) => b.id === id);
      if (board) {
        const updated = crdtRef.current.createOperation({
          ...board,
          name: newName,
        });

        setBoards((prevBoards) => {
          const newBoards = prevBoards.map((b) => (b.id === id ? updated : b));

          // 🔥 FIX: Use canvasStrokes, not toDataURL!
          const dataToSave = {
            canvas: canvasStrokes, // ← FIXED: Save strokes array
            boards: newBoards,
            images: images,
          };

          console.log("💾 Saving board name with strokes");
          saveBoard(roomId, dataToSave).catch((err) => {
            console.error("❌ Save failed:", err);
          });

          return newBoards;
        });

        socket.emit("board:update", { roomId, boardData: updated });
      }
    } else {
      const img = images.find((i) => i.id === id);
      if (img) {
        const updated = crdtRef.current.createOperation({
          ...img,
          name: newName,
        });

        setImages((prevImages) => {
          const newImages = prevImages.map((i) => (i.id === id ? updated : i));

          // 🔥 FIX: Use canvasStrokes, not toDataURL!
          const dataToSave = {
            canvas: canvasStrokes, // ← FIXED: Save strokes array
            boards: boards,
            images: newImages,
          };

          console.log("💾 Saving image name with strokes");
          saveBoard(roomId, dataToSave).catch((err) => {
            console.error("❌ Save failed:", err);
          });

          return newImages;
        });

        socket.emit("image:update", { roomId, imageData: updated });
      }
    }
  };

  // Around line 1050 - REPLACE updateBoardContent
  // Create a map to store debounce timers
  const debouncedBoardUpdates = useRef<Map<number | string, NodeJS.Timeout>>(
    new Map()
  );

  const updateBoardContent = (id: number | string, newContent: string) => {
    if (!crdtRef.current) return;

    const board = boards.find((b) => b.id === id);
    if (!board || board.content === newContent) return;

    // ✅ Update local state immediately (for responsive UI)
    setBoards((prev) =>
      prev.map((b) => (b.id === id ? { ...b, content: newContent } : b))
    );

    // ✅ Debounce the CRDT operation and socket emission
    const existingTimeout = debouncedBoardUpdates.current.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const newTimeout = setTimeout(() => {
      if (!crdtRef.current) return;

      const currentBoard = boards.find((b) => b.id === id);
      if (!currentBoard) return;

      const updatedBoard = crdtRef.current.createOperation({
        ...currentBoard,
        content: newContent,
      });

      console.log("✏️ Updating board content with CRDT:", {
        id: updatedBoard.id,
        version: updatedBoard.version,
      });

      // Update with CRDT metadata
      setBoards((prevBoards) => {
        const updatedBoards = prevBoards.map((b) =>
          b.id === id ? updatedBoard : b
        );

        // Save with new state
        saveThrottled(canvasStrokes, updatedBoards, images, canvasDimensions);

        return updatedBoards;
      });

      socket.emit("board:update", { roomId, boardData: updatedBoard });
    }, 500); // Wait 500ms after typing stops

    debouncedBoardUpdates.current.set(id, newTimeout);
  };

  // Around line 1100 - REPLACE emitDeleteItem
  const emitDeleteItem = (id: number | string, type: "text" | "image") => {
    if (type === "text") {
      socket.emit("board:delete", { roomId, boardId: id });
      setBoards((prev) => {
        const updatedBoards = prev.filter((b) => b.id !== id);
        // 🔥 Save with NEW state
        saveThrottled(canvasStrokes, updatedBoards, images, canvasDimensions);
        return updatedBoards;
      });
    } else {
      socket.emit("image:delete", { roomId, imageId: id });
      setImages((prev) => {
        const updatedImages = prev.filter((img) => img.id !== id);
        // 🔥 Save with NEW state
        saveThrottled(canvasStrokes, boards, updatedImages, canvasDimensions);
        return updatedImages;
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Apply dimensions from state
    canvas.width = canvasDimensions.width;
    canvas.height = canvasDimensions.height;

    console.log(
      "✅ Canvas resized to:",
      canvasDimensions.width,
      "x",
      canvasDimensions.height
    );

    // Re-render strokes when dimensions change
    renderAllStrokes({
      canvasRef,
      canvasStrokes,
    });
  }, [canvasDimensions]);

  // REPLACE handleExpandCanvas in WhiteBoard.tsx (around line 850)

  const handleExpandCanvas = () => {
    if (!expandAmount || expandAmount <= 0) {
      alert("Please enter a valid amount (positive number)");
      return;
    }

    if (!crdtRef.current) {
      console.error("❌ CRDT Manager not initialized");
      return;
    }

    // Calculate new dimensions
    const newWidth =
      expandDirection === "horizontal"
        ? canvasDimensions.width + expandAmount
        : canvasDimensions.width;

    const newHeight =
      expandDirection === "vertical"
        ? canvasDimensions.height + expandAmount
        : canvasDimensions.height;

    // Create CRDT operation
    const newDimensions = crdtRef.current.createDimensionOperation(
      newWidth,
      newHeight
    );

    console.log("📐 Expanding canvas:", {
      direction: expandDirection,
      amount: expandAmount,
      newSize: `${newWidth}x${newHeight}`,
    });

    // Update local state
    setCanvasDimensions(newDimensions);

    // Emit to other users
    socket.emit("canvas:resize", { roomId, dimensions: newDimensions });

    // 🔥 FIX: Pass newDimensions to saveThrottled
    saveThrottled(canvasStrokes, boards, images, newDimensions);

    // Reset UI
    setExpandAmount(0);
  };

  // Emergency save before page closes
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Last-ditch save
      const dataToSave = {
        canvas: canvasStrokes, // ← FIXED!
        boards,
        images,
      };

      console.log("💾 Emergency save on page unload");
      saveBoard(roomId, dataToSave);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [roomId, boards, images]);
  // ==========================================
  // 5. RENDER
  // ==========================================

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col font-sans">
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) =>
          handleImageUpload(
            e,
            crdtRef,
            setImages,
            roomId,
            canvasStrokes,
            boards,
            isLoadingFromFirestore,
            saveTimeout,
            lastSave,
            fileInputRef
          )
        }
        accept="image/*"
        className="hidden"
      />

      {/* HEADER */}
      <header className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-70 shrink-0">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight flex items-center gap-2">
            Whiteboard
          </h1>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Room:</span>
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-mono">
              {roomId}
            </code>
            {/* NEW: Display current canvas size */}
            <span className="ml-2 text-blue-600 font-medium">
              {canvasDimensions.width}×{canvasDimensions.height}px
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* NEW: Canvas Resize Controls */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
            <input
              type="number"
              value={expandAmount || ""}
              onChange={(e) => setExpandAmount(Number(e.target.value))}
              placeholder="Amount"
              min="1"
              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <select
              value={expandDirection}
              onChange={(e) =>
                setExpandDirection(e.target.value as "horizontal" | "vertical")
              }
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>

            <button
              onClick={handleExpandCanvas}
              disabled={!expandAmount || expandAmount <= 0}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
            >
              Expand
            </button>
          </div>

          <div className="relative group z-50">
            <button className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full transition-colors cursor-default">
              <span className="text-sm font-medium text-gray-600">
                {users.length} Online
              </span>
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <p className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase">
                Current Users
              </p>
              <ul className="flex flex-col gap-1 overflow-y-auto max-h-40">
                {users.map((user, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold bg-blue-500 overflow-hidden">
                      {user.id ? user.id.charAt(0).toUpperCase() : "?"}
                    </div>
                    <span
                      className="text-sm text-gray-600 truncate max-w-[120px]"
                      title={user.id}
                    >
                      {user.id}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            Add Board
          </button>

          <button
            onClick={handleSaveToDrive}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            Save to Google Drive
          </button>

          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            Logout
          </button>
        </div>
      </header>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 scale-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">New Board</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Board Name
              </label>
              <input
                type="text"
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                placeholder="e.g., Project Notes"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAddBoard()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-all"
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setNewBoardTitle("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleAddBoard}
                disabled={!newBoardTitle.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Add Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full bg-white overflow-auto"
      >
        <canvas ref={canvasRef} className="block cursor-crosshair" />

        <div className="absolute inset-0 z-10 w-full h-full pointer-events-none">
          {/* RENDER TEXT BOARDS */}
          {boards.map((board) => (
            <div key={board.id} className="pointer-events-auto absolute">
              <Board
                ref={
                  itemRefs.current[board.id]
                    ? itemRefs.current[board.id]
                    : (itemRefs.current[board.id] = createRef())
                }
                id={board.id}
                name={board.name}
                initialPos={board.position}
                content={board.content}
                onContentChange={(newContent) =>
                  updateBoardContent(board.id, newContent)
                }
                onMouseDown={(e) =>
                  handleDragStart(
                    board,
                    e,
                    itemRefs,
                    containerRef,
                    boards,
                    images,
                    crdtRef,
                    setBoards,
                    setImages,
                    roomId,
                    canvasStrokes,
                    isLoadingFromFirestore,
                    saveTimeout,
                    lastSave
                  )
                }
                onRename={(newName) =>
                  updateItemName(board.id, newName, "text")
                }
                onDelete={() => emitDeleteItem(board.id, "text")}
                socket={socket}
                roomId={roomId}
                userEmail={userEmail}
              />
            </div>
          ))}

          {/* RENDER IMAGES */}
          {images.map((img) => (
            <div key={img.id} className="pointer-events-auto absolute">
              <IBoard
                ref={
                  itemRefs.current[img.id]
                    ? itemRefs.current[img.id]
                    : (itemRefs.current[img.id] = createRef())
                }
                id={img.id}
                name={img.name}
                initialPos={img.position}
                content={img.content}
                onMouseDown={(e) =>
                  handleDragStart(
                    img,
                    e,
                    itemRefs,
                    containerRef,
                    boards,
                    images,
                    crdtRef,
                    setBoards,
                    setImages,
                    roomId,
                    canvasStrokes,
                    isLoadingFromFirestore,
                    saveTimeout,
                    lastSave
                  )
                }
                onRename={(newName) => updateItemName(img.id, newName, "image")}
                onDelete={() => emitDeleteItem(img.id, "image")}
              />
            </div>
          ))}
        </div>

        {/* TOGGLE BUTTON*/}
        <div className="fixed z-60 bottom-24 left-4 md:left-0 md:top-1/2 md:bottom-auto md:-translate-y-1/2">
          <button
            onClick={() => setIsToolbarVisible(!isToolbarVisible)}
            className="bg-white border border-gray-200 md:border-l-0 text-gray-600 p-2 md:pr-3 rounded-full md:rounded-r-xl md:rounded-l-none shadow-md hover:bg-gray-50 transition-colors"
          >
            {isToolbarVisible ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="rotate-90 md:rotate-0"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            )}
          </button>
        </div>

        {/*TOOLBAR */}
        <aside
          className={`
            fixed z-50
            bg-white/95 backdrop-blur-sm shadow-xl border border-gray-200/60 p-3
            flex gap-5 transition-all duration-300 ease-in-out
            
            /* MOBILE STYLES */
            bottom-6 left-1/2 -translate-x-1/2 rounded-full flex-row items-center
            ${
              isToolbarVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-[200%] opacity-0"
            }

            /* DESKTOP STYLES */
            md:top-[60%] md:left-4 md:bottom-auto md:translate-x-0 md:-translate-y-1/2 md:rounded-2xl md:flex-col md:items-start
            md:${
              isToolbarVisible ? "md:translate-x-0" : "md:-translate-x-[150%]"
            }
          `}
        >
          <div className="flex md:flex-col flex-row gap-1.5">
            {["pencil", "line", "rect", "circle", "eraser"].map((tool) => (
              <button
                key={tool}
                onClick={() => setSelectedTool(tool)}
                className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                  selectedTool === tool
                    ? "bg-black text-white"
                    : "hover:bg-gray-100 text-gray-500"
                }`}
              >
                {tool === "pencil" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                )}
                {tool === "line" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                  </svg>
                )}
                {tool === "rect" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  </svg>
                )}
                {tool === "circle" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                )}
                {tool === "eraser" && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                    <path d="M22 21H7" />
                    <path d="m5 11 9 9" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <div className="md:h-px md:w-full w-px h-8 bg-gray-200"></div>

          <div className="flex md:flex-col flex-row gap-2 items-center">
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-8 h-8 rounded-full border-2 border-white cursor-pointer"
            />
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="md:w-1.5 md:h-20 w-20 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer"
              style={
                {
                  writingMode:
                    typeof window !== "undefined" && window.innerWidth >= 768
                      ? "vertical-lr"
                      : "horizontal-tb",
                } as any
              }
            />
          </div>

          <div className="md:h-px md:w-full w-px h-8 bg-gray-200"></div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 rounded-xl flex items-center justify-center transition-all hover:bg-gray-100 text-gray-500"
            title="Upload Image"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </button>

          <div className="md:h-px md:w-full w-px h-8 bg-gray-200"></div>

          <div className="flex md:flex-col flex-row gap-1">
            <button
              onClick={undo}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
            </button>
            <button
              onClick={redo}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 7v6h-6" />
                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
              </svg>
            </button>
            <button
              onClick={clearCanvas}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
