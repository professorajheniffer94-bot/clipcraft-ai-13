import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — ClipMind AI" },
      { name: "description", content: "Plan, credits and usage history." },
      { property: "og:title", content: "Billing — ClipMind AI" },
      { property: "og:description", content: "Plan, credits and usage history." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="Billing" description="Plan, credits and usage history." />
      <div className="surface-panel p-6 text-sm text-muted-foreground">
        This workspace section is wired to your account and ready for the next build step.
      </div>
    </>
  );
}
