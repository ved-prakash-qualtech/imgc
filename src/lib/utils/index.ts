/**
 * The barrel the identity-control components resolve `@/lib/utils` to.
 *
 * <p>Those components are copied verbatim from identity-portal-web-app so the two consoles stay
 * visually identical, and they import `cn` from `@/lib/utils` while this project keeps it in
 * `@/lib/utils/twMergeUtils`. A barrel rather than rewriting the imports: the next component
 * copied from the portal should paste in unchanged, and every edit made to make one "fit" is an
 * edit someone has to make again and a chance for the two to drift.
 */
export { cn } from "@/lib/utils/twMergeUtils";
