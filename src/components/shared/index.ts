export { Badge } from "@/components/shared/Badge";
export { Image, type SharedImageProps } from "@/components/shared/Image";
export { Modal } from "@/components/shared/Modal";
export { TenantProvider, useTenant } from "@/components/shared/TenantProvider";
export { WidgetErrorBoundary } from "@/components/shared/WidgetErrorBoundary";

// DocumentViewer is intentionally NOT re-exported here: it pulls in react-pdf /
// pdfjs-dist, so import it directly from "@/components/shared/DocumentViewer"
// only where needed to keep it out of unrelated (and server) bundles.
