import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  role: "student" | "recruiter" | null;
  setRole: (role: "student" | "recruiter" | null) => void;
  syncComplete: boolean;
  setSyncComplete: (status: boolean) => void;
  demoMode: boolean;
  setDemoMode: (on: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      role: null,
      setRole: (role) => set({ role }),
      syncComplete: false,
      setSyncComplete: (syncComplete) => set({ syncComplete }),
      demoMode: false,
      setDemoMode: (demoMode) => set({ demoMode }),
      logout: () => set({ role: null, syncComplete: false, demoMode: false }),
    }),
    {
      name: "verifai-auth-storage",
    }
  )
);
