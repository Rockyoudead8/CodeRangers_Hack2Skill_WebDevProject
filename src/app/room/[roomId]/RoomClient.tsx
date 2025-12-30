//src/app/room/[roomId]/RoomClient.tsx

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useUser from "@/hooks/useUser";
import Whiteboard from "./WhiteBoard";
import { createRoom } from "@/lib/roomService";

export default function RoomClient({ roomId }: { roomId: string }) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    console.log("🔥 Creating Firestore Room:", roomId);
    createRoom(roomId, user);
  }, [user, loading, roomId, router]);

  if (loading) {
    return (
      <div className="text-white flex items-center justify-center h-screen">
        Loading room…
      </div>
    );
  }

  if (!user) return null;

  return <Whiteboard roomId={roomId} userEmail={user.email ?? "anonymous"} />;
}
