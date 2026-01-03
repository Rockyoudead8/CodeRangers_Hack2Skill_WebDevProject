//src/app/home/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Copy,
  Check,
  PlusCircle,
  Users,
  KeyRound,
  ArrowRightCircle,
} from "lucide-react";

export default function Home() {
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const router = useRouter();

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
    setRoomCode(generateRoomCode());
  };

  const handleCopy = async () => {
    if (roomCode) {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateRoom = () => {
    if (!roomCode) {
      alert("Please generate a room code first");
      return;
    }
    router.push(`/room/${roomCode}`);
  };

  const handleJoinRoom = () => {
    if (!joinCode.trim()) {
      alert("Please enter a room code");
      return;
    }
    router.push(`/room/${joinCode.trim()}`);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-black to-gray-950 flex items-center justify-center p-6 text-white">
      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center mb-10 space-y-2">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-wide flex items-center justify-center gap-3">
            <Sparkles className="text-blue-400 animate-pulse" />
            Real-Time Collaboration Hub
            <Sparkles className="text-purple-400 animate-pulse" />
          </h1>
          <p className="text-gray-400 text-sm">
            Create or join a live collaborative whiteboard. No pressure. Just
            chaos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Create Room */}
          <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-xl hover:shadow-blue-800/40 hover:-translate-y-1 transition p-8">
            <div className="flex items-center justify-center gap-2 mb-6">
              <PlusCircle className="text-blue-400" size={34} />
              <h2 className="text-3xl font-bold text-blue-400 tracking-wide">
                Create Room
              </h2>
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
                  className="px-5 py-3 bg-transparent border border-red-500 text-red-400 hover:bg-red-500/10 font-semibold rounded-lg flex items-center gap-2 transition"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <button
              onClick={handleCreateRoom}
              className="w-full mt-7 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-blue-700/40"
            >
              <ArrowRightCircle size={20} />
              Launch Room
            </button>
          </div>

          {/* Join Room */}
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
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            <button
              onClick={handleJoinRoom}
              className="w-full mt-7 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-purple-700/40"
            >
              <ArrowRightCircle size={20} />
              Enter Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
