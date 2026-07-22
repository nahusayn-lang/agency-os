"use client";

import { useState } from "react";
import { toggleUserActiveAction, setUserRoleAction, setShiftAction } from "@/lib/admin/users";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  shift_start?: string | null;
  shift_end?: string | null;
}

export function UsersList({ rows, isSuperAdmin }: { rows: AdminUserRow[]; isSuperAdmin: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {rows.map((u) => {
        const isOpen = openId === u.id;
        return (
          <div key={u.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : u.id)}
              className="w-full flex items-center justify-between gap-2 p-4 text-left"
            >
              <div className="min-w-0">
                <div className="font-semibold text-base truncate">{u.name}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  {u.role}
                </span>
                {!u.is_active && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                    inactive
                  </span>
                )}
                <span className="text-muted-foreground text-xs">{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>

            {isOpen && (
              <div className="p-4 pt-0 space-y-3 border-t border-border">
                <form action={toggleUserActiveAction}>
                  <input type="hidden" name="userId" value={u.id} />
                  <input type="hidden" name="isActive" value={u.is_active ? "false" : "true"} />
                  <button
                    type="submit"
                    className={`w-full text-sm font-medium py-2 rounded-lg border transition-colors ${
                      u.is_active
                        ? "border-destructive text-destructive hover:bg-destructive hover:text-white"
                        : "border-green-500 text-green-600 hover:bg-green-500 hover:text-white"
                    }`}
                  >
                    {u.is_active ? "Deactivate" : "Activate"}
                  </button>
                </form>

                <form action={setUserRoleAction} className="flex items-center gap-2">
                  <input type="hidden" name="userId" value={u.id} />
                  <select
                    name="role"
                    defaultValue={u.role}
                    className="flex-1 border border-border rounded-lg px-3 py-2 bg-background text-sm text-foreground"
                  >
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                    <option value="super_admin">super_admin</option>
                  </select>
                  <button
                    type="submit"
                    className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Set role
                  </button>
                </form>

                <div className="text-xs text-muted-foreground">
                  Shift: {u.shift_start?.slice(0, 5) ?? "—"} → {u.shift_end?.slice(0, 5) ?? "—"}
                </div>

                {isSuperAdmin && (
                  <form action={setShiftAction} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <input
                      type="time"
                      name="shift_start"
                      defaultValue={u.shift_start?.slice(0, 5) ?? "09:00"}
                      className="flex-1 border border-border rounded-lg px-2 py-2 text-sm bg-background text-foreground"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">to</span>
                    <input
                      type="time"
                      name="shift_end"
                      defaultValue={u.shift_end?.slice(0, 5) ?? "17:00"}
                      className="flex-1 border border-border rounded-lg px-2 py-2 text-sm bg-background text-foreground"
                    />
                    <button
                      type="submit"
                      className="shrink-0 text-sm font-medium px-3 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      Save
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}