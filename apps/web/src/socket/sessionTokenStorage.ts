const SESSION_TOKEN_KEY = "battleships-game:session-token";
const LEGACY_CLIENT_ID_KEY = "battleships-game:client-id";

// The old client-generated id is no longer an identity - drop it.
try {
  localStorage.removeItem(LEGACY_CLIENT_ID_KEY);
} catch {
  /* storage unavailable (private mode etc.) - nothing to clean */
}

/**
 * The token is issued by the server (`session_token` event) and is the actual
 * credential. We never generate identity on the client anymore.
 */
export function getSessionToken(): string | undefined {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setSessionToken(token: string): void {
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    /* storage unavailable - session lasts until reload */
  }
}

export function clearSessionToken(): void {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
