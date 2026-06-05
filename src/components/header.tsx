import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/session";
import { getDashboardPathForRole } from "@/lib/auth/roles";
import { LogoutButton } from "@/components/logout-button";

export async function Header() {
  const profile = await requireUserProfile();
  const dashboardPath = getDashboardPathForRole(profile.role);

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href={dashboardPath} className="text-sm font-medium tracking-tight">
            Agency OS
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href={dashboardPath} className="hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/tasks" className="hover:text-foreground">
              Tasks
            </Link>
            <Link href="/crm" className="hover:text-foreground">
              CRM
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{profile.name}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
