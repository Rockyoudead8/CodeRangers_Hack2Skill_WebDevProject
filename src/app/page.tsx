'use client';

import { Sparkles, Users, PenTool, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";
import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { socket } from "./lib/socket";
import { signOut } from "firebase/auth";
import toast from "react-hot-toast";
import useUser from "@/hooks/useUser";
import LoadingScreen from "../../components/Loading";
import { useEffect } from "react";
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-950 text-white">

      {/* Navbar
      <div className="w-full flex justify-between items-center px-8 py-6 border-b border-gray-800">
        <h1 className="text-2xl font-extrabold tracking-wide text-blue-400">
          CollabBoard
        </h1>

        <div className="flex gap-4">

          {loading ? null : user ? (
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800 transition"
            >
              Logout
            </button>
          ) : (
            <div className="space-x-4">
              <Link href="/login">
                <button className="px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800 transition">
                  Login
                </button>
              </Link>

              <Link href="/signup">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition font-semibold">
                  Sign Up
                </button>
              </Link>
            </div>
          )}




        </div>
      </div> */}

      {/* Hero Section */}
      <div className="flex flex-col items-center text-center mt-14 px-6">
        <div className="flex items-center gap-2">
          <Sparkles className="text-blue-400 animate-pulse" />
          <p className="text-gray-400 text-sm tracking-wide">
            Real-Time Collaboration At The Speed Of Thought
          </p>
          <Sparkles className="text-purple-400 animate-pulse" />
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold mt-4 leading-tight">
          Create, Collaborate & Innovate
          <span className="text-blue-500"> Together</span>
        </h1>

        <p className="text-gray-400 max-w-2xl mt-4">
          A powerful real-time collaborative whiteboard where teams brainstorm,
          students learn, designers sketch, and ideas come alive instantly.
        </p>

        <Link href="/home">
          <button className="mt-8 px-8 py-4 bg-blue-600 hover:bg-blue-700 transition rounded-xl text-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-700/40">
            Get Started <ArrowRight size={20} />
          </button>
        </Link>
      </div>

      {/* Features Section */}
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
            Smooth strokes, shapes, writing and more. Your creativity, unleashed.
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
      <div className="mt-20 text-center px-6">
        <div className="inline-flex items-center gap-2 bg-gray-900 border border-gray-800 px-6 py-3 rounded-full">
          <Zap className="text-yellow-400" />
          <p className="text-gray-300">
            Lightning Fast • Zero Friction • Built For Teams
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 text-center text-gray-500 text-sm pb-8">
        CollabBoard © 2025 • Built to make teamwork less painful
      </footer>
    </div>
  );
}
