import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Sparkles, Waves, Scissors, Type, Send, Gauge, ArrowRight } from "lucide-react";

import heroImage from "@/assets/hero-clipmind.jpg";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_TAGLINE, PLANS } from "@/constants/app";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClipMind AI — Turn long videos into viral shorts" },
      {
        name: "description",
        content:
          "ClipMind AI transcribes your long-form video, finds the moments most likely to go viral, reframes them vertically and ships animated subtitles for TikTok, Reels and Shorts.",
      },
      { property: "og:title", content: "ClipMind AI — Turn long videos into viral shorts" },
      {
        property: "og:description",
        content: "ClipMind AI transcribes your long-form video, finds the moments most likely to go viral, reframes them vertically and ships animated subtitles for TikTok, Reels and Shorts.",
      },
    ],
  }),
  component: Landing,
});

const PIPELINE = [
  { icon: Waves, title: "Transcribe", copy: "Word-level timestamps and speaker labels from any provider you plug in." },
  { icon: Sparkles, title: "Find the gold", copy: "The AI module scores hooks, loops, emotion and curiosity across the transcript." },
  { icon: Scissors, title: "Reframe vertically", copy: "9:16 clips with speaker-aware framing and clean cut points." },
  { icon: Type, title: "Animate subtitles", copy: "Karaoke, pop, typewriter — styled with your brand kit." },
  { icon: Send, title: "Ship everywhere", copy: "Captions, hashtags, SEO titles and pinned comments per platform." },
  { icon: Gauge, title: "Track the queue", copy: "Every stage is a job with retries, progress and live status." },
];

function Landing() {
  const { isAuthenticated } = useAuth();
  const primaryTo = isAuthenticated ? "/dashboard" : "/auth";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="size-4" />
          </span>
          <span className="font-display text-base font-semibold tracking-tight">{APP_NAME}</span>
        </div>
        <Button asChild variant={isAuthenticated ? "default" : "outline"} size="sm">
          <Link to={primaryTo}>{isAuthenticated ? "Open workspace" : "Sign in"}</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            AI video repurposing pipeline
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            One long video in.{" "}
            <span className="text-gradient">Twenty scroll-stopping shorts</span> out.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground">{APP_TAGLINE}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={primaryTo}>
                Start repurposing <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className="mt-14 overflow-hidden rounded-3xl border border-border bg-surface"
        >
          <img
            src={heroImage}
            alt="A long-form video timeline being split into three vertical short-form clips"
            width={1600}
            height={1008}
            className="w-full"
          />
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          The whole pipeline, one queue
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PIPELINE.map((step) => (
            <div key={step.title} className="surface-panel p-5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
                <step.icon className="size-4" />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{step.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Pricing</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.tier}
              className={
                plan.highlighted
                  ? "rounded-2xl border border-primary/50 bg-surface p-5 shadow-[0_0_40px_-20px_var(--lilac)]"
                  : "surface-panel p-5"
              }
            >
              <p className="font-display text-sm font-semibold">{plan.name}</p>
              <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{plan.price}</p>
              <p className="text-xs text-muted-foreground">{plan.cadence}</p>
              <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="text-muted-foreground">
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-5 py-8">
        <p className="mx-auto max-w-6xl text-xs text-muted-foreground">
          {APP_NAME} — AI video repurposing for creators.
        </p>
      </footer>
    </div>
  );
}
