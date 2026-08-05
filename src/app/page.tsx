import { redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth/session";
import { getDashboardPathForRole } from "@/lib/auth/roles";

// The root route is only ever meant to be an entry point: send the user
// straight to the dashboard for their role. requireUserProfile() already
// redirects to /login if they aren't authenticated.
export default async function RootPage() {
  const profile = await requireUserProfile();
  redirect(getDashboardPathForRole(profile.role));
}