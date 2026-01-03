// src/proxy.ts (rename proxy.ts to middleware.ts)

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Define public paths (accessible without authentication)
  const publicPaths = ["/login", "/login/email", "/signup", "/verifyEmail"];

  // Check if current path is public
  const isPublicPath = publicPaths.some((publicPath) =>
    path.startsWith(publicPath)
  );

  // Get authentication token from cookies
  // Firebase stores auth state in cookies named __session or custom names
  const firebaseToken =
    request.cookies.get("__session")?.value ||
    request.cookies.get("firebase-auth")?.value ||
    request.cookies.get("auth-token")?.value;

  // Alternative: Check for any Firebase-related cookie
  const hasFirebaseAuth = Array.from(request.cookies.getAll()).some(
    (cookie) =>
      cookie.name.includes("firebase") ||
      cookie.name.includes("auth") ||
      cookie.name.includes("__session")
  );

  console.log("🔒 Middleware Check:", {
    path,
    isPublicPath,
    hasAuth: hasFirebaseAuth || !!firebaseToken,
    cookies: request.cookies.getAll().map((c) => c.name),
  });

  // CASE 1: User is authenticated and trying to access login/signup
  // Redirect them to home page
  if (isPublicPath && (firebaseToken || hasFirebaseAuth)) {
    console.log(
      "✅ Authenticated user accessing public path, redirecting to /home"
    );
    return NextResponse.redirect(new URL("/home", request.url));
  }

  // CASE 2: User is NOT authenticated and trying to access protected route
  // Redirect them to login page
  if (!isPublicPath && !firebaseToken && !hasFirebaseAuth) {
    console.log(
      "❌ Unauthenticated user accessing protected path, redirecting to /login"
    );
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // CASE 3: Everything is fine, let the request proceed
  return NextResponse.next();
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (if you want to protect API routes, remove this line)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
