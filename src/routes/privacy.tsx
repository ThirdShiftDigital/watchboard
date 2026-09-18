import { createFileRoute } from "@tanstack/react-router";
import { DocH2, DocP, DocUl, PublicDocShell } from "@/components/public-doc";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "WatchBoard Privacy Policy" },
      {
        name: "description",
        content: "How WatchBoard handles account, shift, and Google Calendar data.",
      },
    ],
  }),
});

function PrivacyPage() {
  return (
    <PublicDocShell kicker="Legal" title="Privacy Policy">
      <DocP>
        <span className="text-foreground">Effective date:</span> September 18, 2026
        <br />
        <span className="text-foreground">Operator:</span> Third Shift Digital LLC (“Third Shift,”
        “we,” “us”)
        <br />
        <span className="text-foreground">Product:</span> WatchBoard (
        <a className="text-primary underline-offset-4 hover:underline" href="https://tsdwatchboard.netlify.app">
          https://tsdwatchboard.netlify.app
        </a>
        )
      </DocP>
      <DocP>
        This policy explains how WatchBoard handles information when you use the app, including when
        you connect a Google account for Calendar features.
      </DocP>

      <DocH2>Who this is for</DocH2>
      <DocP>
        WatchBoard is a shift and leave tool built for law-enforcement and public-safety agencies. It
        is primarily used by agency personnel (supervisors and officers) for zone assignments, watch
        lists, days-off requests, and the leave calendar.
      </DocP>

      <DocH2>Information we collect</DocH2>
      <DocP>Depending on how your agency uses WatchBoard, we may process:</DocP>
      <DocUl>
        <li>
          <span className="text-foreground">Account information</span> you or your agency provide
          (name, email, password credentials managed by WatchBoard auth).
        </li>
        <li>
          <span className="text-foreground">Shift and operational data</span> entered in WatchBoard
          (assignments, requests, schedule and leave records created in the app).
        </li>
        <li>
          <span className="text-foreground">Google account data</span> only if you choose{" "}
          <span className="text-foreground">Connect Google Calendar</span>, as described below.
        </li>
        <li>
          <span className="text-foreground">Technical logs</span> needed to run and secure the
          service (for example connection timestamps and error diagnostics).
        </li>
      </DocUl>

      <DocH2>Google Calendar access</DocH2>
      <DocP>
        If you use <span className="text-foreground">Connect Google Calendar</span>, WatchBoard
        requests Google authorization to access Calendar event data for the connected account.
      </DocP>
      <DocP>
        <span className="text-foreground">Purpose.</span> We use this access to:
      </DocP>
      <DocUl>
        <li>
          Read leave-related events from the connected Google Calendar and display them in
          WatchBoard’s <span className="text-foreground">in-app</span> leave / watch calendar.
        </li>
        <li>
          When enabled for your shift, write approved days-off decisions from WatchBoard back to the
          connected Google Calendar so the leave calendar stays aligned.
        </li>
      </DocUl>
      <DocP>
        <span className="text-foreground">What we do not do with Calendar data.</span>
      </DocP>
      <DocUl>
        <li>We do not sell Google Calendar data.</li>
        <li>We do not use Google Calendar data for advertising.</li>
        <li>
          We do not use Google user data for purposes unrelated to providing WatchBoard’s
          leave-calendar features.
        </li>
      </DocUl>
      <DocP>
        <span className="text-foreground">Storage and retention.</span> Calendar connection tokens
        and any leave events synced into WatchBoard are kept only as long as needed to provide the
        feature for your agency shift, or until you or an authorized supervisor disconnects Google
        Calendar / removes the connection. Agency operational records created in WatchBoard (for
        example approved requests) may be retained according to your agency’s use of the product.
      </DocP>
      <DocP>
        <span className="text-foreground">Sharing.</span> Calendar-derived leave information shown
        in WatchBoard is visible to users who already have access to that shift’s leave calendar
        inside the app (for example supervisors and officers with leave visibility). We do not share
        Google Calendar data with third parties for their own marketing.
      </DocP>
      <DocP>
        <span className="text-foreground">Your choices.</span> You can disconnect Google Calendar
        from WatchBoard’s calendar / leave settings (where your role allows). After disconnect,
        WatchBoard stops using that Google connection for new sync. You may also revoke WatchBoard’s
        access in your Google Account security settings (Third-party access).
      </DocP>

      <DocH2>How we use information</DocH2>
      <DocP>We use the information above to:</DocP>
      <DocUl>
        <li>Operate WatchBoard for your agency (authentication, shift boards, requests, leave calendar).</li>
        <li>Maintain security and reliability.</li>
        <li>Improve the product based on operational needs.</li>
      </DocUl>

      <DocH2>Security</DocH2>
      <DocP>
        We use administrative, technical, and organizational measures appropriate to the sensitivity
        of law-enforcement operational tools. No method of transmission or storage is perfectly
        secure; agencies remain responsible for account hygiene and role assignment.
      </DocP>

      <DocH2>Children’s privacy</DocH2>
      <DocP>
        WatchBoard is not directed to children and is not intended for personal consumer use by
        minors.
      </DocP>

      <DocH2>Changes</DocH2>
      <DocP>
        We may update this policy as WatchBoard changes. The effective date above will be revised
        when we do. Material changes affecting Google user data use will be reflected here before new
        uses begin.
      </DocP>

      <DocH2>Contact</DocH2>
      <DocP>Questions about this policy or WatchBoard privacy practices:</DocP>
      <DocUl>
        <li>
          <span className="text-foreground">Third Shift Digital LLC</span>
        </li>
        <li>
          Email:{" "}
          <a className="text-primary underline-offset-4 hover:underline" href="mailto:info@totalcircumstance.com">
            info@totalcircumstance.com
          </a>
        </li>
        <li>
          Product: WatchBoard —{" "}
          <a className="text-primary underline-offset-4 hover:underline" href="https://tsdwatchboard.netlify.app">
            https://tsdwatchboard.netlify.app
          </a>
        </li>
      </DocUl>
      <DocP>
        If you are connecting Google Calendar and need support with that connection, contact the same
        address or your agency WatchBoard supervisor.
      </DocP>
    </PublicDocShell>
  );
}
