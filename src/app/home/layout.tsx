//src/app/home/layout.tsx

"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // Use Firebase signOut instead of calling non-existent API
      await signOut(auth);

      // Optional: Clear any local storage tokens
      localStorage.removeItem("drive_token");

      toast.success("Logout successful");
      router.push("/");
    } catch (error: any) {
      console.error("Logout failed", error);
      toast.error(error.message || "Logout failed");
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* Logout Button: Positioned Top-Right */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-1.5 px-3 rounded shadow transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Render the Page Content */}
      {children}
    </div>
  );
}
