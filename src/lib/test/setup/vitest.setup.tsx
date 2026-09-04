import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import React from "react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  redirect: vi.fn(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  getPathname: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: function NextImageMock(
    props: React.ImgHTMLAttributes<HTMLImageElement> & {
      alt: string;
      priority?: boolean;
      preload?: boolean;
    }
  ) {
    const { alt, priority, preload, ...rest } = props;
    void priority;

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt} data-preload={preload ? "true" : "false"} {...rest} />
    );
  },
}));
