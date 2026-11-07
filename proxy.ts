import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const sessionCookie = projectId
    ? request.cookies.get(`a_session_${projectId}`)
    : undefined;

  if (!sessionCookie?.value) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/create/:path*",
    "/instant/:path*",
    "/instants/:path*",
    "/connections/:path*",
    "/profile/:path*",
    "/notifications/:path*",
    "/settings/:path*",
    "/u/:path*",
  ],
};
