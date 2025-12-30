//src\app\login\email\page.tsx

"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { useRouter } from "next/navigation";

export default function EmailAuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    try {
      setLoading(true);

      if (!email || !password) {
        alert("Fill all fields, genius.");
        return;
      }

      if (mode === "signup" && password.length < 8) {
        alert("Password must be 8+ characters.");
        return;
      }

      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("Signup successful 🎉");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        alert("Login successful 🎉");
      }

      router.push("/home");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Authentication failed. Technology hates you.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!email) return alert("Enter email first");
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset link sent to email.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="bg-gray-900 p-8 rounded-2xl border border-gray-700 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6">
          {mode === "login" ? "Login" : "Create Account"}
        </h1>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            onClick={handleAuth}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : mode === "login"
              ? "Login"
              : "Create Account"}
          </button>

          {mode === "login" && (
            <button
              onClick={resetPassword}
              className="text-sm text-gray-400 hover:text-gray-200"
            >
              Forgot Password?
            </button>
          )}
        </div>

        <div className="text-center mt-6 text-gray-400 text-sm">
          {mode === "login" ? (
            <>
              Don’t have an account?{" "}
              <span
                className="text-blue-400 cursor-pointer"
                onClick={() => setMode("signup")}
              >
                Sign up
              </span>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <span
                className="text-blue-400 cursor-pointer"
                onClick={() => setMode("login")}
              >
                Login
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
