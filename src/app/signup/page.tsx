'use client';

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  getOAuthErrorMessage,
  saveGoogleDriveToken,
  signInWithOAuthProvider,
} from "@/lib/oauth";
import toast from "react-hot-toast";

const getAuthErrorMessage = (error: unknown) => {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

  switch (code) {
    case "auth/email-already-in-use":
      return "An account already exists with this email. Please log in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/operation-not-allowed":
      return "Email/password signup is not enabled for this Firebase project.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 8 characters.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    default:
      return "Could not create account. Please try again.";
  }
};

export default function Signup() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const githubLogin = async () => {
    try {
      await signInWithOAuthProvider(auth, "github");
      router.push("/home");
    } catch (err) {
      toast.error(getOAuthErrorMessage(err, "github"));
    }
  };

  const googleLogin = async () => {
    try {
      const result = await signInWithOAuthProvider(auth, "google");
      saveGoogleDriveToken(result);
      router.push("/home");
    } catch (err) {
      toast.error(getOAuthErrorMessage(err, "google"));
    }
  };

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setLoading(true);

      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail || !password) return toast.error("Fill all fields.");
      if (password.length < 8)
        return toast.error("Password must be at least 8 characters.");

      await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      toast.success("Account created");
      router.push("/home");
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="
        pt-15
        min-h-screen w-full flex items-center justify-center relative overflow-hidden
        bg-gradient-to-br
        from-blue-100 via-gray-100 to-purple-100
        dark:from-black dark:via-gray-900 dark:to-gray-950
        transition-colors
      "
    >
      {/* Light mode breathing orbs */}
      <div className="absolute w-[650px] h-[650px] bg-blue-300/40 blur-[160px] rounded-full -top-24 -left-16 animate-pulse dark:hidden" />
      <div className="absolute w-[700px] h-[700px] bg-purple-300/40 blur-[180px] rounded-full bottom-0 right-0 animate-pulse dark:hidden" />

      {/* Dark mode breathing orbs */}
      <div className="absolute w-[650px] h-[650px] bg-blue-700/40 blur-[150px] rounded-full -top-24 -left-16 animate-pulse hidden dark:block" />
      <div className="absolute w-[700px] h-[700px] bg-purple-700/30 blur-[170px] rounded-full bottom-0 right-0 animate-pulse hidden dark:block" />

      {/* Card */}
      <div
        className="
          relative z-10 w-full max-w-lg rounded-3xl p-10 backdrop-blur-xl shadow-2xl
          bg-white/80 border border-gray-300
          dark:bg-gray-900/70 dark:border-gray-800
        "
      >
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white text-center">
          Create Account
        </h1>

        <p className="text-gray-600 dark:text-gray-400 text-center mt-2 text-sm tracking-wide">
          Join the CollabBoard experience 🚀
        </p>

        {/* Inputs */}
        <form className="mt-8 flex flex-col gap-4" onSubmit={handleAuth}>
          <input
            type="email"
            placeholder="Email Address"
            autoComplete="email"
            className="
              w-full px-4 py-3 rounded-xl transition outline-none
              bg-gray-50 border border-gray-300 text-gray-900
              dark:bg-black/60 dark:border-gray-700 dark:text-gray-200
              focus:ring-2 focus:ring-blue-600
            "
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            autoComplete="new-password"
            className="
              w-full px-4 py-3 rounded-xl transition outline-none
              bg-gray-50 border border-gray-300 text-gray-900
              dark:bg-black/60 dark:border-gray-700 dark:text-gray-200
              focus:ring-2 focus:ring-purple-600
            "
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            disabled={loading}
            className="
              mt-2 w-full py-3 rounded-xl font-bold tracking-wide transition
              bg-gradient-to-r from-blue-600 to-purple-600
              hover:from-purple-600 hover:to-blue-600
              text-white shadow-lg shadow-blue-700/40
              disabled:opacity-50
            "
          >
            {loading ? "Processing..." : "Create Account"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">
          <div className="h-[1px] bg-gray-300 dark:bg-gray-700 w-full" />
          <span className="text-gray-500 dark:text-gray-400 text-sm">OR</span>
          <div className="h-[1px] bg-gray-300 dark:bg-gray-700 w-full" />
        </div>

        {/* OAuth */}
        <div className="flex flex-col gap-3">
          <button
            onClick={googleLogin}
            className="w-full py-3 bg-white border border-gray-300 text-black font-semibold rounded-xl hover:bg-gray-100 transition flex items-center justify-center gap-2"
          >
            <img
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              className="w-5 h-5"
            />
            Continue with Google
          </button>

          <button
            onClick={githubLogin}
            className="w-full py-3 bg-gray-800 border border-gray-700 text-white font-semibold rounded-xl hover:bg-gray-700 transition flex items-center justify-center gap-2"
          >
            <img
              src="https://www.svgrepo.com/show/512317/github-142.svg"
              className="w-5 invert"
            />
            Continue with GitHub
          </button>
        </div>

        {/* Switch */}
        <p className="text-gray-600 dark:text-gray-400 text-sm text-center mt-6">
          Already have an account?
          <span
            onClick={() => router.push("/login")}
            className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer ml-1"
          >
            Login
          </span>
        </p>
      </div>
    </div>
  );
}
