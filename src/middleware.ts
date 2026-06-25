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
  const searchParams = request.nextUrl.searchParams;

  const hasRecoveryIndicator = () => {
    if (searchParams.get("type") === "recovery") return true;
    if (searchParams.get("code")) return true;
    if (searchParams.get("access_token")) return true;
    if (searchParams.get("refresh_token")) return true;
    return false;
  };

  const isLoginPage = pathname === "/login";
  const isDashboard = pathname.startsWith("/dashboard");
  const isAppRoute =
    isDashboard ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/crm") ||
    pathname.startsWith("/attendance") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/my-tasks") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/targets") ||
    pathname.startsWith("/performance") ||
    pathname.startsWith("/admin");
  const isRoot = pathname === "/";

  if (isRoot) {
    return supabaseResponse;
  }

  if (!user) {
    if (isLoginPage) {
      return supabaseResponse;
    }
    if ((isAppRoute || isRoot) && !hasRecoveryIndicator()) {
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
    if (hasRecoveryIndicator()) {
      return supabaseResponse;
    }
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
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/tasks/:path*",
    "/crm/:path*",
    "/attendance/:path*",
    "/messages/:path*",
    "/my-tasks/:path*",
    "/reports/:path*",
    "/targets/:path*",
    "/performance/:path*",
    "/admin/:path*",
  ],
};