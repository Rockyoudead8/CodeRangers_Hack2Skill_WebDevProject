'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import useUser from "@/hooks/useUser";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Menu, LogOut, Home, Users, PenTool } from "lucide-react";
import { useState } from "react";
import { socket } from "@/app/lib/socket";

export default function Navbar() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    try {
      socket.disconnect();
      await signOut(auth);
      localStorage.removeItem("drive_token");
      router.push("/login");
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 backdrop-blur-lg bg-black/70 border-b border-gray-800 h-[8vh]">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

    
        <Link href="/" className="text-2xl font-extrabold tracking-wide">
          <span className="text-white">Collab</span>
          <span className="text-blue-500">Board</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-gray-300">


          <Link href="/home" className="hover:text-white flex items-center gap-2 transition">
            <PenTool size={18}/> Whiteboard
          </Link>

          <Link href="/about" className="hover:text-white flex items-center gap-2 transition">
            <Users size={18}/> About
          </Link>

        </div>

        {/* Right Side */}
        {!loading && (
          user ? (
            <div className="hidden md:flex items-center gap-4">

              <div className="px-4 py-1 rounded-xl border border-gray-700 text-gray-300 text-sm">
                {user.email}
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl transition"
              >
                <LogOut size={18}/>
                Logout
              </button>
            </div>
          ) : (
            <div className="hidden md:flex gap-4">
              <Link href="/login">
                <button className="px-4 py-2 border border-gray-700 rounded-xl hover:bg-gray-800 transition">
                  Login
                </button>
              </Link>

              <Link href="/signup">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold">
                  Sign Up
                </button>
              </Link>
            </div>
          )
        )}

        {/* Mobile Menu Button */}
        <button onClick={() => setOpen(!open)} className="md:hidden text-white">
          <Menu size={26}/>
        </button>
      </div>

      {/* Mobile Dropdown */}
      {open && (
        <div className="md:hidden bg-black/90 border-t border-gray-800 p-6 space-y-4">

          <Link href="/home" className="block hover:text-blue-400 transition">
            Home
          </Link>

          <Link href="/room" className="block hover:text-blue-400 transition">
            Whiteboard
          </Link>

          <Link href="/about" className="block hover:text-blue-400 transition">
            About
          </Link>

          {!loading && (
            user ? (
              <button
                onClick={handleLogout}
                className="w-full mt-2 py-2 bg-red-600 hover:bg-red-700 rounded-xl"
              >
                Logout
              </button>
            ) : (
              <>
                <Link href="/login">
                  <button className="w-full py-2 border border-gray-700 rounded-xl hover:bg-gray-800 transition">
                    Login
                  </button>
                </Link>

                <Link href="/signup">
                  <button className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl">
                    Sign Up
                  </button>
                </Link>
              </>
            )
          )}

        </div>
      )}
    </nav>
  );
}