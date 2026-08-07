"use client";

import { useState, useTransition } from "react";
import { toggleUserActiveAction, setUserRoleAction, setShiftAction } from "@/lib/admin/users";

function ShiftForm({ userId, shiftStart, shiftEnd }: { userId: string; shiftStart: string; shiftEnd: string }) {
  const [start, setStart] = useState(shiftStart);
  const [end, setEnd] = useState(shiftEnd);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("userId", userId);
      formData.set("shift_start", start);
      formData.set("shift_end", end);
      const result = await setShiftAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="time"
        value={start}
        onChange={(e) => {
          setStart(e.target.value);
          setSaved(false);
        }}
        className="flex-1 border border-border rounded-lg px-2 py-2 text-sm bg-background text-foreground"
      />
      <span className="text-xs text-muted-foreground shrink-0">to</span>
      <input
        type="time"
        value={end}
        onChange={(e) => {
          setEnd(e.target.value);
          setSaved(false);
        }}
        className="flex-1 border border-border rounded-lg px-2 py-2 text-sm bg-background text-foreground"
      />
      <button
        type="button"
        disabled={pending}
        onClick={handleSave}
        className="shrink-0 text-sm font-medium px-3 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {saved && !pending && <span className="text-xs text-emerald-500 shrink-0">Saved ✓</span>}
      {error && <span className="text-xs text-destructive shrink-0">{error}</span>}
    </div>
  );
}

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
                  <ShiftForm
                    userId={u.id}
                    shiftStart={u.shift_start?.slice(0, 5) ?? "09:00"}
                    shiftEnd={u.shift_end?.slice(0, 5) ?? "17:00"}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}