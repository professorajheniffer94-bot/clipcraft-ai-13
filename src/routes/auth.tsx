import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle } from "@/hooks/useAuth";
import { signInSchema, signUpSchema, forgotPasswordSchema } from "@/utils/validation";
import { APP_NAME } from "@/constants/app";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search['redirect'] === "string" ? (search['redirect'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — ClipMind AI" },
      { name: "description", content: "Sign in to ClipMind AI to turn long videos into short-form clips." },
      { property: "og:title", content: "Sign in — ClipMind AI" },
      { property: "og:description", content: "Access your AI video repurposing workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function safePath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const destination = safePath(search.redirect);
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: destination, replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate({ to: destination, replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [destination, navigate]);

  async function handleSignIn() {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    setBusy("signin");
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(null);
    if (error) toast.error(error.message);
  }

  async function handleSignUp() {
    const parsed = signUpSchema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    setBusy("signup");
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}${destination}`,
        data: { full_name: parsed.data.fullName },
      },
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) setPendingConfirm(true);
  }

  async function handleReset() {
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    setBusy("reset");
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password reset link sent");
  }

  async function handleGoogle() {
    setBusy("google");
    const result = await signInWithGoogle();
    if (result.error) {
      setBusy(null);
      toast.error(result.error);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r border-border bg-surface p-10 lg:flex">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="size-4" />
          </span>
          <span className="font-display text-base font-semibold">{APP_NAME}</span>
        </Link>
        <div className="max-w-sm">
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight">
            One upload. <span className="text-gradient">Twenty shorts.</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Transcription, viral-moment detection, vertical reframing and animated subtitles run as one
            pipeline. You pick what ships.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Built for creators publishing every single day.</p>
      </div>

      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          {pendingConfirm ? (
            <div className="surface-panel p-6 text-center">
              <h1 className="font-display text-xl font-semibold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to {email}. Confirm it to finish creating your account.
              </p>
              <Button variant="ghost" className="mt-4" onClick={() => setPendingConfirm(false)}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="signin">
              <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign in to keep repurposing your library.
              </p>

              <Button
                variant="outline"
                className="mt-6 w-full gap-2"
                onClick={handleGoogle}
                disabled={busy !== null}
              >
                {busy === "google" ? <Loader2 className="size-4 animate-spin" /> : null}
                Continue with Google
              </Button>

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>

              <TabsList className="w-full">
                <TabsTrigger value="signin" className="flex-1">
                  Sign in
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">
                  Create account
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={handleSignIn} disabled={busy !== null}>
                  {busy === "signin" ? <Loader2 className="size-4 animate-spin" /> : null} Sign in
                </Button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Forgot your password?
                </button>
              </TabsContent>

              <TabsContent value="signup" className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-up">Email</Label>
                  <Input
                    id="email-up"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-up">Password</Label>
                  <Input
                    id="password-up"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={handleSignUp} disabled={busy !== null}>
                  {busy === "signup" ? <Loader2 className="size-4 animate-spin" /> : null} Create account
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}