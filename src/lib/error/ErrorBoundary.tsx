"use client";

import { unstable_rethrow } from "next/navigation";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { ErrorBoundaryFallback } from "@/lib/error/ErrorBoundaryFallback";
import { logError } from "@/lib/logging";

export type ErrorBoundaryProps = Readonly<{
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  /** When any value changes, the boundary resets (useful after route or key changes). */
  resetKeys?: readonly unknown[];
}>;

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

function haveResetKeysChanged(
  prevKeys: readonly unknown[] | undefined,
  nextKeys: readonly unknown[] | undefined
): boolean {
  if (prevKeys === nextKeys) return false;
  if (!prevKeys || !nextKeys || prevKeys.length !== nextKeys.length)
    return true;
  return prevKeys.some((key, index) => key !== nextKeys.at(index));
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // notFound(), redirect() and forbidden() signal themselves by throwing, so a boundary that
    // catches everything catches those too — and the framework never gets to render not-found.tsx,
    // the redirect, or forbidden.tsx. unstable_rethrow re-throws exactly those and returns for
    // anything else; it is the escape hatch Next documents for this, unstable only in its name.
    //
    // Worth knowing what it looks like when it is missing: an ungranted route rendered this
    // boundary's generic "Something went wrong" with NEXT_HTTP_ERROR_FALLBACK;403 in the console —
    // an access decision working correctly, reported as a crash.
    unstable_rethrow(error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    unstable_rethrow(error);
    logError(error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetKeys } = this.props;
    if (
      this.state.hasError &&
      resetKeys &&
      haveResetKeysChanged(prevProps.resetKeys, resetKeys)
    ) {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (typeof fallback === "function")
        return fallback(error, this.resetErrorBoundary);
      if (fallback) return fallback;
      return (
        <ErrorBoundaryFallback error={error} reset={this.resetErrorBoundary} />
      );
    }

    return children;
  }
}
