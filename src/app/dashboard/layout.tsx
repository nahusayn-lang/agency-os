import Header from "@/components/header";
import { PushInit } from "@/components/push-init";
import { requireUserProfile } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireUserProfile();

  return (
    <div className="min-h-screen">
      <Header />
      <PushInit userId={profile.id} />
      <main className="mx-auto max-w-5xl px-4 py-8 lg:ml-[var(--sidebar-w)] transition-[margin-left] duration-300 ease-in-out">{children}</main>
    </div>
  );
}