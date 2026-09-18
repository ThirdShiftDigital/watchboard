import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env.server";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export function googleOAuthConfigured(): boolean {
  return Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));
}

export function appBaseUrl(): string {
  return (
    env("BETTER_AUTH_URL") ||
    env("URL") ||
    env("DEPLOY_PRIME_URL") ||
    "https://tsdwatchboard.netlify.app"
  ).replace(/\/$/, "");
}

export function googleCallbackUrl(): string {
  return `${appBaseUrl()}/api/google/callback`;
}

function signingKey(): string {
  return env("BETTER_AUTH_SECRET") || env("GOOGLE_CLIENT_SECRET") || "watchboard-dev";
}

export function signOAuthState(payload: { shiftId: string; userId: string }): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + 15 * 60 * 1000 }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", signingKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyOAuthState(state: string): { shiftId: string; userId: string } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expect = createHmac("sha256", signingKey()).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expect);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      shiftId?: string;
      userId?: string;
      exp?: number;
    };
    if (!parsed.shiftId || !parsed.userId || !parsed.exp || parsed.exp < Date.now()) return null;
    return { shiftId: parsed.shiftId, userId: parsed.userId };
  } catch {
    return null;
  }
}

export function buildGoogleAuthUrl(input: { shiftId: string; userId: string }): string {
  const clientId = env("GOOGLE_CLIENT_ID");
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not set on the server.");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleCallbackUrl(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: signOAuthState(input),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

export async function exchangeGoogleCode(code: string): Promise<TokenResponse> {
  const clientId = env("GOOGLE_CLIENT_ID");
  const clientSecret = env("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleCallbackUrl(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<TokenResponse> {
  const clientId = env("GOOGLE_CLIENT_ID");
  const clientSecret = env("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
}

export type ShiftGoogleTokens = {
  accessToken: string;
  refreshToken: string;
  expiry: number;
  calendarId: string;
};

export async function loadShiftGoogleTokens(shiftId: string): Promise<ShiftGoogleTokens | null> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{
    google_access_token: string | null;
    google_refresh_token: string | null;
    google_token_expiry: string | null;
    google_calendar_id: string | null;
  }>`
    select google_access_token, google_refresh_token, google_token_expiry, google_calendar_id
    from shifts where id = ${shiftId}
  `;
  const row = rows[0];
  if (!row?.google_refresh_token) return null;
  return {
    accessToken: row.google_access_token ?? "",
    refreshToken: row.google_refresh_token,
    expiry: row.google_token_expiry ? Date.parse(row.google_token_expiry) : 0,
    calendarId: row.google_calendar_id || "primary",
  };
}

export async function saveShiftGoogleTokens(
  shiftId: string,
  userId: string,
  tokens: TokenResponse,
  calendarId = "primary",
) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const expiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
  const existing = await loadShiftGoogleTokens(shiftId);
  const refresh = tokens.refresh_token || existing?.refreshToken;
  if (!refresh) throw new Error("Google did not return a refresh token. Disconnect and connect again with consent.");
  await sql`
    update shifts set
      google_calendar = true,
      google_access_token = ${tokens.access_token},
      google_refresh_token = ${refresh},
      google_token_expiry = ${expiry},
      google_calendar_id = ${calendarId},
      google_connected_by = ${userId}
    where id = ${shiftId}
  `;
}

export async function clearShiftGoogleTokens(shiftId: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql`
    update shifts set
      google_calendar = false,
      google_access_token = null,
      google_refresh_token = null,
      google_token_expiry = null,
      google_connected_by = null
    where id = ${shiftId}
  `;
}

export async function getValidAccessTokenForShift(shiftId: string): Promise<ShiftGoogleTokens | null> {
  const stored = await loadShiftGoogleTokens(shiftId);
  if (!stored) return null;
  if (stored.accessToken && stored.expiry > Date.now() + 60_000) return stored;
  const refreshed = await refreshGoogleAccessToken(stored.refreshToken);
  await saveShiftGoogleTokens(shiftId, "", refreshed, stored.calendarId);
  return {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || stored.refreshToken,
    expiry: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
    calendarId: stored.calendarId,
  };
}
