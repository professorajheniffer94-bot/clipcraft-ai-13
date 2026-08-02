import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Library — ClipMind AI" },
      { name: "description", content: "Every video you have imported, with pipeline status." },
      { property: "og:title", content: "Library — ClipMind AI" },
      { property: "og:description", content: "Every video you have imported, with pipeline status." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="Library" description="Every video you have imported, with pipeline status." />
      <div className="surface-panel p-6 text-sm text-muted-foreground">
        This workspace section is wired to your account and ready for the next build step.
      </div>
    </>
  );
}
