'use client';

import { useEffect, useRef, useState, createRef } from 'react';
import { useParams } from 'next/navigation';
import { socket } from '../../lib/socket';
import Board from './Board';
import IBoard from './IBoard';

type Position = { x: number; y: number };

type BoardData = {
  id: number | string;
  type: 'text' | 'image'; // Explicit type is now crucial
  name: string;
  position: Position;
  content: string; 
};

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userIdRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Drawing State ---
  const [selectedTool, setSelectedTool] = useState('pencil');
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [imageData, setImageData] = useState<ImageData | null>(null);

  // --- UI State ---
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  
  // --- DATA STATES (SEPARATED) ---
  const [boards, setBoards] = useState<BoardData[]>([]); // For Text/Stickies
  const [images, setImages] = useState<BoardData[]>([]); // For Images
  
  // Unified refs for both to handle dragging/overlap logic cleanly
  const itemRefs = useRef<any>({});
  
  const [users, setUsers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");


  // 1. SOCKET & DATA SYNC LOGIC


  useEffect(() => {
    if (!roomId) return;
    
    if (!userIdRef.current) userIdRef.current = socket.id || `user-${Date.now()}`;
    const userId = userIdRef.current;

    socket.emit('userJoined', { userId, roomId });

    //  CANVAS HANDLERS 
    const handleDraw = ({ roomId: incomingRoom, image }: { roomId: string; image: string | null; }) => {
      if (incomingRoom !== roomId) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      if (!image) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        const img = new Image();
        img.src = image;
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
      }
    };

    const handleUserList = (data: any) => {
      const userList = Array.isArray(data) ? data : data.users;
      if (userList) setUsers(userList);
    };

    //  TEXT BOARD HANDLERS 
    const handleBoardsSync = (serverBoards: BoardData[]) => setBoards(serverBoards || []);
    
    const handleBoardAdd = (newBoard: BoardData) => {
      setBoards((prev) => {
        if (prev.find(b => b.id === newBoard.id)) return prev;
        return [...prev, newBoard];
      });
    };

    const handleBoardUpdate = (updatedBoard: BoardData) => {
      setBoards((prev) => prev.map((b) => (b.id === updatedBoard.id ? updatedBoard : b)));
    };

    const handleBoardDelete = (boardId: string | number) => {
        setBoards((prev) => prev.filter(b => b.id !== boardId));
    };

    //  IMAGE HANDLERS (NEW) 
    const handleImagesSync = (serverImages: BoardData[]) => setImages(serverImages || []);

    const handleImageAdd = (newImage: BoardData) => {
      setImages((prev) => {
        if (prev.find(img => img.id === newImage.id)) return prev;
        return [...prev, newImage];
      });
    };

    const handleImageUpdate = (updatedImage: BoardData) => {
      setImages((prev) => prev.map((img) => (img.id === updatedImage.id ? updatedImage : img)));
    };

    const handleImageDelete = (imageId: string | number) => {
      setImages((prev) => prev.filter(img => img.id !== imageId));
    };

    // Listeners
    socket.on('draw', handleDraw);
    socket.on('userIsJoined', handleUserList);
    socket.on('allUsers', handleUserList);
    
    // Text Boards
    socket.on('boards:sync', handleBoardsSync);
    socket.on('board:add', handleBoardAdd);
    socket.on('board:update', handleBoardUpdate);
    socket.on('board:delete', handleBoardDelete);

    // Images
    socket.on('images:sync', handleImagesSync);
    socket.on('image:add', handleImageAdd);
    socket.on('image:update', handleImageUpdate);
    socket.on('image:delete', handleImageDelete);

    return () => {
      socket.off('draw', handleDraw);
      socket.off('userIsJoined', handleUserList);
      socket.off('allUsers', handleUserList);
      
      socket.off('boards:sync', handleBoardsSync);
      socket.off('board:add', handleBoardAdd);
      socket.off('board:update', handleBoardUpdate);
      socket.off('board:delete', handleBoardDelete);

      socket.off('images:sync', handleImagesSync);
      socket.off('image:add', handleImageAdd);
      socket.off('image:update', handleImageUpdate);
      socket.off('image:delete', handleImageDelete);
    };
  }, [roomId]);



  // 2. CANVAS DRAWING LOGIC (Unchanged)


  const emitCanvasImage = () => {
    const canvas = canvasRef.current;
    if (!canvas || !roomId) return;
    const image = canvas.toDataURL('image/png');
    socket.emit('draw', { roomId, image });
  };

  const undo = () => socket.emit('undo', { roomId });
  const redo = () => socket.emit('redo', { roomId });

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      emitCanvasImage();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleMouseDown = (e: MouseEvent) => {
      setIsDrawing(true);
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setStartX(x);
      setStartY(y);
      setImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));

      if (selectedTool === 'pencil') {
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawing) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (['line', 'rect', 'circle'].includes(selectedTool) && imageData) {
        ctx.putImageData(imageData, 0, 0);
      }

      ctx.strokeStyle = selectedColor;
      ctx.fillStyle = selectedColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      switch (selectedTool) {
        case 'pencil':
          ctx.lineTo(x, y);
          ctx.stroke();
          break;
        case 'line':
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(x, y);
          ctx.stroke();
          break;
        case 'rect': {
          const width = x - startX;
          const height = y - startY;
          ctx.strokeRect(startX, startY, width, height);
          break;
        }
        case 'circle': {
          const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
          ctx.beginPath();
          ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
          ctx.stroke();
          break;
        }
        case 'eraser':
          ctx.clearRect(x - brushSize / 2, y - brushSize / 2, brushSize, brushSize);
          break;
      }
    };

    const finishStroke = () => {
      if (isDrawing) {
        emitCanvasImage();
        setIsDrawing(false);
      }
      ctx.beginPath();
    };

    const handleMouseUp = () => finishStroke();
    const handleMouseLeave = () => finishStroke();

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
  }, [isDrawing, selectedTool, selectedColor, brushSize, startX, startY, imageData, roomId]);


  // ==========================================
  // 3. BOARD & IMAGE MANAGEMENT LOGIC
  // ==========================================

  const determineNewPosition = () => {
    if (typeof window === 'undefined') return { x: 100, y: 100 };
    return {
      x: Math.floor(Math.random() * (window.innerWidth / 2)),
      y: Math.floor(Math.random() * (window.innerHeight / 2))
    };
  };

  const checkForOverlap = (id: number | string) => {
    const currentNoteRef = itemRefs.current[id]?.current;
    if (!currentNoteRef) return false;
    const currentRect = currentNoteRef.getBoundingClientRect();

    // Check against all items (Boards + Images)
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

  //  ADD BOARD (TEXT) 
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
  };

  //  ADD IMAGE LOGIC (New Socket Event) 
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
      // EMIT TO IMAGE CHANNEL
      socket.emit('image:add', { roomId, imageData: newImage });
    } catch (err) {
      console.error("Image processing failed", err);
      alert("Could not process image.");
    }
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  //  UPDATE LOGIC (ROUTER) 
  const updateItemPosition = (id: number | string, newPosition: Position, type: 'text' | 'image') => {
    if (type === 'text') {
        const board = boards.find(b => b.id === id);
        if (board) {
            const updated = { ...board, position: newPosition };
            setBoards(prev => prev.map(b => b.id === id ? updated : b));
            socket.emit('board:update', { roomId, boardData: updated });
        }
    } else {
        const img = images.find(i => i.id === id);
        if (img) {
            const updated = { ...img, position: newPosition };
            setImages(prev => prev.map(i => i.id === id ? updated : i));
            socket.emit('image:update', { roomId, imageData: updated });
        }
    }
  };

  const updateItemName = (id: number | string, newName: string, type: 'text' | 'image') => {
    if (type === 'text') {
        const board = boards.find(b => b.id === id);
        if (board) {
            const updated = { ...board, name: newName };
            setBoards(prev => prev.map(b => b.id === id ? updated : b));
            socket.emit('board:update', { roomId, boardData: updated });
        }
    } else {
        const img = images.find(i => i.id === id);
        if (img) {
            const updated = { ...img, name: newName };
            setImages(prev => prev.map(i => i.id === id ? updated : i));
            socket.emit('image:update', { roomId, imageData: updated });
        }
    }
  };

  const updateBoardContent = (id: number | string, newContent: string) => {
    const board = boards.find(b => b.id === id);
    if (!board || board.content === newContent) return;
    const updatedBoard = { ...board, content: newContent };
    setBoards((prev) => prev.map((b) => (b.id === id ? updatedBoard : b)));
    socket.emit('board:update', { roomId, boardData: updatedBoard });
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

  //  DRAG LOGIC 
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
        y: finalRect.top - containerRect.top
      };

      if (checkForOverlap(id)) {
        itemRef.style.left = `${startPos.x}px`;
        itemRef.style.top = `${startPos.y}px`;
      } else {
        // Route to correct update function based on Type
        updateItemPosition(id, newPosition, item.type);
      }
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  //  EFFECT: Canvas Sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      // Calculate height based on both boards and images
      const allItems = [...boards, ...images];
      const lowestItemBottom = allItems.reduce((max, item) => {
        return Math.max(max, item.position.y + 600);
      }, 0);

      const requiredHeight = Math.max(window.innerHeight, lowestItemBottom);
      const requiredWidth = container.clientWidth;

      if (canvas.height !== requiredHeight || canvas.width !== requiredWidth) {
        const tempUrl = canvas.toDataURL();
        canvas.width = requiredWidth;
        canvas.height = requiredHeight;
        container.style.height = `${requiredHeight}px`;
        const img = new Image();
        img.src = tempUrl;
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
        };
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);

  }, [boards, images]); // Depedency on both now



  // 4. RENDER

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
              <p className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase">Current Users</p>
              <ul className="flex flex-col gap-1 overflow-y-auto max-h-40">
                {users.map((user, i) => (
                  <li key={i} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold bg-blue-500">
                      {user.id ? user.id.charAt(0).toUpperCase() : '?'}
                    </div>
                    <span className="text-sm text-gray-600 truncate">User {user.id ? user.id.slice(0, 4) : '...'}</span>
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
              <input
                type="text"
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                placeholder="e.g., Project Notes"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddBoard()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-all"
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
              <button
                onClick={() => { setIsModalOpen(false); setNewBoardTitle(""); }}
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
      <div ref={containerRef} className="relative flex-1 w-full bg-white cursor-crosshair">
        <canvas ref={canvasRef} className="absolute top-0 left-0 block w-full" />

        <div className="absolute inset-0 z-10 w-full h-full pointer-events-none">
          
          {/* RENDER TEXT BOARDS */}
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

          {/* RENDER IMAGES */}
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

        {/* TOGGLE BUTTON*/}
        <div className="fixed z-[60] bottom-24 left-4 md:left-0 md:top-1/2 md:bottom-auto md:-translate-y-1/2">
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

        {/*TOOLBAR */}
        <aside
          className={`
            fixed z-50
            bg-white/95 backdrop-blur-sm shadow-xl border border-gray-200/60 p-3
            flex gap-5 transition-all duration-300 ease-in-out
            
            /* MOBILE STYLES */
            bottom-6 left-1/2 -translate-x-1/2 rounded-full flex-row items-center
            ${isToolbarVisible ? 'translate-y-0 opacity-100' : 'translate-y-[200%] opacity-0'}

            /* DESKTOP STYLES */
            md:top-[60%] md:left-4 md:bottom-auto md:translate-x-0 md:-translate-y-1/2 md:rounded-2xl md:flex-col md:items-start
            md:${isToolbarVisible ? 'md:translate-x-0' : 'md:-translate-x-[150%]'}
          `}
        >
          <div className="flex md:flex-col flex-row gap-1.5">
            {['pencil', 'line', 'rect', 'circle', 'eraser'].map((tool) => (
              <button
                key={tool}
                onClick={() => setSelectedTool(tool)}
                className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${selectedTool === tool ? 'bg-black text-white' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                {tool === 'pencil' && <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>}
                {tool === 'line' && <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg>}
                {tool === 'rect' && <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /></svg>}
                {tool === 'circle' && <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /></svg>}
                {tool === 'eraser' && <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg>}
              </button>
            ))}
          </div>

          <div className="md:h-px md:w-full w-px h-8 bg-gray-200"></div>

          <div className="flex md:flex-col flex-row gap-2 items-center">
            <input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} className="w-8 h-8 rounded-full border-2 border-white cursor-pointer" />
            <input 
              type="range" 
              min="1" 
              max="20" 
              value={brushSize} 
              onChange={(e) => setBrushSize(Number(e.target.value))} 
              className="md:w-1.5 md:h-20 w-20 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer" 
              style={{ writingMode: typeof window !== 'undefined' && window.innerWidth >= 768 ? 'vertical-lr' : 'horizontal-tb' } as any} 
            />
          </div>

          <div className="md:h-px md:w-full w-px h-8 bg-gray-200"></div>

          <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-1 rounded-xl flex items-center justify-center transition-all hover:bg-gray-100 text-gray-500"
              title="Upload Image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            </button>

          <div className="md:h-px md:w-full w-px h-8 bg-gray-200"></div>

          <div className="flex md:flex-col flex-row gap-1">
            <button onClick={undo} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
            </button>
            <button onClick={redo} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" /></svg>
            </button>
            <button onClick={clearCanvas} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
            </button>
          </div>
        </aside>

      </div>
    </div>
  );
}