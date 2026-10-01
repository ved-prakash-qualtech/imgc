export { Badge } from "@imgc/ui/shared/Badge";
export { Image, type SharedImageProps } from "@imgc/ui/shared/Image";
export { Modal } from "@imgc/ui/shared/Modal";
export { TenantProvider, useTenant } from "@imgc/ui/shared/TenantProvider";
export { WidgetErrorBoundary } from "@imgc/ui/shared/WidgetErrorBoundary";

// DocumentViewer is intentionally NOT re-exported here: it pulls in react-pdf /
// pdfjs-dist, so import it directly from "@imgc/ui/shared/DocumentViewer"
// only where needed to keep it out of unrelated (and server) bundles.
