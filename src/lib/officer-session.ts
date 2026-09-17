import { useEffect, useState } from "react";

const KEY = "watchboard.officerId";

export function useOfficerSession() {
  const [officerId, setOfficerId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setOfficerId(window.localStorage.getItem(KEY));
    } catch {
      setOfficerId(null);
    }
    setReady(true);
  }, []);

  function pick(id: string) {
    window.localStorage.setItem(KEY, id);
    setOfficerId(id);
  }

  function clear() {
    window.localStorage.removeItem(KEY);
    setOfficerId(null);
  }

  return { officerId, ready, pick, clear };
}
