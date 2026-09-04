"use client";

import {
  useCallback,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  InfoIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";

import { cn } from "@/lib/utils/twMergeUtils";

type ToastType = "success" | "error" | "warning" | "info";

type ToastOptions = Readonly<{
  /** Body — "record + next action" (regular 12.5px, neutral-700). */
  description?: ReactNode;
  /** Warning-only action link — expands `fields` inline when clicked. */
  action?: { label: string };
  /** Missing-field list revealed by the action link (warning toasts only). */
  fields?: string[];
  /** Auto-dismiss delay in ms (default 4000; pass 0 to disable). */
  duration?: number;
}>;

type ToastItem = ToastOptions & {
  id: string;
  title: string;
  type: ToastType;
};

let toasts: ToastItem[] = [];
let listeners: Array<() => void> = [];

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

function getSnapshot() {
  return toasts;
}

/**
 * The server always renders no toasts — but it must be the *same* no toasts every time.
 *
 * <p>`useSyncExternalStore` compares snapshots by reference. Returning a fresh `[]` here handed
 * React a new value on every call, so the store never looked settled: React warns
 * "getServerSnapshot should be cached to avoid an infinite loop" and, on React 19, throws while
 * hydrating. The whole client tree then never hydrates — which reads as the page being fine,
 * because links are real anchors and still navigate, while every button silently does nothing.
 */
const NO_TOASTS: ToastItem[] = [];

function getServerSnapshot(): ToastItem[] {
  return NO_TOASTS;
}

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(title: string, type: ToastType, options?: ToastOptions) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  toasts = [...toasts, { id, title, type, ...options }];
  emit();
  const duration = options?.duration ?? 4000;
  if (duration > 0) {
    window.setTimeout(() => dismiss(id), duration);
  }
  return id;
}

/** Minimal in-app toast shim (replaces the `sonner` package in this template). */
export const toast = {
  success: (title: string, options?: ToastOptions) =>
    push(title, "success", options),
  error: (title: string, options?: ToastOptions) =>
    push(title, "error", options),
  warning: (title: string, options?: ToastOptions) =>
    push(title, "warning", options),
  info: (title: string, options?: ToastOptions) => push(title, "info", options),
  dismiss,
};

// miFIN™ Toast Anatomy — 18px semantic icon, semibold 13px title, rounded-lg
// (matches the button system's 8px radius).
const TOAST_ICON: Record<ToastType, typeof CheckCircle2Icon> = {
  success: CheckCircle2Icon,
  error: XCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
};

const TOAST_COLOR: Record<ToastType, string> = {
  success: "text-success-700",
  error: "text-danger-700",
  warning: "text-warning-700",
  info: "text-info-700",
};

function ToastCard({ item }: Readonly<{ item: ToastItem }>) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOAST_ICON[item.type];

  const handleDismiss = useCallback(() => dismiss(item.id), [item.id]);
  const handleToggleFields = useCallback(
    () => setExpanded((prev) => !prev),
    []
  );

  return (
    <div className="animate-fade-in-cc w-80 rounded-lg border border-neutral-100 bg-white p-3.5 shadow-lg">
      <div className="flex items-start gap-2.5">
        <Icon
          className={cn("mt-0.5 size-[18px] shrink-0", TOAST_COLOR[item.type])}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn("text-[13px] font-semibold", TOAST_COLOR[item.type])}
          >
            {item.title}
          </p>
          {item.description && (
            <p className="mt-0.5 text-[12.5px] font-normal text-neutral-700">
              {item.description}
            </p>
          )}
          {item.type === "warning" && item.action && (
            <button
              type="button"
              onClick={handleToggleFields}
              className="mt-1 text-[12.5px] font-medium text-warning-700 underline underline-offset-2"
            >
              {item.action.label}
            </button>
          )}
          {expanded && item.fields && item.fields.length > 0 && (
            <ul className="mt-1.5 list-disc pl-4 text-[12.5px] text-neutral-700">
              {item.fields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-neutral-400 hover:text-neutral-700"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function Toaster() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (items.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-9999 flex flex-col gap-2">
      {items.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}
