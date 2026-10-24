import { useEffect, useState } from "react";
import { Download, Volume2, VolumeX } from "lucide-react";
import { DuplicateAlert } from "@/components/duplicate-alert";
import { ScanLog } from "@/components/scan-log";
import { ScannerPanel } from "@/components/scanner-panel";
import { playCue, unlockAudio, vibrate } from "@/lib/cues";
import { downloadScanCsv, groupScans, type RecordResult, type ScanSource } from "@/lib/scans";
import { useScanStore } from "@/lib/scan-store";

type Notice =
  | { kind: "new"; code: string; at: number }
  | { kind: "duplicate"; code: string; count: number; firstAt: number; at: number }
  | null;

export function TwiceApp() {
  const scans = useScanStore((state) => state.scans);
  const sound = useScanStore((state) => state.sound);
  const add = useScanStore((state) => state.add);
  const removeScan = useScanStore((state) => state.removeScan);
  const removeCode = useScanStore((state) => state.removeCode);
  const clear = useScanStore((state) => state.clear);
  const toggleSound = useScanStore((state) => state.toggleSound);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (notice?.kind !== "new") return;
    const id = window.setTimeout(() => {
      setNotice((current) => (current?.kind === "new" && current.at === notice.at ? null : current));
    }, 2600);
    return () => window.clearTimeout(id);
  }, [notice]);

  const unique = groupScans(scans).length;
  const repeats = scans.length - unique;

  function commit(code: string, source: ScanSource, format?: string): RecordResult {
    unlockAudio();
    const result = add(code, source, format);
    if (!result.ok) return result;
    if (result.duplicate) {
      setNotice({
        kind: "duplicate",
        code: result.scan.code,
        count: result.count,
        firstAt: result.firstAt,
        at: result.scan.at,
      });
      playCue("duplicate", sound);
      vibrate([80, 40, 120]);
      return result;
    }
    setNotice({ kind: "new", code: result.scan.code, at: result.scan.at });
    playCue("new", sound);
    vibrate(16);
    return result;
  }

  const duplicate = notice?.kind === "duplicate" ? notice : null;

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-4 pt-5 pb-24 lg:px-8">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={repeats > 0 ? "lamp-on size-2.5 rounded-full" : "size-2.5 rounded-full bg-line"} aria-hidden />
            <h1 className="text-2xl font-semibold tracking-tight">Twice</h1>
          </div>
          <p className="mt-1 max-w-md text-sm text-muted">
            Scan a barcode. It gets logged here, and the same code again sets off an alert.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              toggleSound();
            }}
            aria-pressed={sound}
            aria-label={sound ? "Mute alert sound" : "Turn alert sound on"}
            className="pressable grid size-11 place-items-center rounded-control bg-surface text-fg shadow-ring"
          >
            {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>
          <button
            type="button"
            onClick={() => downloadScanCsv(scans)}
            disabled={scans.length === 0}
            aria-label="Download log as CSV"
            className="pressable grid size-11 place-items-center rounded-control bg-surface text-fg shadow-ring"
          >
            <Download className="size-5" />
          </button>
        </div>
      </header>

      <dl className="mt-5 grid grid-cols-3 gap-2">
        <Stat label="Scans" value={scans.length} />
        <Stat label="Unique" value={unique} />
        <Stat label="Repeats" value={repeats} hot={repeats > 0} />
      </dl>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
        <ScannerPanel
          paused={duplicate !== null}
          showSamples={repeats === 0}
          banner={notice?.kind === "new" ? { kind: "new", code: notice.code } : null}
          onCommit={commit}
        />
        <ScanLog
          scans={scans}
          onRemoveScan={removeScan}
          onRemoveCode={removeCode}
          onClear={() => {
            clear();
            setNotice(null);
          }}
        />
      </div>

      <p className="mt-4 text-center text-xs text-muted">Saved in this browser only. Nothing is uploaded.</p>

      {duplicate ? (
        <DuplicateAlert
          key={`${duplicate.code}-${duplicate.count}`}
          alert={{ code: duplicate.code, count: duplicate.count, firstAt: duplicate.firstAt }}
          onDismiss={() => setNotice(null)}
        />
      ) : null}
    </main>
  );
}

function Stat({ label, value, hot = false }: { label: string; value: number; hot?: boolean }) {
  return (
    <div className="rounded-control bg-surface px-3 py-2 shadow-ring">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={hot ? "font-mono text-2xl font-semibold text-primary tabular-nums" : "font-mono text-2xl font-semibold tabular-nums"}>
        {value}
      </dd>
    </div>
  );
}
