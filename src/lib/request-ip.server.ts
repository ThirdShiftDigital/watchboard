import { getRequest } from "@tanstack/react-start/server";

/**
 * Best-effort client IP for rate limiting — server-only (`.server.ts`), see
 * isolation.server.ts for why the suffix matters. Netlify sets
 * `x-nf-client-connection-ip`; fall back to the first `x-forwarded-for` hop.
 */
export function clientIp(): string {
  try {
    const headers = getRequest().headers;
    const nf = headers.get("x-nf-client-connection-ip");
    if (nf) return nf.trim();
    const fwd = headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    return headers.get("x-real-ip")?.trim() || "unknown";
  } catch {
    return "unknown";
  }
}
