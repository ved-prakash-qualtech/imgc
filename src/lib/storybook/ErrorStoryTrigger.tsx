"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";

type ErrorStoryTriggerProps = Readonly<{
  label?: string;
  children?: React.ReactNode;
}>;

export function ErrorStoryTrigger({
  label = "Trigger error",
  children,
}: ErrorStoryTriggerProps) {
  const [shouldThrow, setShouldThrow] = useState(false);
  const triggerError = useCallback(() => {
    setShouldThrow(true);
  }, []);

  if (shouldThrow) {
    throw new Error("Storybook demo error");
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {children ?? (
        <p className="text-sm text-neutral-500">
          Click the button to simulate a render error.
        </p>
      )}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={triggerError}
      >
        {label}
      </Button>
    </div>
  );
}
