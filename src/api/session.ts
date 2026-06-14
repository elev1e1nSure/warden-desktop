// Persists the API key so the user doesn't have to paste it on every launch.

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
