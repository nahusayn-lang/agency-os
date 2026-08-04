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

// Caches the role/is_active check in a short-lived cookie so we don't hit
// the DB on every single navigation. This is purely a routing/UX
// optimization — actual page access still goes through requireRole() /
// requireUserProfile() (src/lib/auth/session.ts), which independently
// re-verify role and is_active from the DB on every page load. So a stale
// cache here can never grant access to something the DB-level check would
// block; worst case, a just-deactivated/role-changed user briefly reaches
// a page and gets bounced there instead of at the middleware layer.
const ROLE_CACHE_COOKIE = "agencyos_role_cache";
const ROLE_CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

type RoleCache = { uid: string; role: string; active: boolean; ts: number };

function readRoleCache(request: NextRequest, userId: string): RoleCache | null {
  const raw = request.cookies.get(ROLE_CACHE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(atob(raw)) as RoleCache;
    if (parsed.uid !== userId) return null;
    if (Date.now() - parsed.ts > ROLE_CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRoleCache(response: NextResponse, cache: RoleCache) {
  const encoded = btoa(JSON.stringify(cache));
  response.cookies.set(ROLE_CACHE_COOKIE, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ROLE_CACHE_MAX_AGE_MS / 1000,
  });
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

  let role: string;
  let isActive: boolean;

  const cached = readRoleCache(request, user.id);
  if (cached) {
    role = cached.role;
    isActive = cached.active;
  } else {
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

    role = profile.role;
    isActive = profile.is_active;

    writeRoleCache(supabaseResponse, { uid: user.id, role, active: isActive, ts: Date.now() });
  }

  if (!isActive) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/login?error=account_inactive", request.url)
    );
  }

  if (!isUserRole(role)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/login?error=invalid_role", request.url)
    );
  }

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