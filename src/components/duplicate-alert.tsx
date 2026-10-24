import { useEffect, useRef } from "react";
import { formatWhen } from "@/lib/when";

type Alert = {
  code: string;
  count: number;
  firstAt: number;
};

type Props = {
  alert: Alert | null;
  onDismiss: () => void;
};

export function DuplicateAlert({ alert, onDismiss }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (!node.open) node.showModal();
    titleRef.current?.focus();
    return () => {
      if (node.open) node.close();
    };
  }, []);

  if (!alert) return null;

  return (
    <dialog
      ref={dialogRef}
      className="dup-alert"
      aria-labelledby="dup-title"
      aria-describedby="dup-desc"
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
    >
      <div className="flex min-h-full items-end p-4 sm:items-center sm:justify-center">
        <div className="dup-shake w-full max-w-md rounded-panel bg-primary p-6 text-primary-fg sm:p-8">
          <h2 id="dup-title" ref={titleRef} tabIndex={-1} className="text-sm font-semibold tracking-widest">
            DUPLICATE
          </h2>
          <p className="mt-4 max-h-40 overflow-auto font-mono text-3xl leading-tight font-semibold break-all">
            {alert.code}
          </p>
          <p id="dup-desc" className="mt-4 text-xl font-semibold tabular-nums">
            Seen {alert.count} times
          </p>
          <p className="mt-1 text-base">First logged {formatWhen(alert.firstAt)}.</p>
          <button
            type="button"
            onClick={onDismiss}
            className="pressable mt-8 h-12 w-full rounded-control bg-primary-fg text-lg font-semibold text-primary"
          >
            Got it
          </button>
        </div>
      </div>
    </dialog>
  );
}
