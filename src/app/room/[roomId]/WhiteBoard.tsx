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

type Position = { x: number; y: number };

import { BoardData } from "./types";
import type { CanvasStroke, Point } from "./types/canvas";

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

  // Add this function inside your WhiteBoard component

  const renderAllStrokes = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw each stroke
    canvasStrokes.forEach((stroke) => {
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (stroke.tool) {
        case "pencil": {
          if (stroke.points.length < 2) break;
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          stroke.points.forEach((point) => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
          break;
        }

        case "line": {
          if (stroke.points.length < 2) break;
          const [start, end] = stroke.points;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          break;
        }

        case "rect": {
          if (stroke.points.length < 2) break;
          const [start, end] = stroke.points;
          const width = end.x - start.x;
          const height = end.y - start.y;
          ctx.strokeRect(start.x, start.y, width, height);
          break;
        }

        case "circle": {
          if (stroke.points.length < 2) break;
          const [center, edge] = stroke.points;
          const radius = Math.sqrt(
            Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2)
          );
          ctx.beginPath();
          ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
          break;
        }

        case "eraser": {
          // Eraser just clears rectangles at each point
          stroke.points.forEach((point) => {
            ctx.clearRect(
              point.x - stroke.lineWidth / 2,
              point.y - stroke.lineWidth / 2,
              stroke.lineWidth,
              stroke.lineWidth
            );
          });
          break;
        }
      }
    });
  };

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
      canvas: canvasStrokes, // Save strokes array, not base64 image
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

    console.log("📥 Restoring board from Firestore", {
      hasCanvas: !!data.canvas,
      canvasLength: Array.isArray(data.canvas) ? data.canvas.length : 0,
      hasBoards: !!data.boards,
      boardsLength: data.boards?.length || 0,
      hasImages: !!data.images,
      imagesLength: data.images?.length || 0,
    });

    // 🔥 CRITICAL FIX: Only load if Firestore has data
    if (data.canvas && Array.isArray(data.canvas) && data.canvas.length > 0) {
      console.log("✅ Restoring", data.canvas.length, "strokes from Firestore");

      // 🔥 Use callback to compare with current state
      setCanvasStrokes((currentStrokes) => {
        // If current is empty, load from Firestore
        if (currentStrokes.length === 0) {
          return data.canvas;
        }

        // If Firestore has MORE strokes, use it
        if (data.canvas.length > currentStrokes.length) {
          console.log("✅ Firestore has more data, using it");
          return data.canvas;
        }

        // Otherwise keep current
        console.log("⚠️ Keeping current strokes");
        return currentStrokes;
      });
    } else {
      console.log("⚠️ Firestore has no canvas data - keeping current strokes");
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

  function saveThrottled() {
    if (isLoadingFromFirestore.current) {
      console.log("🚫 Skipping save (loading from Firestore)");
      return;
    }

    // 🔥 ADD THIS LINE
    console.log("💾 About to save:", {
      canvasStrokes: canvasStrokes.length,
      boards: boards.length,
      images: images.length,
    });

    // Clear any pending save
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Schedule save for 2 seconds from now
    saveTimeout = setTimeout(() => {
      const now = Date.now();
      if (now - lastSave > 2000) {
        lastSave = now;
        console.log("💾 Saving board to Firestore...");
        saveBoard(roomId, exportBoardData()).catch((err) => {
          console.error("❌ Firestore save failed:", err);
        });
      }
    }, 2000); // Increased from 1500ms to 2000ms
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

    // 🔥 Load ONCE on mount, don't subscribe
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

    // NO subscription - Socket.io handles all real-time updates
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !crdtRef.current) return;

    if (!socket.connected) socket.connect();
    userIdRef.current = userEmail;
    const userId = userIdRef.current;

    console.log(`Joining room ${roomId} as ${userId}`);
    socket.emit("userJoined", { userId, roomId });

    // Canvas draw handler (unchanged)
    // NEW: Receive single stroke from another user
    const handleCanvasStroke = (stroke: CanvasStroke) => {
      if (!crdtRef.current) return;

      console.log("📥 Received stroke from another user:", stroke.id);

      // Update vector clock
      crdtRef.current.updateClock(stroke.vectorClock);

      // Add to local strokes
      setCanvasStrokes((prev) => {
        // Check if we already have this stroke (shouldn't happen, but safety first)
        if (prev.find((s) => s.id === stroke.id)) {
          return prev;
        }
        return [...prev, stroke].sort((a, b) => a.timestamp - b.timestamp);
      });
    };

    // NEW: Sync all strokes when joining room
    const handleCanvasSync = (strokes: CanvasStroke[]) => {
      console.log("📥 Socket sync received:", strokes.length, "strokes");

      setCanvasStrokes((currentStrokes) => {
        // If we have no strokes, accept socket sync
        if (currentStrokes.length === 0) {
          console.log("✅ Accepting socket sync (no local strokes)");
          return strokes.sort((a, b) => a.timestamp - b.timestamp);
        }

        // 🔥 CRITICAL FIX: Compare which dataset is MORE COMPLETE
        if (strokes.length > currentStrokes.length) {
          console.log(
            `✅ Socket has MORE strokes (${strokes.length} vs ${currentStrokes.length}) - accepting socket data`
          );
          return strokes.sort((a, b) => a.timestamp - b.timestamp);
        }

        // If socket has same or fewer strokes, keep current
        console.log(
          `⚠️ Keeping current strokes (${currentStrokes.length}) - socket has ${strokes.length}`
        );
        return currentStrokes;
      });
    };

    // NEW: Clear canvas for everyone
    const handleCanvasClear = () => {
      console.log("🗑️ Canvas cleared by another user");
      setCanvasStrokes([]);
    };

    const handleUserList = (data: any) => {
      const userList = Array.isArray(data) ? data : data.users;
      if (userList) setUsers(userList);
    };

    // ===== NEW: CRDT-AWARE BOARD HANDLERS =====

    const handleBoardAdd = (boardData: BoardData) => {
      if (!crdtRef.current) return;

      console.log("📥 Received board:add:", {
        id: boardData.id,
        version: boardData.version,
        vectorClock: boardData.vectorClock,
      });

      // Update our vector clock
      crdtRef.current.updateClock(boardData.vectorClock);

      setBoards((prev) => {
        const exists = prev.find((b) => b.id === boardData.id);

        if (exists) {
          // Conflict: resolve using CRDT
          console.log("⚠️ Board already exists locally, resolving conflict");
          const resolved = crdtRef.current!.resolveConflict(exists, boardData);
          return prev.map((b) => (b.id === boardData.id ? resolved : b));
        }

        // New board, add it
        return [...prev, boardData];
      });
    };

    const handleBoardUpdate = (boardData: BoardData) => {
      if (!crdtRef.current) return;

      console.log("📥 Received board:update:", {
        id: boardData.id,
        version: boardData.version,
        vectorClock: boardData.vectorClock,
      });

      crdtRef.current.updateClock(boardData.vectorClock);

      setBoards((prev) => {
        const local = prev.find((b) => b.id === boardData.id);

        if (!local) {
          console.warn("⚠️ Received update for unknown board, adding it");
          return [...prev, boardData];
        }

        // Resolve conflict
        const resolved = crdtRef.current!.resolveConflict(local, boardData);
        return prev.map((b) => (b.id === boardData.id ? resolved : b));
      });
    };

    const handleBoardDelete = (boardId: string | number) => {
      console.log("📥 Received board:delete:", boardId);
      setBoards((prev) => prev.filter((b) => b.id !== boardId));
    };

    // ===== NEW: CRDT-AWARE IMAGE HANDLERS =====

    const handleImageAdd = (imageData: BoardData) => {
      if (!crdtRef.current) return;

      console.log("📥 Received image:add:", {
        id: imageData.id,
        version: imageData.version,
      });

      crdtRef.current.updateClock(imageData.vectorClock);

      setImages((prev) => {
        const exists = prev.find((i) => i.id === imageData.id);

        if (exists) {
          const resolved = crdtRef.current!.resolveConflict(exists, imageData);
          return prev.map((i) => (i.id === imageData.id ? resolved : i));
        }

        return [...prev, imageData];
      });
    };

    const handleImageUpdate = (imageData: BoardData) => {
      if (!crdtRef.current) return;

      console.log("📥 Received image:update:", {
        id: imageData.id,
        version: imageData.version,
      });

      crdtRef.current.updateClock(imageData.vectorClock);

      setImages((prev) => {
        const local = prev.find((i) => i.id === imageData.id);

        if (!local) {
          return [...prev, imageData];
        }

        const resolved = crdtRef.current!.resolveConflict(local, imageData);
        return prev.map((i) => (i.id === imageData.id ? resolved : i));
      });
    };

    const handleImageDelete = (imageId: string | number) => {
      console.log("📥 Received image:delete:", imageId);
      setImages((prev) => prev.filter((i) => i.id !== imageId));
    };

    // Register all listeners
    socket.on("canvas:stroke", handleCanvasStroke);
    socket.on("canvas:sync", handleCanvasSync);
    socket.on("canvas:clear", handleCanvasClear);
    socket.on("userIsJoined", handleUserList);
    socket.on("allUsers", handleUserList);
    socket.on("board:add", handleBoardAdd);
    socket.on("board:update", handleBoardUpdate);
    socket.on("board:delete", handleBoardDelete);
    socket.on("image:add", handleImageAdd);
    socket.on("image:update", handleImageUpdate);
    socket.on("image:delete", handleImageDelete);

    return () => {
      socket.off("canvas:stroke", handleCanvasStroke);
      socket.off("canvas:sync", handleCanvasSync);
      socket.off("canvas:clear", handleCanvasClear);
      socket.off("userIsJoined", handleUserList);
      socket.off("allUsers", handleUserList);
      socket.off("board:add", handleBoardAdd);
      socket.off("board:update", handleBoardUpdate);
      socket.off("board:delete", handleBoardDelete);
      socket.off("image:add", handleImageAdd);
      socket.off("image:update", handleImageUpdate);
      socket.off("image:delete", handleImageDelete);
      socket.disconnect();
    };
  }, [roomId, userEmail]);

  // ==========================================
  // CANVAS DRAWING  ⭐ SAVE TO FIRESTORE WHEN DONE
  // ==========================================
  const emitCanvasImage = () => {
    const canvas = canvasRef.current;
    if (!canvas || !roomId) return;
    const image = canvas.toDataURL("image/png");
    socket.emit("draw", { roomId, image });
    saveThrottled(); // ⭐ SAVE HERE
  };

  const undo = () => {
    setCanvasStrokes((prev) => {
      if (prev.length === 0) return prev;
      const newStrokes = prev.slice(0, -1); // Remove last stroke
      socket.emit("canvas:undo", {
        roomId,
        strokeId: prev[prev.length - 1].id,
      });
      saveThrottled();
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
    saveThrottled();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let tempStrokePoints: Point[] = []; // Temporarily store points while drawing

    const handleMouseDown = (e: MouseEvent) => {
      setIsDrawing(true);
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Start new stroke
      tempStrokePoints = [{ x, y }];

      setStartX(x);
      setStartY(y);
      setImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));

      if (selectedTool === "pencil") {
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawing) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Add point to current stroke
      tempStrokePoints.push({ x, y });

      // For shapes, restore canvas to show preview
      if (["line", "rect", "circle"].includes(selectedTool) && imageData) {
        ctx.putImageData(imageData, 0, 0);
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
          ctx.moveTo(startX, startY);
          ctx.lineTo(x, y);
          ctx.stroke();
          break;
        case "rect": {
          const width = x - startX;
          const height = y - startY;
          ctx.strokeRect(startX, startY, width, height);
          break;
        }
        case "circle": {
          const radius = Math.sqrt(
            Math.pow(x - startX, 2) + Math.pow(y - startY, 2)
          );
          ctx.beginPath();
          ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
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
      if (!isDrawing) return;
      setIsDrawing(false);

      if (!crdtRef.current) return;

      // Create stroke object
      let strokePoints = tempStrokePoints;

      // For shapes, only need start/end points
      if (["line", "rect", "circle"].includes(selectedTool)) {
        strokePoints = [
          { x: startX, y: startY },
          strokePoints[strokePoints.length - 1],
        ];
      }

      // Create CRDT stroke
      const newStroke = crdtRef.current.createStroke({
        tool: selectedTool as any,
        points: strokePoints,
        color: selectedColor,
        lineWidth: brushSize,
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
  }, [
    isDrawing,
    selectedTool,
    selectedColor,
    brushSize,
    startX,
    startY,
    imageData,
    roomId,
  ]);

  // Add this near your other useEffects

  useEffect(() => {
    renderAllStrokes();
  }, [canvasStrokes]); // Re-render whenever strokes change

  // ==========================================
  // 4. BOARD & IMAGE MANAGEMENT LOGIC
  // ==========================================

  const determineNewPosition = () => {
    if (typeof window === "undefined") return { x: 100, y: 100 };
    return {
      x: Math.floor(Math.random() * (window.innerWidth / 2)),
      y: Math.floor(Math.random() * (window.innerHeight / 2)),
    };
  };

  const checkForOverlap = (id: number | string) => {
    const currentNoteRef = itemRefs.current[id]?.current;
    if (!currentNoteRef) return false;
    const currentRect = currentNoteRef.getBoundingClientRect();

    const allItems = [...boards, ...images];

    return allItems.some((item) => {
      if (item.id === id) return false;
      const otherNoteRef = itemRefs.current[item.id]?.current;
      if (!otherNoteRef) return false;
      const otherRect = otherNoteRef.getBoundingClientRect();

      return !(
        currentRect.right < otherRect.left ||
        currentRect.left > otherRect.right ||
        currentRect.bottom < otherRect.top ||
        currentRect.top > otherRect.bottom
      );
    });
  };

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

    // Add CRDT metadata
    const newBoard = crdtRef.current.createOperation(baseBoard);

    console.log("➕ Adding board with CRDT metadata:", {
      id: newBoard.id,
      version: newBoard.version,
      vectorClock: newBoard.vectorClock,
    });

    setBoards((prev) => [...prev, newBoard]);
    socket.emit("board:add", { roomId, boardData: newBoard });

    // Persist to Firestore
    saveThrottled();

    setNewBoardTitle("");
    setIsModalOpen(false);
  };

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const MAX_DIM = 800;

          if (width > height) {
            if (width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !crdtRef.current) return;

    try {
      const base64Image = await resizeImage(file);

      const baseImage = {
        id: Date.now(),
        type: "image" as const,
        name: file.name,
        position: determineNewPosition(),
        content: base64Image,
      };

      // Add CRDT metadata
      const newImage = crdtRef.current.createOperation(baseImage);

      console.log("🖼️ Adding image with CRDT metadata:", {
        id: newImage.id,
        version: newImage.version,
      });

      setImages((prev) => [...prev, newImage]);
      socket.emit("image:add", { roomId, imageData: newImage });
      saveThrottled();
    } catch (err) {
      console.error("Image processing failed", err);
      alert("Could not process image.");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateItemPosition = (
    id: number | string,
    newPosition: Position,
    type: "text" | "image"
  ) => {
    if (!crdtRef.current) {
      console.error("❌ CRDT Manager not initialized");
      return;
    }

    if (type === "text") {
      const board = boards.find((b) => b.id === id);
      if (board) {
        const updated = crdtRef.current.createOperation({
          ...board,
          position: newPosition,
        });

        console.log("🔄 Updating board position with CRDT:", {
          id: updated.id,
          version: updated.version,
        });

        setBoards((prev) => prev.map((b) => (b.id === id ? updated : b)));
        socket.emit("board:update", { roomId, boardData: updated });
        saveThrottled();
      }
    } else {
      const img = images.find((i) => i.id === id);
      if (img) {
        const updated = crdtRef.current.createOperation({
          ...img,
          position: newPosition,
        });

        console.log("🔄 Updating image position with CRDT:", {
          id: updated.id,
          version: updated.version,
        });

        setImages((prev) => prev.map((i) => (i.id === id ? updated : i)));
        socket.emit("image:update", { roomId, imageData: updated });
        saveThrottled();
      }
    }
  };

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

  const updateBoardContent = (id: number | string, newContent: string) => {
    if (!crdtRef.current) return;

    const board = boards.find((b) => b.id === id);
    if (!board || board.content === newContent) return;

    const updatedBoard = crdtRef.current.createOperation({
      ...board,
      content: newContent,
    });

    console.log("✏️ Updating board content with CRDT:", {
      id: updatedBoard.id,
      version: updatedBoard.version,
    });

    setBoards((prev) => prev.map((b) => (b.id === id ? updatedBoard : b)));
    socket.emit("board:update", { roomId, boardData: updatedBoard });
    saveThrottled();
  };

  const emitDeleteItem = (id: number | string, type: "text" | "image") => {
    if (type === "text") {
      socket.emit("board:delete", { roomId, boardId: id });
      setBoards((prev) => prev.filter((b) => b.id !== id));
    } else {
      socket.emit("image:delete", { roomId, imageId: id });
      setImages((prev) => prev.filter((img) => img.id !== id));
    }
  };

  const handleDragStart = (item: BoardData, e: React.MouseEvent) => {
    e.preventDefault();
    const { id } = item;
    const itemRef = itemRefs.current[id]?.current;
    const container = containerRef.current;
    if (!itemRef || !container) return;

    const itemRect = itemRef.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offsetX = e.clientX - itemRect.left;
    const offsetY = e.clientY - itemRect.top;
    const startPos = item.position;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - offsetX - containerRect.left;
      let newY = e.clientY - offsetY - containerRect.top;
      if (newY < 0) newY = 0;

      itemRef.style.left = `${newX}px`;
      itemRef.style.top = `${newY}px`;
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      const finalRect = itemRef.getBoundingClientRect();
      const newPosition = {
        x: finalRect.left - containerRect.left,
        y: finalRect.top - containerRect.top,
      };

      if (checkForOverlap(id)) {
        itemRef.style.left = `${startPos.x}px`;
        itemRef.style.top = `${startPos.y}px`;
      } else {
        updateItemPosition(id, newPosition, item.type);
      }
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas to a large fixed size ONCE
    canvas.width = 3000;
    canvas.height = 2000;

    console.log("✅ Canvas fixed at:", canvas.width, "x", canvas.height);

    // NO resize listener - canvas stays at fixed size
  }, []);

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
        onChange={handleImageUpload}
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
          </div>
        </div>

        <div className="flex items-center gap-4">
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

          {/* LOGOUT BUTTON */}
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
                onMouseDown={(e) => handleDragStart(board, e)}
                onRename={(newName) =>
                  updateItemName(board.id, newName, "text")
                }
                onDelete={() => emitDeleteItem(board.id, "text")}
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
                onMouseDown={(e) => handleDragStart(img, e)}
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
