"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * "Are you sure?" for anything that destroys something.
 *
 * A delete here is not undoable — the file is gone from storage, not moved to a bin — and the
 * trash icon sits one row away from the icons that only open or download. One misplaced click
 * used to be enough.
 *
 * A hook rather than a button wrapper because the delete handlers already exist in one place per
 * screen and are passed down to several buttons: asking at the handler covers every button that
 * calls it, including ones added later.
 *
 * ```tsx
 * const { ask, dialog } = useConfirmDelete();
 * onClick={() => ask({ description: `"${name}" …`, onConfirm: () => doDelete() })}
 * return <>… {dialog}</>;
 * ```
 */
export type ConfirmRequest = Readonly<{
  title?: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
}>;

export function useConfirmDelete(): {
  ask: (request: ConfirmRequest) => void;
  dialog: React.ReactNode;
} {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const ask = useCallback((next: ConfirmRequest) => setRequest(next), []);
  const close = useCallback(() => setRequest(null), []);

  const onConfirm = useCallback(() => {
    // Read it before clearing: the handler may re-render this component.
    const confirmed = request;
    setRequest(null);
    confirmed?.onConfirm();
  }, [request]);

  const dialog = (
    <Dialog open={request !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{request?.title ?? "Delete this file?"}</DialogTitle>
          <DialogDescription>{request?.description ?? ""}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" size="sm" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={onConfirm}
          >
            {request?.confirmLabel ?? "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { ask, dialog };
}
