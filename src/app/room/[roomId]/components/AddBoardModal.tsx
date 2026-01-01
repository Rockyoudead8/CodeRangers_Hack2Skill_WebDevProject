// src/app/room/[roomId]/components/AddBoardModal.tsx

"use client";
import { useState } from "react";

interface AddBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (title: string) => void;
}

export default function AddBoardModal({
  isOpen,
  onClose,
  onAdd,
}: AddBoardModalProps) {
  const [title, setTitle] = useState("");

  if (!isOpen) return null;

  const handleAdd = () => {
    if (title.trim()) {
      onAdd(title);
      setTitle("");
    }
  };

  const handleClose = () => {
    setTitle("");
    onClose();
  };

  return (
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Project Notes"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-all"
          />
        </div>
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleAdd}
            disabled={!title.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Add Board
          </button>
        </div>
      </div>
    </div>
  );
}
