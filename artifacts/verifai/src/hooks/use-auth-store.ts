import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  role: "student" | "recruiter" | null;
  setRole: (role: "student" | "recruiter" | null) => void;
  syncComplete: boolean;
  setSyncComplete: (status: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      role: null,
      setRole: (role) => set({ role }),
      syncComplete: false,
      setSyncComplete: (syncComplete) => set({ syncComplete }),
      logout: () => set({ role: null, syncComplete: false }),
    }),
    {
      name: "verifai-auth-storage",
    }
  )
);
