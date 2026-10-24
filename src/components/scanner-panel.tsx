import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, Check, Flashlight, ImagePlus } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { cameraErrorMessage, readBarcodeFile, startLiveScan, stopLiveScan } from "@/lib/barcode";
import type { RecordResult, ScanSource } from "@/lib/scans";

const CAMERA_MIN_LENGTH = 4;
const CAMERA_COOLDOWN_MS = 2800;

type Banner = { kind: "new"; code: string } | null;

type Props = {
  paused: boolean;
  banner: Banner;
  showSamples: boolean;
  onCommit: (code: string, source: ScanSource, format?: string) => RecordResult;
};

const SAMPLES = ["SAMPLE-1001", "012345678905"];

export function ScannerPanel({ paused, banner, showSamples, onCommit }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const pausedRef = useRef(paused);
  const onCommitRef = useRef(onCommit);
  const armedRef = useRef<string | null>(null);
  const lastAcceptedRef = useRef<Map<string, number>>(new Map());
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<"idle" | "starting" | "live">("idle");
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [entryError, setEntryError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  pausedRef.current = paused;
  onCommitRef.current = onCommit;

  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopLiveScan(controlsRef.current);
      controlsRef.current = null;
    };
  }, []);

  function acceptCameraCode(text: string, format?: string) {
    if (pausedRef.current) return;
    if (text.length < CAMERA_MIN_LENGTH) {
      armedRef.current = null;
      return;
    }
    if (armedRef.current !== text) {
      armedRef.current = text;
      return;
    }
    const now = Date.now();
    const previous = lastAcceptedRef.current.get(text) ?? 0;
    if (now - previous < CAMERA_COOLDOWN_MS) return;
    lastAcceptedRef.current.set(text, now);
    armedRef.current = null;
    const result = onCommitRef.current(text, "camera", format);
    if (!result.ok) setEntryError(result.error);
    else setEntryError(null);
  }

  async function startCamera() {
    const video = videoRef.current;
    if (!video || phase === "starting" || phase === "live") return;
    setCameraError(null);
    setPhase("starting");
    try {
      const session = await startLiveScan(video, (code) => acceptCameraCode(code.text, code.format));
      if (!aliveRef.current) {
        stopLiveScan(session.controls);
        return;
      }
      controlsRef.current = session.controls;
      setTorchAvailable(session.torch);
      setTorchOn(false);
      setPhase("live");
    } catch (error) {
      stopLiveScan(controlsRef.current);
      controlsRef.current = null;
      setPhase("idle");
      setTorchAvailable(false);
      setCameraError(cameraErrorMessage(error));
    }
  }

  function stopCamera() {
    stopLiveScan(controlsRef.current);
    controlsRef.current = null;
    setPhase("idle");
    setTorchOn(false);
    setTorchAvailable(false);
    armedRef.current = null;
  }

  async function toggleTorch() {
    const controls = controlsRef.current;
    if (!controls?.switchTorch) return;
    const next = !torchOn;
    try {
      await controls.switchTorch(next);
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
      setTorchOn(false);
    }
  }

  function submitTyped(event: FormEvent) {
    event.preventDefault();
    const result = onCommit(draft, "typed");
    if (!result.ok) {
      setEntryError(result.error);
      return;
    }
    setEntryError(null);
    setDraft("");
  }

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setEntryError(null);
    try {
      const decoded = await readBarcodeFile(file);
      const result = onCommit(decoded.text, "photo", decoded.format);
      if (!result.ok) setEntryError(result.error);
    } catch {
      setEntryError("No barcode in that photo. Try a closer, well-lit shot.");
    } finally {
      setPhotoBusy(false);
    }
  }

  const live = phase === "live";
  const status = live
    ? paused
      ? "Scanning is paused until you dismiss the duplicate."
      : "Scanning. Hold the code steady inside the frame."
    : phase === "starting"
      ? "Starting camera…"
      : "Camera is off. You can type a code or upload a photo.";

  return (
    <section className="grid gap-4" aria-label="Scanner">
      <div className="relative aspect-[3/2] overflow-hidden rounded-panel bg-surface shadow-ring">
        <video
          ref={videoRef}
          className={live ? "absolute inset-0 h-full w-full object-cover" : "absolute inset-0 h-full w-full object-cover opacity-0"}
          muted
          playsInline
          autoPlay
        />
        {live ? (
          <>
            <div className="pointer-events-none absolute inset-3">
              <span className="absolute top-0 left-0 size-7 border-t-2 border-l-2 border-primary" />
              <span className="absolute top-0 right-0 size-7 border-t-2 border-r-2 border-primary" />
              <span className="absolute bottom-0 left-0 size-7 border-b-2 border-l-2 border-primary" />
              <span className="absolute right-0 bottom-0 size-7 border-r-2 border-b-2 border-primary" />
            </div>
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="finder-sweep h-full">
                <div className="scan-beam" />
              </div>
            </div>
            {torchAvailable ? (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                aria-pressed={torchOn}
                aria-label={torchOn ? "Turn light off" : "Turn light on"}
                className={
                  torchOn
                    ? "pressable absolute top-3 right-3 grid size-11 place-items-center rounded-control bg-primary text-primary-fg"
                    : "pressable absolute top-3 right-3 grid size-11 place-items-center rounded-control bg-bg/80 text-fg"
                }
              >
                <Flashlight className="size-5" />
              </button>
            ) : null}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <Camera className="size-8 text-primary" aria-hidden />
            <p className="max-w-xs text-sm text-muted">
              {cameraError ?? "Point the camera at a barcode. The same code a second time raises an alert."}
            </p>
            <button
              type="button"
              onClick={() => void startCamera()}
              disabled={phase === "starting"}
              className="pressable inline-flex h-12 items-center justify-center gap-2 rounded-control bg-primary pr-4 pl-3.5 font-semibold text-primary-fg"
            >
              <Camera className="size-5" />
              {phase === "starting" ? "Starting…" : "Start camera"}
            </button>
          </div>
        )}
      </div>

      {live ? (
        <button
          type="button"
          onClick={stopCamera}
          className="pressable h-12 rounded-control bg-surface-2 font-semibold text-fg shadow-ring"
        >
          Stop camera
        </button>
      ) : null}

      <p className="text-sm text-muted" aria-live="polite">
        {status}
      </p>

      {banner ? (
        <p role="status" className="flex min-w-0 items-center gap-2 text-sm text-fg">
          <Check className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate">
            Logged <span className="font-mono">{banner.code}</span> — first time
          </span>
        </p>
      ) : null}

      <form onSubmit={submitTyped} className="flex gap-2">
        <label className="sr-only" htmlFor="barcode">
          Barcode
        </label>
        <input
          id="barcode"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a barcode"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          className="h-12 min-w-0 flex-1 rounded-control border border-line bg-surface px-3 font-mono text-base text-fg placeholder:font-sans placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="pressable h-12 shrink-0 rounded-control bg-primary px-4 font-semibold text-primary-fg"
        >
          Log
        </button>
      </form>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={photoBusy}
          className="pressable inline-flex h-11 items-center gap-2 rounded-control px-1 text-sm font-medium text-fg"
        >
          <ImagePlus className="size-4 text-primary" aria-hidden />
          {photoBusy ? "Reading photo…" : "Upload a photo"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => void onPhoto(event)}
        />
      </div>

      {entryError ? (
        <p role="alert" className="text-sm text-fg">
          {entryError}
        </p>
      ) : null}

      {showSamples ? (
        <div>
          <p className="text-sm text-muted">No camera handy? Tap a sample twice.</p>
          <div className="mt-2 grid gap-2">
            {SAMPLES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onCommit(code, "typed")}
                className="pressable flex h-12 items-center justify-between rounded-control bg-surface px-3 text-left shadow-ring"
              >
                <span className="font-mono text-sm">{code}</span>
                <span className="text-sm text-muted">Log sample</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
