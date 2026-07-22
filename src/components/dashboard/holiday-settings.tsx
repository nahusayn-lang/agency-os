"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export interface HolidayItem {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative flex-1">
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          WebkitTextFillColor: value ? "transparent" : "white",
          colorScheme: "dark",
        }}
        className={`holiday-date-input w-full text-sm rounded border px-2 py-1.5 bg-background ${
          value ? "text-transparent" : "text-white"
        }`}
      />
      {value && (
        <span className="pointer-events-none absolute inset-0 flex items-center px-2 text-sm">
          {formatDate(value)}
        </span>
      )}
    </div>
  );
}

export function HolidaySettings({
  initialSundayOff,
  initialHolidays,
}: {
  initialSundayOff: boolean;
  initialHolidays: HolidayItem[];
}) {
  const [sundayOff, setSundayOff] = useState(initialSundayOff);
  const [togglePending, startToggleTransition] = useTransition();
  const [toggleError, setToggleError] = useState<string | null>(null);

  const [holidays, setHolidays] = useState(initialHolidays);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [addPending, startAddTransition] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);

  function toggleSunday() {
    const next = !sundayOff;
    setToggleError(null);
    startToggleTransition(async () => {
      const res = await fetch("/api/admin/attendance-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sundayOff: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToggleError(data.error ?? "Save failed.");
        return;
      }
      setSundayOff(next);
    });
  }

  function addHoliday() {
    setAddError(null);
    if (!name.trim() || !startDate || !endDate) {
      setAddError("Please fill in name, start date, and end date.");
      return;
    }
    startAddTransition(async () => {
      const res = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, startDate, endDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add.");
        return;
      }
      setHolidays((prev) =>
        [...prev, { id: crypto.randomUUID(), name, start_date: startDate, end_date: endDate }].sort((a, b) =>
          a.start_date.localeCompare(b.start_date)
        )
      );
      setName("");
      setStartDate("");
      setEndDate("");
    });
  }

  function removeHoliday(id: string) {
    startAddTransition(async () => {
      const res = await fetch("/api/admin/holidays", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to remove.");
        return;
      }
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Off Days &amp; Holidays</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sunday off</p>
          <div className="flex items-center gap-3">
            <Button size="sm" disabled={togglePending} onClick={toggleSunday}>
              {sundayOff ? "Sunday: OFF (turn ON)" : "Sunday: WORKING (turn OFF)"}
            </Button>
            {togglePending && <span className="text-xs text-muted-foreground">Saving…</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            All active users will be notified when this is changed.
          </p>
          {toggleError && <p className="text-xs text-destructive">{toggleError}</p>}
        </div>

        <div className="rounded-lg border p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add holiday</p>
          <input
            className="w-full text-sm rounded border px-2 py-1.5 bg-background"
            placeholder="Holiday name (e.g. Independence Day)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <DateField value={startDate} onChange={setStartDate} />
            <span className="text-xs text-muted-foreground shrink-0">to</span>
            <DateField value={endDate} onChange={setEndDate} />
          </div>
          <Button size="sm" disabled={addPending} onClick={addHoliday}>
            {addPending ? "Saving…" : "Add holiday"}
          </Button>
          {addError && <p className="text-xs text-destructive">{addError}</p>}

          <div className="space-y-2 pt-2">
            {holidays.length === 0 && <p className="text-xs text-muted-foreground">No holidays added yet.</p>}
            {holidays.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                <div>
                  <p className="font-medium">{h.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(h.start_date)} → {formatDate(h.end_date)}
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled={addPending} onClick={() => removeHoliday(h.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}