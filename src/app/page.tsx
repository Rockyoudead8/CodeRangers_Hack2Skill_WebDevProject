'use client';

import {
  Sparkles,
  Users,
  PenTool,
  ShieldCheck,
  Zap,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { socket } from "./lib/socket";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";
import useUser from "@/hooks/useUser";

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  const handleLogout = async () => {
    try {
      socket.disconnect();
      await signOut(auth);
      localStorage.removeItem("drive_token");
    } catch (error) {
      console.error("Logout failed", error);
      toast.error("Logout failed. Life remains disappointing.");
    }
  };

  return (
    <div
      className="
        min-h-screen
        bg-gradient-to-br
        from-blue-100 to-purple-100
        dark:from-gray-900 dark:via-black dark:to-gray-950
        text-gray-900 dark:text-white
        transition-colors
      "
    >
      {/* Hero Section */}
      <div className="pt-20 flex flex-col items-center text-center mt-14 px-6">
        <div className="flex items-center gap-2">
          <Sparkles className="text-blue-500 dark:text-blue-400 animate-pulse" />
          <p className="text-gray-600 dark:text-gray-400 text-sm tracking-wide">
            Real-Time Collaboration At The Speed Of Thought
          </p>
          <Sparkles className="text-purple-500 dark:text-purple-400 animate-pulse" />
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold mt-4 leading-tight">
          Create, Collaborate & Innovate
          <span className="text-blue-600 dark:text-blue-500"> Together</span>
        </h1>

        <p className="text-gray-700 dark:text-gray-400 max-w-2xl mt-4">
          A powerful real-time collaborative whiteboard where teams brainstorm,
          students learn, designers sketch, and ideas come alive instantly.
        </p>

        <Link href="/home">
          <button
            className="
              mt-8 px-8 py-4 rounded-xl text-lg font-bold
              flex items-center gap-2 transition
              bg-blue-600 hover:bg-blue-700 text-white
              shadow-lg shadow-blue-700/40
            "
          >
            Get Started <ArrowRight size={20} />
          </button>
        </Link>
      </div>

      {/* Features Section */}
      <div className="mt-20 px-8 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Feature Card */}
        <div
          className="
            backdrop-blur-xl rounded-2xl p-6 transition
            bg-white/80 border border-gray-300
            dark:bg-gray-900/60 dark:border-gray-800
            hover:-translate-y-1 hover:shadow-blue-800/30
          "
        >
          <div className="flex items-center gap-3">
            <Users className="text-blue-500 dark:text-blue-400" size={32} />
            <h2 className="text-xl font-bold">Real-Time Collaboration</h2>
          </div>
          <p className="text-gray-700 dark:text-gray-400 mt-3">
            Work together instantly. See every stroke and change live.
          </p>
        </div>

        <div
          className="
            backdrop-blur-xl rounded-2xl p-6 transition
            bg-white/80 border border-gray-300
            dark:bg-gray-900/60 dark:border-gray-800
            hover:-translate-y-1 hover:shadow-purple-800/30
          "
        >
          <div className="flex items-center gap-3">
            <PenTool className="text-purple-500 dark:text-purple-400" size={32} />
            <h2 className="text-xl font-bold">Powerful Drawing Tools</h2>
          </div>
          <p className="text-gray-700 dark:text-gray-400 mt-3">
            Smooth strokes, shapes, writing and more. Your creativity, unleashed.
          </p>
        </div>

        <div
          className="
            backdrop-blur-xl rounded-2xl p-6 transition
            bg-white/80 border border-gray-300
            dark:bg-gray-900/60 dark:border-gray-800
            hover:-translate-y-1 hover:shadow-green-800/30
          "
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-green-500 dark:text-green-400" size={32} />
            <h2 className="text-xl font-bold">Secure & Private</h2>
          </div>
          <p className="text-gray-700 dark:text-gray-400 mt-3">
            Your rooms are protected. Your ideas stay yours.
          </p>
        </div>
      </div>

      {/* Highlight */}
      <div className="mt-20 text-center px-6">
        <div
          className="
            inline-flex items-center gap-2 px-6 py-3 rounded-full
            bg-white/70 border border-gray-300
            dark:bg-gray-900 dark:border-gray-800
          "
        >
          <Zap className="text-yellow-500 dark:text-yellow-400" />
          <p className="text-gray-700 dark:text-gray-300">
            Lightning Fast • Zero Friction • Built For Teams
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 text-center text-gray-600 dark:text-gray-500 text-sm pb-8">
        CollabBoard © 2025 • Built to make teamwork less painful
      </footer>
    </div>
  );
}

