'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingScreen from "../../../components/Loading";
import {
  Sparkles,
  Copy,
  Check,
  PlusCircle,
  Users,
  KeyRound,
  ArrowRightCircle
} from "lucide-react";
import useUser from '@/hooks/useUser';

export default function Home() {
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const { user, loading } = useUser();

  useEffect(() => {
    if (!loading && user) {
      router.push("/home");
    }
  }, [user, loading, router]);

  if (loading) return <LoadingScreen />;

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
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
      alert('Please generate a room code first');
      return;
    }
    router.push(`/room/${roomCode}`);
  };

  const handleJoinRoom = () => {
    if (!joinCode.trim()) {
      alert('Please enter a room code');
      return;
    }
    router.push(`/room/${joinCode.trim()}`);
  };

  return (
    <div
      className="
        min-h-screen flex items-center justify-center px-4 py-24 sm:px-6 lg:px-8
        text-gray-800 dark:text-white
        bg-gradient-to-br
        from-blue-100 via-grey-100 to-purple-100
        dark:from-gray-900 dark:via-black dark:to-gray-950
        transition-colors
      "
    >
      <div className="w-full max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8 sm:mb-10 space-y-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-wide flex items-center justify-center gap-2 sm:gap-3">
            <Sparkles className="text-blue-500 dark:text-blue-400 animate-pulse shrink-0" />
            <span>Real-Time Collaboration Hub</span>
            <Sparkles className="text-purple-500 dark:text-purple-400 animate-pulse shrink-0" />
          </h1>
          <p className="text-gray-700 dark:text-gray-400 text-sm px-2">
            Create or join a live collaborative whiteboard. No pressure. Just chaos.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-8">

          {/* Create Room */}
          <div
            className="
              backdrop-blur-xl rounded-2xl p-5 sm:p-8 transition
              bg-gray-50/80 border border-gray-300
              dark:bg-gray-900/70 dark:border-gray-800
              shadow-xl hover:-translate-y-1
              hover:shadow-blue-800/40
            "
          >
            <div className="flex items-center justify-center gap-2 mb-5 sm:mb-6">
              <PlusCircle className="text-blue-500 dark:text-blue-400 shrink-0" size={34} />
              <h2 className="text-2xl sm:text-3xl font-bold text-blue-500 dark:text-blue-400 tracking-wide">
                Create Room
              </h2>
            </div>

            <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2">
              Room Code
            </label>

            <div className="flex flex-col xl:flex-row gap-3">
              <input
                type="text"
                value={roomCode}
                readOnly
                placeholder="Generate room code"
                className="
                  min-w-0 flex-1 px-4 py-3 rounded-lg
                  bg-gray-50 border border-gray-300
                  text-gray-900 placeholder-gray-500
                  dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                "
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:flex gap-3">
                <button
                  onClick={handleGenerate}
                  className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition"
                >
                  <KeyRound size={18} />
                  Generate
                </button>

                <button
                  onClick={handleCopy}
                  className="
                    px-5 py-3 font-semibold rounded-lg flex items-center justify-center gap-2 transition
                    border border-red-500 text-red-500
                    hover:bg-red-500/10
                  "
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? 'Copied' : 'Copy'}
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
          <div
            className="
              backdrop-blur-xl rounded-2xl p-5 sm:p-8 transition
              bg-gray-50/80 border border-gray-300
              dark:bg-gray-900/70 dark:border-gray-800
              shadow-xl hover:-translate-y-1
              hover:shadow-purple-800/40
            "
          >
            <div className="flex items-center justify-center gap-2 mb-5 sm:mb-6">
              <Users className="text-purple-500 dark:text-purple-400 shrink-0" size={34} />
              <h2 className="text-2xl sm:text-3xl font-bold text-purple-500 dark:text-purple-400 tracking-wide">
                Join Room
              </h2>
            </div>

            <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2">
              Room Code
            </label>

            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter room code"
              className="
                w-full px-4 py-3 rounded-lg
                bg-gray-50 border border-gray-300
                text-gray-900 placeholder-gray-500
                dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200
                focus:outline-none focus:ring-2 focus:ring-purple-500
              "
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
