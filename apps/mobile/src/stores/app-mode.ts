import { create } from 'zustand';

/** One app, two modes: drivers look for parking, hosts manage their spots. */
export type AppMode = 'driver' | 'host';

type AppModeState = {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
};

export const useAppMode = create<AppModeState>((set) => ({
  mode: 'driver',
  setMode: (mode) => set({ mode }),
}));
