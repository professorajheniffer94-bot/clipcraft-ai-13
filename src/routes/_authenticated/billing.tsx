import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { billingApi, profilesApi } from "@/api/queries";
import { PLANS } from "@/constants/app";
import { formatBytes, relativeTime } from "@/utils/format";

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
  const profile = useQuery({ queryKey: ["profile"], queryFn: profilesApi.me });
  const subscription = useQuery({ queryKey: ["subscription"], queryFn: billingApi.subscription });
  const usage = useQuery({ queryKey: ["usage"], queryFn: billingApi.usage });

  const currentPlan = subscription.data?.plan ?? profile.data?.plan ?? "free";
  const storageUsed = profile.data?.storage_used_bytes ?? 0;
  const storageLimit = profile.data?.storage_limit_bytes ?? 1;

  return (
    <>
      <PageHeader title="Billing" description="Plan, credits and usage history." />

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="surface-panel p-5">
          <p className="text-sm text-muted-foreground">Current plan</p>
          <p className="mt-1 font-display text-2xl font-semibold capitalize">{currentPlan}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {profile.data?.credits_remaining ?? 0} credits remaining
          </p>
          {subscription.data?.current_period_end ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Renews {relativeTime(subscription.data.current_period_end)}
            </p>
          ) : null}
        </div>
        <div className="surface-panel p-5">
          <p className="text-sm text-muted-foreground">Storage</p>
          <p className="mt-1 font-display text-2xl font-semibold">{formatBytes(storageUsed)}</p>
          <Progress
            value={Math.min(100, (storageUsed / Math.max(storageLimit, 1)) * 100)}
            className="mt-3 h-1.5"
          />
          <p className="mt-2 text-xs text-muted-foreground">of {formatBytes(storageLimit)} included</p>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const active = plan.tier === currentPlan;
          return (
            <div
              key={plan.tier}
              className={`surface-panel flex flex-col p-5 ${active ? "ring-1 ring-primary" : ""}`}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">{plan.name}</h2>
                {active ? <Badge variant="secondary">Current</Badge> : null}
              </div>
              <p className="mt-2 font-display text-2xl font-semibold">{plan.price}</p>
              <p className="text-xs text-muted-foreground">{plan.cadence}</p>
              <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className="mt-5" variant={active ? "secondary" : "default"} disabled={active}>
                {active ? "Active plan" : "Upgrade"}
              </Button>
            </div>
          );
        })}
      </section>

      <section className="surface-panel mt-8 p-5">
        <h2 className="font-display text-base font-semibold">Usage history</h2>
        {usage.data && usage.data.length > 0 ? (
          <ul className="mt-4 divide-y divide-border text-sm">
            {usage.data.map((event) => (
              <li key={event.id} className="flex items-center justify-between py-3">
                <span className="capitalize">{event.event_type.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">
                  {event.credits_used} credits · {relativeTime(event.created_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No credit usage yet. Import and process a video to see activity here.
          </p>
        )}
      </section>
    </>
  );
}
