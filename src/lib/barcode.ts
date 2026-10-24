import type { IScannerControls } from "@zxing/browser";

export type DecodedCode = {
  text: string;
  format?: string;
};

type LiveSession = {
  controls: IScannerControls;
  torch: boolean;
};

function formatName(format: number, names: { [index: number]: string | number }) {
  const named = names[format];
  return typeof named === "string" ? named : undefined;
}

export async function startLiveScan(
  video: HTMLVideoElement,
  onCode: (code: DecodedCode) => void,
): Promise<LiveSession> {
  const { BrowserMultiFormatReader, BarcodeFormat } = await import("@zxing/browser");
  const reader = new BrowserMultiFormatReader(undefined, {
    delayBetweenScanAttempts: 180,
    delayBetweenScanSuccess: 180,
  });

  const handle: Parameters<typeof reader.decodeFromConstraints>[2] = (result) => {
    if (!result) return;
    const text = result.getText().trim();
    if (!text) return;
    onCode({ text, format: formatName(result.getBarcodeFormat(), BarcodeFormat) });
  };

  const preferred: MediaStreamConstraints = {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };

  let controls: IScannerControls;
  try {
    controls = await reader.decodeFromConstraints(preferred, video, handle);
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name !== "OverconstrainedError" && name !== "NotFoundError") throw error;
    controls = await reader.decodeFromConstraints({ audio: false, video: true }, video, handle);
  }

  return { controls, torch: typeof controls.switchTorch === "function" };
}

export function stopLiveScan(controls: IScannerControls | null) {
  if (!controls) return;
  try {
    void Promise.resolve(controls.stop()).catch(() => {});
  } catch {
    // The stream is already gone.
  }
}

export async function readBarcodeFile(file: File): Promise<DecodedCode> {
  const { BrowserMultiFormatReader, BarcodeFormat } = await import("@zxing/browser");
  const url = URL.createObjectURL(file);
  try {
    const reader = new BrowserMultiFormatReader();
    const result = await reader.decodeFromImageUrl(url);
    const text = result.getText().trim();
    if (!text) throw new Error("empty");
    return { text, format: formatName(result.getBarcodeFormat(), BarcodeFormat) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function cameraErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission is blocked. Allow it in the browser, or type the code.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found. Type the code or upload a photo.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "That camera is busy in another app. Type the code instead.";
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "The camera needs a secure page. Type the code or upload a photo.";
  }
  return "Couldn’t start the camera. Type the code or upload a photo.";
}
