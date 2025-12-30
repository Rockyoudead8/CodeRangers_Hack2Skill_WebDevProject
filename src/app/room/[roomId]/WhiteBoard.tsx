'use client';

import { useEffect, useRef, useState, createRef } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

import toast from 'react-hot-toast';
import { socket } from '../../lib/socket';
import Board from './Board';
import IBoard from './IBoard';

import { saveBoard, subscribeToBoard } from "@/lib/roomService";

// ==========================================
// 1. TYPES & HELPER FUNCTIONS (Outside Component)
// ==========================================

type Position = { x: number; y: number };

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  tool: 'pencil' | 'eraser' | 'line' | 'rect' | 'circle';
  color: string;
  width: number;
  points: Point[];
}

type BoardData = {
  id: number | string;
  type: 'text' | 'image';
  name: string;
  position: Position;
  content: string;
};

interface WhiteboardProps {
  roomId: string;
  userEmail: string;
}

// Helper: Calculate distance from a point (mouse) to a line segment (stroke)
function pointToSegmentDistance(p: Point, v: Point, w: Point) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

// Helper: Draws strokes onto ANY context (Screen or Save File)
const renderStrokesToContext = (ctx: CanvasRenderingContext2D, strokes: Stroke[]) => {
  strokes.forEach(stroke => {
    ctx.beginPath();
    
    // Setup Style
    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = stroke.width;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
    }
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const p = stroke.points;
    if (!p || p.length === 0) return;

    // ✏️ PENCIL / ERASER
    if (stroke.tool === 'pencil' || stroke.tool === 'eraser') {
      ctx.moveTo(p[0].x, p[0].y);
      p.forEach(point => ctx.lineTo(point.x, point.y));
    } 
    // 📏 LINE
    else if (stroke.tool === 'line') {
      ctx.moveTo(p[0].x, p[0].y);
      ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
    }
    // 🟦 RECTANGLE
    else if (stroke.tool === 'rect') {
      const start = p[0];
      const end = p[p.length - 1];
      ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
    }
    // ⭕ CIRCLE
    else if (stroke.tool === 'circle') {
      const start = p[0];
      const end = p[p.length - 1];
      const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
      ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
    }

    ctx.stroke();
  });
};

// ==========================================
// 2. MAIN COMPONENT
// ==========================================

export default function Whiteboard({ roomId, userEmail }: WhiteboardProps) {

  const router = useRouter();

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userIdRef = useRef(userEmail);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedFromDB = useRef(false);
  const latestDataRef = useRef({ strokes: [], boards: [], images: [] });
  const strokesRef = useRef<Stroke[]>([]); // "Live" mirror for eraser logic
  const itemRefs = useRef<any>({});
  const panStartRef = useRef({ x: 0, y: 0 }); 
  const currentPoints = useRef<Point[]>([]); 
  const hasCenteredRef = useRef(false);

  // UI State
  const [selectedTool, setSelectedTool] = useState<'pencil' | 'eraser' | 'line' | 'rect' | 'circle'>('pencil');
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  
  // Data State
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [boards, setBoards] = useState<BoardData[]>([]);
  const [images, setImages] = useState<BoardData[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // 🎥 CAMERA STATE
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  // ==========================================
  // 3. HELPERS & RENDER ENGINE
  // ==========================================

  // Helper: Convert Screen Pixel -> Infinite World Coordinate
  const screenToWorld = (screenX: number, screenY: number) => {
    return {
      x: (screenX - camera.x) / camera.zoom,
      y: (screenY - camera.y) / camera.zoom
    };
  };

  // The Main Render Function
  const redrawCanvas = (strokesToDraw: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // 1. Reset Transform: clear everything, then set base scale to DPR
    // This fixes the "Shift to Top Left" bug
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // 2. Apply Camera (Pan & Zoom)
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // 3. Draw
    renderStrokesToContext(ctx, strokesToDraw);
  };

  // Sync Ref with State
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  // Sync Data for Save
  useEffect(() => {
    // @ts-ignore 
    latestDataRef.current = { strokes, boards, images };
  }, [strokes, boards, images]);

  // ==========================================
  // 4. DATABASE & SAVE LOGIC
  // ==========================================

  // function for doing the summary of the whole whiteboard
  const exportFullBoardImage = () => {
  if (strokes.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  strokes.forEach(s => {
    s.points.forEach(p => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
  });

  const PADDING = 100;
  minX -= PADDING; 
  minY -= PADDING;
  maxX += PADDING; 
  maxY += PADDING;

  const width = maxX - minX;
  const height = maxY - minY;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, width, height);

  ctx.translate(-minX, -minY);
  renderStrokesToContext(ctx, strokes);

  return canvas.toDataURL("image/png");
};


const summarizeEntireBoard = async () => {
  try {
    const image = exportFullBoardImage();
    if (!image) return alert("Board is empty. Draw something first genius.");

    setLoadingSummary(true);

    const res = await fetch("/api/ai/summarizeVisionFull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image })
    });

    const data = await res.json();
    setAiSummary(data.summary || "AI died trying. Probably deserved.");
  } catch (err) {
    console.error(err);
    alert("AI Summarizer crashed.");
  } finally {
    setLoadingSummary(false);
  }
};


  function getViewportImage(canvasRef: any) {
  const canvas = canvasRef.current;
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();

  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = viewWidth;
  tempCanvas.height = viewHeight;

  const ctx = tempCanvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  ctx.drawImage(canvas, -rect.left, -rect.top);

  return tempCanvas.toDataURL("image/png");
}



const summarizeBoard = async () => {
  try {
    const image = getViewportImage(canvasRef);
    if (!image) return alert("Canvas not found. Technology hates us.");

    setLoadingSummary(true);

    const res = await fetch("/api/ai/summarizeVision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image })
    });

    const data = await res.json();
    setAiSummary(data.summary || "AI cried. No idea what this is.");
  } catch (err) {
    console.error(err);
    alert("AI Summarizer crashed. Probably your fault.");
  } finally {
    setLoadingSummary(false);
  }
};


  const handleSaveToDrive = async () => {
    try {
      const token = localStorage.getItem("drive_token");
      if (!token) return alert("Login again with Google");
      if (strokes.length === 0) return alert("Canvas is empty!");

      // 1. Calculate Bounding Box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      strokes.forEach(s => {
        s.points.forEach(p => {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        });
      });

      const PADDING = 50;
      minX -= PADDING; minY -= PADDING;
      maxX += PADDING; maxY += PADDING;
      const width = maxX - minX;
      const height = maxY - minY;

      // 2. Create Virtual Canvas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return;

      // 3. Fill & Shift
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.translate(-minX, -minY);

      // 4. Draw
      renderStrokesToContext(ctx, strokes);

      // 5. Upload
      const blob = await new Promise<Blob>((resolve) => tempCanvas.toBlob((b) => resolve(b!), "image/png"));
      const metadata = { name: `whiteboard-${roomId}.png`, mimeType: "image/png" };
      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", blob);

      await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });

      alert("Saved Snapshot to Drive 📸");
    } catch (e) {
      console.error(e);
      alert("Drive upload failed.");
    }
  };

  function exportBoardData() { return latestDataRef.current; }

  function loadBoardFromData(data: any) {
    if (!data) return;
    if (!hasLoadedFromDB.current && data.strokes && Array.isArray(data.strokes)) {
        if (data.strokes.length > 0) {
           setStrokes(data.strokes);
           requestAnimationFrame(() => redrawCanvas(data.strokes));
        }
        hasLoadedFromDB.current = true;
    }
    if (data.boards) setBoards(data.boards);
    if (data.images) setImages(data.images);
  }

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  function triggerSave() {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveBoard(roomId, exportBoardData());
    }, 1000);
  }

  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeToBoard(roomId, (data) => {
      if (data) loadBoardFromData(data);
    });
    return () => unsub();
  }, [roomId]);

  // ==========================================
  // 🔭 FIXED ZOOM & PAN HANDLER (Non-Passive)
  // ==========================================
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      // 🛑 PREVENT BROWSER NATIVE ZOOM
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }

      // LOGIC: Zoom or Pan
      if (e.ctrlKey || e.metaKey) {
        // ZOOM
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        const newZoom = Math.min(Math.max(camera.zoom + delta, 0.1), 5);

        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate World Mouse based on OLD zoom
        const worldX = (mouseX - camera.x) / camera.zoom;
        const worldY = (mouseY - camera.y) / camera.zoom;

        // Calculate New Camera to keep mouse in same spot
        const newCamX = mouseX - worldX * newZoom;
        const newCamY = mouseY - worldY * newZoom;

        setCamera({ x: newCamX, y: newCamY, zoom: newZoom });
      } else {
        // PAN (Scroll Wheel)
        setCamera(prev => ({
          ...prev,
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }));
      }
      requestAnimationFrame(() => redrawCanvas(strokes));
    };

    // { passive: false } is REQUIRED to stop browser zoom
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', onWheel);
    };
  }, [camera, strokes]); // Re-bind when camera changes to keep math accurate

  // ==========================================
  // 5. INPUT HANDLERS (MOUSE & WHEEL)
  // ==========================================

  

  const startDrawing = (e: React.MouseEvent | MouseEvent) => {
    // Middle Mouse or Spacebar = PAN
    if (e.button === 1 || (e as any).code === 'Space') {
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY };
        return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    // 🚀 Convert to World Coords
    const worldPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

    currentPoints.current = [{ x: worldPos.x, y: worldPos.y }];
  };

  const draw = (e: React.MouseEvent | MouseEvent) => {
    // A. PANNING
    if (isPanning) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        panStartRef.current = { x: e.clientX, y: e.clientY };
        requestAnimationFrame(() => redrawCanvas(strokes));
        return;
    }

    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    // 🚀 World Coords
    const mouse = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

    // B. ERASER
    if (selectedTool === 'eraser') {
      const hitThreshold = 10 / camera.zoom; // Scale threshold with zoom
      
      const strokeIdToDelete = strokesRef.current.find(stroke => {
        const p = stroke.points;
        if (!p || p.length < 2) return false;
        const start = p[0];
        const end = p[p.length - 1];

        if (stroke.tool === 'rect') {
           const TL = { x: start.x, y: start.y };
           const TR = { x: end.x, y: start.y };
           const BR = { x: end.x, y: end.y };
           const BL = { x: start.x, y: end.y };
           return (
             pointToSegmentDistance(mouse, TL, TR) < hitThreshold ||
             pointToSegmentDistance(mouse, TR, BR) < hitThreshold ||
             pointToSegmentDistance(mouse, BR, BL) < hitThreshold ||
             pointToSegmentDistance(mouse, BL, TL) < hitThreshold
           );
        }
        if (stroke.tool === 'circle') {
           const radius = Math.hypot(end.x - start.x, end.y - start.y);
           const distToCenter = Math.hypot(mouse.x - start.x, mouse.y - start.y);
           return Math.abs(distToCenter - radius) < hitThreshold;
        }
        return p.some((point, index) => {
          if (index === p.length - 1) return false;
          return pointToSegmentDistance(mouse, point, p[index + 1]) < hitThreshold;
        });
      })?.id;

      if (strokeIdToDelete) {
        const newStrokes = strokesRef.current.filter(s => s.id !== strokeIdToDelete);
        setStrokes(newStrokes);
        requestAnimationFrame(() => redrawCanvas(newStrokes));
        socket.emit('stroke:delete', { roomId, strokeId: strokeIdToDelete });
        triggerSave();
      }
      return; 
    }

    // C. PENCIL & SHAPES
    if (selectedTool === 'pencil') {
        currentPoints.current.push(mouse);
        const previewStroke: Stroke = { id: 'temp', tool: 'pencil', color: selectedColor, width: brushSize, points: currentPoints.current };
        requestAnimationFrame(() => redrawCanvas([...strokesRef.current, previewStroke]));
    } else {
        currentPoints.current[1] = mouse;
        const previewStroke: Stroke = { id: 'preview', tool: selectedTool, color: selectedColor, width: brushSize, points: currentPoints.current };
        requestAnimationFrame(() => redrawCanvas([...strokesRef.current, previewStroke]));
    }
  };

  const stopDrawing = () => {
    if (isPanning) {
        setIsPanning(false);
        return;
    }
    if (!isDrawing) return;
    setIsDrawing(false);

    const newStroke: Stroke = {
        id: Date.now().toString(),
        tool: selectedTool,
        color: selectedColor,
        width: brushSize,
        points: currentPoints.current
    };

    const updatedStrokes = [...strokes, newStroke];
    setStrokes(updatedStrokes);
    socket.emit('draw', { roomId, stroke: newStroke });
    triggerSave();
  };

  const undo = () => socket.emit('undo', { roomId });
  const redo = () => socket.emit('redo', { roomId });

  //Zoom to fit
  const handleFitView = () => {
    // 1. If empty, reset to World Center
    if (strokes.length === 0) {
      setCamera({ x: 0, y: 0, zoom: 1 });
      requestAnimationFrame(() => redrawCanvas(strokes));
      toast("Reset to Center 🎯");
      return;
    }

    // 2. Calculate Bounding Box of drawings
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    strokes.forEach(s => {
      s.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
    });

    // 3. Get Container Dimensions
    const container = containerRef.current;
    if (!container) return;
    const { clientWidth: viewW, clientHeight: viewH } = container;

    // 4. Calculate Dimensions of the Drawing
    const drawingW = maxX - minX;
    const drawingH = maxY - minY;
    const centerX = minX + drawingW / 2;
    const centerY = minY + drawingH / 2;

    // 5. Determine Zoom (with 10% padding)
    // We assume a minimum width/height of 50 to prevent division by zero or infinite zoom on a single dot
    const safeW = Math.max(drawingW, 50);
    const safeH = Math.max(drawingH, 50);
    
    const scaleX = viewW / safeW;
    const scaleY = viewH / safeH;
    
    // Fit to the smallest dimension (so nothing gets cut off) * 0.9 for padding
    let newZoom = Math.min(scaleX, scaleY) * 0.9;
    
    // Clamp Zoom: Don't zoom in too close (e.g. max 2x) if drawing is tiny, 
    // and don't zoom out too far (e.g. min 0.1x)
    newZoom = Math.min(Math.max(newZoom, 0.1), 2);

    // 6. Calculate Camera Position to Center the Drawing
    // Formula: Camera = ScreenCenter - (WorldCenter * Zoom)
    const newCamX = (viewW / 2) - (centerX * newZoom);
    const newCamY = (viewH / 2) - (centerY * newZoom);

    setCamera({ x: newCamX, y: newCamY, zoom: newZoom });
    requestAnimationFrame(() => redrawCanvas(strokes));
    toast("Canvas Focused 🔭");
  };


  //AUTO-ZOOM ON JOIN

  useEffect(() => {
    // Check 1: Have we already centered the camera? (If yes, stop)
    if (hasCenteredRef.current) return;

    // Check 2: Do we have strokes loaded?
    if (strokes.length > 0) {
      // Execute the "Zoom to Fit" logic
      handleFitView();
      
      // Mark as done so it doesn't run again
      hasCenteredRef.current = true;
    }
  }, [strokes]);

  const clearCanvas = () => {
    socket.emit('clear', { roomId }); 
    setStrokes([]);
    redrawCanvas([]);
    triggerSave(); 
  };

  const handleLogout = async () => {
    try {
      socket.disconnect();
      await signOut(auth);
      localStorage.removeItem("drive_token");
      router.push("/login");
    } catch (error) { console.error(error); }
  };

  // ==========================================
  // 6. SOCKET & EVENT LISTENERS
  // ==========================================

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: any) => startDrawing(e);
    const handleMouseMove = (e: any) => draw(e);
    const handleMouseUp = () => stopDrawing();
    const handleMouseLeave = () => stopDrawing();

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isDrawing, selectedTool, selectedColor, brushSize, roomId, strokes, camera, isPanning]);

  useEffect(() => {
    if (!roomId) return;
    if (!socket.connected) socket.connect();
    
    userIdRef.current = userEmail;
    socket.emit('userJoined', { userId: userEmail, roomId });

    const handleCanvasSync = (serverStrokes: Stroke[]) => {
       setStrokes(serverStrokes);
       requestAnimationFrame(() => redrawCanvas(serverStrokes));
    };

    const handleNewStroke = (newStroke: Stroke) => {
       setStrokes(prev => {
         const updated = [...prev, newStroke];
         requestAnimationFrame(() => redrawCanvas(updated));
         return updated;
       });
    };

    const handleStrokeDelete = (data: { strokeId: string }) => {
       setStrokes(prev => {
         const updated = prev.filter(s => s.id !== data.strokeId);
         requestAnimationFrame(() => redrawCanvas(updated));
         return updated;
       });
    };

    const handleUserList = (data: any) => {
      const userList = Array.isArray(data) ? data : data.users;
      if (userList) setUsers(userList);
    };

    socket.on('canvas:sync', handleCanvasSync);
    socket.on('draw', handleNewStroke);
    socket.on('stroke:delete', handleStrokeDelete);
    socket.on('userIsJoined', handleUserList);
    socket.on('allUsers', handleUserList);

    return () => {
      socket.off('canvas:sync', handleCanvasSync);
      socket.off('draw', handleNewStroke);
      socket.off('stroke:delete', handleStrokeDelete);
      socket.off('userIsJoined', handleUserList);
      socket.off('allUsers', handleUserList);
      socket.disconnect();
    };
  }, [roomId, userEmail]);

  // Canvas Resizer
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      redrawCanvas(strokes);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [strokes]); // Keep strokes in dep to allow redraw on resize

  // ==========================================
  // 7. BOARD/IMAGE LOGIC
  // ==========================================
  
  const determineNewPosition = () => {
    // Center of the current VIEW
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    // We add absolute position based on camera to spawn in center of screen
    return {
      x: (containerRef.current?.clientWidth || 800) / 2 - camera.x,
      y: (containerRef.current?.clientHeight || 600) / 2 - camera.y
    };
  };

  const handleAddBoard = () => {
    if (!newBoardTitle.trim()) return;
    const newBoard: BoardData = {
      id: Date.now(),
      type: 'text',
      name: newBoardTitle,
      position: determineNewPosition(),
      content: '<p>Hello World! 🌎</p>'
    };
    setBoards((prev) => [...prev, newBoard]);
    socket.emit('board:add', { roomId, boardData: newBoard });
    setNewBoardTitle("");
    setIsModalOpen(false);
    triggerSave();
  };

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_DIM = 800;
          if (width > height) {
            if (width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; }
          } else {
            if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64Image = await resizeImage(file);
      const newImage: BoardData = {
        id: Date.now(),
        type: 'image',
        name: file.name,
        position: determineNewPosition(),
        content: base64Image
      };
      setImages((prev) => [...prev, newImage]);
      socket.emit('image:add', { roomId, imageData: newImage });
      triggerSave();
    } catch (err) { toast.error("Could not process image."); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateItemPosition = (id: number | string, newPosition: Position, type: 'text' | 'image') => {
    const targetSet = type === 'text' ? setBoards : setImages;
    const eventName = type === 'text' ? 'board:update' : 'image:update';
    const dataKey = type === 'text' ? 'boardData' : 'imageData';

    targetSet(prev => {
        const item = prev.find(i => i.id === id);
        if(!item) return prev;
        const updated = { ...item, position: newPosition };
        socket.emit(eventName, { roomId, [dataKey]: updated });
        return prev.map(i => i.id === id ? updated : i);
    });
  };

  const updateItemName = (id: number | string, newName: string, type: 'text' | 'image') => {
    const targetSet = type === 'text' ? setBoards : setImages;
    const eventName = type === 'text' ? 'board:update' : 'image:update';
    const dataKey = type === 'text' ? 'boardData' : 'imageData';

    targetSet(prev => {
        const item = prev.find(i => i.id === id);
        if(!item) return prev;
        const updated = { ...item, name: newName };
        socket.emit(eventName, { roomId, [dataKey]: updated });
        return prev.map(i => i.id === id ? updated : i);
    });
  };

  const updateBoardContent = (id: number | string, newContent: string) => {
    setBoards(prev => {
        const board = prev.find(b => b.id === id);
        if(!board || board.content === newContent) return prev;
        const updated = { ...board, content: newContent };
        socket.emit('board:update', { roomId, boardData: updated });
        return prev.map(b => b.id === id ? updated : b);
    });
  };

  const emitDeleteItem = (id: number | string, type: 'text' | 'image') => {
    if (type === 'text') {
      socket.emit('board:delete', { roomId, boardId: id });
      setBoards((prev) => prev.filter(b => b.id !== id));
    } else {
      socket.emit('image:delete', { roomId, imageId: id });
      setImages((prev) => prev.filter(img => img.id !== id));
    }
  };

  const handleDragStart = (item: BoardData, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop pan from triggering
    const { id } = item;
    const itemRef = itemRefs.current[id]?.current;
    if (!itemRef) return;

    // We must account for Zoom when dragging DOM elements
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = item.position;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate delta and divide by zoom to get "World Units" moved
      const dx = (e.clientX - startX) / camera.zoom;
      const dy = (e.clientY - startY) / camera.zoom;
      
      const newX = startPos.x + dx;
      const newY = startPos.y + dy;

      itemRef.style.left = `${newX}px`;
      itemRef.style.top = `${newY}px`;
    };

    const handleMouseUp = (e: MouseEvent) => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      
      const dx = (e.clientX - startX) / camera.zoom;
      const dy = (e.clientY - startY) / camera.zoom;
      updateItemPosition(id, { x: startPos.x + dx, y: startPos.y + dy }, item.type);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };


  // ==========================================
  // 8. RENDER UI
  // ==========================================

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col font-sans">
      <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

      {/* HEADER */}
      <header className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-[70] shrink-0">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight flex items-center gap-2">
            Whiteboard
          </h1>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Room:</span>
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-mono">{roomId}</code>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group z-50">
            <button className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full transition-colors cursor-default">
              <span className="text-sm font-medium text-gray-600">{users.length} Online</span>
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
               <ul className="flex flex-col gap-1 overflow-y-auto max-h-40">
                {users.map((user, i) => (
                  <li key={i} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold bg-blue-500">
                      {user.id ? user.id.charAt(0).toUpperCase() : '?'}
                    </div>
                    <span className="text-sm text-gray-600 truncate max-w-[120px]">{user.id}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white text-sm font-medium px-4 py-2 rounded-lg">
            Add Board
          </button>
          <button onClick={handleSaveToDrive} className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm">
            Save to Google Drive
          </button>

          <button
            onClick={summarizeBoard}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow"
          >
            {loadingSummary ? "Summarizing..." : "AI Summarize"}
          </button>

          <button
  onClick={summarizeEntireBoard}
  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow"
>
  {loadingSummary ? "Processing..." : "AI Full Board Summary"}
</button>

        </div>
      </header>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 scale-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">New Board</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Board Name</label>
              <input type="text" value={newBoardTitle} onChange={(e) => setNewBoardTitle(e.target.value)} placeholder="e.g., Project Notes" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleAddBoard()} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none" />
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
              <button onClick={() => { setIsModalOpen(false); setNewBoardTitle(""); }} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg">Discard</button>
              <button onClick={handleAddBoard} disabled={!newBoardTitle.trim()} className="px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg disabled:opacity-50">Add Board</button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT (INFINITE CANVAS) */}
      <div 
        ref={containerRef} 
        className="relative flex-1 w-full bg-white cursor-crosshair overflow-hidden" 
      >
        <canvas ref={canvasRef} className="absolute top-0 left-0 block w-full h-full" />

        {/* HTML LAYER TRANSFORMED BY CAMERA */}
        <div 
          className="absolute inset-0 z-10 w-full h-full pointer-events-none origin-top-left will-change-transform"
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`
          }}
        >
          {boards.map((board) => (
            <div key={board.id} className="pointer-events-auto absolute">
              <Board 
                ref={itemRefs.current[board.id] ? itemRefs.current[board.id] : (itemRefs.current[board.id] = createRef())} 
                id={board.id} 
                name={board.name} 
                initialPos={board.position} 
                content={board.content} 
                onContentChange={(newContent) => updateBoardContent(board.id, newContent)} 
                onMouseDown={(e) => handleDragStart(board, e)} 
                onRename={(newName) => updateItemName(board.id, newName, 'text')} 
                onDelete={() => emitDeleteItem(board.id, 'text')} 
              />
            </div>
          ))}

          {images.map((img) => (
            <div key={img.id} className="pointer-events-auto absolute">
              <IBoard 
                ref={itemRefs.current[img.id] ? itemRefs.current[img.id] : (itemRefs.current[img.id] = createRef())} 
                id={img.id} 
                name={img.name} 
                initialPos={img.position} 
                content={img.content} 
                onMouseDown={(e) => handleDragStart(img, e)} 
                onRename={(newName) => updateItemName(img.id, newName, 'image')} 
                onDelete={() => emitDeleteItem(img.id, 'image')} 
              />
            </div>
          ))}
        </div>

        {/* TOOLBAR */}
        <aside 
          className={`
            fixed z-[80] bg-white/95 backdrop-blur-sm shadow-xl border border-gray-200/60 p-3 flex gap-5 transition-all duration-300 ease-in-out rounded-full flex-row items-center
            
            ${/* MOBILE: Bottom Center & Slide Down */ ''}
            bottom-6 left-1/2 -translate-x-1/2
            ${isToolbarVisible ? 'translate-y-0 opacity-100' : 'translate-y-[200%] opacity-0'}

            ${/* DESKTOP: Top Left & Slide Left */ ''}
            md:top-28 md:left-4 md:bottom-auto
            md:translate-y-0  ${/* Stops it from sliding down on desktop */ ''}
            ${isToolbarVisible ? 'md:translate-x-0' : 'md:-translate-x-[150%]'}

            ${/* SHAPE: Rounded Square on Desktop */ ''}
            md:rounded-2xl md:flex-col md:items-start
          `}
        >
          {/* ... (Your buttons inside remain exactly the same) ... */}
          
          <div className="flex md:flex-col flex-row gap-1.5">
            {[
              { id: 'pencil', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg> },
              { id: 'line', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="19" x2="19" y2="5"></line></svg> },
              { id: 'rect', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg> },
              { id: 'circle', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle></svg> },
              { id: 'eraser', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg> },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTool(t.id as any)}
                className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                  selectedTool === t.id ? 'bg-black text-white' : 'hover:bg-gray-100 text-gray-500'
                }`}
                title={t.id.charAt(0).toUpperCase() + t.id.slice(1)}
              >
                {t.icon}
              </button>
            ))}
          </div>

          <div className="md:h-px md:w-full w-px h-8 bg-gray-200"></div>

          <div className="flex md:flex-col flex-row gap-2 items-center">
            <input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} className="w-8 h-8 rounded-full border-2 border-white cursor-pointer" />
            <input type="range" min="1" max="20" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="md:w-1.5 md:h-20 w-20 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer" style={{ writingMode: typeof window !== 'undefined' && window.innerWidth >= 768 ? 'vertical-lr' : 'horizontal-tb' } as any} />
          </div>

          <div className="md:h-px md:w-full w-px h-8 bg-gray-200"></div>

          <button onClick={() => fileInputRef.current?.click()} className="p-1 rounded-xl flex items-center justify-center transition-all hover:bg-gray-100 text-gray-500" title="Upload Image">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
          </button>

          <div className="md:h-px md:w-full w-px h-8 bg-gray-200"></div>

          <div className="flex md:flex-col flex-row gap-1">
            <button onClick={undo} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Undo">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
            </button>
            <button onClick={redo} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Redo">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" /></svg>
            </button>
            <button onClick={handleFitView} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Fit to Content">
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
            </button>
            <button onClick={clearCanvas} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Clear Canvas">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
            </button>
          </div>
        </aside>

         {/* TOGGLE BUTTON */}
        <div className="fixed z-[80] bottom-24 left-4 md:left-0 md:top-28 md:bottom-auto">
          <button 
            onClick={() => setIsToolbarVisible(!isToolbarVisible)} 
            className="bg-white border border-gray-200 md:border-l-0 text-gray-600 p-2 md:pr-3 rounded-full md:rounded-r-xl md:rounded-l-none shadow-md hover:bg-gray-50 transition-colors"
          >
            {isToolbarVisible ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-90 md:rotate-0"><path d="m15 18-6-6 6-6" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            )}
          </button>
        </div>

        {aiSummary && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-gray-900 text-white p-6 rounded-2xl max-w-2xl w-full border border-gray-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">AI Summary</h2>

            <pre className="text-gray-300 whitespace-pre-wrap max-h-[60vh] overflow-y-auto leading-relaxed">
              {aiSummary}
            </pre>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setAiSummary(null)}
                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 rounded-lg font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

// 'use client';

// import { useEffect, useRef, useState, createRef } from 'react';
// import { useRouter } from 'next/navigation';
// import { signOut } from "firebase/auth";
// import { auth } from "@/lib/firebase";

// import axios from 'axios';
// import toast from 'react-hot-toast';
// import { socket } from '../../lib/socket';
// import Board from './Board';
// import IBoard from './IBoard';

// import { saveBoard, subscribeToBoard } from "@/lib/roomService";

// // ==========================================
// // 1. NEW TYPES FOR VECTOR ENGINE
// // ==========================================
// type Position = { x: number; y: number };

// interface Point {
//   x: number;
//   y: number;
// }

// interface Stroke {
//   id: string;
//   tool: 'pencil' | 'eraser' | 'line' | 'rect' | 'circle';
//   color: string;
//   width: number;
//   points: Point[];
// }

// type BoardData = {
//   id: number | string;
//   type: 'text' | 'image';
//   name: string;
//   position: Position;
//   content: string;
// };

// interface WhiteboardProps {
//   roomId: string;
//   userEmail: string;
// }

// // Helper: Calculate distance from a point (mouse) to a line segment (stroke)
// function pointToSegmentDistance(p: Point, v: Point, w: Point) {
//   const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
//   if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
//   let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
//   t = Math.max(0, Math.min(1, t));
//   return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
// }

// // Helper: Draws strokes onto ANY context (Screen or Save File)
// const renderStrokesToContext = (ctx: CanvasRenderingContext2D, strokes: Stroke[]) => {
//   strokes.forEach(stroke => {
//     ctx.beginPath();
    
//     // Setup Style
//     if (stroke.tool === 'eraser') {
//       ctx.globalCompositeOperation = 'destination-out';
//       ctx.lineWidth = stroke.width;
//     } else {
//       ctx.globalCompositeOperation = 'source-over';
//       ctx.strokeStyle = stroke.color;
//       ctx.lineWidth = stroke.width;
//     }
    
//     ctx.lineCap = 'round';
//     ctx.lineJoin = 'round';

//     const p = stroke.points;
//     if (!p || p.length === 0) return;

//     // ✏️ PENCIL / ERASER
//     if (stroke.tool === 'pencil' || stroke.tool === 'eraser') {
//       ctx.moveTo(p[0].x, p[0].y);
//       p.forEach(point => ctx.lineTo(point.x, point.y));
//     } 
//     // 📏 LINE
//     else if (stroke.tool === 'line') {
//       ctx.moveTo(p[0].x, p[0].y);
//       ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
//     }
//     // 🟦 RECTANGLE
//     else if (stroke.tool === 'rect') {
//       const start = p[0];
//       const end = p[p.length - 1];
//       ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
//     }
//     // ⭕ CIRCLE
//     else if (stroke.tool === 'circle') {
//       const start = p[0];
//       const end = p[p.length - 1];
//       const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
//       ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
//     }

//     ctx.stroke();
//   });
// };

// export default function Whiteboard({ roomId, userEmail }: WhiteboardProps) {

//   const router = useRouter();

//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const containerRef = useRef<HTMLDivElement>(null);
//   const userIdRef = useRef(userEmail);
//   const fileInputRef = useRef<HTMLInputElement>(null);
//   const hasLoadedFromDB = useRef(false);
//   const latestDataRef = useRef({ strokes: [], boards: [], images: [] });
//   const strokesRef = useRef<Stroke[]>([]);


//   // Drawing State
//   const [selectedTool, setSelectedTool] = useState<'pencil' | 'eraser' | 'line' | 'rect' | 'circle'>('pencil');
//   const [selectedColor, setSelectedColor] = useState('#000000');
//   const [brushSize, setBrushSize] = useState(2);
//   const [isDrawing, setIsDrawing] = useState(false);
  
//   // Vector State
//   const [strokes, setStrokes] = useState<Stroke[]>([]);
//   const currentPoints = useRef<Point[]>([]); // Ref is faster for high-frequency updates

//   const [isToolbarVisible, setIsToolbarVisible] = useState(true);
//   const [boards, setBoards] = useState<BoardData[]>([]);
//   const [images, setImages] = useState<BoardData[]>([]);
//   const itemRefs = useRef<any>({});
//   const [users, setUsers] = useState<any[]>([]);
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [newBoardTitle, setNewBoardTitle] = useState("");

//   // 🎥 CAMERA STATE
//   const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
//   const [isPanning, setIsPanning] = useState(false);
//   const panStartRef = useRef({ x: 0, y: 0 }); // Where we started dragging the camera
  
//   // Helper: Convert Screen Pixel -> Infinite World Coordinate
//   const screenToWorld = (screenX: number, screenY: number) => {
//     return {
//       x: (screenX - camera.x) / camera.zoom,
//       y: (screenY - camera.y) / camera.zoom
//     };
//   };

//   const handleWheel = (e: React.WheelEvent) => {
//     // Ctrl + Wheel = Zoom
//     if (e.ctrlKey || e.metaKey) {
//         e.preventDefault(); // Stop browser zoom
        
//         const zoomSensitivity = 0.001;
//         const delta = -e.deltaY * zoomSensitivity;
//         const newZoom = Math.min(Math.max(camera.zoom + delta, 0.1), 5); // Limit zoom 0.1x to 5x

//         // Zoom towards the mouse pointer
//         // 1. Calculate where mouse is in world BEFORE zoom
//         const rect = canvasRef.current!.getBoundingClientRect();
//         const mouseX = e.clientX - rect.left;
//         const mouseY = e.clientY - rect.top;
//         const worldMouse = screenToWorld(mouseX, mouseY);

//         // 2. Calculate new Camera Position to keep mouse on the same spot
//         const newCamX = mouseX - worldMouse.x * newZoom;
//         const newCamY = mouseY - worldMouse.y * newZoom;

//         setCamera({ x: newCamX, y: newCamY, zoom: newZoom });
//         requestAnimationFrame(() => redrawCanvas(strokes)); // Redraw immediately
//     } 
//     // Normal Wheel = Pan (Horizontal/Vertical)
//     else {
//         setCamera(prev => ({ 
//             ...prev, 
//             x: prev.x - e.deltaX, 
//             y: prev.y - e.deltaY 
//         }));
//         requestAnimationFrame(() => redrawCanvas(strokes));
//     }
//   };
  
//   // ==========================================
//   // 2. THE VECTOR RENDER ENGINE
//   // ==========================================
  
//   // This function replays all strokes. It's the "Screen Refresh".
//  const redrawCanvas = (strokesToDraw: Stroke[]) => {
//     const canvas = canvasRef.current;
//     if (!canvas) return;
//     const ctx = canvas.getContext('2d');
//     if (!ctx) return;

//     // 1. Clear Screen (Use the identity transform to clear the whole visible screen)
//     ctx.setTransform(1, 0, 0, 1, 0, 0); 
//     ctx.clearRect(0, 0, canvas.width, canvas.height);

//     // 2. APPLY CAMERA (Pan & Zoom)
//     ctx.translate(camera.x, camera.y);
//     ctx.scale(camera.zoom, camera.zoom);

//     // 3. Draw the strokes (in World Coordinates)
//     renderStrokesToContext(ctx, strokesToDraw);
//   };

//   // ==========================================
//   // 3. PERSISTENCE (Google Drive / Firestore)
//   // ==========================================

//   const handleSaveToDrive = async () => {
//     try {
//       const token = localStorage.getItem("drive_token");
//       if (!token) return toast.error("Login again with Google");

//       if (strokes.length === 0) return toast.error("Canvas is empty!");

//       // 1. CALCULATE BOUNDING BOX (Finds the size of your drawing)
//       let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

//       strokes.forEach(s => {
//         s.points.forEach(p => {
//           if (p.x < minX) minX = p.x;
//           if (p.y < minY) minY = p.y;
//           if (p.x > maxX) maxX = p.x;
//           if (p.y > maxY) maxY = p.y;
//         });
//       });

//       // Add padding
//       const PADDING = 50;
//       minX -= PADDING; minY -= PADDING;
//       maxX += PADDING; maxY += PADDING;

//       const width = maxX - minX;
//       const height = maxY - minY;

//       // 2. CREATE VIRTUAL CANVAS
//       const tempCanvas = document.createElement('canvas');
//       tempCanvas.width = width;
//       tempCanvas.height = height;
//       const ctx = tempCanvas.getContext('2d');
//       if (!ctx) return;

//       // 3. FILL & SHIFT
//       ctx.fillStyle = '#ffffff';
//       ctx.fillRect(0, 0, width, height);
//       ctx.translate(-minX, -minY); // Shift the camera to fit the drawing

//       // 4. DRAW USING YOUR HELPER
//       renderStrokesToContext(ctx, strokes);

//       // 5. UPLOAD
//       const blob = await new Promise<Blob>((resolve) =>
//         tempCanvas.toBlob((b) => resolve(b!), "image/png")
//       );

//       const metadata = { name: `whiteboard-${roomId}.png`, mimeType: "image/png" };
//       const form = new FormData();
//       form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
//       form.append("file", blob);

//       await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}` },
//         body: form
//       });

//       toast.success("Saved Snapshot to Drive 📸");
//     } catch (e) {
//       console.error(e);
//       toast.error("Drive upload failed.");
//     }
//   };

//   // ==========================================
//   // ⭐ FIRESTORE PERSISTENCE HELPERS (VECTOR UPGRADE)
//   // ==========================================

//   // 1. Prepare data for saving
//   function exportBoardData() {
//     return latestDataRef.current;
//   }

//   // 2. Load data from database
//   function loadBoardFromData(data: any) {
//     if (!data) return;

//     // A. Restore Vectors
//     if (!hasLoadedFromDB.current && data.strokes && Array.isArray(data.strokes)) {
//         if (data.strokes.length > 0) {
//            setStrokes(data.strokes);
//            requestAnimationFrame(() => redrawCanvas(data.strokes));
//         }
//         hasLoadedFromDB.current = true;
//     }

//     // B. Restore Boards & Images (Sticky Notes)
//     if (data.boards) setBoards(data.boards);
//     if (data.images) setImages(data.images);
//   }

//  // 3. Debounced Save (Saves 2 seconds AFTER you stop working)
//   const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

//   function triggerSave() {
//     // Clear the previous timer if the user keeps drawing/editing
//     if (saveTimeoutRef.current) {
//       clearTimeout(saveTimeoutRef.current);
//     }

//     // Set a new timer to save in 2000ms (2 seconds)
//     saveTimeoutRef.current = setTimeout(() => {
//       saveBoard(roomId, exportBoardData());
//     }, 1000);
//   }

//   // 4. Subscribe to Realtime Updates (Load on Join)
//   useEffect(() => {
//     if (!roomId) return;
//     // Subscribe to Firestore changes
//     const unsub = subscribeToBoard(roomId, (data) => {
//       if (data) loadBoardFromData(data);
//     });
//     return () => unsub();
//   }, [roomId]);

//   const handleLogout = async () => {
//     try {
//       socket.disconnect();
//       await signOut(auth);
//       localStorage.removeItem("drive_token");
//       router.push("/login");
//     } catch (error) {
//       console.error(error);
//     }
//   };

//   //Sync Ref with states
//   useEffect(() => {
//   strokesRef.current = strokes;
// }, [strokes]);

//   // ==========================================
// // SYNC LATEST DATA TO REF (Fixes Stale Save Bug)
// // ==========================================
// useEffect(() => {
//   // @ts-ignore - Types might complain slightly depending on your strictness, but this is safe
//   latestDataRef.current = { strokes, boards, images };
// }, [strokes, boards, images]);

//   // ==========================================
//   // 4. SOCKET & EVENTS
//   // ==========================================

//   useEffect(() => {
//     if (!roomId) return;
//     if (!socket.connected) socket.connect();
    
//     userIdRef.current = userEmail;
//     socket.emit('userJoined', { userId: userEmail, roomId });

//     // Handle initial load of all strokes
//     const handleCanvasSync = (serverStrokes: Stroke[]) => {
//        setStrokes(serverStrokes);
//        requestAnimationFrame(() => redrawCanvas(serverStrokes));
//     };

//     // Handle a single new stroke coming in
//     const handleNewStroke = (newStroke: Stroke) => {
//        setStrokes(prev => {
//          const updated = [...prev, newStroke];
//          // Optimization: We could just draw this one line, but redrawing all is safer for "layering"
//          requestAnimationFrame(() => redrawCanvas(updated));
//          return updated;
//        });
//     };

//     // Handle Deletion
//     const handleStrokeDelete = (data: { strokeId: string }) => {
//        setStrokes(prev => {
//          const updated = prev.filter(s => s.id !== data.strokeId);
//          requestAnimationFrame(() => redrawCanvas(updated));
//          return updated;
//        });
//     };

//     const handleUserList = (data: any) => {
//       const userList = Array.isArray(data) ? data : data.users;
//       if (userList) setUsers(userList);
//     };

//     socket.on('canvas:sync', handleCanvasSync);
//     socket.on('draw', handleNewStroke);
//     socket.on('stroke:delete', handleStrokeDelete);
//     socket.on('userIsJoined', handleUserList);
//     socket.on('allUsers', handleUserList);

//     return () => {
//       socket.off('canvas:sync', handleCanvasSync);
//       socket.off('draw', handleNewStroke);
//       socket.off('stroke:delete', handleStrokeDelete);
//       socket.off('userIsJoined', handleUserList);
//       socket.off('allUsers', handleUserList);
//       socket.disconnect();
//     };
//   }, [roomId, userEmail]);


//   // ==========================================
//   // 5. MOUSE EVENT HANDLERS (The New Logic)
//   // ==========================================

//   const startDrawing = (e: React.MouseEvent | MouseEvent) => {
//     // Middle Mouse (button 1) or Spacebar pressed = PANNING
//     if (e.button === 1 || (e as any).code === 'Space') {
//         setIsPanning(true);
//         panStartRef.current = { x: e.clientX, y: e.clientY };
//         return;
//     }

//     // Left Mouse = DRAWING
//     const canvas = canvasRef.current;
//     if (!canvas) return;
    
//     setIsDrawing(true);
//     const rect = canvas.getBoundingClientRect();
//     const screenX = e.clientX - rect.left;
//     const screenY = e.clientY - rect.top;

//     // 🚀 CONVERT TO WORLD COORDINATES
//     const worldPos = screenToWorld(screenX, screenY);

//     currentPoints.current = [{ x: worldPos.x, y: worldPos.y }];
//   };

//   const draw = (e: React.MouseEvent | MouseEvent) => {
//     // 1. PANNING LOGIC
//     if (isPanning) {
//         const dx = e.clientX - panStartRef.current.x;
//         const dy = e.clientY - panStartRef.current.y;
        
//         setCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
//         panStartRef.current = { x: e.clientX, y: e.clientY };
        
//         requestAnimationFrame(() => redrawCanvas(strokes));
//         return;
//     }

//     // 2. DRAWING LOGIC
//     if (!isDrawing) return;
//     const canvas = canvasRef.current;
//     if (!canvas) return;
//     const rect = canvas.getBoundingClientRect();
//     const screenX = e.clientX - rect.left;
//     const screenY = e.clientY - rect.top;
    
//     // 🚀 CONVERT TO WORLD COORDINATES
//     const worldPos = screenToWorld(screenX, screenY);

//     // ... (Eraser Logic - Update 'x' and 'y' to use worldPos.x / worldPos.y) ...
//     // ... (Your Eraser Logic stays exactly the same, just pass worldPos instead of raw x/y)

//     // PENCIL / SHAPES
//     if (selectedTool === 'pencil') {
//         currentPoints.current.push(worldPos); // Save World Pos
        
//         // We can't use simple ctx.lineTo anymore because of the camera.
//         // It's easier to just redraw the whole scene + current stroke
//         const previewStroke: Stroke = {
//              id: 'temp', tool: 'pencil', color: selectedColor, width: brushSize, points: currentPoints.current
//         };
//         requestAnimationFrame(() => redrawCanvas([...strokesRef.current, previewStroke]));
//     } else {
//         // Shapes
//         currentPoints.current[1] = worldPos;
//         const previewStroke: Stroke = {
//           id: 'preview', tool: selectedTool, color: selectedColor, width: brushSize, points: currentPoints.current
//         };
//         requestAnimationFrame(() => redrawCanvas([...strokesRef.current, previewStroke]));
//     }
//   };

//   const stopDrawing = () => {
//     if (isPanning) {
//         setIsPanning(false);
//         return;
//     }
//     if (!isDrawing) return;
//     setIsDrawing(false);

//     // Save stroke (Logic unchanged)
//     const newStroke: Stroke = {
//         id: Date.now().toString(),
//         tool: selectedTool,
//         color: selectedColor,
//         width: brushSize,
//         points: currentPoints.current
//     };

//     const updatedStrokes = [...strokes, newStroke];
//     setStrokes(updatedStrokes);
//     socket.emit('draw', { roomId, stroke: newStroke });
//     triggerSave();
//   };

//   const undo = () => socket.emit('undo', { roomId });
//   const redo = () => socket.emit('redo', { roomId });
//   const clearCanvas = () => {
//     // 1. Notify other users
//     socket.emit('clear', { roomId }); 

//     // 2. Clear local state immediately
//     setStrokes([]);
//     redrawCanvas([]);

//     // 3. Save the empty state to the database
//     triggerSave(); 
//   };

//   // Attach Listeners
//   useEffect(() => {
//     const canvas = canvasRef.current;
//     if (!canvas) return;

//     // We cast to any here because React Typescript events vs Native events can be tricky
//     const handleMouseDown = (e: any) => startDrawing(e);
//     const handleMouseMove = (e: any) => draw(e);
//     const handleMouseUp = () => stopDrawing();
//     const handleMouseLeave = () => stopDrawing();

//     canvas.addEventListener('mousedown', handleMouseDown);
//     canvas.addEventListener('mousemove', handleMouseMove);
//     canvas.addEventListener('mouseup', handleMouseUp);
//     canvas.addEventListener('mouseleave', handleMouseLeave);

//     return () => {
//       canvas.removeEventListener('mousedown', handleMouseDown);
//       canvas.removeEventListener('mousemove', handleMouseMove);
//       canvas.removeEventListener('mouseup', handleMouseUp);
//       canvas.removeEventListener('mouseleave', handleMouseLeave);
//     };
//   }, [isDrawing, selectedTool, selectedColor, brushSize, roomId, strokes]);


//   // ==========================================
//   // 6. BOARD & IMAGE LOGIC (Kept same as before)
//   // ==========================================
//   // ... (All Board management functions remain exactly the same) ...

//   const determineNewPosition = () => {
//     if (typeof window === 'undefined') return { x: 100, y: 100 };
//     return {
//       x: Math.floor(Math.random() * (window.innerWidth / 2)),
//       y: Math.floor(Math.random() * (window.innerHeight / 2))
//     };
//   };

//   const checkForOverlap = (id: number | string) => {
//     const currentNoteRef = itemRefs.current[id]?.current;
//     if (!currentNoteRef) return false;
//     const currentRect = currentNoteRef.getBoundingClientRect();
//     const allItems = [...boards, ...images];

//     return allItems.some((item) => {
//       if (item.id === id) return false;
//       const otherNoteRef = itemRefs.current[item.id]?.current;
//       if (!otherNoteRef) return false;
//       const otherRect = otherNoteRef.getBoundingClientRect();

//       return !(
//         currentRect.right < otherRect.left ||
//         currentRect.left > otherRect.right ||
//         currentRect.bottom < otherRect.top ||
//         currentRect.top > otherRect.bottom
//       );
//     });
//   };

//   const handleAddBoard = () => {
//     if (!newBoardTitle.trim()) return;
//     const newBoard: BoardData = {
//       id: Date.now(),
//       type: 'text',
//       name: newBoardTitle,
//       position: determineNewPosition(),
//       content: '<p>Hello World! 🌎</p>'
//     };
//     setBoards((prev) => [...prev, newBoard]);
//     socket.emit('board:add', { roomId, boardData: newBoard });
//     setNewBoardTitle("");
//     setIsModalOpen(false);
//     triggerSave();
//   };

//   // Image Helper
//   const resizeImage = (file: File): Promise<string> => {
//     return new Promise((resolve) => {
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const img = new Image();
//         img.onload = () => {
//           const canvas = document.createElement('canvas');
//           let width = img.width;
//           let height = img.height;
//           const MAX_DIM = 800;
//           if (width > height) {
//             if (width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; }
//           } else {
//             if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; }
//           }
//           canvas.width = width;
//           canvas.height = height;
//           const ctx = canvas.getContext('2d');
//           ctx?.drawImage(img, 0, 0, width, height);
//           resolve(canvas.toDataURL('image/jpeg', 0.8));
//         };
//         img.src = e.target?.result as string;
//       };
//       reader.readAsDataURL(file);
//     });
//   };

//   const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     try {
//       const base64Image = await resizeImage(file);
//       const newImage: BoardData = {
//         id: Date.now(),
//         type: 'image',
//         name: file.name,
//         position: determineNewPosition(),
//         content: base64Image
//       };
//       setImages((prev) => [...prev, newImage]);
//       socket.emit('image:add', { roomId, imageData: newImage });
//       triggerSave();
//     } catch (err) {
//       toast.error("Could not process image.");
//     }
//     if (fileInputRef.current) fileInputRef.current.value = "";
//   };

//   // Update handlers
//   const updateItemPosition = (id: number | string, newPosition: Position, type: 'text' | 'image') => {
//     const targetSet = type === 'text' ? setBoards : setImages;
//     const eventName = type === 'text' ? 'board:update' : 'image:update';
//     const dataKey = type === 'text' ? 'boardData' : 'imageData';

//     targetSet(prev => {
//         const item = prev.find(i => i.id === id);
//         if(!item) return prev;
//         const updated = { ...item, position: newPosition };
//         socket.emit(eventName, { roomId, [dataKey]: updated });
//         return prev.map(i => i.id === id ? updated : i);
//     });
//   };

//   const updateItemName = (id: number | string, newName: string, type: 'text' | 'image') => {
//     const targetSet = type === 'text' ? setBoards : setImages;
//     const eventName = type === 'text' ? 'board:update' : 'image:update';
//     const dataKey = type === 'text' ? 'boardData' : 'imageData';

//     targetSet(prev => {
//         const item = prev.find(i => i.id === id);
//         if(!item) return prev;
//         const updated = { ...item, name: newName };
//         socket.emit(eventName, { roomId, [dataKey]: updated });
//         return prev.map(i => i.id === id ? updated : i);
//     });
//   };

//   const updateBoardContent = (id: number | string, newContent: string) => {
//     setBoards(prev => {
//         const board = prev.find(b => b.id === id);
//         if(!board || board.content === newContent) return prev;
//         const updated = { ...board, content: newContent };
//         socket.emit('board:update', { roomId, boardData: updated });
//         return prev.map(b => b.id === id ? updated : b);
//     });
//   };

//   const emitDeleteItem = (id: number | string, type: 'text' | 'image') => {
//     if (type === 'text') {
//       socket.emit('board:delete', { roomId, boardId: id });
//       setBoards((prev) => prev.filter(b => b.id !== id));
//     } else {
//       socket.emit('image:delete', { roomId, imageId: id });
//       setImages((prev) => prev.filter(img => img.id !== id));
//     }
//   };

//   const handleDragStart = (item: BoardData, e: React.MouseEvent) => {
//     e.preventDefault();
//     const { id } = item;
//     const itemRef = itemRefs.current[id]?.current;
//     const container = containerRef.current;
//     if (!itemRef || !container) return;

//     const itemRect = itemRef.getBoundingClientRect();
//     const containerRect = container.getBoundingClientRect();
//     const offsetX = e.clientX - itemRect.left;
//     const offsetY = e.clientY - itemRect.top;
//     const startPos = item.position;

//     const handleMouseMove = (e: MouseEvent) => {
//       const newX = e.clientX - offsetX - containerRect.left;
//       let newY = e.clientY - offsetY - containerRect.top;
//       if (newY < 0) newY = 0;
//       itemRef.style.left = `${newX}px`;
//       itemRef.style.top = `${newY}px`;
//     };

//     const handleMouseUp = () => {
//       document.removeEventListener("mousemove", handleMouseMove);
//       document.removeEventListener("mouseup", handleMouseUp);
//       const finalRect = itemRef.getBoundingClientRect();
//       const newPosition = {
//         x: finalRect.left - containerRect.left,
//         y: finalRect.top - containerRect.top
//       };

//       if (checkForOverlap(id)) {
//         itemRef.style.left = `${startPos.x}px`;
//         itemRef.style.top = `${startPos.y}px`;
//       } else {
//         updateItemPosition(id, newPosition, item.type);
//       }
//     };
//     document.addEventListener("mousemove", handleMouseMove);
//     document.addEventListener("mouseup", handleMouseUp);
//   };

//   // Canvas Resizer
// useEffect(() => {
//     const canvas = canvasRef.current;
//     const container = containerRef.current;
//     if (!canvas || !container) return;
//     const ctx = canvas.getContext('2d');
//     if (!ctx) return;

//     const resizeCanvas = () => {
//       const allItems = [...boards, ...images];
//       const lowestItemBottom = allItems.reduce((max, item) => {
//         return Math.max(max, item.position.y + 600);
//       }, 0);

//       const requiredHeight = Math.max(window.innerHeight, lowestItemBottom);
//       const requiredWidth = container.clientWidth;

//       // 👇 THE BLUR FIX STARTS HERE
//       const dpr = window.devicePixelRatio || 1;
      
//       // 1. Set the "Real" resolution (High pixel count)
//       canvas.width = requiredWidth * dpr;
//       canvas.height = requiredHeight * dpr;

//       // 2. Set the "Visual" size (CSS size)
//       canvas.style.width = `${requiredWidth}px`;
//       canvas.style.height = `${requiredHeight}px`;

//       // 3. Scale the context so drawing operations happen at the right size
//       ctx.scale(dpr, dpr);
//       // 👆 THE BLUR FIX ENDS HERE

//       // Re-apply drawing settings (Reset by resizing)
//       ctx.lineCap = 'round';
//       ctx.lineJoin = 'round';

//       // Redraw all strokes immediately
//       redrawCanvas(strokes);
//     };

//     resizeCanvas();
//     window.addEventListener('resize', resizeCanvas);
//     return () => window.removeEventListener('resize', resizeCanvas);
//   }, [boards, images, strokes]);


//   // ==========================================
//   // 7. RENDER (Unchanged UI)
//   // ==========================================

//   return (
//     <div className="bg-gray-50 min-h-screen flex flex-col font-sans">
//       <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

//       {/* HEADER */}
//       <header className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-[70] shrink-0">
//         <div className="flex flex-col">
//           <h1 className="text-lg font-semibold text-gray-900 tracking-tight flex items-center gap-2">
//             Whiteboard
//           </h1>
//           <div className="flex items-center gap-2 text-xs text-gray-500">
//             <span>Room:</span>
//             <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-mono">{roomId}</code>
//           </div>
//         </div>

//         <div className="flex items-center gap-4">
//           <div className="relative group z-50">
//             <button className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full transition-colors cursor-default">
//               <span className="text-sm font-medium text-gray-600">{users.length} Online</span>
//             </button>
//             <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
//                <ul className="flex flex-col gap-1 overflow-y-auto max-h-40">
//                 {users.map((user, i) => (
//                   <li key={i} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg">
//                     <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold bg-blue-500">
//                       {user.id ? user.id.charAt(0).toUpperCase() : '?'}
//                     </div>
//                     <span className="text-sm text-gray-600 truncate max-w-[120px]">{user.id}</span>
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           </div>
//           <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white text-sm font-medium px-4 py-2 rounded-lg">
//             Add Board
//           </button>
//           <button onClick={handleSaveToDrive} className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm">
//             Save to Google Drive
//           </button>
//           <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm">
//             Logout
//           </button>
//         </div>
//       </header>

//       {/* MODAL */}
//       {isModalOpen && (
//         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
//           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 scale-100 animate-in fade-in zoom-in-95 duration-200">
//             <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
//               <h3 className="text-lg font-semibold text-gray-900">New Board</h3>
//             </div>
//             <div className="p-6">
//               <label className="block text-sm font-medium text-gray-700 mb-1">Board Name</label>
//               <input type="text" value={newBoardTitle} onChange={(e) => setNewBoardTitle(e.target.value)} placeholder="e.g., Project Notes" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleAddBoard()} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black outline-none" />
//             </div>
//             <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
//               <button onClick={() => { setIsModalOpen(false); setNewBoardTitle(""); }} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg">Discard</button>
//               <button onClick={handleAddBoard} disabled={!newBoardTitle.trim()} className="px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg disabled:opacity-50">Add Board</button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* MAIN CONTENT */}
//       {/* 1️⃣ CHANGE: Add onWheel handler and overflow-hidden to the container */}
//       <div 
//         ref={containerRef} 
//         className="relative flex-1 w-full bg-white cursor-crosshair overflow-hidden" 
//         onWheel={handleWheel}
//       >
        
//         {/* Canvas stays exactly the same (It is transformed internally via redrawCanvas) */}
//         <canvas ref={canvasRef} className="absolute top-0 left-0 block w-full h-full" />

//         {/* 2️⃣ CHANGE: Apply the Camera Transform to the HTML Layer */}
//         <div 
//           className="absolute inset-0 z-10 w-full h-full pointer-events-none origin-top-left will-change-transform"
//           style={{
//             transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`
//           }}
//         >
//           {/* 3️⃣ CHANGE: Ensure children can be clicked (pointer-events-auto) */}
//           {/* Note: Your individual items already had pointer-events-auto, so this loop logic is mostly unchanged, 
//               we just wrapped it in the transforming div above. */}
          
//           {boards.map((board) => (
//             <div key={board.id} className="pointer-events-auto absolute">
//               <Board 
//                 ref={itemRefs.current[board.id] ? itemRefs.current[board.id] : (itemRefs.current[board.id] = createRef())} 
//                 id={board.id} 
//                 name={board.name} 
//                 initialPos={board.position} 
//                 content={board.content} 
//                 onContentChange={(newContent) => updateBoardContent(board.id, newContent)} 
//                 onMouseDown={(e) => handleDragStart(board, e)} 
//                 onRename={(newName) => updateItemName(board.id, newName, 'text')} 
//                 onDelete={() => emitDeleteItem(board.id, 'text')} 
//               />
//             </div>
//           ))}

//           {images.map((img) => (
//             <div key={img.id} className="pointer-events-auto absolute">
//               <IBoard 
//                 ref={itemRefs.current[img.id] ? itemRefs.current[img.id] : (itemRefs.current[img.id] = createRef())} 
//                 id={img.id} 
//                 name={img.name} 
//                 initialPos={img.position} 
//                 content={img.content} 
//                 onMouseDown={(e) => handleDragStart(img, e)} 
//                 onRename={(newName) => updateItemName(img.id, newName, 'image')} 
//                 onDelete={() => emitDeleteItem(img.id, 'image')} 
//               />
//             </div>
//           ))}
//         </div>

//         {/* TOGGLE BUTTON */}
//         <div className="fixed z-[60] bottom-24 left-4 md:left-0 md:top-1/2 md:bottom-auto md:-translate-y-1/2">
//           <button onClick={() => setIsToolbarVisible(!isToolbarVisible)} className="bg-white border border-gray-200 md:border-l-0 text-gray-600 p-2 md:pr-3 rounded-full md:rounded-r-xl md:rounded-l-none shadow-md hover:bg-gray-50 transition-colors">
//             {isToolbarVisible ? (
//               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-90 md:rotate-0"><path d="m15 18-6-6 6-6" /></svg>
//             ) : (
//               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
//             )}
//           </button>
//         </div>

//         {/* TOOLBAR */}
//         <aside className={`fixed z-50 bg-white/95 backdrop-blur-sm shadow-xl border border-gray-200/60 p-3 flex gap-5 transition-all duration-300 ease-in-out bottom-6 left-1/2 -translate-x-1/2 rounded-full flex-row items-center ${isToolbarVisible ? 'translate-y-0 opacity-100' : 'translate-y-[200%] opacity-0'} md:top-[60%] md:left-4 md:bottom-auto md:translate-x-0 md:-translate-y-1/2 md:rounded-2xl md:flex-col md:items-start md:${isToolbarVisible ? 'md:translate-x-0' : 'md:-translate-x-[150%]'}`}>
//           <div className="flex md:flex-col flex-row gap-1.5">
//             {[
//               { id: 'pencil', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg> },
//               { id: 'line', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="19" x2="19" y2="5"></line></svg> },
//               { id: 'rect', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg> },
//               { id: 'circle', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle></svg> },
//               { id: 'eraser', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg> },
//             ].map((t) => (
//               <button
//                 key={t.id}
//                 onClick={() => setSelectedTool(t.id as any)}
//                 className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
//                   selectedTool === t.id ? 'bg-black text-white' : 'hover:bg-gray-100 text-gray-500'
//                 }`}
//                 title={t.id.charAt(0).toUpperCase() + t.id.slice(1)}
//               >
//                 {t.icon}
//               </button>
//             ))}
//           </div>

//           <div className="md:h-px md:w-full w-px h-8 bg-gray-200"></div>

//           <div className="flex md:flex-col flex-row gap-2 items-center">
//             <input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} className="w-8 h-8 rounded-full border-2 border-white cursor-pointer" />
//             <input type="range" min="1" max="20" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="md:w-1.5 md:h-20 w-20 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer" style={{ writingMode: typeof window !== 'undefined' && window.innerWidth >= 768 ? 'vertical-lr' : 'horizontal-tb' } as any} />
//           </div>

//           <div className="md:h-px md:w-full w-px h-8 bg-gray-200"></div>

//           <button onClick={() => fileInputRef.current?.click()} className="p-1 rounded-xl flex items-center justify-center transition-all hover:bg-gray-100 text-gray-500" title="Upload Image">
//             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
//           </button>

//           <div className="md:h-px md:w-full w-px h-8 bg-gray-200"></div>

//           <div className="flex md:flex-col flex-row gap-1">
//             <button onClick={undo} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
//               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
//             </button>
//             <button onClick={redo} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
//               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" /></svg>
//             </button>
//             <button onClick={clearCanvas} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
//               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
//             </button>
//           </div>
//         </aside>

//       </div>
//     </div>
//   );
// }