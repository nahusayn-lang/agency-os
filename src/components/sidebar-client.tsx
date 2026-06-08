"use client";
import { useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

export default function SidebarClient({ profile }: { profile: { id: string; name: string; role: string; email?: string } }) {
  const [open, setOpen] = useState(false);

  const isAdmin = ["super_admin", "founder"].includes(profile.role || "");

  return (
    <>
      <button
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="p-2 rounded hover:bg-accent/5 lg:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-background shadow-md p-4 transform transition-transform duration-200">
            <div className="flex items-center justify-between mb-6">
              <Link href={"/dashboard"} className="text-lg font-semibold" onClick={() => setOpen(false)}>
                Agency OS
              </Link>
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="p-2">
                ✕
              </button>
            </div>

            <nav className="space-y-2 text-sm">
              <Link href="/dashboard" onClick={() => setOpen(false)} className="block px-2 py-1 rounded hover:bg-accent/5">Dashboard</Link>
              <Link href="/tasks" onClick={() => setOpen(false)} className="block px-2 py-1 rounded hover:bg-accent/5">Tasks</Link>
              <Link href="/crm" onClick={() => setOpen(false)} className="block px-2 py-1 rounded hover:bg-accent/5">CRM</Link>
              <Link href="/messages" onClick={() => setOpen(false)} className="block px-2 py-1 rounded hover:bg-accent/5">Messages</Link>
              <Link href="/reports" onClick={() => setOpen(false)} className="block px-2 py-1 rounded hover:bg-accent/5">Reports</Link>

              <div className="border-t border-border my-3" />

              <Link href="/attendance" onClick={() => setOpen(false)} className="block px-2 py-1 rounded hover:bg-accent/5">Attendance</Link>
              <Link href="/performance" onClick={() => setOpen(false)} className="block px-2 py-1 rounded hover:bg-accent/5">Performance</Link>
              <Link href="/targets" onClick={() => setOpen(false)} className="block px-2 py-1 rounded hover:bg-accent/5">Weekly Targets</Link>

              <div className="border-t border-border my-3" />

              {isAdmin && (
                <Link href="/admin/users" onClick={() => setOpen(false)} className="block px-2 py-1 rounded hover:bg-accent/5">Users</Link>
              )}
            </nav>

            <div className="mt-6">
              <LogoutButton />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
