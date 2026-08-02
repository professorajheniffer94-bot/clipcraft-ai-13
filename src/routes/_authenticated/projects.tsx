import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projects — ClipMind AI" },
      { name: "description", content: "Group videos and clips per client or channel." },
      { property: "og:title", content: "Projects — ClipMind AI" },
      { property: "og:description", content: "Group videos and clips per client or channel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="Projects" description="Group videos and clips per client or channel." />
      <div className="surface-panel p-6 text-sm text-muted-foreground">
        This workspace section is wired to your account and ready for the next build step.
      </div>
    </>
  );
}
