import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Image } from "@/components/shared/Image";

describe("Image", () => {
  it("renders with required alt", () => {
    render(<Image src="/logo.svg" alt="App logo" width={120} height={40} />);

    expect(screen.getByRole("img", { name: "App logo" })).toBeInTheDocument();
  });

  it("shows skeleton before load and hides after load", () => {
    const { container } = render(
      <Image src="/logo.svg" alt="App logo" width={120} height={40} />
    );

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();

    fireEvent.load(screen.getByRole("img", { name: "App logo" }));

    expect(
      container.querySelector('[aria-hidden="true"]')
    ).not.toBeInTheDocument();
  });

  it("renders default fallback on error", () => {
    render(
      <Image src="/broken.jpg" alt="Broken image" width={120} height={40} />
    );

    fireEvent.error(screen.getByRole("img", { name: "Broken image" }));

    expect(screen.getAllByRole("img", { name: "Broken image" })).toHaveLength(
      1
    );
    expect(screen.getByRole("img", { name: "Broken image" })).toHaveClass(
      "bg-muted/30"
    );
  });

  it("forwards preload to next/image", () => {
    render(
      <Image
        src="/banner.jpg"
        alt="Banner"
        width={800}
        height={400}
        preload
        showSkeleton={false}
      />
    );

    const img = screen.getByRole("img", { name: "Banner" });
    expect(img).toHaveAttribute("data-preload", "true");
  });
});
