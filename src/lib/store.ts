import { create } from "zustand";
import { todayISO } from "./dates";

type WatchStore = {
  date: string;
  setDate: (date: string) => void;
};

export const useWatchDate = create<WatchStore>((set) => ({
  date: todayISO(),
  setDate: (date) => set({ date }),
}));
