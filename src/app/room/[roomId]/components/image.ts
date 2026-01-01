import { CRDTManager } from "../utils/crdt";
import { BoardData, type Position } from "../types";
import { CanvasStroke } from "../types/canvas";
import { saveBoard } from "@/lib/roomService";
import { socket } from "@/app/lib/socket";
export const resizeImage = (file: File): Promise<string> => {
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

export const determineNewPosition = () => {
  if (typeof window === "undefined") return { x: 100, y: 100 };
  return {
    x: Math.floor(Math.random() * (window.innerWidth / 2)),
    y: Math.floor(Math.random() * (window.innerHeight / 2)),
  };
};
function saveThrottled(
  currentCanvasStrokes: CanvasStroke[],
  currentBoards: BoardData[],
  currentImages: BoardData[],
  isLoadingFromFirestore: React.RefObject<boolean>,
  roomId: string,
  saveTimeout: NodeJS.Timeout | null,
  lastSave: number
) {
  if (isLoadingFromFirestore.current) {
    console.log("🚫 Skipping save (loading from Firestore)");
    return;
  }

  // Use provided state or fall back to ref values
  const dataToSave = {
    canvas: currentCanvasStrokes,
    boards: currentBoards,
    images: currentImages,
  };

  console.log("💾 About to save:", {
    canvasStrokes: dataToSave.canvas.length,
    boards: dataToSave.boards.length,
    images: dataToSave.images.length,
  });

  // Clear any pending save
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  // Schedule save for 500ms (reduced from 2000ms for better responsiveness)
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
export const handleImageUpload = async (
  e: React.ChangeEvent<HTMLInputElement>,
  crdtRef: React.RefObject<CRDTManager | null>,
  setImages: React.Dispatch<React.SetStateAction<BoardData[]>>,
  roomId: string,
  canvasStrokes: CanvasStroke[],
  boards: BoardData[],
  isLoadingFromFirestore: React.RefObject<boolean>,
  saveTimeout: NodeJS.Timeout | null,
  lastSave: number,
  fileInputRef: React.RefObject<HTMLInputElement | null>
) => {
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

    const newImage = crdtRef.current.createOperation(baseImage);

    console.log("🖼️ Adding image with CRDT metadata:", {
      id: newImage.id,
      version: newImage.version,
    });

    setImages((prev) => {
      const updatedImages = [...prev, newImage];
      // 🔥 Save with NEW state
      saveThrottled(
        canvasStrokes,
        boards,
        updatedImages,
        isLoadingFromFirestore,
        roomId,
        saveTimeout,
        lastSave
      );
      return updatedImages;
    });

    socket.emit("image:add", { roomId, imageData: newImage });
  } catch (err) {
    console.error("Image processing failed", err);
    alert("Could not process image.");
  }

  if (fileInputRef.current) fileInputRef.current.value = "";
};

export const checkForOverlap = (
  id: number | string,
  itemRefs: React.RefObject<any>,
  boards: BoardData[],
  images: BoardData[]
) => {
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

const updateItemPosition = (
  id: number | string,
  newPosition: Position,
  type: "text" | "image",
  crdtRef: React.RefObject<CRDTManager | null>,
  boards: BoardData[],
  images: BoardData[],
  setBoards: React.Dispatch<React.SetStateAction<BoardData[]>>,
  setImages: React.Dispatch<React.SetStateAction<BoardData[]>>,
  roomId: string,
  canvasStrokes: CanvasStroke[],
  isLoadingFromFirestore: React.RefObject<boolean>,
  saveTimeout: NodeJS.Timeout | null,
  lastSave: number
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

      setBoards((prev) => {
        const updatedBoards = prev.map((b) => (b.id === id ? updated : b));
        // 🔥 Save with NEW state
        saveThrottled(
          canvasStrokes,
          updatedBoards,
          images,
          isLoadingFromFirestore,
          roomId,
          saveTimeout,
          lastSave
        );
        return updatedBoards;
      });

      socket.emit("board:update", { roomId, boardData: updated });
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

      setImages((prev) => {
        const updatedImages = prev.map((i) => (i.id === id ? updated : i));
        // 🔥 Save with NEW state
        saveThrottled(
          canvasStrokes,
          boards,
          updatedImages,
          isLoadingFromFirestore,
          roomId,
          saveTimeout,
          lastSave
        );
        return updatedImages;
      });

      socket.emit("image:update", { roomId, imageData: updated });
    }
  }
};

export const handleDragStart = (
  item: BoardData,
  e: React.MouseEvent,
  itemRefs: React.RefObject<any | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  boards: BoardData[],
  images: BoardData[],
  crdtRef: React.RefObject<CRDTManager | null>,
  setBoards: React.Dispatch<React.SetStateAction<BoardData[]>>,
  setImages: React.Dispatch<React.SetStateAction<BoardData[]>>,
  roomId: string,
  canvasStrokes: CanvasStroke[],
  isLoadingFromFirestore: React.RefObject<boolean>,
  saveTimeout: NodeJS.Timeout | null,
  lastSave: number
) => {
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

    if (checkForOverlap(id, itemRefs, boards, images)) {
      itemRef.style.left = `${startPos.x}px`;
      itemRef.style.top = `${startPos.y}px`;
    } else {
      updateItemPosition(
        id,
        newPosition,
        item.type,
        crdtRef,
        boards,
        images,
        setBoards,
        setImages,
        roomId,
        canvasStrokes,
        isLoadingFromFirestore,
        saveTimeout,
        lastSave
      );
    }
  };
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
};
