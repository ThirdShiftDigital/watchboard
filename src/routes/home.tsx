import { createFileRoute } from "@tanstack/react-router";
import { PublicHomePage } from "@/components/public-home";

export const Route = createFileRoute("/home")({
  component: PublicHomePage,
  head: () => ({
    meta: [
      { title: "WatchBoard — Shift management for public safety" },
      {
        name: "description",
        content:
          "Zone assignments, sendable watch lists, days-off requests, and the leave calendar for the shift.",
      },
    ],
  }),
});
