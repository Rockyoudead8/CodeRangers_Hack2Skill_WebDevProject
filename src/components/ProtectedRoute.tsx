// src/components/ProtectedRoute.tsx
// Create this new file

"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  // Public paths that don't require authentication
  const publicPaths = ["/login", "/login/email", "/signup", "/verifyEmail"];
  const isPublicPath =
    publicPaths.some((path) => pathname?.startsWith(path)) || pathname === "/";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("🔐 Auth State Changed:", {
        user: user?.email,
        path: pathname,
        isPublic: isPublicPath,
      });

      if (user) {
        // User is authenticated
        setAuthenticated(true);

        // If on login/signup page, redirect to home
        if (isPublicPath) {
          console.log(
            "✅ Authenticated user on public page, redirecting to /home"
          );
          router.push("/home");
        }
      } else {
        // User is NOT authenticated
        setAuthenticated(false);

        // If on protected page, redirect to login
        if (!isPublicPath) {
          console.log(
            "❌ Unauthenticated user on protected page, redirecting to /login"
          );
          router.push("/login");
        }
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [pathname, isPublicPath, router]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show content only when authentication state is resolved correctly
  if (isPublicPath || authenticated) {
    return <>{children}</>;
  }

  // Fallback: should not reach here due to redirects above
  return null;
}
