import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { useFollowToday } from "@/lib/store";

export function AppProviders({ children }: { children: ReactNode }) {
  useFollowToday();
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          className:
            "bg-card text-foreground border border-border shadow-panel font-sans",
        }}
      />
    </QueryClientProvider>
  );
}
