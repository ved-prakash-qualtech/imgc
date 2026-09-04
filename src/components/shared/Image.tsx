"use client";

import NextImage, { type ImageProps } from "next/image";
import { useCallback, useState, type SyntheticEvent } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/twMergeUtils";

export type SharedImageProps = Readonly<
  Omit<ImageProps, "priority"> & {
    /** Show skeleton until `onLoad`. Default: `true`. */
    showSkeleton?: boolean;
    /** Custom node when the image fails to load. */
    fallback?: React.ReactNode;
  }
>;

type DefaultImageFallbackProps = Readonly<{
  alt: string;
  fill?: boolean;
}>;

/** 1×1 transparent GIF — keeps a valid `src` when the primary image fails. */
const TRANSPARENT_PIXEL_DATA_URI =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function DefaultImageFallback({ alt, fill }: DefaultImageFallbackProps) {
  return (
    <NextImage
      alt={alt}
      src={TRANSPARENT_PIXEL_DATA_URI}
      fill={fill}
      width={fill ? undefined : 8}
      height={fill ? undefined : 8}
      unoptimized
      className={cn(
        "rounded-md bg-muted/30 object-cover",
        !fill && "min-h-8 min-w-8"
      )}
    />
  );
}

export function Image({
  showSkeleton = true,
  fallback,
  preload: preloadProp,
  fill,
  sizes,
  alt,
  onLoad,
  onError,
  className,
  loading,
  ...rest
}: SharedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const preload = preloadProp ?? false;
  const resolvedSizes = sizes ?? (fill ? "100vw" : undefined);
  const resolvedLoading = preload ? undefined : (loading ?? "lazy");

  const handleLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement, Event>) => {
      setIsLoading(false);
      onLoad?.(event);
    },
    [onLoad]
  );

  const handleError = useCallback(
    (event: SyntheticEvent<HTMLImageElement, Event>) => {
      setIsLoading(false);
      setHasError(true);
      onError?.(event);
    },
    [onError]
  );

  if (hasError) {
    const errorContent = fallback ?? (
      <DefaultImageFallback alt={alt} fill={fill} />
    );

    if (fill) {
      return <div className="relative size-full">{errorContent}</div>;
    }

    return <div className="relative inline-block">{errorContent}</div>;
  }

  const nextImage = (
    <NextImage
      alt={alt}
      fill={fill}
      sizes={resolvedSizes}
      preload={preload || undefined}
      loading={resolvedLoading}
      className={className}
      onLoad={handleLoad}
      onError={handleError}
      {...rest}
    />
  );

  const showSkeletonOverlay = showSkeleton && isLoading;

  if (fill) {
    return (
      <div className="relative size-full">
        {showSkeletonOverlay && (
          <Skeleton className="absolute inset-0 z-10" aria-hidden />
        )}
        {nextImage}
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      {showSkeletonOverlay && (
        <Skeleton
          className={cn("absolute inset-0 z-10", className)}
          aria-hidden
        />
      )}
      {nextImage}
    </div>
  );
}
