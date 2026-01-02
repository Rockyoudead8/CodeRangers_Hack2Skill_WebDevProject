"use client";
import React from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

export default function LayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isWhiteboard = pathname.startsWith("/room");

  return (
    <>
      <Navbar />

      <div
        className={`
          ${isWhiteboard ? "pt-15" : ""}
           min-h-screen bg-white text-gray-900 dark:bg-black dark:text-gray-100 transition-colors
        `}
      >
        {children}
      </div>
    </>
  );
}
