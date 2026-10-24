import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isScan, recordScan, type RecordResult, type Scan, type ScanSource } from "@/lib/scans";

type Persisted = {
  scans: Scan[];
  sound: boolean;
};

type ScanState = Persisted & {
  add: (code: string, source: ScanSource, format?: string) => RecordResult;
  removeScan: (id: string) => void;
  removeCode: (code: string) => void;
  clear: () => void;
  toggleSound: () => void;
};

export const useScanStore = create<ScanState>()(
  persist(
    (set) => ({
      scans: [],
      sound: true,
      add: (code, source, format) => {
        let result: RecordResult = { ok: false, error: "Enter a barcode first." };
        set((state) => {
          result = recordScan(state.scans, { code, source, format });
          if (!result.ok) return state;
          return { scans: result.scans };
        });
        return result;
      },
      removeScan: (id) => set((state) => ({ scans: state.scans.filter((scan) => scan.id !== id) })),
      removeCode: (code) => set((state) => ({ scans: state.scans.filter((scan) => scan.code !== code) })),
      clear: () => set({ scans: [] }),
      toggleSound: () => set((state) => ({ sound: !state.sound })),
    }),
    {
      name: "twice-scan-log-v1",
      skipHydration: true,
      partialize: (state) => ({ scans: state.scans, sound: state.sound }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Persisted>;
        const scans = Array.isArray(saved.scans) ? saved.scans.filter(isScan) : [];
        const sound = typeof saved.sound === "boolean" ? saved.sound : true;
        return { ...current, scans, sound };
      },
    },
  ),
);

// Load the saved log before the first click. `window` is absent during SSR.
if (typeof window !== "undefined") {
  void useScanStore.persist.rehydrate();
}
