'use client';

import React, { forwardRef, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import {TextStyle} from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'

interface BoardProps {
  id: number | string; // Updated to allow string or number
  name: string;
  initialPos: { x: number; y: number };
  content?: string;
  onContentChange?: (content: string) => void;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onRename: (newName: string) => void;
  // 1. NEW PROP
  onDelete: () => void;
}

const Board = forwardRef<HTMLDivElement, BoardProps>(({ id, name, initialPos, content, onContentChange, onMouseDown, onRename, onDelete }, ref) => {
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontFamily.configure({
        types: ['textStyle'],
      }),
    ],
    content: content || '<p>Hello World! 🌎</p>',
    immediatelyRender: false, 
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg m-2 focus:outline-none min-h-[100px] leading-tight',
      },
    },
    onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        if (onContentChange) {
            onContentChange(html);
        }
    }
  })

  useEffect(() => {
    if (editor && content && content !== editor.getHTML()) {
        editor.commands.setContent(content);
    }
  }, [content, editor]);

  const handleRenameClick = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    const newName = window.prompt("Enter new board name:", name);
    if (newName && newName.trim() !== "") {
        onRename(newName);
    }
  };

  // 2. NEW: Handle Delete Click
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if(window.confirm("Are you sure you want to delete this board?")) {
        onDelete();
    }
  }

  const setFont = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'sans') editor?.chain().focus().unsetFontFamily().run();
    else editor?.chain().focus().setFontFamily(value).run();
  };

  const setSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'p') editor?.chain().focus().setParagraph().run();
    else if (value === 'h1') editor?.chain().focus().toggleHeading({ level: 1 }).run();
    else if (value === 'h2') editor?.chain().focus().toggleHeading({ level: 2 }).run();
    else if (value === 'h3') editor?.chain().focus().toggleHeading({ level: 3 }).run();
  };

  if (!editor) {
    return null
  }

  const currentFont = editor.isActive('textStyle', { fontFamily: 'serif' }) ? 'serif' 
                    : editor.isActive('textStyle', { fontFamily: 'monospace' }) ? 'monospace' 
                    : 'sans';
  
  const currentSize = editor.isActive('heading', { level: 1 }) ? 'h1'
                    : editor.isActive('heading', { level: 2 }) ? 'h2'
                    : editor.isActive('heading', { level: 3 }) ? 'h3'
                    : 'p';

  return (
    <div 
      ref={ref} 
      style={{
        position: 'absolute', 
        left: `${initialPos.x}px`,
        top: `${initialPos.y}px`,
      }}
      className="absolute group rounded-lg bg-white shadow-md hover:shadow-xl transition-shadow duration-200 w-[300px] flex flex-col border border-transparent hover:border-gray-200"
    >
      {/* HEADER AREA */}
      <div 
        onMouseDown={onMouseDown} 
        className="relative h-10 bg-gray-50 rounded-t-lg border-b border-gray-100 cursor-grab active:cursor-grabbing select-none"
      >
        {/* Name */}
        <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 opacity-100 group-hover:opacity-0 pointer-events-none">
            <span className="text-sm font-semibold text-gray-600 truncate max-w-[90%]">
                {name}
            </span>
        </div>

        {/* Toolbar */}
        <div className="absolute inset-0 flex items-center justify-between px-2 gap-2 transition-opacity duration-200 opacity-0 group-hover:opacity-100 pointer-events-none">
            <div className="flex items-center gap-1 pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
                <div className="flex bg-white rounded border border-gray-200 overflow-hidden shrink-0">
                    <button onClick={() => editor.chain().focus().toggleBold().run()} className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold hover:bg-gray-100 ${editor.isActive('bold') ? 'bg-black text-white' : 'text-gray-700'}`}>B</button>
                    <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`w-6 h-6 flex items-center justify-center text-[10px] italic hover:bg-gray-100 ${editor.isActive('italic') ? 'bg-black text-white' : 'text-gray-700'}`}>I</button>
                    <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`w-6 h-6 flex items-center justify-center text-[10px] underline hover:bg-gray-100 ${editor.isActive('underline') ? 'bg-black text-white' : 'text-gray-700'}`}>U</button>
                </div>
                <select value={currentSize} onChange={setSize} className="h-6 w-16 text-[10px] bg-white border border-gray-200 rounded px-1 outline-none cursor-pointer">
                    <option value="p">Normal</option>
                    <option value="h3">Large</option>
                    <option value="h2">X-Large</option>
                    <option value="h1">Huge</option>
                </select>
                <select value={currentFont} onChange={setFont} className="h-6 w-16 text-[10px] bg-white border border-gray-200 rounded px-1 outline-none cursor-pointer">
                    <option value="sans">Sans</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Mono</option>
                </select>
            </div>
            
            <div className="flex items-center gap-1 pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
                {/* Rename Button */}
                <button onClick={handleRenameClick} className="p-1.5 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700" title="Rename">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </button>
                
                {/* 3. NEW: Delete Button */}
                <button onClick={handleDeleteClick} className="p-1.5 hover:bg-red-100 rounded text-gray-500 hover:text-red-600 transition-colors" title="Delete Board">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
      </div>

      {/* The Editor */}
      <div className="p-4 cursor-text" onMouseDown={(e) => e.stopPropagation()}>
         <EditorContent editor={editor} />
      </div>
    </div>
  )
});

Board.displayName = 'Board';

export default Board;