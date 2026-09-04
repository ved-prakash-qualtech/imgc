import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DocumentViewer } from "@/components/shared/DocumentViewer";

const SAMPLE_PDF_URL =
  "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf";

const meta = {
  title: "Shared/DocumentViewer",
  component: DocumentViewer,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    fileUrl: SAMPLE_PDF_URL,
    fileName: "sample-loan-agreement.pdf",
    allowDownload: false,
    height: "32rem",
  },
} satisfies Meta<typeof DocumentViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDownload: Story = {
  args: {
    allowDownload: true,
  },
};

export const Compact: Story = {
  args: {
    height: "20rem",
  },
};

export const LoadError: Story = {
  args: {
    fileUrl: "https://invalid.example/broken-document.pdf",
    fileName: "missing-document.pdf",
  },
};
