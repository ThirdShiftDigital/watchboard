import { createFileRoute } from "@tanstack/react-router";
import { DocH2, DocP, DocUl, PublicDocShell } from "@/components/public-doc";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "WatchBoard Terms of Use" },
      {
        name: "description",
        content: "Terms governing authorized agency use of WatchBoard.",
      },
    ],
  }),
});

function TermsPage() {
  return (
    <PublicDocShell kicker="Legal" title="Terms of Use">
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
        These terms govern use of WatchBoard. By accessing or using WatchBoard, you agree to them. If
        you use WatchBoard on behalf of an agency, you represent that you are authorized to accept
        these terms for that agency.
      </DocP>

      <DocH2>The service</DocH2>
      <DocP>
        WatchBoard is a software tool for agency shift operations, including zone assignments,
        sendable watch lists, days-off requests, and an in-app leave calendar. It may optionally
        connect to Google Calendar when a user authorizes that connection.
      </DocP>
      <DocP>
        WatchBoard is provided for authorized agency use. It is not a substitute for official agency
        policy, CAD, RMS, or legal advice.
      </DocP>

      <DocH2>Accounts and access</DocH2>
      <DocP>
        You must provide accurate account information and keep credentials confidential. Agencies
        control who is invited and what roles they receive. You must not attempt to access another
        user’s account or data outside your assigned permissions.
      </DocP>

      <DocH2>Acceptable use</DocH2>
      <DocP>You agree not to:</DocP>
      <DocUl>
        <li>Misuse WatchBoard to harass, discriminate, or violate law or agency policy.</li>
        <li>
          Probe, scrape, or disrupt the service except as authorized security testing arranged with
          Third Shift.
        </li>
        <li>Misrepresent your identity or agency affiliation.</li>
        <li>
          Use Google Calendar connection features for purposes other than the leave-calendar workflow
          WatchBoard provides.
        </li>
      </DocUl>

      <DocH2>Google services</DocH2>
      <DocP>
        If you connect Google Calendar, your use of Google is also subject to Google’s terms and
        privacy policy. WatchBoard’s use of Google user data is limited to the purposes described in
        the WatchBoard Privacy Policy.
      </DocP>

      <DocH2>Agency data and responsibility</DocH2>
      <DocP>
        Agencies are responsible for the accuracy of information entered into WatchBoard, for deciding
        who may view leave and assignment data, and for complying with their own records, retention,
        and privacy rules. Third Shift does not supervise field operations.
      </DocP>

      <DocH2>Intellectual property</DocH2>
      <DocP>
        WatchBoard, its branding, and related materials are owned by Third Shift Digital LLC or its
        licensors. You receive a limited right to use the service as provided. You may not copy,
        reverse engineer, or resell the service except as allowed by law or written agreement.
      </DocP>

      <DocH2>Availability and changes</DocH2>
      <DocP>
        We may modify, suspend, or discontinue features with reasonable notice when practical. We aim
        for reliable uptime but do not guarantee uninterrupted availability.
      </DocP>

      <DocH2>Disclaimer</DocH2>
      <DocP>
        WATCHBOARD IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW,
        THIRD SHIFT DISCLAIMS WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
        NON-INFRINGEMENT. Operational decisions remain the agency’s responsibility.
      </DocP>

      <DocH2>Limitation of liability</DocH2>
      <DocP>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, THIRD SHIFT WILL NOT BE LIABLE FOR INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, OR
        GOODWILL, ARISING FROM USE OF WATCHBOARD. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE
        SERVICE IS LIMITED TO THE AMOUNTS PAID TO THIRD SHIFT FOR WATCHBOARD IN THE TWELVE MONTHS
        BEFORE THE CLAIM (OR ZERO IF YOU PAY NOTHING).
      </DocP>

      <DocH2>Termination</DocH2>
      <DocP>
        We or your agency may suspend or end access if these terms are violated or if the service
        relationship ends. Provisions that should survive (including intellectual property,
        disclaimers, and limitations) will survive.
      </DocP>

      <DocH2>Changes to these terms</DocH2>
      <DocP>
        We may update these terms. Continued use after the effective date of changes constitutes
        acceptance of the updated terms where permitted by law.
      </DocP>

      <DocH2>Contact</DocH2>
      <DocP>
        Third Shift Digital LLC
        <br />
        Email:{" "}
        <a className="text-primary underline-offset-4 hover:underline" href="mailto:info@totalcircumstance.com">
          info@totalcircumstance.com
        </a>
        <br />
        WatchBoard:{" "}
        <a className="text-primary underline-offset-4 hover:underline" href="https://tsdwatchboard.netlify.app">
          https://tsdwatchboard.netlify.app
        </a>
      </DocP>
    </PublicDocShell>
  );
}
