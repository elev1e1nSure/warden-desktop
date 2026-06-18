// Persists the API key so the user doesn't have to paste it on every launch.

import { api } from "./client";

const KEY = "warden.connection";

export interface SavedConnection {
  apiKey: string;
}

export function saveConnection(c: SavedConnection): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // storage unavailable — non-fatal
  }
}

export function loadConnection(): SavedConnection | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedConnection) : null;
  } catch {
    return null;
  }
}

/** Verify the backend is our own Warden instance before sending the API key. */
export async function verifyBackend(): Promise<boolean> {
  try {
    const healthy = await api.health();
    if (!healthy) return false;
    const status = await api.status();
    return status.provider === "openrouter";
  } catch {
    return false;
  }
}
