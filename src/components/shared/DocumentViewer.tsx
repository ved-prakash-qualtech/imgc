"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileWarning,
  Loader2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { Button, buttonVariants } from "@/components/ui/button";
import { logger } from "@/lib/logging";
import { cn } from "@/lib/utils/twMergeUtils";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

const LoadingState = (
  <div className="flex h-full items-center justify-center text-muted-foreground">
    <Loader2 className="size-5 animate-spin" aria-hidden />
  </div>
);

export type DocumentViewerProps = Readonly<{
  /** Signed, short-lived URL minted server-side. Never a long-lived URL. */
  fileUrl: string;
  /** Displayed in the toolbar and used as the download filename. */
  fileName: string;
  /** Download is opt-in per document policy; defaults to false. */
  allowDownload?: boolean;
  /** Viewer height; defaults to 750px. */
  height?: string;
  className?: string;
}>;

/**
 * Shared inline PDF viewer for BFSI lending & leasing documents.
 *
 * Handles page navigation, zoom, an opt-in download control, and explicit
 * loading/error states. Sensitive documents must be passed a server-minted
 * signed URL (see `lib/documents/signedUrl.ts`) and `allowDownload` must follow
 * the document policy in `constants/documents.ts`.
 *
 * (Critical Gaps — Issue 03; shared so it is not rebuilt per product.)
 */
export function DocumentViewer({
  fileUrl,
  fileName,
  allowDownload = false,
  height = "750px",
  className,
}: DocumentViewerProps) {
  const t = useTranslations("documents");
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [hasError, setHasError] = useState(false);

  const onLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setNumPages(total);
      setHasError(false);
    },
    []
  );

  const goToPrevious = useCallback(
    () => setPageNumber((page) => Math.max(1, page - 1)),
    []
  );
  const goToNext = useCallback(
    () => setPageNumber((page) => Math.min(numPages || 1, page + 1)),
    [numPages]
  );
  const zoomIn = useCallback(
    () => setScale((value) => Math.min(MAX_SCALE, value + SCALE_STEP)),
    []
  );
  const zoomOut = useCallback(
    () => setScale((value) => Math.max(MIN_SCALE, value - SCALE_STEP)),
    []
  );
  const onLoadError = useCallback(
    (error: Error) => {
      logger.error("Document load failed", {
        context: "DocumentViewer",
        data: {
          fileName,
          error: error.message,
        },
      });
      setHasError(true);
    },
    [fileName]
  );

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-card",
        className
      )}
      style={{ height }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <span
          className="truncate text-sm font-medium text-foreground"
          title={fileName}
        >
          {fileName}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={goToPrevious}
            disabled={pageNumber <= 1}
            aria-label={t("previousPage")}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-16 text-center text-xs text-muted-foreground">
            {numPages ? `${pageNumber} / ${numPages}` : "—"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={goToNext}
            disabled={!numPages || pageNumber >= numPages}
            aria-label={t("nextPage")}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            aria-label={t("zoomOut")}
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            aria-label={t("zoomIn")}
          >
            <ZoomIn className="size-4" />
          </Button>
          {allowDownload ? (
            <a
              href={fileUrl}
              download={fileName}
              rel="noopener"
              aria-label={t("download")}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" })
              )}
            >
              <Download className="size-4" />
            </a>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted/20 p-4">
        {hasError ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-destructive">
            <FileWarning className="size-6" aria-hidden />
            <p className="text-sm">{t("loadError")}</p>
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={onLoadSuccess}
            onLoadError={onLoadError}
            onSourceError={onLoadError}
            loading={LoadingState}
            className="flex justify-center"
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderAnnotationLayer
              renderTextLayer
            />
          </Document>
        )}
      </div>
    </div>
  );
}
