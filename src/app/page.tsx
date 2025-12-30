'use client';

import { Sparkles, Users, PenTool, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";
import { socket } from "./lib/socket";
import { signOut } from "firebase/auth";
import toast from "react-hot-toast";
import useUser from "@/hooks/useUser";
import { auth } from "@/lib/firebase";

export default function LandingPage() {
  const { user, loading } = useUser();

  const handleLogout = async () => {
    try {
      socket.disconnect();
      await signOut(auth);
      localStorage.removeItem("drive_token");
    } catch (error) {
      console.error("Logout failed", error);
      toast.error("Logout failed. Technology continues bullying you.");
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-black to-gray-950 text-white flex flex-col">

   
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="flex items-center gap-2">
          <Sparkles className="text-blue-400 animate-pulse" />
          <p className="text-gray-400 text-sm tracking-wide">
            Real-Time Collaboration At The Speed Of Thought
          </p>
          <Sparkles className="text-purple-400 animate-pulse" />
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-extrabold mt-4 leading-tight">
          Create, Collaborate & Innovate
          <span className="text-blue-500"> Together</span>
        </h1>

        {/* Subtitle */}
        <p className="text-gray-400 max-w-2xl mt-4">
          A powerful real-time collaborative whiteboard where teams brainstorm,
          students learn, designers sketch, and ideas come alive instantly.
        </p>

        {/* CTA */}
        <Link href="/home">
          <button className="mt-8 px-8 py-4 bg-blue-600 hover:bg-blue-700 transition rounded-xl text-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-700/40">
            Get Started <ArrowRight size={20} />
          </button>
        </Link>

        {/* Features */}
        <div className="mt-20 px-8 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">

          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-blue-800/30 transition">
            <div className="flex items-center gap-3">
              <Users className="text-blue-400" size={32} />
              <h2 className="text-xl font-bold">Real-Time Collaboration</h2>
            </div>
            <p className="text-gray-400 mt-3">
              Work together instantly. See every stroke and change live.
            </p>
          </div>

          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-purple-800/30 transition">
            <div className="flex items-center gap-3">
              <PenTool className="text-purple-400" size={32} />
              <h2 className="text-xl font-bold">Powerful Drawing Tools</h2>
            </div>
            <p className="text-gray-400 mt-3">
              Smooth strokes, shapes, writing and more. Your creativity unleashed.
            </p>
          </div>

          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-green-800/30 transition">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-green-400" size={32} />
              <h2 className="text-xl font-bold">Secure & Private</h2>
            </div>
            <p className="text-gray-400 mt-3">
              Your rooms are protected. Your ideas stay yours.
            </p>
          </div>

        </div>

        {/* Highlight Section */}
        <div className="mt-16 text-center px-6">
          <div className="inline-flex items-center gap-2 bg-gray-900 border border-gray-800 px-6 py-3 rounded-full">
            <Zap className="text-yellow-400" />
            <p className="text-gray-300">
              Lightning Fast • Zero Friction • Built For Teams
            </p>
          </div>
        </div>
      </div>

      {/* Footer sticks to bottom */}
      <footer className="text-center text-gray-500 text-sm py-8">
        CollabBoard © 2025 • Built to make teamwork less painful
      </footer>
    </div>
  );
}
