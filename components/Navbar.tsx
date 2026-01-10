'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import useUser from "@/hooks/useUser";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Menu, LogOut, Users, PenTool, Sun, Moon } from "lucide-react";
import { useState } from "react";
import { socket } from "@/app/lib/socket";
import { useTheme } from "next-themes";

export default function Navbar() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

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

  const toggleTheme = () =>
    setTheme(theme === "dark" ? "light" : "dark");

  return (
    <nav
      className="
        fixed top-0 left-0 w-full z-50 h-[8vh]
        backdrop-blur-lg transition-colors
        bg-white/70 dark:bg-black/70
        border-b border-gray-200 dark:border-gray-800
      "
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="text-2xl font-extrabold tracking-wide">
          <span className="text-gray-900 dark:text-white">Collab</span>
          <span className="text-blue-600 dark:text-blue-500">Board</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/home"
            className="
              flex items-center gap-2 transition
              text-gray-700 hover:text-black
              dark:text-gray-300 dark:hover:text-white
            "
          >
            <PenTool size={18} /> Whiteboard
          </Link>

          <Link
            href="/about"
            className="
              flex items-center gap-2 transition
              text-gray-700 hover:text-black
              dark:text-gray-300 dark:hover:text-white
            "
          >
            <Users size={18} /> About
          </Link>
        </div>

        {/* Desktop Right */}
        {!loading && (
          user ? (
            <div className="hidden md:flex items-center gap-3">
              <div
                className="
                  px-4 py-1 rounded-xl text-sm
                  bg-white/60 border border-gray-300 text-gray-700
                  dark:bg-black/40 dark:border-gray-700 dark:text-gray-300
                "
              >
                {user.email}
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition"
              >
                <LogOut size={18} />
                Logout
              </button>

              <button
                onClick={toggleTheme}
                className="
                  p-2 rounded-xl border transition
                  border-gray-300 dark:border-gray-700
                  hover:bg-gray-200 dark:hover:bg-gray-800
                "
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-3">
              <Link href="/login">
                <button className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800 transition">
                  Login
                </button>
              </Link>

              <Link href="/signup">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold">
                  Sign Up
                </button>
              </Link>

              <button
                onClick={toggleTheme}
                className="
                  p-2 rounded-xl border transition
                  border-gray-300 dark:border-gray-700
                  hover:bg-gray-200 dark:hover:bg-gray-800
                "
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          )
        )}

        {/* Mobile Menu Button */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden text-gray-900 dark:text-white"
        >
          <Menu size={26} />
        </button>
      </div>

      {/* Mobile Dropdown */}
      {open && (
        <div
          className="
            md:hidden px-6 py-5 space-y-4
            bg-white/90 dark:bg-black/90
            border-t border-gray-200 dark:border-gray-800
            transition-colors
          "
        >
          <Link
            href="/home"
            onClick={() => setOpen(false)}
            className="block text-gray-800 dark:text-gray-200 hover:text-blue-500 transition"
          >
            Whiteboard
          </Link>

          <Link
            href="/about"
            onClick={() => setOpen(false)}
            className="block text-gray-800 dark:text-gray-200 hover:text-blue-500 transition"
          >
            About
          </Link>

          <button
            onClick={toggleTheme}
            className="
              w-full flex items-center justify-center gap-2
              py-2 rounded-xl border transition
              border-gray-300 dark:border-gray-700
              hover:bg-gray-200 dark:hover:bg-gray-800
            "
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>

          {!loading && (
            user ? (
              <button
                onClick={handleLogout}
                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition"
              >
                Logout
              </button>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)}>
                  <button className="w-full py-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800 transition">
                    Login
                  </button>
                </Link>

                <Link href="/signup" onClick={() => setOpen(false)}>
                  <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
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
