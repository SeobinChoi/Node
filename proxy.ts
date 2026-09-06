import NextAuth, { type NextAuthRequest } from "next-auth";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authConfig } from "./auth.config";
import { publicDemoRoutes } from "./lib/public-demo-routes";

const authenticatedProxy = NextAuth(authConfig).auth((request: NextAuthRequest, event: NextFetchEvent) => {
  void request;
  void event;
  return NextResponse.next();
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (publicDemoRoutes.has(request.nextUrl.pathname)) return NextResponse.next();
  return authenticatedProxy(request, event);
}

export const config = {
  // Public demos are bypassed by exact pathname in proxy(); the matcher must
  // still run for lookalike prefixes so future routes do not silently lose auth.
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
