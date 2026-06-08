"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Ensure page is rendered dynamically to allow useSearchParams in App Router
export const dynamic = "force-dynamic";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromQuery = searchParams.get("access_token");
  const refreshTokenFromQuery = searchParams.get("refresh_token");
  const recoveryCode = searchParams.get("code");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let accessToken = tokenFromQuery;
    let refreshToken = refreshTokenFromQuery;

    // Fallback to hash fragment (e.g., #access_token=...&refresh_token=...)
    if ((!accessToken || !refreshToken) && typeof window !== "undefined") {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash) {
        const params = new URLSearchParams(hash);
        accessToken = accessToken || params.get("access_token");
        refreshToken = refreshToken || params.get("refresh_token");
      }
    }

    const supabase = createClient();

    if (recoveryCode) {
      supabase.auth
        .exchangeCodeForSession(recoveryCode)
        .then(({ error: exchangeError }) => {
          if (exchangeError) {
            setError("Invalid or expired recovery code.");
          } else {
            setSessionReady(true);
          }
        })
        .catch(() => setError("Invalid or expired recovery code."));
      return;
    }

    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error: sessError }) => {
          if (sessError) {
            setError("Invalid or expired reset token.");
          } else {
            setSessionReady(true);
          }
        })
        .catch(() => setError("Invalid or expired reset token."));
    }
    // No else: if no tokens, we simply wait for user to provide correct link.
  }, [tokenFromQuery, refreshTokenFromQuery, recoveryCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!sessionReady) {
      setError("Auth session missing! Please wait while we establish your session.");
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Password updated successfully. Redirecting to login...");
      setTimeout(() => router.push("/login"), 1500);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-4">Reset Password</h1>
      {error && (
        <p className="text-red-500 mb-2" role="alert">
          {error}
        </p>
      )}
      {message && <p className="text-green-500 mb-2">{message}</p>}
      {!sessionReady && (
        <p className="text-sm text-muted-foreground mb-2">Establishing session…</p>
      )}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label htmlFor="newPassword" className="block mb-1 text-sm">
            New Password
          </label>
          <input
            id="newPassword"
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border rounded px-2 py-1 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block mb-1 text-sm">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border rounded px-2 py-1 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-primary text-primary-foreground py-2 rounded hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          Update Password
        </button>
      </form>
    </main>
  );
}
