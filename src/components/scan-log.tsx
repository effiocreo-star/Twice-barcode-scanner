import { useMemo, useState } from "react";
import { formatExact, formatWhen } from "@/lib/when";
import { formatLabel, groupScans, sourceLabel, type Scan } from "@/lib/scans";

type Filter = "all" | "repeats" | "once";

type Props = {
  scans: Scan[];
  onRemoveScan: (id: string) => void;
  onRemoveCode: (code: string) => void;
  onClear: () => void;
};

export function ScanLog({ scans, onRemoveScan, onRemoveCode, onClear }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const groups = useMemo(() => groupScans(scans), [scans]);

  const visible = groups.filter((group) => {
    if (filter === "repeats" && group.count < 2) return false;
    if (filter === "once" && group.count !== 1) return false;
    const needle = query.trim().toLowerCase();
    if (needle && !group.code.toLowerCase().includes(needle)) return false;
    return true;
  });

  return (
    <section className="overflow-hidden rounded-panel bg-surface shadow-ring" aria-label="Scan log">
      <div className="flex items-end justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">Log</h2>
          <p className="text-sm text-muted">Same code, same spelling, counts as a repeat.</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="px-4 py-8">
          <p className="text-sm text-muted">Nothing logged yet. New codes and repeats both show up here.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
            <FilterChip label="All" pressed={filter === "all"} onClick={() => setFilter("all")} />
            <FilterChip label="Repeats" pressed={filter === "repeats"} onClick={() => setFilter("repeats")} />
            <FilterChip label="Once" pressed={filter === "once"} onClick={() => setFilter("once")} />
          </div>
          {groups.length > 4 ? (
            <div className="border-b border-line px-4 py-3">
              <label className="sr-only" htmlFor="log-search">
                Search codes
              </label>
              <input
                id="log-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the log"
                className="h-11 w-full rounded-control border border-line bg-bg px-3 text-base text-fg placeholder:text-muted"
              />
            </div>
          ) : null}
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No codes match.</p>
          ) : (
            <ul>
              {visible.map((group) => {
                const open = openCode === group.code;
                const repeat = group.count > 1;
                const label = formatLabel(group.format);
                return (
                  <li key={group.code} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenCode(open ? null : group.code)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <span
                        className={
                          repeat
                            ? "grid h-11 min-w-11 place-items-center rounded-control bg-primary px-2 font-mono text-sm font-semibold text-primary-fg tabular-nums"
                            : "grid h-11 min-w-11 place-items-center rounded-control bg-surface-2 px-2 font-mono text-sm text-muted tabular-nums"
                        }
                      >
                        ×{group.count}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-sm">{group.code}</span>
                        <span className="mt-0.5 block text-sm text-muted">
                          {repeat ? `Seen ${group.count} times` : "Once"}
                          {label ? ` · ${label}` : ""} · {formatWhen(group.lastAt)}
                        </span>
                      </span>
                    </button>
                    {open ? (
                      <div className="grid gap-2 px-4 pb-4">
                        <ul className="grid gap-1">
                          {[...group.events].reverse().map((event) => (
                            <li key={event.id} className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-muted">
                                {sourceLabel(event.source)} · {formatExact(event.at)}
                              </span>
                              <button
                                type="button"
                                onClick={() => onRemoveScan(event.id)}
                                className="h-11 shrink-0 px-2 text-fg"
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          onClick={() => {
                            onRemoveCode(group.code);
                            setOpenCode(null);
                          }}
                          className="h-11 justify-self-start px-2 text-sm text-muted"
                        >
                          Remove this code
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-line px-4 py-3">
            {confirmClear ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">Delete the whole log?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirmClear(false)} className="h-11 px-3 text-sm">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClear();
                      setConfirmClear(false);
                      setOpenCode(null);
                    }}
                    className="pressable h-11 rounded-control bg-primary px-3 text-sm font-semibold text-primary-fg"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmClear(true)} className="h-11 text-sm text-muted">
                Clear log
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function FilterChip({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        pressed
          ? "pressable h-11 rounded-control bg-primary px-3 text-sm font-semibold text-primary-fg"
          : "pressable h-11 rounded-control bg-surface-2 px-3 text-sm text-fg"
      }
    >
      {label}
    </button>
  );
}
