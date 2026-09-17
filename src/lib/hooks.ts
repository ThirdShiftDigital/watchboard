import { useQuery } from "@tanstack/react-query";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listRequests } from "./fns";
import { getMyAccess } from "./staff";

export function useSupervisorReady() {
  const { user, isPending } = useCurrentUserState();
  return { user, isPending, ready: !isPending && Boolean(user) };
}

export function useMyAccess() {
  const { ready } = useSupervisorReady();
  return useQuery({
    queryKey: ["my-access"],
    queryFn: () => getMyAccess(),
    enabled: ready,
  });
}

export function usePendingCount() {
  const access = useMyAccess();
  const q = useQuery({
    queryKey: ["requests"],
    queryFn: () => listRequests(),
    enabled: Boolean(access.data?.caps.viewBoard),
  });
  return q.data?.requests.filter((r) => r.status === "pending").length ?? 0;
}
