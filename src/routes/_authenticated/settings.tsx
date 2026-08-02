import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ClipMind AI" },
      { name: "description", content: "Profile, defaults and subtitle preferences." },
      { property: "og:title", content: "Settings — ClipMind AI" },
      { property: "og:description", content: "Profile, defaults and subtitle preferences." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="Settings" description="Profile, defaults and subtitle preferences." />
      <div className="surface-panel p-6 text-sm text-muted-foreground">
        This workspace section is wired to your account and ready for the next build step.
      </div>
    </>
  );
}
