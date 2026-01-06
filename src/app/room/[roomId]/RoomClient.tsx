// src/app/room/[roomId]/RoomClient.tsx - UPDATED with smart joining logic

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useUser from "@/hooks/useUser";
import Whiteboard from "./WhiteBoard";
import {
  createRoom,
  getRoomAccessInfo,
  getRoom,
  updateRoomLastAccessed,
} from "@/lib/roomService";
import { socket } from "@/app/lib/socket";
import { Shield, Eye, Lock, AlertCircle } from "lucide-react";

type UserRole = "admin" | "viewer" | null;

export default function RoomClient({ roomId }: { roomId: string }) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();

  const [roomAccessInfo, setRoomAccessInfo] = useState<any>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState("");

  // ==========================================
  // 1. FETCH ROOM ACCESS INFO WITH SMART LOGIC
  // ==========================================

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    const checkRoomAccess = async () => {
      try {
        console.log("🔍 Checking room access for:", roomId);

        const accessInfo = await getRoomAccessInfo(roomId);

        if (!accessInfo) {
          console.log("❌ Room not found, creating it...");
          await createRoom({ roomId, user, isRoleBased: false });
          setRoomAccessInfo({ isRoleBased: false, requiresKey: false });
          setUserRole("admin"); // Creator is always admin
          setLoadingRoom(false);
          return;
        }

        setRoomAccessInfo(accessInfo);

        // 🔥 NEW: Update lastAccessed timestamp for saved rooms
        if (user.uid) {
          updateRoomLastAccessed(user.uid, roomId).catch((err) => {
            console.warn("⚠️ Failed to update lastAccessed:", err);
          });
        }

        // Check if user already has admin access from room creation
        const sessionRole = sessionStorage.getItem(`room_${roomId}_role`);

        if (sessionRole === "admin") {
          console.log("✅ User has admin access from session");
          setUserRole("admin");
          setLoadingRoom(false);
          return;
        }

        // 🔥 NEW: SMART JOINING - Check if user is room creator
        if (accessInfo.isRoleBased) {
          const roomData = await getRoom(roomId);

          if (roomData && roomData.createdBy === user.uid) {
            console.log("✅ User is room creator - granting admin access");
            setUserRole("admin");
            sessionStorage.setItem(`room_${roomId}_role`, "admin");
            setLoadingRoom(false);
            return;
          }
        }

        // PUBLIC ROOM: Auto-grant admin access
        if (!accessInfo.isRoleBased) {
          console.log("✅ Public room - granting admin access");
          setUserRole("admin");
          setLoadingRoom(false);
          return;
        }

        // ROLE-BASED ROOM (not creator): Show modal
        console.log(
          "🔐 Role-based room (not creator) - showing role selection modal"
        );
        setShowRoleModal(true);
        setLoadingRoom(false);
      } catch (error) {
        console.error("Failed to check room access:", error);
        alert("Failed to load room. Please try again.");
        router.push("/home");
      }
    };

    checkRoomAccess();
  }, [user, authLoading, roomId, router]);

  // ==========================================
  // 2. HANDLE ROLE SELECTION
  // ==========================================

  const handleJoinAsViewer = () => {
    console.log("👁️ User chose to join as viewer");
    setUserRole("viewer");
    setShowRoleModal(false);
  };

  const handleVerifyAdminKey = async () => {
    if (!adminKeyInput.trim()) {
      setVerificationError("Please enter an admin key");
      return;
    }

    setVerifying(true);
    setVerificationError("");

    try {
      if (!socket.connected) {
        console.log("🔌 Socket not connected, attempting to connect...");
        socket.connect();

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Socket connection timeout"));
          }, 5000);

          if (socket.connected) {
            clearTimeout(timeout);
            resolve();
          } else {
            socket.once("connect", () => {
              clearTimeout(timeout);
              console.log("✅ Socket connected");
              resolve();
            });

            socket.once("connect_error", (error) => {
              clearTimeout(timeout);
              reject(error);
            });
          }
        });
      }

      console.log("📡 Emitting room:verify-admin for room:", roomId);

      const verificationResult = await new Promise<any>((resolve, reject) => {
        const verificationTimeout = setTimeout(() => {
          console.error("❌ Verification timeout - server not responding");
          reject(new Error("Verification timeout. Server may be down."));
        }, 10000);

        socket.emit(
          "room:verify-admin",
          { roomId, inputKey: adminKeyInput },
          (response: any) => {
            clearTimeout(verificationTimeout);
            console.log("📨 Received verification response:", response);
            resolve(response);
          }
        );
      });

      setVerifying(false);

      if (verificationResult && verificationResult.success) {
        console.log("✅ Admin key verified successfully");
        setUserRole("admin");
        setShowRoleModal(false);

        // Store in session for page refreshes
        sessionStorage.setItem(`room_${roomId}_role`, "admin");
      } else {
        console.log("❌ Admin verification failed:", verificationResult?.error);
        setVerificationError(verificationResult?.error || "Invalid admin key");
      }
    } catch (error) {
      console.error("❌ Verification error:", error);
      setVerifying(false);

      if (error instanceof Error) {
        setVerificationError(error.message);
      } else {
        setVerificationError(
          "Verification failed. Please check your connection and try again."
        );
      }
    }
  };

  // ==========================================
  // 3. UPGRADE MODAL (for viewers to become admin)
  // ==========================================

  const handleUpgradeToAdmin = () => {
    setAdminKeyInput("");
    setVerificationError("");
    setShowRoleModal(true);
  };

  // ==========================================
  // 4. LOADING STATE
  // ==========================================

  if (authLoading || loadingRoom) {
    return (
      <div className="text-white flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading room…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ==========================================
  // 5. ROLE SELECTION MODAL
  // ==========================================

  if (showRoleModal) {
    return (
      <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-700 bg-gray-800">
            <div className="flex items-center gap-3">
              <Shield className="text-yellow-400" size={28} />
              <div>
                <h3 className="text-xl font-bold text-white">
                  Role-Based Room
                </h3>
                <p className="text-sm text-gray-400">
                  Choose your access level
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Option 1: Join as Viewer */}
            <button
              onClick={handleJoinAsViewer}
              className="w-full p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl transition text-left group"
            >
              <div className="flex items-center gap-3 mb-2">
                <Eye className="text-blue-400" size={24} />
                <h4 className="text-lg font-semibold text-white group-hover:text-blue-400 transition">
                  Join as Viewer
                </h4>
              </div>
              <p className="text-sm text-gray-400">
                View-only access. You can see updates but cannot edit.
              </p>
            </button>

            {/* Option 2: Join as Admin */}
            <div className="p-4 bg-gray-800 border border-gray-700 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <Lock className="text-yellow-400" size={24} />
                <h4 className="text-lg font-semibold text-white">
                  Join as Admin
                </h4>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                Full edit access. Requires admin key.
              </p>

              <input
                type="password"
                value={adminKeyInput}
                onChange={(e) => {
                  setAdminKeyInput(e.target.value);
                  setVerificationError("");
                }}
                placeholder="Enter admin key"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-2"
                onKeyDown={(e) => e.key === "Enter" && handleVerifyAdminKey()}
              />

              {verificationError && (
                <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
                  <AlertCircle size={16} />
                  <span>{verificationError}</span>
                </div>
              )}

              <button
                onClick={handleVerifyAdminKey}
                disabled={verifying || !adminKeyInput.trim()}
                className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition"
              >
                {verifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                    Verifying...
                  </span>
                ) : (
                  "Verify & Enter"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 6. RENDER WHITEBOARD
  // ==========================================

  if (!userRole) {
    return (
      <div className="text-white flex items-center justify-center h-screen bg-gray-900">
        <p className="text-gray-400">Determining access level...</p>
      </div>
    );
  }

  return (
    <Whiteboard
      roomId={roomId}
      userEmail={user.email ?? "anonymous"}
      userRole={userRole}
      onUpgradeToAdmin={handleUpgradeToAdmin}
    />
  );
}
