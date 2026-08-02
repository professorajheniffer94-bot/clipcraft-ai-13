import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_authenticated/brand")({
  head: () => ({
    meta: [
      { title: "Brand kit — ClipMind AI" },
      { name: "description", content: "Fonts, colours, logo and watermark applied to every export." },
      { property: "og:title", content: "Brand kit — ClipMind AI" },
      { property: "og:description", content: "Fonts, colours, logo and watermark applied to every export." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="Brand kit" description="Fonts, colours, logo and watermark applied to every export." />
      <div className="surface-panel p-6 text-sm text-muted-foreground">
        This workspace section is wired to your account and ready for the next build step.
      </div>
    </>
  );
}
