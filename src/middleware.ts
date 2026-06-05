import { type NextRequest, NextResponse } from "next/server";
import {
  getDashboardPathForRole,
  getRoleForDashboardPath,
} from "@/lib/auth/roles";
import { updateSession } from "@/lib/supabase/middleware";
import type { UserRole } from "@/lib/types/database";

function isUserRole(value: string): value is UserRole {
  return value === "super_admin" || value === "admin" || value === "member";
}

export async function middleware(request: NextRequest) {
  const { supabase, user, supabaseResponse } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isLoginPage = pathname === "/login";
  const isDashboard = pathname.startsWith("/dashboard");
  const isAppRoute =
    isDashboard ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/crm");
  const isRoot = pathname === "/";

  if (!user) {
    if (isLoginPage) {
      return supabaseResponse;
    }
    if (isAppRoute || isRoot) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return supabaseResponse;
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/login?error=profile_not_found", request.url)
    );
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/login?error=account_inactive", request.url)
    );
  }

  if (!isUserRole(profile.role)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/login?error=invalid_role", request.url)
    );
  }

  const role = profile.role;
  const dashboardPath = getDashboardPathForRole(role);

  if (isLoginPage || isRoot) {
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }

  if (isDashboard) {
    const requiredRole = getRoleForDashboardPath(pathname);
    if (requiredRole && requiredRole !== role) {
      return NextResponse.redirect(new URL(dashboardPath, request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/tasks/:path*", "/crm/:path*"],
};
