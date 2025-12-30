//src\app\login\page.tsx

"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();

      // ⭐ Request Google Drive Access
      provider.addScope("https://www.googleapis.com/auth/drive.file");

      const result = await signInWithPopup(auth, provider);

      //  Get OAuth Access Token
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;

      if (accessToken) {
        localStorage.setItem("drive_token", accessToken);
        console.log("Drive Token Stored");
      } else {
        console.warn("No Drive Token received");
      }

      console.log("User:", result.user);
      router.push("/home");
    } catch (error) {
      console.error("Google Login Failed", error);
      alert("Login failed. Technology is mean sometimes.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="bg-gray-900 p-8 rounded-2xl border border-gray-700 max-w-md w-full">
        <h1 className="text-3xl font-bold mb-6 text-center">
          Login to CollabBoard
        </h1>

        <button
          onClick={loginWithGoogle}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
        >
          Continue with Google
        </button>

        <p className="text-center text-sm text-gray-400 mt-4">
          Secure Google Sign-In. We only request Drive access to save your
          boards.
        </p>
      </div>
    </div>
  );
}
