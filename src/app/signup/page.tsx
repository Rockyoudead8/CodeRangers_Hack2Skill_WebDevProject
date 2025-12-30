'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { GithubAuthProvider } from "firebase/auth";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import toast from "react-hot-toast";

export default function Login() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // GITHUB LOGIN
  const githubLogin = async () => {
    try {
      const provider = new GithubAuthProvider();
      provider.addScope("read:user");
      provider.addScope("user:email");

      const result = await signInWithPopup(auth, provider);

      console.log("GitHub user:", result.user);

      router.push("/home");
    } catch (err) {
      console.error(err);
      toast.error("GitHub login failed. Blame the octocat.");
    }
  };

  // GOOGLE LOGIN
  const googleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/drive.file");

      const result = await signInWithPopup(auth, provider);

      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;

      if (accessToken) {
        localStorage.setItem("drive_token", accessToken);
      }

      router.push("/home");
    } catch (err) {
      console.error(err);
      toast.error("Google login failed. Technology hates you today.");
    }
  };

  // EMAIL LOGIN / SIGNUP
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
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="bg-gray-900 p-8 rounded-2xl border border-gray-700 w-full max-w-md">

        <h1 className="text-3xl font-bold text-center mb-6">
          {mode === "login" ? "Login" : "Create Account"}
        </h1>

        {/* EMAIL INPUT */}
        <input
          type="email"
          placeholder="Email"
          className="w-full px-4 py-3 mb-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        {/* PASSWORD INPUT */}
        <input
          type="password"
          placeholder="Password"
          className="w-full px-4 py-3 mb-4 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        {/* EMAIL LOGIN / SIGNUP */}
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
        <div className="my-6 flex items-center gap-4">
          <div className="h-px bg-gray-700 flex-1" />
          <span className="text-gray-400 text-sm">OR</span>
          <div className="h-px bg-gray-700 flex-1" />
        </div>

        {/* GOOGLE LOGIN */}
        <button
          onClick={googleLogin}
          className="w-full py-3 bg-red-500 hover:bg-red-600 rounded-lg font-semibold transition"
        >
          Continue with Google
        </button>

        <button
          onClick={githubLogin}
          className="w-full py-3 bg-gray-700 hover:bg-gray-800 rounded-lg font-semibold transition mt-3"
        >
          Continue with GitHub
        </button>


        {/* SWITCH MODE */}
        <p className="text-center text-gray-400 text-sm mt-6">
          {mode === "login" ? (
            <>
              Don’t have an account?{" "}
              <span
                onClick={() => setMode("signup")}
                className="text-blue-400 cursor-pointer"
              >
                Sign up
              </span>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <span
                onClick={() => setMode("login")}
                className="text-blue-400 cursor-pointer"
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
