"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFlashTaskAction } from "@/lib/tasks/flash-actions";
import { Button } from "@/components/ui/button";

const DURATIONS = [2, 3, 4];

export function CreateFlashTaskForm({
  assignableUsers,
}: {
  assignableUsers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(2);
  const [isCustom, setIsCustom] = useState(false);
  const [customHours, setCustomHours] = useState("");

  function handleSubmit(formData: FormData) {
    const finalDuration = isCustom ? Number(customHours) : duration;
    formData.set("duration_hours", String(finalDuration));
    setError(null);
    startTransition(async () => {
      const result = await createFlashTaskAction(formData);
      if (result?.error) setError(result.error);
      else {
        (document.getElementById("flash-task-form") as HTMLFormElement)?.reset();
        setDuration(2);
        router.refresh();
      }
    });
  }

  return (
    <form id="flash-task-form" action={handleSubmit} className="space-y-3 glass-card rounded-xl p-4">
      <p className="font-medium text-sm">⚡ Assign Flash Task (anytime, hour-based)</p>

      <input
        name="title"
        placeholder="Task title"
        required
        className="w-full rounded-md border px-2 py-1.5 text-sm bg-background"
      />
      <textarea
        name="description"
        placeholder="Description (optional)"
        rows={2}
        className="w-full rounded-md border px-2 py-1.5 text-sm bg-background resize-none"
      />

      <select
        name="assigned_to"
        required
        defaultValue=""
        className="w-full rounded-md border px-2 py-1.5 text-sm bg-background"
      >
        <option value="" disabled>
          Assign to…
        </option>
        {assignableUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>

      <div className="flex gap-2 items-center flex-wrap">
        {DURATIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setIsCustom(false);
              setDuration(d);
            }}
            className={
              "text-xs px-3 py-1.5 rounded-md border transition-colors " +
              (!isCustom && duration === d
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted")
            }
          >
            {d}h
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIsCustom(true)}
          className={
            "text-xs px-3 py-1.5 rounded-md border transition-colors " +
            (isCustom
              ? "bg-primary text-primary-foreground border-primary"
              : "hover:bg-muted")
          }
        >
          Custom
        </button>
        {isCustom && (
          <input
            type="number"
            min={1}
            max={24}
            step={0.5}
            placeholder="Hours"
            value={customHours}
            onChange={(e) => setCustomHours(e.target.value)}
            className="w-20 rounded-md border px-2 py-1.5 text-xs bg-background"
          />
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Assigning…" : "Assign Flash Task"}
      </Button>
    </form>
  );
}