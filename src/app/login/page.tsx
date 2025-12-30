'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useUser from "@/hooks/useUser";
import { auth } from "@/lib/firebase";
import { GithubAuthProvider } from "firebase/auth";
import LoadingScreen from "../../../components/Loading";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import toast from "react-hot-toast";

export default function Login() {

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [Loading, setLoading] = useState(false);
  const { user, loading } = useUser();
  const router = useRouter();

  
  useEffect(() => {
    if (!loading && user) {
      router.push("/home");
    }
  }, [user, loading, router]);

  if (loading) return <LoadingScreen />;



  const githubLogin = async () => {
    try {
      const provider = new GithubAuthProvider();
      provider.addScope("read:user");
      provider.addScope("user:email");
      await signInWithPopup(auth, provider);
      router.push("/home");
    } catch (err) {
      toast.error("GitHub login failed.");
    }
  };

  const googleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/drive.file");
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;
      if (accessToken) localStorage.setItem("drive_token", accessToken);
      router.push("/home");
    } catch (err) {
      toast.error("Google login failed.");
    }
  };

  const handleAuth = async () => {
    try {
      setLoading(true);

      if (!email || !password) return toast.error("Fill all fields.");
      if (mode === "signup" && password.length < 8)
        return toast.error("Password must be 8+ characters.");

      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success("Account created 🎉");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Login successful 🎉");
      }

      router.push("/home");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!email) return toast.error("Enter email first");
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Reset email sent.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-black via-gray-900 to-gray-950 flex items-center justify-center relative overflow-hidden">

      {/* Glowing background Orbs */}
      <div className="absolute w-[650px] h-[650px] bg-blue-700/40 blur-[150px] rounded-full -top-24 -left-16 animate-pulse" />
      <div className="absolute w-[700px] h-[700px] bg-purple-700/30 blur-[170px] rounded-full bottom-0 right-0 animate-pulse" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg bg-gray-900/70 border border-gray-800 rounded-3xl p-10 shadow-2xl backdrop-blur-xl">

        <h1 className="text-4xl font-extrabold text-white text-center">
          {mode === "login" ? "Welcome Back" : "Create Account"}
        </h1>
        <p className="text-gray-400 text-center mt-2 text-sm tracking-wide">
          {mode === "login"
            ? "Log in and jump straight into collaboration."
            : "Join the CollabBoard experience 🚀"}
        </p>

        {/* Inputs */}
        <div className="mt-8 flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email Address"
            className="w-full px-4 py-3 bg-black/60 border border-gray-700 rounded-xl text-gray-200 focus:ring-2 focus:ring-blue-600 outline-none transition"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 bg-black/60 border border-gray-700 rounded-xl text-gray-200 focus:ring-2 focus:ring-purple-600 outline-none transition"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            onClick={handleAuth}
            disabled={Loading}
            className="mt-2 w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-purple-600 hover:to-blue-600 transition rounded-xl text-white font-bold tracking-wide shadow-lg shadow-blue-700/40 disabled:opacity-50"
          >
            {Loading
              ? "Processing..."
              : mode === "login"
                ? "Login"
                : "Create Account"}
          </button>
        </div>

        {/* Forgot Password */}
        {mode === "login" && (
          <button
            onClick={resetPassword}
            className="text-sm text-gray-400 hover:text-gray-200 mt-2"
          >
            Forgot Password?
          </button>
        )}

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">
          <div className="h-[1px] bg-gray-700 w-full"></div>
          <span className="text-gray-400 text-sm">OR</span>
          <div className="h-[1px] bg-gray-700 w-full"></div>
        </div>

        {/* OAuth Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={googleLogin}
            className="w-full py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition flex items-center justify-center gap-2"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" />
            Continue with Google
          </button>

          <button
            onClick={githubLogin}
            className="w-full py-3 bg-gray-800 border border-gray-700 text-white font-semibold rounded-xl hover:bg-gray-700 transition flex items-center justify-center gap-2"
          >
            <img src="https://www.svgrepo.com/show/512317/github-142.svg" className="w-5 invert" />
            Continue with GitHub
          </button>
        </div>

        {/* Mode Switch */}
        <p className="text-gray-400 text-sm text-center mt-6">
          {mode === "login" ? (
            <>
              Don’t have an account?
              <span
                onClick={() => setMode("signup")}
                className="text-blue-400 hover:underline cursor-pointer ml-1"
              >
                Sign Up
              </span>
            </>
          ) : (
            <>
              Already have an account?
              <span
                onClick={() => setMode("login")}
                className="text-blue-400 hover:underline cursor-pointer ml-1"
              >
                Login
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
