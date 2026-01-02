'use client';

import React, { forwardRef } from 'react';

interface IBoardProps {
  id: number | string;
  name: string;
  initialPos: { x: number; y: number };
  content: string; // This will be the Image Source (Base64 or URL)
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}

const IBoard = forwardRef<HTMLDivElement, IBoardProps>(({ 
  id, 
  name, 
  initialPos, 
  content, 
  onMouseDown, 
  onRename, 
  onDelete 
}, ref) => {

  const handleRenameClick = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    const newName = window.prompt("Enter new image name:", name);
    if (newName && newName.trim() !== "") onRename(newName);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if(window.confirm("Delete this image?")) onDelete();
  }

  return (
    <div 
      ref={ref} 
      style={{ left: `${initialPos.x}px`, top: `${initialPos.y}px` }}
      className="absolute group rounded-lg bg-white shadow-md hover:shadow-xl transition-shadow duration-200 flex flex-col border border-transparent hover:border-gray-200 w-auto"
    >
      {/* HEADER */}
      <div 
        onMouseDown={onMouseDown} 
        className="relative h-10 bg-gray-50 rounded-t-lg border-b border-gray-100 cursor-grab active:cursor-grabbing select-none min-w-[200px]"
      >
        {/* Name Display */}
        <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 opacity-100 group-hover:opacity-0 pointer-events-none px-2">
            <span className="text-sm font-semibold text-gray-600 truncate max-w-[180px]">{name}</span>
        </div>

        {/* Toolbar (Rename / Delete) */}
        <div className="absolute inset-0 flex items-center justify-end px-2 gap-1 transition-opacity duration-200 opacity-0 group-hover:opacity-100 pointer-events-none">
             <div className="flex items-center gap-1 pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
                <button onClick={handleRenameClick} className="p-1.5 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700" title="Rename">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </button>
                <button onClick={handleDeleteClick} className="p-1.5 hover:bg-red-100 rounded text-gray-500 hover:text-red-600 transition-colors" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
            </div>
        </div>
      </div>

      {/* IMAGE CONTENT */}
      <div className="p-1" onMouseDown={(e) => e.stopPropagation()}>
         <img 
            src={content} 
            alt={name} 
            className="max-w-[400px] max-h-[400px] rounded object-contain pointer-events-none select-none bg-gray-50/50" 
            draggable={false}
         />
      </div>
    </div>
  )
});

IBoard.displayName = 'IBoard';
export default IBoard;