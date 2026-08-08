"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ColdCallTargetRow {
  id: string;
  name: string;
  override: number | null;
  effectiveTarget: number;
}

export function ColdCallSettings({
  initialDefaultTarget,
  initialMembers,
}: {
  initialDefaultTarget: number;
  initialMembers: ColdCallTargetRow[];
}) {
  const [defaultTarget, setDefaultTarget] = useState(initialDefaultTarget);
  const [defaultInput, setDefaultInput] = useState(String(initialDefaultTarget));
  const [defaultPending, startDefaultTransition] = useTransition();
  const [defaultError, setDefaultError] = useState<string | null>(null);

  const [members, setMembers] = useState(initialMembers);
  const [overrideInputs, setOverrideInputs] = useState<Record<string, string>>(
    Object.fromEntries(initialMembers.map((m) => [m.id, m.override != null ? String(m.override) : ""]))
  );
  const [overridePending, setOverridePending] = useState<string | null>(null);
  const [overrideError, setOverrideError] = useState<Record<string, string>>({});

  function handleSaveDefault() {
    const value = Number(defaultInput);
    if (!Number.isInteger(value) || value <= 0) {
      setDefaultError("Enter a positive whole number.");
      return;
    }
    setDefaultError(null);
    startDefaultTransition(async () => {
      const res = await fetch("/api/admin/cold-call-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultTarget: value }),
      });
      const data = await res.json();
      if (data?.error) {
        setDefaultError(data.error);
        return;
      }
      setDefaultTarget(value);
      // Members without an override now follow the new default.
      setMembers((cur) => cur.map((m) => (m.override == null ? { ...m, effectiveTarget: value } : m)));
    });
  }

  function handleSaveOverride(userId: string) {
    const raw = overrideInputs[userId] ?? "";
    const value = raw.trim() === "" ? null : Number(raw);

    if (value !== null && (!Number.isInteger(value) || value <= 0)) {
      setOverrideError((cur) => ({ ...cur, [userId]: "Enter a positive whole number or leave blank." }));
      return;
    }

    setOverrideError((cur) => ({ ...cur, [userId]: "" }));
    setOverridePending(userId);

    fetch("/api/admin/cold-call-settings/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, target: value }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) {
          setOverrideError((cur) => ({ ...cur, [userId]: data.error }));
          return;
        }
        setMembers((cur) =>
          cur.map((m) =>
            m.id === userId
              ? { ...m, override: value, effectiveTarget: value ?? defaultTarget }
              : m
          )
        );
      })
      .finally(() => setOverridePending(null));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cold Calls Target</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Daily target for the mandatory Cold Calls task. Members without a personal override use this
            number.
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={defaultInput}
              onChange={(e) => setDefaultInput(e.target.value)}
              className="w-24"
            />
            <Button size="sm" disabled={defaultPending} onClick={handleSaveDefault}>
              {defaultPending ? "Saving…" : "Save default"}
            </Button>
          </div>
          {defaultError && <p className="text-xs text-red-500">{defaultError}</p>}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Per-member override</p>
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm truncate">{m.name}</span>
              <Input
                type="number"
                min={1}
                placeholder={String(defaultTarget)}
                value={overrideInputs[m.id] ?? ""}
                onChange={(e) =>
                  setOverrideInputs((cur) => ({ ...cur, [m.id]: e.target.value }))
                }
                className="w-20"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={overridePending === m.id}
                onClick={() => handleSaveOverride(m.id)}
              >
                {overridePending === m.id ? "…" : "Save"}
              </Button>
            </div>
          ))}
          {members.map((m) =>
            overrideError[m.id] ? (
              <p key={`err-${m.id}`} className="text-xs text-red-500">
                {m.name}: {overrideError[m.id]}
              </p>
            ) : null
          )}
        </div>
      </CardContent>
    </Card>
  );
}