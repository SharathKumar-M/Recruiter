import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  role: "student" | "recruiter" | null;
  setRole: (role: "student" | "recruiter" | null) => void;
  syncComplete: boolean;
  setSyncComplete: (status: boolean) => void;
  syncedUserId: string | null;
  setSyncedUserId: (id: string | null) => void;
  syncError: string | null;
  setSyncError: (error: string | null) => void;
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
      syncedUserId: null,
      setSyncedUserId: (syncedUserId) => set({ syncedUserId }),
      syncError: null,
      setSyncError: (syncError) => set({ syncError }),
      demoMode: false,
      setDemoMode: (demoMode) => set({ demoMode }),
      logout: () =>
        set({
          role: null,
          syncComplete: false,
          syncedUserId: null,
          syncError: null,
          demoMode: false,
        }),
    }),
    {
      name: "verifai-auth-storage",
      partialize: (state) => ({
        role: state.role,
        demoMode: state.demoMode,
        syncedUserId: state.syncedUserId,
      }),
    }
  )
);
