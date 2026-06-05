"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { setTaskProofUrlAction } from "@/lib/tasks/actions";
import { Input } from "@/components/ui/input";

interface ProofUploadProps {
  taskId: string;
  currentProofUrl: string | null;
}

export function ProofUpload({ taskId, currentProofUrl }: ProofUploadProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const path = `${taskId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("task-proofs")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("task-proofs").getPublicUrl(path);

      const { data: signed } = await supabase.storage
        .from("task-proofs")
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      const proofUrl = signed?.signedUrl ?? publicUrl;
      const result = await setTaskProofUrlAction(taskId, proofUrl);

      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <Input type="file" accept="image/*,application/pdf" onChange={handleUpload} disabled={pending} />
      {pending && <p className="text-sm text-muted-foreground">Uploading…</p>}
      {currentProofUrl && (
        <a
          href={currentProofUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          View current proof
        </a>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
