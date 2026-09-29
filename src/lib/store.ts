import { useEffect } from "react";
import { create } from "zustand";
import { todayISO } from "./dates";

type WatchStore = {
  date: string;
  /** True once the user picks a day other than today; otherwise we follow "today". */
  pinned: boolean;
  setDate: (date: string) => void;
  /** Roll an un-pinned date forward when the agency-local day changes. */
  syncToday: () => void;
};

export const useWatchDate = create<WatchStore>((set) => ({
  date: todayISO(),
  pinned: false,
  setDate: (date) => set({ date, pinned: date !== todayISO() }),
  syncToday: () =>
    set((s) => {
      const today = todayISO();
      if (s.date === today) return s.pinned ? { pinned: false } : s;
      return s.pinned ? s : { date: today };
    }),
}));

/**
 * Keep the shared Watch/Calendar/Schedule date on "today" when the app stays
 * open (installed PWA resumed from the background) across midnight, instead of
 * showing the day it was first opened.
 */
export function useFollowToday() {
  const syncToday = useWatchDate((s) => s.syncToday);
  useEffect(() => {
    syncToday();
    const onWake = () => {
      if (document.visibilityState === "visible") syncToday();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("pageshow", onWake);
    const timer = window.setInterval(syncToday, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("pageshow", onWake);
      window.clearInterval(timer);
    };
  }, [syncToday]);
}
