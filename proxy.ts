import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Refreshes the Supabase session cookie and sends signed-out visitors to the role picker (demo mode, no login).
// Real authorization still happens in getMe() and RLS.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const db = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await db.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = path === "/" || path.startsWith("/demo/") || path.startsWith("/login");
  if (!user && !isPublic) return NextResponse.redirect(new URL("/", request.url));
  return response;
}

export const config = {
  // skip static files, images and API routes (webhooks/cron do their own auth)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
