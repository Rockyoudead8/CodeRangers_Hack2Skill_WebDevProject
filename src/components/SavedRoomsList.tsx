// src/components/SavedRoomsList.tsx

"use client";

import { useState, useEffect } from "react";
import { X, Search, Filter } from "lucide-react";
import { SavedRoom, RoomFilterType } from "@/types/room";
import {
  subscribeToUserRooms,
  updateRoomName,
  removeRoomFromList,
  checkRoomExists,
} from "@/lib/roomService";
import RoomCard from "./RoomCard";
import toast from "react-hot-toast";

interface SavedRoomsListProps {
  userId: string;
  onClose: () => void;
  onJoinRoom: (roomId: string) => void;
}

export default function SavedRoomsList({
  userId,
  onClose,
  onJoinRoom,
}: SavedRoomsListProps) {
  const [rooms, setRooms] = useState<SavedRoom[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<SavedRoom[]>([]);
  const [roomExistence, setRoomExistence] = useState<Record<string, boolean>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<RoomFilterType>("all");

  // Real-time subscription to user's saved rooms
  useEffect(() => {
    if (!userId) return;

    setLoading(true);

    const unsubscribe = subscribeToUserRooms(userId, async (updatedRooms) => {
      setRooms(updatedRooms);
      setLoading(false);

      // Check existence for each room
      const existenceChecks = await Promise.all(
        updatedRooms.map(async (room) => ({
          roomId: room.roomId,
          exists: await checkRoomExists(room.roomId),
        }))
      );

      const existenceMap: Record<string, boolean> = {};
      existenceChecks.forEach(({ roomId, exists }) => {
        existenceMap[roomId] = exists;
      });

      setRoomExistence(existenceMap);
    });

    return () => unsubscribe();
  }, [userId]);

  // Apply filters and search
  useEffect(() => {
    let filtered = [...rooms];

    // Apply filter
    switch (filterType) {
      case "public":
        filtered = filtered.filter((room) => room.roomType === "public");
        break;
      case "rbac":
        filtered = filtered.filter((room) => room.roomType === "rbac");
        break;
      case "created":
        filtered = filtered.filter((room) => room.isCreator);
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (room) =>
          room.customName.toLowerCase().includes(query) ||
          room.roomId.toLowerCase().includes(query)
      );
    }

    setFilteredRooms(filtered);
  }, [rooms, searchQuery, filterType]);

  const handleRename = async (roomId: string, newName: string) => {
    try {
      await updateRoomName(userId, roomId, newName);
      toast.success("Room renamed successfully!");
    } catch (error: any) {
      console.error("Failed to rename room:", error);
      toast.error(error.message || "Failed to rename room");
      throw error;
    }
  };

  const handleDelete = async (roomId: string) => {
    try {
      await removeRoomFromList(userId, roomId);
      toast.success("Room removed from your list");
    } catch (error: any) {
      console.error("Failed to remove room:", error);
      toast.error("Failed to remove room");
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">My Rooms</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className="px-6 py-4 border-b border-gray-700 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rooms by name or ID..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400" />
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filterType === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              All Rooms ({rooms.length})
            </button>
            <button
              onClick={() => setFilterType("public")}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filterType === "public"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              Public ({rooms.filter((r) => r.roomType === "public").length})
            </button>
            <button
              onClick={() => setFilterType("rbac")}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filterType === "rbac"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              Role-Based ({rooms.filter((r) => r.roomType === "rbac").length})
            </button>
            <button
              onClick={() => setFilterType("created")}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filterType === "created"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              Created by Me ({rooms.filter((r) => r.isCreator).length})
            </button>
          </div>
        </div>

        {/* Rooms Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading your rooms...</p>
              </div>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-gray-400 text-lg mb-2">
                  {searchQuery || filterType !== "all"
                    ? "No rooms match your search"
                    : "No saved rooms yet"}
                </p>
                <p className="text-gray-500 text-sm">
                  {searchQuery || filterType !== "all"
                    ? "Try adjusting your filters or search query"
                    : "Create or join a room to get started"}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map((room) => (
                <RoomCard
                  key={room.roomId}
                  room={room}
                  exists={roomExistence[room.roomId] ?? true}
                  onJoin={onJoinRoom}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
