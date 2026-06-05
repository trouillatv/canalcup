"use client";

export type ClientAllowlistResult = {
  ok?: boolean;
  error?: string;
  reason?: string;
};

export async function checkClientAllowlist(): Promise<ClientAllowlistResult> {
  try {
    const res = await fetch("/api/auth/self-allowlist", {
      method: "POST",
      credentials: "same-origin",
    });
    return (await res.json().catch(() => ({}))) as ClientAllowlistResult;
  } catch {
    return { ok: false, error: "not_allowed", reason: "Accès non autorisé." };
  }
}
