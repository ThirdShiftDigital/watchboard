import { createFileRoute } from "@tanstack/react-router";
import {
  appBaseUrl,
  exchangeGoogleCode,
  saveShiftGoogleTokens,
  verifyOAuthState,
} from "@/lib/google-oauth";

export const Route = createFileRoute("/api/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const oauthError = url.searchParams.get("error");
        const base = appBaseUrl();
        const fail = (msg: string) =>
          Response.redirect(
            `${base}/calendar?google=error&message=${encodeURIComponent(msg)}`,
            302,
          );

        if (oauthError) return fail(oauthError);
        if (!code || !state) return fail("Missing Google OAuth code or state.");

        const parsed = verifyOAuthState(state);
        if (!parsed) return fail("Google OAuth state expired or invalid. Try Connect again.");

        try {
          const tokens = await exchangeGoogleCode(code);
          await saveShiftGoogleTokens(parsed.shiftId, parsed.userId, tokens, "primary");
          return Response.redirect(`${base}/calendar?google=connected`, 302);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Google OAuth failed.";
          return fail(message);
        }
      },
    },
  },
});
