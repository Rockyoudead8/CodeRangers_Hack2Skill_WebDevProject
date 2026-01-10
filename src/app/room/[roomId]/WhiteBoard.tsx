'use client';

import { useEffect, useRef, useState, createRef } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useTheme } from "next-themes";

import toast from 'react-hot-toast';
import { socket } from '../../lib/socket';
import Board from './Board';
import IBoard from './IBoard';
import { Track, TrackPublication } from "livekit-client";
import { saveBoard, subscribeToBoard } from "@/lib/roomService";

// for the audio functionality
import { Room, RoomEvent, RemoteParticipant, LocalParticipant } from "livekit-client";


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
  tool: 'pencil' | 'eraser' | 'line' | 'rect' | 'circle' | (string & {});
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


function simplify(points: Point[], epsilon = 2): Point[] {
  if (points.length < 3) return points;

  const distToLine = (p: Point, a: Point, b: Point) => {
    const num = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x);
    const den = Math.sqrt((b.y - a.y) ** 2 + (b.x - a.x) ** 2);
    return den === 0 ? 0 : num / den;
  };

  let maxDist = 0;
  let index = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const d = distToLine(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left: Point[] = simplify(points.slice(0, index + 1), epsilon);
    const right: Point[] = simplify(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }

  return [points[0], points[points.length - 1]];
}

function strokeLength(points: Point[]) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y
    );
  }
  return len;
}

function isClosed(points: Point[]) {
  const start = points[0];
  const end = points[points.length - 1];
  return Math.hypot(end.x - start.x, end.y - start.y) < 35;
}


// ================== SHAPE DETECTION BRAIN (IMPROVED) ==================

function getBoundingBox(points: Point[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  points.forEach((p) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function isLine(points: Point[]) {
  if (points.length < 5) return false;

  const { width, height } = getBoundingBox(points);
  const length = Math.sqrt(width * width + height * height);
  if (length < 30) return false;

  const start = points[0];
  const end = points[points.length - 1];

  let maxDeviation = 0;
  points.forEach((p) => {
    const numerator = Math.abs((end.y - start.y) * p.x - (end.x - start.x) * p.y + end.x * start.y - end.y * start.x);
    const denom = Math.sqrt((end.y - start.y) ** 2 + (end.x - start.x) ** 2);
    const dist = denom === 0 ? 0 : numerator / denom;
    maxDeviation = Math.max(maxDeviation, dist);
  });

  return maxDeviation < (length * 0.05); // Deviation relative to length
}

function isCircle(points: Point[]) {
  if (points.length < 10) return false;

  const box = getBoundingBox(points);
  const ratio = box.width / box.height;
  if (ratio < 0.75 || ratio > 1.25) return false;

  const perimeter = strokeLength(points);
  const area = (box.width / 2) * (box.height / 2) * Math.PI;

  // Circularity (Isoperimetric Quotient) = (4 * PI * Area) / Perimeter^2
  const circularity = (4 * Math.PI * area) / (perimeter * perimeter);

  return circularity > 0.7;
}

function isRectangle(points: Point[]) {
  const box = getBoundingBox(points);
  if (box.width < 20 || box.height < 20) return false;

  const perimeter = strokeLength(points);
  const rectPerimeter = 2 * (box.width + box.height);

  // Check if stroke length matches a rectangle's perimeter
  const perimeterMatch = Math.abs(perimeter - rectPerimeter) / rectPerimeter;

  // Simplified points should represent corners
  const pts = simplify(points, 10);

  return perimeterMatch < 0.2 && pts.length >= 4 && pts.length <= 8;
}

function makeLineStroke(points: Point[], color: string, width: number): Stroke {
  return {
    id: Date.now().toString(),
    tool: "line",
    color,
    width,
    points: [points[0], points[points.length - 1]]
  };
}

function makeCircleStroke(points: Point[], color: string, width: number): Stroke {
  const { minX, minY, width: w, height: h } = getBoundingBox(points);
  const center = { x: minX + w / 2, y: minY + h / 2 };
  const radiusPoint = { x: center.x + w / 2, y: center.y };

  return {
    id: Date.now().toString(),
    tool: "circle",
    color,
    width,
    points: [center, radiusPoint]
  };
}

function makeRectStroke(points: Point[], color: string, width: number): Stroke {
  const { minX, minY, maxX, maxY } = getBoundingBox(points);

  return {
    id: Date.now().toString(),
    tool: "rect",
    color,
    width,
    points: [
      { x: minX, y: minY },
      { x: maxX, y: maxY }
    ]
  };
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
const renderStrokesToContext = (ctx: CanvasRenderingContext2D, strokes: Stroke[], isDarkMode: boolean) => {
  strokes.forEach(stroke => {
    ctx.beginPath();

    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = stroke.width;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = resolveStrokeColor(stroke.color, isDarkMode);
      ctx.lineWidth = stroke.width;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const p = stroke.points;
    if (!p || p.length === 0) return;

    if (stroke.tool === 'pencil' || stroke.tool === 'eraser') {
      ctx.moveTo(p[0].x, p[0].y);
      p.forEach(point => ctx.lineTo(point.x, point.y));
    }
    else if (stroke.tool === 'line') {
      ctx.moveTo(p[0].x, p[0].y);
      ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
    }
    else if (stroke.tool === 'rect') {
      const start = p[0];
      const end = p[p.length - 1];
      ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
    }
    else if (stroke.tool === 'circle') {
      const start = p[0];
      const end = p[p.length - 1];
      const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
      ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
    }

    ctx.stroke();
  });
};

function resolveStrokeColor(color: string, isDark: boolean) {
  if (!isDark) return color;

  const c = color.trim().toLowerCase();

  if (c === "#000" || c === "#000000") return "#ffffff";
  if (c === "#fff" || c === "#ffffff") return "#000000";

  return color;
}

const invertHex = (hex: string) => {
  if (hex.toLowerCase() === "#000000") return "#ffffff";
  if (hex.toLowerCase() === "#ffffff") return "#000000";
  return hex; // keep all other colors untouched
};


// ==========================================
// 2. MAIN COMPONENT
// ==========================================

export default function Whiteboard({ roomId, userEmail }: WhiteboardProps) {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  useEffect(() => {
    requestAnimationFrame(() => redrawCanvas(strokes));
  }, [theme]);

  const router = useRouter();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userIdRef = useRef(userEmail);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedFromDB = useRef(false);
  const latestDataRef = useRef({ strokes: [], boards: [], images: [] });
  const strokesRef = useRef<Stroke[]>([]);
  const itemRefs = useRef<any>({});
  const panStartRef = useRef({ x: 0, y: 0 });
  const currentPoints = useRef<Point[]>([]);
  const hasCenteredRef = useRef(false);


  // for the audio functionality
  const livekitRoomRef = useRef<Room | null>(null);
  const [isInCall, setIsInCall] = useState(false);

  // for muting and unmuting the user
  const [isMuted, setIsMuted] = useState(false);

  // for showing who is speaking
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);


  const [selectedTool, setSelectedTool] =
    useState<Stroke["tool"] | "hand">("pencil");
  const prevToolRef = useRef<typeof selectedTool>("pencil");
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [boards, setBoards] = useState<BoardData[]>([]);
  const [images, setImages] = useState<BoardData[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);


  const screenToWorld = (screenX: number, screenY: number) => {
    return {
      x: (screenX - camera.x) / camera.zoom,
      y: (screenY - camera.y) / camera.zoom
    };
  };

  const redrawCanvas = (strokesToDraw: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = isDarkMode ? "#000000" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    renderStrokesToContext(ctx, strokesToDraw, isDarkMode);
  };

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    // @ts-ignore 
    latestDataRef.current = { strokes, boards, images };
  }, [strokes, boards, images]);

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

    ctx.fillStyle = isDarkMode ? "#000000" : "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.translate(-minX, -minY);
    renderStrokesToContext(ctx, strokes, isDarkMode);

    return canvas.toDataURL("image/png");
  };


  // for the audio functionality
  const identity =
    userEmail ??
    `guest-${Math.random().toString(36).slice(2, 8)}`;

  console.log("JOIN AUDIO WITH IDENTITY:", identity);

  // for the toggle mute and unmute
  const toggleMute = async () => {
    if (!livekitRoomRef.current) return;

    const lp = livekitRoomRef.current.localParticipant;

    try {
      if (isMuted) {
        await lp.setMicrophoneEnabled(true);
        setIsMuted(false);
        toast.success("Microphone Unmuted");
      } else {
        await lp.setMicrophoneEnabled(false);
        setIsMuted(true);
        toast.error("Microphone Muted");
      }
    } catch (err) {
      console.error("Mute error:", err);
    }
  };

  const joinAudioRoom = async () => {
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          userEmail: identity,
        }),
      });

      const { token, url } = await res.json();

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      livekitRoomRef.current = room;

      // Add video track subscription handler
      room.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
        if (publication.kind === "video" && participant.isLocal && localVideoRef.current) {
          const track = publication.track;
          if (track) {
            track.attach(localVideoRef.current);
          }
        }
      });

      // Track subscribed handler for remote participants
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === "video") {
          setRemoteParticipants([...room.remoteParticipants.values()]);
        }
      });

      // Track unsubscribed handler
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach(el => el.remove());
        setRemoteParticipants([...room.remoteParticipants.values()]);
      });

      // Participant connected/disconnected
      room.on(RoomEvent.ParticipantConnected, () => {
        setRemoteParticipants([...room.remoteParticipants.values()]);
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        setRemoteParticipants([...room.remoteParticipants.values()]);
      });

      // Speaker detection
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const speakingIdentities = speakers.map(s => s.identity);
        setActiveSpeakers(speakingIdentities);
      });

      await room.connect(url, token);

      // Enable microphone by default
      await room.localParticipant.setMicrophoneEnabled(true);
      setIsMuted(false);
      setIsInCall(true);
      toast.success("🎙️ Joined call");
    } catch (err) {
      console.error(err);
      toast.error("Failed to join call");
    }
  };


  const toggleVideo = async () => {
  if (!livekitRoomRef.current) return;
  const lp = livekitRoomRef.current.localParticipant;

  try {
    if (isVideoEnabled) {
      await lp.setCameraEnabled(false);
      setIsVideoEnabled(false);
      toast.error("Camera Disabled");
    } else {
      // Explicitly request camera
      await lp.setCameraEnabled(true);
      setIsVideoEnabled(true);
      toast.success("Camera Enabled");
    }
    
    // Force UI to sync
    setRemoteParticipants([...livekitRoomRef.current.remoteParticipants.values()]);
  } catch (err: any) {
    console.error("Video Error:", err);
    toast.error(err.message || "Could not access camera");
  }
};

  const leaveAudioRoom = () => {
    if (!livekitRoomRef.current) return;

    livekitRoomRef.current.disconnect();
    livekitRoomRef.current = null;
    setIsInCall(false);
    setActiveSpeakers([]);
    setRemoteParticipants([]);
    setIsVideoEnabled(false);
    setIsMuted(false);

    toast("🔇 Left call");
  };

  // Video participant renderer
const VideoParticipant = ({ participant, isLocal = false }: { 
  participant: LocalParticipant | RemoteParticipant, 
  isLocal?: boolean 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const handleTrackUpdate = () => {
      // 1. Correct way to get publications in latest SDK
      const publications = participant.getTrackPublications();
      
      // 2. Filter for video kind and camera source
      const videoPub = publications.find(p => p.kind === Track.Kind.Video);

      // 3. Check for existence, enablement, and subscription status
      if (videoPub && videoPub.track) {
        if (isLocal || videoPub.isSubscribed) {
          videoPub.track.attach(el);
          setHasVideo(true);
          return;
        }
      }
      setHasVideo(false);
    };

    // Listen for events to trigger re-attachment
    participant.on(RoomEvent.TrackPublished, handleTrackUpdate);
    participant.on(RoomEvent.TrackUnpublished, handleTrackUpdate);
    participant.on(RoomEvent.TrackSubscribed, handleTrackUpdate);
    participant.on(RoomEvent.TrackUnsubscribed, handleTrackUpdate);
    participant.on(RoomEvent.TrackMuted, handleTrackUpdate);
    participant.on(RoomEvent.TrackUnmuted, handleTrackUpdate);

    handleTrackUpdate();

    return () => {
      participant.off(RoomEvent.TrackPublished, handleTrackUpdate);
      participant.off(RoomEvent.TrackUnpublished, handleTrackUpdate);
      participant.off(RoomEvent.TrackSubscribed, handleTrackUpdate);
      participant.off(RoomEvent.TrackUnsubscribed, handleTrackUpdate);
      participant.off(RoomEvent.TrackMuted, handleTrackUpdate);
      participant.off(RoomEvent.TrackUnmuted, handleTrackUpdate);
      
      // Detach all tracks from this element on cleanup
      participant.getTrackPublications().forEach(pub => {
        pub.track?.detach(el);
      });
    };
  }, [participant, isLocal]);

  return (
    <div className={`relative w-full h-full rounded-xl overflow-hidden bg-black border-2 ${isLocal ? 'border-blue-500' : 'border-gray-700'}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover transition-opacity duration-300 ${hasVideo ? 'opacity-100' : 'opacity-0'}`}
      />
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
           <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
            {participant.identity.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-white">
        {isLocal ? "You" : participant.identity}
      </div>
    </div>
  );
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

    ctx.fillStyle = isDarkMode ? "#000000" : "#ffffff";
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

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.translate(-minX, -minY);

      renderStrokesToContext(ctx, strokes, isDarkMode);

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
        setStrokes(data.strokes as Stroke[]);
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

  // =====================
  // Spacebar Temporary Hand Tool
  // =====================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (selectedTool !== "hand") {
          prevToolRef.current = selectedTool;
          setSelectedTool("hand");
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setSelectedTool(prevToolRef.current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedTool]);


  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeToBoard(roomId, (data) => {
      if (data) loadBoardFromData(data);
    });
    return () => unsub();
  }, [roomId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }

      if (e.ctrlKey || e.metaKey) {
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        const newZoom = Math.min(Math.max(camera.zoom + delta, 0.1), 5);

        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - camera.x) / camera.zoom;
        const worldY = (mouseY - camera.y) / camera.zoom;

        const newCamX = mouseX - worldX * newZoom;
        const newCamY = mouseY - worldY * newZoom;

        setCamera({ x: newCamX, y: newCamY, zoom: newZoom });
      } else {
        setCamera(prev => ({
          ...prev,
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }));
      }
      requestAnimationFrame(() => redrawCanvas(strokes));
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [camera, strokes]);

  const startDrawing = (e: React.MouseEvent | MouseEvent) => {
    
    // If Hand tool selected → always pan on left click
    if (selectedTool === "hand") {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button === 1 || (e as any).code === 'Space') {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

    currentPoints.current = [{ x: worldPos.x, y: worldPos.y }];
  };

  const draw = (e: React.MouseEvent | MouseEvent) => {
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
    const mouse = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (selectedTool === 'eraser') {
      const hitThreshold = 10 / camera.zoom;
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

    const rawPoints = [...currentPoints.current];
    currentPoints.current = [];

    if (selectedTool !== "pencil") {
      const stroke: Stroke = {
        id: Date.now().toString(),
        tool: selectedTool,
        color: selectedColor,
        width: brushSize,
        points: rawPoints
      };
      save(stroke);
      return;
    }

    let points = simplify(rawPoints);
    if (strokeLength(points) < 80) {
      saveNormal();
      return;
    }

    if (!isClosed(points)) {
      if (isLine(points)) {
        save(makeLineStroke(points, selectedColor, brushSize));
      } else {
        saveNormal();
      }
    } else {
      if (isCircle(points)) {
        save(makeCircleStroke(points, selectedColor, brushSize));
      }
      else if (isRectangle(points)) {
        save(makeRectStroke(points, selectedColor, brushSize));
      }
      else {
        saveNormal();
      }
    }

    function save(stroke: Stroke) {
      const updated = [...strokes, stroke];
      setStrokes(updated);
      socket.emit("draw", { roomId, stroke });
      triggerSave();
    }

    function saveNormal() {
      const normal: Stroke = {
        id: Date.now().toString(),
        tool: "pencil",
        color: selectedColor,
        width: brushSize,
        points: rawPoints
      };
      save(normal);
    }
  };

  const undo = () => socket.emit('undo', { roomId });
  const redo = () => socket.emit('redo', { roomId });

  const handleFitView = () => {
    if (strokes.length === 0) {
      setCamera({ x: 0, y: 0, zoom: 1 });
      requestAnimationFrame(() => redrawCanvas(strokes));
      toast("Reset to Center 🎯");
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    strokes.forEach(s => {
      s.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
    });

    const container = containerRef.current;
    if (!container) return;
    const { clientWidth: viewW, clientHeight: viewH } = container;

    const drawingW = maxX - minX;
    const drawingH = maxY - minY;
    const centerX = minX + drawingW / 2;
    const centerY = minY + drawingH / 2;

    const safeW = Math.max(drawingW, 50);
    const safeH = Math.max(drawingH, 50);
    const scaleX = viewW / safeW;
    const scaleY = viewH / safeH;

    let newZoom = Math.min(scaleX, scaleY) * 0.9;
    newZoom = Math.min(Math.max(newZoom, 0.1), 2);

    const newCamX = (viewW / 2) - (centerX * newZoom);
    const newCamY = (viewH / 2) - (centerY * newZoom);

    setCamera({ x: newCamX, y: newCamY, zoom: newZoom });
    requestAnimationFrame(() => redrawCanvas(strokes));
    toast("Canvas Focused 🔭");
  };

  // =====================
  // Centered Zoom Controls
  // =====================

  const applyZoom = (newZoom: number) => {
    const container = containerRef.current;
    if (!container) return;

    const viewW = container.clientWidth;
    const viewH = container.clientHeight;

    // Screen center
    const screenCenterX = viewW / 2;
    const screenCenterY = viewH / 2;

    // Convert screen center → world coordinates BEFORE zoom
    const worldCenterX = (screenCenterX - camera.x) / camera.zoom;
    const worldCenterY = (screenCenterY - camera.y) / camera.zoom;

    // Compute new camera position to keep world center fixed
    const newCamX = screenCenterX - worldCenterX * newZoom;
    const newCamY = screenCenterY - worldCenterY * newZoom;

    setCamera({ x: newCamX, y: newCamY, zoom: newZoom });
    requestAnimationFrame(() => redrawCanvas(strokes));
  };

  const zoomIn = () => {
    const newZoom = Math.min(camera.zoom + 0.15, 5);
    applyZoom(newZoom);
  };

  const zoomOut = () => {
    const newZoom = Math.max(camera.zoom - 0.15, 0.1);
    applyZoom(newZoom);
  };

  const resetView = () => {
    applyZoom(1);
    toast("Zoom reset to 100%");
  };


  useEffect(() => {
    if (hasCenteredRef.current) return;
    if (strokes.length > 0) {
      handleFitView();
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
  }, [strokes]);

  const determineNewPosition = () => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
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
      if (!item) return prev;
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
      if (!item) return prev;
      const updated = { ...item, name: newName };
      socket.emit(eventName, { roomId, [dataKey]: updated });
      return prev.map(i => i.id === id ? updated : i);
    });
  };

  const updateBoardContent = (id: number | string, newContent: string) => {
    setBoards(prev => {
      const board = prev.find(b => b.id === id);
      if (!board || board.content === newContent) return prev;
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
    e.stopPropagation();
    const { id } = item;
    const itemRef = itemRefs.current[id]?.current;
    if (!itemRef) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = item.position;

    const handleMouseMove = (e: MouseEvent) => {
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

  const displayColor = isDarkMode
    ? invertHex(selectedColor)
    : selectedColor;

  return (
    <div className="min-h-screen flex flex-col font-sans
      bg-gray-50 text-gray-900
      dark:bg-black dark:text-white
    ">

      <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

      <header
        className="
          sticky top-0 z-70 shrink-0
          px-6 py-4 flex items-center justify-between
          backdrop-blur-lg transition-colors
          bg-white/80 border-b border-gray-200
          dark:bg-black/70 dark:border-gray-800
        "
      >

        <div className="flex flex-col">
          <h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
            Whiteboard
          </h1>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Room:</span>
            <code className="
              px-1.5 py-0.5 rounded font-mono
              bg-gray-100 text-gray-700
              dark:bg-gray-800 dark:text-gray-300
            ">
              {roomId}
            </code>

          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group z-50">
            <button className="
              flex items-center gap-2 px-3 py-1.5 rounded-full transition
              bg-gray-100 border border-gray-200 text-gray-700
              dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300
              cursor-default
            ">
              <span className="text-sm font-medium text-gray-600">{users.length} Online</span>
            </button>
            <div className="
              absolute right-0 top-full mt-2 w-48 p-2 rounded-xl shadow-xl
              bg-white border border-gray-200
              dark:bg-gray-900 dark:border-gray-700
              opacity-0 invisible group-hover:opacity-100 group-hover:visible
              transition-all duration-200
            ">

              <ul className="flex flex-col gap-1 overflow-y-auto max-h-40">
                {users.map((user, i) => {
                  const isSpeaking = activeSpeakers.includes(user.id);
                  return (
                    <li key={i} className={`
                      flex items-center gap-2 px-2 py-1.5 rounded-lg
                      hover:bg-gray-100 dark:hover:bg-gray-800
                      ${isSpeaking ? 'bg-green-100/50 dark:bg-green-900/20' : ''}
                    `}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold bg-blue-500 transition-all ${isSpeaking ? 'ring-2 ring-green-500 scale-110' : ''}`}>
                        {user.id ? user.id.charAt(0).toUpperCase() : '?'}
                      </div>
                      <span className="text-sm text-gray-600 truncate max-w-[120px]">{user.id}</span>
                      {isSpeaking && <span className="text-[10px] text-green-500 animate-pulse">●</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          {isInCall && (
            <>
              <button
                onClick={toggleMute}
                className={`px-4 py-2 rounded-lg font-medium transition-colors text-white ${
                  isMuted ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                }`}
              >
                {isMuted ? "🔇 Muted" : "🎤 Live"}
              </button>
              
              {/* ✨ THIS IS NEW - VIDEO TOGGLE BUTTON ✨ */}
              <button
                onClick={toggleVideo}
                className={`px-4 py-2 rounded-lg font-medium transition-colors text-white ${
                  isVideoEnabled ? "bg-blue-500 hover:bg-blue-600" : "bg-gray-500 hover:bg-gray-600"
                }`}
              >
                {isVideoEnabled ? "📹 Video On" : "📹 Video Off"}
              </button>
            </>
          )}

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

          {/* UI for the audio functionality */}
          <button
            onClick={isInCall ? leaveAudioRoom : joinAudioRoom}
            className={`
              px-4 py-2 rounded-lg font-medium
              ${isInCall
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-green-600 hover:bg-green-700"}
              text-white`}
          >
            {isInCall ? "Leave Audio" : "Join Audio"}
          </button>
        </div>
      </header>

      {isModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
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

      <div
        ref={containerRef}
        className={`relative flex-1 w-full bg-white overflow-hidden
          ${selectedTool === "hand" ? "cursor-grab" : "cursor-crosshair"}
        `}
        style={{ cursor: isPanning ? "grabbing" : undefined }}
      >

        <canvas ref={canvasRef} className="absolute top-0 left-0 block w-full h-full" />

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

        <aside
          className={`
            fixed z-80
            bottom-6 left-1/2 -translate-x-1/2
            px-4 py-3
            flex flex-row items-center gap-5
            rounded-full
            backdrop-blur-lg
            shadow-xl
            border
            transition-all duration-300 ease-in-out

            bg-white/90 border-gray-200
            dark:bg-black/80 dark:border-gray-700

            ${isToolbarVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20 pointer-events-none'}
          `}
        >
          {/* TOOLS */}
          <div className="flex flex-row gap-1.5">
            {[
              { id: 'hand', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"> <path d="M18 11V6a2 2 0 0 0-4 0v5" /> <path d="M14 10V4a2 2 0 1 0-4 0v6" /> <path d="M10 10V3a2 2 0 1 0-4 0v7" /> <path d="M6 12v-1a2 2 0 1 0-4 0v6c0 1.1.9 2 2 2h9" /> <path d="M18 8a2 2 0 0 1 4 2v7c0 1.1-.9 2-2 2h-3" /> </svg> )},
              { id: 'pencil', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg> },
              { id: 'line', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5" /></svg> },
              { id: 'rect', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg> },
              { id: 'circle', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg> },
              { id: 'eraser', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg> },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTool(t.id as any)}
                className={`p-2.5 rounded-xl flex items-center justify-center transition
                  ${selectedTool === t.id
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}
                `}
                title={t.id}
              >
                {t.icon}
              </button>
            ))}
          </div>

          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />

          {/* COLOR + SIZE */}
          <div className="flex flex-row gap-2 items-center">
            <input
              type="color"
              value={displayColor}
              onChange={(e) => {
                const picked = e.target.value;
                setSelectedColor(
                  isDarkMode ? invertHex(picked) : picked
                );
              }}
              className="w-8 h-8 rounded-full border-2 border-white cursor-pointer"
            />
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer"
            />
          </div>

          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />

          {/* IMAGE */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            title="Upload Image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
          </button>

          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />

          {/* ACTIONS */}
          <div className="flex flex-row gap-1">

            {/* Undo */}
            <button onClick={undo}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              title="Undo">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
            </button>

            {/* Redo */}
            <button onClick={redo}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              title="Redo">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 7v6h-6" />
                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
              </svg>
            </button>

            {/* Fit View (existing) */}
            <button onClick={handleFitView}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              title="Fit to Screen">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>

            {/* Zoom In */}
            <button onClick={zoomIn}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              title="Zoom In">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {/* Zoom Percentage Display */}
            <button
              onClick={resetView}
              className="px-2 text-xs font-semibold text-gray-600 dark:text-gray-300 
                        hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              title="Reset Zoom to 100%"
            >
              {Math.round(camera.zoom * 100)}%
            </button>
            {/* Zoom Out */}

            <button onClick={zoomOut}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              title="Zoom Out">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="8" y1="11" x2="14" y2="11" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
            
            {/* Clear */}
            <button onClick={clearCanvas}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
              title="Clear">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>

          </div>
        </aside>


        <div className="fixed z-80 bottom-6 left-4">
          <button
            onClick={() => setIsToolbarVisible(!isToolbarVisible)}
            className="
      flex items-center justify-center
      w-10 h-10
      rounded-full
      border shadow-md
      transition-all

      bg-white border-gray-200 text-gray-600
      hover:bg-gray-100

      dark:bg-black dark:border-gray-700 dark:text-gray-300
      dark:hover:bg-gray-800
    "
            title={isToolbarVisible ? 'Hide Toolbar' : 'Show Toolbar'}
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
                className="-rotate-90"
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
                className="-rotate-90"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            )}
          </button>
        </div>



        {aiSummary && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-9999">
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
        {/* VIDEO CALL OVERLAY */}
        {isInCall && (
          <div className="fixed top-24 right-6 z-[100] flex flex-col gap-3">
            {/* Render Local Participant */}
            {livekitRoomRef.current?.localParticipant && (
              <div className="w-56 h-40 shadow-2xl">
                <VideoParticipant 
                  participant={livekitRoomRef.current.localParticipant} 
                  isLocal={true} 
                />
              </div>
            )}
            
            {/* Render Remote Participants */}
            {remoteParticipants.map((p) => (
              <div key={p.sid} className="w-56 h-40 shadow-2xl">
                <VideoParticipant participant={p} />
              </div>
            ))}
          </div>
        )}
        </div>
    </div>
  );
}