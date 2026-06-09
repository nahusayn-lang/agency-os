"use client";

import React, { useEffect, useMemo, useState } from "react";

interface Props {
  isCheckedIn: boolean;
  checkInTime: string | null;
  isBlocked: boolean;
}

export default function WorkSessionCardClient({ isCheckedIn, checkInTime, isBlocked }: Props) {
  const [now, setNow] = useState(() => new Date());
  const checkInDate = useMemo(() => (checkInTime ? new Date(checkInTime) : null), [checkInTime]);

  useEffect(() => {
    if (!isCheckedIn) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [isCheckedIn]);

  function formatDuration(from: Date, to: Date) {
    const diff = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  return (
    <div className="space-y-2">
      <div>Checked in: {isCheckedIn && checkInDate ? new Date(checkInDate).toLocaleString() : "No"}</div>
      {isCheckedIn && checkInDate && (
        <div>Current session: <strong>{formatDuration(checkInDate, now)}</strong></div>
      )}
      <div>Working status: {isCheckedIn ? (isBlocked ? "Blocked" : "Working") : "Not started"}</div>

      <div className="mt-4 flex gap-2">
        {!isCheckedIn && (
          <form action="/api/attendance/checkin" method="POST">
            <button className="btn" type="submit">Check In</button>
          </form>
        )}

        {isCheckedIn && (
          <form action="/api/attendance/checkout" method="POST">
            <button className="btn" type="submit" disabled={isBlocked}>Check Out</button>
          </form>
        )}
      </div>

      {isBlocked && (
        <div className="mt-4">
          <label htmlFor="emergency_note">Emergency note</label>
          <form action="/api/requests/emergency" method="POST" className="mt-2">
            <input id="emergency_note" name="note" className="w-full rounded border p-2" />
            <div className="mt-2">
              <button className="btn" type="submit">Send Approval Request</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
