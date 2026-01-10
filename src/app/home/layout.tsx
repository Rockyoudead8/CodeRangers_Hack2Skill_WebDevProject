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
      {/* Render the Page Content */}
      {children}
    </div>
  );
}