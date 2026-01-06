// src/app/home/page.tsx - Updated with "My Rooms" feature

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Copy,
  Check,
  PlusCircle,
  Users,
  KeyRound,
  ArrowRightCircle,
  Shield,
  Eye,
  Lock,
  AlertCircle,
  Folder,
} from "lucide-react";
import { createRoom, generateAdminKey } from "@/lib/roomService";
import useUser from "@/hooks/useUser";
import SavedRoomsList from "@/components/SavedRoomsList";

export default function Home() {
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [isRoleBased, setIsRoleBased] = useState(false);
  const [generatedAdminKey, setGeneratedAdminKey] = useState<string | null>(
    null
  );
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔥 NEW: My Rooms state
  const [showMyRooms, setShowMyRooms] = useState(false);

  const router = useRouter();
  const { user, loading } = useUser();

  // Debug authentication state
  useEffect(() => {
    console.log("🔐 Auth State:", {
      loading,
      user: user?.email,
      uid: user?.uid,
    });
  }, [user, loading]);

  const generateRoomCode = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < 20; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleGenerate = () => {
    const code = generateRoomCode();
    setRoomCode(code);
    setError(null);

    if (isRoleBased) {
      const adminKey = generateAdminKey();
      setGeneratedAdminKey(adminKey);
      setShowAdminKey(true);
    } else {
      setGeneratedAdminKey(null);
      setShowAdminKey(false);
    }
  };

  const handleCopy = async () => {
    if (roomCode) {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyAdminKey = async () => {
    if (generatedAdminKey) {
      await navigator.clipboard.writeText(generatedAdminKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  };

  const handleCreateRoom = async () => {
    setError(null);

    if (!roomCode) {
      setError("Please generate a room code first");
      return;
    }

    if (!user || !user.uid) {
      setError("You must be logged in to create a room");
      console.error("❌ User not authenticated:", { user });
      return;
    }

    setIsCreating(true);

    try {
      console.log("🚀 Creating room with:", {
        roomId: roomCode,
        userId: user.uid,
        userEmail: user.email,
        isRoleBased,
        hasAdminKey: !!generatedAdminKey,
      });

      const result = await createRoom({
        roomId: roomCode,
        user,
        isRoleBased,
        adminKey: generatedAdminKey || undefined,
      });

      if (result.exists) {
        setError("Room already exists. Please generate a new code.");
        setIsCreating(false);
        return;
      }

      console.log("✅ Room created successfully!");

      // Store admin status for this session
      if (isRoleBased) {
        sessionStorage.setItem(`room_${roomCode}_role`, "admin");
      }

      // Navigate to the room
      router.push(`/room/${roomCode}`);
    } catch (error: any) {
      console.error("❌ Room creation failed:", error);

      let errorMessage = "Failed to create room. Please try again.";

      if (error.code === "permission-denied") {
        errorMessage =
          "Permission denied. Please check your Firebase security rules.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (roomId?: string) => {
    const targetRoom = roomId || joinCode.trim();

    if (!targetRoom) {
      setError("Please enter a room code");
      return;
    }

    router.push(`/room/${targetRoom}`);
  };

  const handleRoleToggle = (checked: boolean) => {
    setIsRoleBased(checked);

    if (checked && roomCode) {
      const adminKey = generateAdminKey();
      setGeneratedAdminKey(adminKey);
      setShowAdminKey(true);
    } else {
      setGeneratedAdminKey(null);
      setShowAdminKey(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-900 via-black to-gray-950 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-900 via-black to-gray-950 flex items-center justify-center text-white p-6">
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-8 max-w-md">
          <AlertCircle className="mx-auto mb-4 text-red-400" size={48} />
          <h2 className="text-2xl font-bold text-center mb-2">
            Not Authenticated
          </h2>
          <p className="text-gray-300 text-center mb-4">
            Please log in to create or join rooms.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-black to-gray-950 flex items-center justify-center p-6 text-white relative">
      {/* 🔥 NEW: My Rooms Button - Top Left */}
      <button
        onClick={() => setShowMyRooms(true)}
        className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors z-10"
      >
        <Folder className="w-5 h-5 text-blue-400" />
        <span className="font-semibold text-white">My Rooms</span>
      </button>

      {/* 🔥 NEW: My Rooms Modal */}
      {showMyRooms && user?.uid && (
        <SavedRoomsList
          userId={user.uid}
          onClose={() => setShowMyRooms(false)}
          onJoinRoom={handleJoinRoom}
        />
      )}

      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center mb-10 space-y-2">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-wide flex items-center justify-center gap-3">
            <Sparkles className="text-blue-400 animate-pulse" />
            Real-Time Collaboration Hub
            <Sparkles className="text-purple-400 animate-pulse" />
          </h1>
          <p className="text-gray-400 text-sm">
            Create or join a live collaborative whiteboard. Now with role-based
            access control.
          </p>

          {/* Show user info */}
          <p className="text-gray-500 text-xs">
            Logged in as: <span className="text-blue-400">{user.email}</span>
          </p>
        </div>

        {/* Global error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl flex items-start gap-3">
            <AlertCircle className="text-red-400 mt-0.5" size={20} />
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* CREATE ROOM */}
          <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-xl hover:shadow-blue-800/40 hover:-translate-y-1 transition p-8">
            <div className="flex items-center justify-center gap-2 mb-6">
              <PlusCircle className="text-blue-400" size={34} />
              <h2 className="text-3xl font-bold text-blue-400 tracking-wide">
                Create Room
              </h2>
            </div>

            {/* RBAC Toggle */}
            <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="text-yellow-400" size={20} />
                  <label className="text-sm font-semibold text-gray-200">
                    Role-Based Access Control
                  </label>
                </div>
                <button
                  onClick={() => handleRoleToggle(!isRoleBased)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    isRoleBased ? "bg-blue-600" : "bg-gray-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      isRoleBased ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-gray-400">
                {isRoleBased ? (
                  <>
                    <Lock className="inline w-3 h-3 mr-1" />
                    Viewers need admin key for edit access
                  </>
                ) : (
                  <>
                    <Eye className="inline w-3 h-3 mr-1" />
                    Anyone with room code can edit
                  </>
                )}
              </p>
            </div>

            <label className="block text-sm text-gray-400 mb-2">
              Room Code
            </label>

            <div className="flex flex-col xl:flex-row gap-3">
              <input
                type="text"
                value={roomCode}
                readOnly
                placeholder="Generate room code"
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex gap-3">
                <button
                  onClick={handleGenerate}
                  className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center gap-2 transition"
                >
                  <KeyRound size={18} />
                  Generate
                </button>

                <button
                  onClick={handleCopy}
                  disabled={!roomCode}
                  className="px-5 py-3 bg-transparent border border-red-500 text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-lg flex items-center gap-2 transition"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            {/* Admin Key Display */}
            {isRoleBased && showAdminKey && generatedAdminKey && (
              <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-600/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="text-yellow-400" size={18} />
                  <label className="text-sm font-semibold text-yellow-200">
                    Admin Key (Save This!)
                  </label>
                </div>

                <div className="flex gap-2 items-center">
                  <code className="flex-1 px-3 py-2 bg-gray-900 border border-yellow-600/30 rounded text-yellow-200 font-mono text-sm">
                    {generatedAdminKey}
                  </code>
                  <button
                    onClick={handleCopyAdminKey}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-black font-semibold rounded-lg flex items-center gap-2 transition"
                  >
                    {keyCopied ? <Check size={16} /> : <Copy size={16} />}
                    {keyCopied ? "Copied" : "Copy"}
                  </button>
                </div>

                <p className="text-xs text-yellow-200/80 mt-2">
                  ⚠️ This key will only be shown once. Save it securely to grant
                  admin access.
                </p>
              </div>
            )}

            <button
              onClick={handleCreateRoom}
              disabled={isCreating || !roomCode}
              className="w-full mt-7 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-blue-700/40"
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <ArrowRightCircle size={20} />
                  Launch Room
                </>
              )}
            </button>
          </div>

          {/* JOIN ROOM */}
          <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-xl hover:shadow-purple-800/40 hover:-translate-y-1 transition p-8">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Users className="text-purple-400" size={34} />
              <h2 className="text-3xl font-bold text-purple-400 tracking-wide">
                Join Room
              </h2>
            </div>

            <label className="block text-sm text-gray-400 mb-2">
              Room Code
            </label>

            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter room code"
              onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            <button
              onClick={() => handleJoinRoom()}
              disabled={!joinCode.trim()}
              className="w-full mt-7 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-purple-700/40"
            >
              <ArrowRightCircle size={20} />
              Enter Room
            </button>

            <div className="mt-6 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
              <p className="text-xs text-gray-400">
                💡 <span className="font-semibold">Tip:</span> If the room
                requires admin access, you'll be asked to enter the admin key or
                join as a viewer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
