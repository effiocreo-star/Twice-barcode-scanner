export type ScanSource = "camera" | "typed" | "photo";

export type Scan = {
  id: string;
  code: string;
  at: number;
  source: ScanSource;
  format?: string;
};

export type CodeGroup = {
  code: string;
  count: number;
  firstAt: number;
  lastAt: number;
  format?: string;
  events: Scan[];
};

export type RecordOk = {
  ok: true;
  scans: Scan[];
  scan: Scan;
  count: number;
  firstAt: number;
  duplicate: boolean;
};

export type RecordResult = RecordOk | { ok: false; error: string };

const MAX_SCANS = 2000;
const MAX_CODE = 512;

export function isScan(value: unknown): value is Scan {
  if (!value || typeof value !== "object") return false;
  const scan = value as Partial<Scan>;
  return (
    typeof scan.id === "string" &&
    typeof scan.code === "string" &&
    typeof scan.at === "number" &&
    (scan.source === "camera" || scan.source === "typed" || scan.source === "photo")
  );
}

export function recordScan(
  scans: Scan[],
  input: { code: string; source: ScanSource; format?: string; now?: number },
): RecordResult {
  const code = input.code.trim();
  if (!code) return { ok: false, error: "Enter a barcode first." };
  if (code.length > MAX_CODE) return { ok: false, error: "That code is too long to log." };

  const scan: Scan = {
    id: crypto.randomUUID(),
    code,
    at: input.now ?? Date.now(),
    source: input.source,
    format: input.format,
  };
  const next = [...scans, scan].slice(-MAX_SCANS);
  const same = next.filter((item) => item.code === code);
  const firstAt = same.reduce((min, item) => Math.min(min, item.at), scan.at);
  return {
    ok: true,
    scans: next,
    scan,
    count: same.length,
    firstAt,
    duplicate: same.length > 1,
  };
}

export function groupScans(scans: Scan[]): CodeGroup[] {
  const map = new Map<string, CodeGroup>();
  for (const scan of scans) {
    const existing = map.get(scan.code);
    if (!existing) {
      map.set(scan.code, {
        code: scan.code,
        count: 1,
        firstAt: scan.at,
        lastAt: scan.at,
        format: scan.format,
        events: [scan],
      });
      continue;
    }
    existing.count += 1;
    existing.firstAt = Math.min(existing.firstAt, scan.at);
    existing.lastAt = Math.max(existing.lastAt, scan.at);
    if (scan.format) existing.format = scan.format;
    existing.events.push(scan);
  }
  return [...map.values()].sort((a, b) => b.lastAt - a.lastAt);
}

export function scansToCsv(scans: Scan[]): string {
  const header = "code,scanned_at,source,format,occurrence";
  const counts = new Map<string, number>();
  const lines = [...scans]
    .sort((a, b) => a.at - b.at)
    .map((scan) => {
      const occurrence = (counts.get(scan.code) ?? 0) + 1;
      counts.set(scan.code, occurrence);
      return [
        csvEscape(scan.code),
        new Date(scan.at).toISOString(),
        scan.source,
        csvEscape(scan.format ?? ""),
        String(occurrence),
      ].join(",");
    });
  return [header, ...lines].join("\n");
}

export function downloadScanCsv(scans: Scan[]) {
  const blob = new Blob([scansToCsv(scans)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "twice-barcode-log.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

const FORMAT_LABELS: Record<string, string> = {
  EAN_13: "EAN-13",
  EAN_8: "EAN-8",
  UPC_A: "UPC-A",
  UPC_E: "UPC-E",
  CODE_128: "Code 128",
  CODE_39: "Code 39",
  CODE_93: "Code 93",
  QR_CODE: "QR",
  DATA_MATRIX: "Data Matrix",
  ITF: "ITF",
  CODABAR: "Codabar",
  PDF_417: "PDF417",
  AZTEC: "Aztec",
  RSS_14: "GS1 DataBar",
};

export function formatLabel(format: string | undefined) {
  if (!format) return undefined;
  return FORMAT_LABELS[format] ?? format.replaceAll("_", " ");
}

export function sourceLabel(source: ScanSource) {
  if (source === "camera") return "Camera";
  if (source === "photo") return "Photo";
  return "Typed";
}
