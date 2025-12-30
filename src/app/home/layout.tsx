'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';
import { socket } from '../lib/socket';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
export default function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      socket.disconnect();
      await signOut(auth);
      localStorage.removeItem("drive_token");
      router.push("/login");
    } catch (error) {
      console.error("Logout failed", error);
      alert("Logout failed. Life remains disappointing.");
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