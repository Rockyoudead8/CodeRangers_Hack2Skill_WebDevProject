//src\app\room\[roomId]\layout.tsx

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
  return <div className="relative min-h-screen">{children}</div>;
}
