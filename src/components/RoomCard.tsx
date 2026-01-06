// src/components/RoomCard.tsx

"use client";

import { useState } from "react";
import { Trash2, Edit2, Check, X, Shield, Eye, Clock } from "lucide-react";
import { SavedRoom } from "@/types/room";
import { validateRoomName } from "@/lib/validation/roomNameSchema";

interface RoomCardProps {
  room: SavedRoom;
  onJoin: (roomId: string) => void;
  onRename: (roomId: string, newName: string) => Promise<void>;
  onDelete: (roomId: string) => void;
  exists: boolean;
}

export default function RoomCard({
  room,
  onJoin,
  onRename,
  onDelete,
  exists,
}: RoomCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(room.customName);
  const [error, setError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditName(room.customName);
    setError(null);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setEditName(room.customName);
    setError(null);
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const trimmedName = editName.trim();

    // Validate name
    const validation = validateRoomName(trimmedName);

    if (!validation.success) {
      setError(validation.error || "Invalid name");
      return;
    }

    if (trimmedName === room.customName) {
      setIsEditing(false);
      return;
    }

    setIsRenaming(true);
    setError(null);

    try {
      await onRename(room.roomId, trimmedName);
      setIsEditing(false);
    } catch (error: any) {
      setError(error.message || "Failed to rename");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (confirm(`Remove "${room.customName}" from your saved rooms?`)) {
      onDelete(room.roomId);
    }
  };

  const formatRelativeTime = (timestamp: any): string => {
    const now = Date.now();
    const then = timestamp.toMillis();
    const diffMs = now - then;

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

    return timestamp.toDate().toLocaleDateString();
  };

  return (
    <div
      onClick={() => exists && !isEditing && onJoin(room.roomId)}
      className={`
        relative group bg-gray-800/50 border border-gray-700 rounded-xl p-4 
        transition-all duration-200 
        ${
          exists && !isEditing
            ? "hover:bg-gray-800 hover:border-blue-500 hover:-translate-y-1 cursor-pointer"
            : "opacity-60 cursor-not-allowed"
        }
      `}
    >
      {/* Room Type Badge */}
      <div className="absolute top-3 right-3 flex gap-2">
        {room.isCreator && (
          <div className="px-2 py-1 bg-green-600/20 border border-green-500/50 rounded-full flex items-center gap-1">
            <Shield className="w-3 h-3 text-green-400" />
            <span className="text-[10px] font-semibold text-green-300">
              Creator
            </span>
          </div>
        )}

        <div
          className={`px-2 py-1 rounded-full flex items-center gap-1 ${
            room.roomType === "rbac"
              ? "bg-yellow-600/20 border border-yellow-500/50"
              : "bg-blue-600/20 border border-blue-500/50"
          }`}
        >
          {room.roomType === "rbac" ? (
            <>
              <Shield className="w-3 h-3 text-yellow-400" />
              <span className="text-[10px] font-semibold text-yellow-300">
                Role-Based
              </span>
            </>
          ) : (
            <>
              <Eye className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-semibold text-blue-300">
                Public
              </span>
            </>
          )}
        </div>
      </div>

      {/* Room Name */}
      <div className="mb-3 pr-32">
        {isEditing ? (
          <div onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editName}
              onChange={(e) => {
                setEditName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveEdit(e as any);
                if (e.key === "Escape") handleCancelEdit(e as any);
              }}
              className="w-full px-2 py-1 bg-gray-900 border border-blue-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              disabled={isRenaming}
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSaveEdit}
                disabled={isRenaming}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-white text-xs flex items-center gap-1"
              >
                {isRenaming ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isRenaming}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <h3 className="text-lg font-semibold text-white truncate">
            {room.customName}
          </h3>
        )}
      </div>

      {/* Room ID */}
      <p className="text-xs text-gray-400 mb-2 font-mono truncate">
        ID: {room.roomId}
      </p>

      {/* Last Accessed */}
      <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
        <Clock className="w-3 h-3" />
        <span>{formatRelativeTime(room.lastAccessed)}</span>
      </div>

      {/* Status */}
      {!exists && (
        <div className="mb-3 px-2 py-1 bg-red-900/30 border border-red-500/50 rounded text-xs text-red-300">
          ⚠️ Room no longer exists
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {exists && !isEditing && (
          <button
            onClick={handleStartEdit}
            className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center justify-center gap-1 transition-colors"
          >
            <Edit2 className="w-3 h-3" />
            Rename
          </button>
        )}

        <button
          onClick={handleDelete}
          className="flex-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 rounded text-red-300 text-xs flex items-center justify-center gap-1 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Remove
        </button>
      </div>
    </div>
  );
}
