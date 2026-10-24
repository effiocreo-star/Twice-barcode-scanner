let audio: AudioContext | null = null;

function context() {
  if (!audio) audio = new AudioContext();
  return audio;
}

export function unlockAudio() {
  if (typeof window === "undefined") return;
  const ctx = context();
  if (ctx.state === "suspended") void ctx.resume();
}

export function playCue(kind: "new" | "duplicate", enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  const ctx = context();
  if (ctx.state === "suspended") void ctx.resume();
  const now = ctx.currentTime;
  const tone = (freq: number, start: number, dur: number, gainValue: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  };
  if (kind === "duplicate") {
    tone(698, now, 0.14, 0.16);
    tone(466, now + 0.18, 0.22, 0.18);
    return;
  }
  tone(880, now, 0.07, 0.08);
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}
